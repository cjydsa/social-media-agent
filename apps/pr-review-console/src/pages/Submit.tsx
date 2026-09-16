import { useRef, useState, type DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type { ContentType } from "../api/types";
import { useActor } from "../context/ActorContext";
import {
  CONTENT_TYPE_LABELS,
  PLATFORM_LABELS,
  PLATFORMS,
} from "../utils/labels";
import { useToast } from "../components/Common";

const CONTENT_TYPES = Object.keys(CONTENT_TYPE_LABELS) as ContentType[];
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const MAX_FILE_MB = 5;

interface PendingImage {
  localId: string;
  file: File;
  previewUrl: string;
}

let imageSeq = 0;

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.readAsDataURL(file);
  });
}

export function Submit() {
  const { actor } = useActor();
  const navigate = useNavigate();
  const toast = useToast();

  const [contentType, setContentType] = useState<ContentType>("SOCIAL_POST");
  const [platforms, setPlatforms] = useState<string[]>(["WEIBO"]);
  const [content, setContent] = useState("");
  const [sourceUrls, setSourceUrls] = useState<string[]>([""]);
  const [images, setImages] = useState<PendingImage[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const togglePlatform = (platform: string) => {
    setPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((item) => item !== platform)
        : [...prev, platform],
    );
  };

  const addFiles = (files: FileList | File[]) => {
    const accepted = [...files].filter((file) => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast("error", `不支持的文件类型：${file.name}（仅 PNG/JPG/GIF/WebP）`);
        return false;
      }
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        toast(
          "error",
          `文件过大：${file.name}（单文件不超过 ${MAX_FILE_MB}MB）`,
        );
        return false;
      }
      return true;
    });

    setImages((prev) => {
      const remaining = 5 - prev.length;
      if (accepted.length > remaining) {
        toast("error", "最多上传 5 张图片");
      }
      const next = accepted.slice(0, Math.max(0, remaining)).map((file) => {
        imageSeq += 1;
        return {
          localId: `img_${imageSeq}`,
          file,
          previewUrl: URL.createObjectURL(file),
        };
      });
      return [...prev, ...next];
    });
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    addFiles(event.dataTransfer.files);
  };

  const removeImage = (localId: string) => {
    setImages((prev) => {
      const target = prev.find((item) => item.localId === localId);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.localId !== localId);
    });
  };

  const canSubmit =
    content.trim().length > 0 && platforms.length > 0 && !submitting;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      let imageUrls: string[] = [];
      if (images.length > 0) {
        const payload = await Promise.all(
          images.map(async (image) => ({
            fileName: image.file.name,
            mediaType: image.file.type,
            dataBase64: await readAsBase64(image.file),
          })),
        );
        const uploaded = await api.uploadFiles(actor, payload);
        imageUrls = uploaded.map((file) => file.url);
      }

      const detail = await api.createReview(actor, {
        contentType,
        targetPlatform: platforms,
        content: content.trim(),
        imageUrls,
        sourceUrls: sourceUrls.map((url) => url.trim()).filter(Boolean),
      });
      toast("success", "提交成功，AI 已完成五维审核");
      navigate(`/reviews/${detail.case.id}`);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? `${err.message}（${err.code}）`
          : err instanceof Error
            ? err.message
            : "提交失败";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 860 }}>
      <div className="topbar" style={{ marginBottom: 16 }}>
        <div>
          <h2>提交审核</h2>
          <div className="subtitle">
            上传文案与图片素材，五维 AI 多智能体将自动完成风险审核
          </div>
        </div>
      </div>

      <div className="card">
        <div className="field">
          <label>
            内容类型 <span className="required">*</span>
          </label>
          <div className="chip-group">
            {CONTENT_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                className={`chip ${contentType === type ? "selected" : ""}`}
                onClick={() => setContentType(type)}
              >
                {CONTENT_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>
            目标平台 <span className="required">*</span>（可多选）
          </label>
          <div className="chip-group">
            {PLATFORMS.map((platform) => (
              <button
                key={platform}
                type="button"
                className={`chip ${platforms.includes(platform) ? "selected" : ""}`}
                onClick={() => togglePlatform(platform)}
              >
                {PLATFORM_LABELS[platform]}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>
            审核文案 <span className="required">*</span>
          </label>
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="粘贴或撰写待审核的公关内容，例如新品发布帖、新闻稿、危机回应声明……"
          />
          <div className="char-count">{content.length} 字</div>
        </div>

        <div className="field">
          <label>图片素材（最多 5 张，单张 ≤ {MAX_FILE_MB}MB）</label>
          <div
            className={`upload-zone ${dragOver ? "dragover" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInput.current?.click()}
            role="button"
            tabIndex={0}
          >
            <div className="icon">🖼️</div>
            <p>点击选择或拖拽图片到此处</p>
            <small>支持 PNG / JPG / GIF / WebP，服务端将校验文件真实类型</small>
            <input
              ref={fileInput}
              type="file"
              accept={ACCEPTED_TYPES.join(",")}
              multiple
              hidden
              onChange={(event) => {
                if (event.target.files) addFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </div>
          {images.length > 0 && (
            <div className="upload-previews">
              {images.map((image) => (
                <div className="upload-preview" key={image.localId}>
                  <img src={image.previewUrl} alt={image.file.name} />
                  <button
                    className="remove"
                    onClick={() => removeImage(image.localId)}
                    title="移除"
                  >
                    ×
                  </button>
                  <div className="name">{image.file.name}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="field">
          <label>来源链接（选填，作为事实核查依据）</label>
          {sourceUrls.map((url, index) => (
            <div
              key={index}
              style={{ display: "flex", gap: 8, marginBottom: 8 }}
            >
              <input
                type="url"
                value={url}
                placeholder="https://…"
                onChange={(event) => {
                  const next = [...sourceUrls];
                  next[index] = event.target.value;
                  setSourceUrls(next);
                }}
              />
              <button
                type="button"
                className="btn ghost sm"
                onClick={() =>
                  setSourceUrls((prev) => prev.filter((_, i) => i !== index))
                }
                disabled={sourceUrls.length <= 1}
              >
                删除
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn sm"
            onClick={() => setSourceUrls((prev) => [...prev, ""])}
          >
            + 添加链接
          </button>
        </div>

        {error && (
          <div className="issue-item sev-HIGH" style={{ marginBottom: 16 }}>
            <div className="reason">{error}</div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            className="btn primary"
            disabled={!canSubmit}
            onClick={onSubmit}
          >
            {submitting ? "提交并审核中…" : "提交并立即审核"}
          </button>
        </div>
      </div>
    </div>
  );
}
