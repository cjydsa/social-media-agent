import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { LLMConfig } from "../../config/types.js";
import type { Severity } from "../schemas/common.js";
import {
  EvidenceItemSchema,
  type EvidenceItem,
} from "../schemas/review-result.js";

export const VisualAnalysisResultSchema = z.strictObject({
  ocrText: z.string(),
  sceneDescription: z.string(),
  visualElements: z.array(z.string()),
  riskObservations: z.array(
    z.strictObject({
      observation: z.string(),
      severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    }),
  ),
  brandSafety: z.enum(["PASS", "WARN", "BLOCK"]),
  brandSafetyReason: z.string(),
});
export type VisualAnalysisResult = z.infer<typeof VisualAnalysisResultSchema>;

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

export class VisualAnalysisError extends Error {
  constructor(
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "VisualAnalysisError";
  }
}

export interface QwenVisualAnalyzerOptions {
  llm: LLMConfig;
  /** Local directory backing /uploads/* URLs. */
  uploadDir: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  /** Max images per batch call (default 9, per typical VLM limits). */
  maxImages?: number;
}

/**
 * Calls a Qwen vision model (e.g. qwen-vl-plus) through the DashScope
 * OpenAI-compatible endpoint. Local upload files are inlined as base64
 * data URLs; image bytes never leave the server except to the configured
 * provider endpoint.
 */
export class QwenVisualAnalyzer {
  readonly #options: Required<QwenVisualAnalyzerOptions>;

  constructor(options: QwenVisualAnalyzerOptions) {
    this.#options = {
      fetchFn: options.fetchFn ?? fetch,
      timeoutMs: options.timeoutMs ?? 45_000,
      maxImages: 9,
      ...options,
    };
  }

  async analyze(imageUrl: string): Promise<VisualAnalysisResult> {
    const dataUrl = await this.#toDataUrl(imageUrl);
    return this.#sendToVision({ messages: [dataUrl] });
  }

  /**
   * Batch-analyze images. For small batches (≤maxImages), sends a single
   * multi-image call for better context awareness. Returns one combined
   * analysis covering all images.
   */
  async analyzeBatch(imageUrls: string[]): Promise<VisualAnalysisResult[]> {
    if (imageUrls.length === 0) return [];
    const urls = imageUrls.slice(0, this.#options.maxImages);
    const dataUrls = await Promise.all(urls.map((url) => this.#toDataUrl(url)));
    return [await this.#sendToVision({ messages: dataUrls })];
  }

  async #sendToVision(options: { messages: string[] }): Promise<VisualAnalysisResult> {
    const { messages } = options;
    const baseUrl = this.#options.llm.baseUrl;
    const apiKey = this.#options.llm.apiKey;
    const model = this.#options.llm.model;
    if (!baseUrl || !apiKey?.isConfigured() || !model) {
      throw new VisualAnalysisError(
        "Vision provider is not fully configured (baseUrl/key/model).",
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#options.timeoutMs);
    const isMultiImage = messages.length > 1;
    try {
      const response = await this.#options.fetchFn(
        `${baseUrl.replace(/\/$/, "")}/chat/completions`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${apiKey.unwrap()}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "system",
                content: isMultiImage
                  ? "你是企业公网内容审核的图片素材分析员。一次性分析所有传入的图片，综合识别每张图的 OCR 文字、画面要素与视觉风险，输出 JSON 字段：ocrText（多图合并的文字摘要，按图分组标注「图N：…」）、sceneDescription（多图的共同场景描述或主要意图说明）、visualElements（多图共现的要素列表）、riskObservations[{observation,severity}]（跨图综合观察，最多 3 条）、brandSafety(PASS/WARN/BLOCK)、brandSafetyReason。OCR 不确定的字符用 □，不得编造，不识别或猜测人物身份。"
                  : "你是企业公网内容审核的图片素材分析员。只输出 JSON，字段：ocrText、sceneDescription、visualElements、riskObservations[{observation,severity}]、brandSafety(PASS/WARN/BLOCK)、brandSafetyReason。OCR 不确定的字符用 □，不得编造，不识别或猜测人物身份。",
              },
              {
                role: "user",
                content: isMultiImage
                  ? [
                      {
                        type: "text",
                        text: "依次分析这几张将与文案一起发布的图片素材，识别每张图片的 OCR 文字与视觉要素，综合判断品牌安全与风险。",
                      },
                      ...messages.map((url) => ({
                        type: "image_url",
                        image_url: { url },
                      })),
                    ]
                  : [
                      {
                        type: "text",
                        text: "分析这张将与文案一起发布的图片素材，识别文字、画面要素与视觉风险。",
                      },
                      { type: "image_url", image_url: { url: messages[0] } },
                    ],
              },
            ],
            response_format: { type: "json_object" },
          }),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        throw new VisualAnalysisError(
          `Vision provider returned HTTP ${response.status}.`,
          response.status >= 500,
        );
      }
      const body = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const text = body.choices?.[0]?.message?.content;
      if (!text) {
        throw new VisualAnalysisError("Vision provider returned empty content.");
      }
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(text);
      } catch {
        throw new VisualAnalysisError("Vision provider output is not JSON.");
      }
      const parsed = VisualAnalysisResultSchema.safeParse(parsedJson);
      if (!parsed.success) {
        throw new VisualAnalysisError(
          "Vision provider output failed schema validation.",
        );
      }
      return parsed.data;
    } catch (error) {
      if (error instanceof VisualAnalysisError) throw error;
      const message = error instanceof Error ? error.message : "unknown error";
      throw new VisualAnalysisError(
        /abort|timeout/i.test(message)
          ? "Vision provider request timed out."
          : `Vision provider request failed: ${message}`,
        true,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  async #toDataUrl(imageUrl: string): Promise<string> {
    const fileName = path.basename(imageUrl);
    const extension = path.extname(fileName).toLowerCase();
    const mime = MIME_BY_EXT[extension];
    if (!mime) {
      throw new VisualAnalysisError(
        `Unsupported image extension for vision analysis: ${extension}`,
      );
    }
    const filePath = path.join(this.#options.uploadDir, fileName);
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(this.#options.uploadDir))) {
      throw new VisualAnalysisError("Image path escapes the upload directory.");
    }
    const bytes = await readFile(resolved);
    return `data:${mime};base64,${bytes.toString("base64")}`;
  }
}

let visionSequence = 0;

/** Convert per-image analysis results into MULTIMODAL_EVIDENCE items. */
export function visionEvidenceItems(
  analyses: VisualAnalysisResult[],
): EvidenceItem[] {
  return analyses.map((analysis) => {
    visionSequence += 1;
    const topRisk: Severity | null =
      analysis.riskObservations.length > 0
        ? analysis.riskObservations.reduce((a, b) =>
            severityRank(b.severity) > severityRank(a.severity) ? b : a,
          ).severity
        : null;
    const parts = [
      analysis.sceneDescription,
      analysis.ocrText ? `图中文字：${analysis.ocrText}` : null,
      analysis.visualElements.length > 0
        ? `画面要素：${analysis.visualElements.join("、")}`
        : null,
      analysis.riskObservations.length > 0
        ? `视觉风险：${analysis.riskObservations
            .map((risk) => `[${risk.severity}] ${risk.observation}`)
            .join("；")}`
        : "未发现明显视觉风险。",
      `品牌安全：${analysis.brandSafety}（${analysis.brandSafetyReason}）`,
    ].filter(Boolean);
    return EvidenceItemSchema.parse({
      id: `vision-ev-${String(visionSequence).padStart(3, "0")}`,
      sourceType: "IMAGE",
      title: `图片素材分析（${analysis.brandSafety}${topRisk ? `，最高风险 ${topRisk}` : ""}）`,
      content: parts.join("\n"),
      source: "qwen-vision",
      score: null,
    });
  });
}

function severityRank(severity: Severity): number {
  return { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 }[severity];
}
