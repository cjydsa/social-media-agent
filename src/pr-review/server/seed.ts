import type { ReviewActor } from "../algorithm/index.js";
import type { ReviewOrchestrationService } from "../backend/services/orchestration.js";
import type { LocalUploadStorage } from "./uploads.js";

const DEMO_ACTOR: ReviewActor = {
  id: "usr_demo_requester",
  displayName: "演示需求方",
  role: "REQUESTER",
};

// 1x1 brand-blue PNG used only for demo seeding (synthetic asset).
const DEMO_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

interface DemoCaseInput {
  contentType:
    | "SOCIAL_POST"
    | "PRESS_RELEASE"
    | "PRODUCT_LAUNCH"
    | "BRAND_CAMPAIGN"
    | "EXTERNAL_RESPONSE"
    | "MULTIMODAL_POST";
  targetPlatform: string[];
  content: string;
  withImage?: boolean;
}

const DEMO_CASES: DemoCaseInput[] = [
  {
    contentType: "SOCIAL_POST",
    targetPlatform: ["WEIBO", "XIAOHONGSHU"],
    content:
      "【演示数据 synthetic】我们的新一代智能手表今天正式开售，欢迎大家到官方旗舰店体验。",
  },
  {
    contentType: "MULTIMODAL_POST",
    targetPlatform: ["WEIBO"],
    content:
      "【演示数据 synthetic】春季新品发布会将于 4 月 18 日在上海举行，配图为主题海报，欢迎预约直播。",
    withImage: true,
  },
  {
    contentType: "EXTERNAL_RESPONSE",
    targetPlatform: ["WEIBO", "DOUYIN"],
    content:
      "【演示数据 synthetic】[scenario:multi-risk] 关于昨晚的服务中断，我们认为友商的攻击才是根本原因，用户不应当质疑我们的稳定性，我们的系统性能行业领先。",
  },
  {
    contentType: "PRODUCT_LAUNCH",
    targetPlatform: ["BILIBILI"],
    content:
      "【演示数据 synthetic】[scenario:product-risk] 全新充电宝支持 200W 快充，3 分钟充满一部手机，绝对是市面上最快的产品。",
  },
  {
    contentType: "PRESS_RELEASE",
    targetPlatform: ["WEIBO"],
    content:
      "【演示数据 synthetic】[scenario:missing-evidence] 我司宣布下一代平台将支持全面自动化能力，具体细节稍后公布。",
  },
];

export async function seedDemoData(input: {
  orchestration: ReviewOrchestrationService;
  uploadStorage: LocalUploadStorage;
  hasExistingCases: boolean;
}): Promise<number> {
  if (input.hasExistingCases) return 0;

  let created = 0;
  for (const demoCase of DEMO_CASES) {
    const imageUrls: string[] = [];
    if (demoCase.withImage) {
      const saved = await input.uploadStorage.save([
        {
          fileName: "demo-launch-poster.png",
          mediaType: "image/png",
          dataBase64: DEMO_PNG_BASE64,
        },
      ]);
      imageUrls.push(...saved.map((file) => file.url));
    }

    await input.orchestration.createReview(
      {
        contentType: demoCase.contentType,
        targetPlatform: demoCase.targetPlatform,
        content: demoCase.content,
        imageUrls,
        sourceUrls: [],
      },
      DEMO_ACTOR,
    );
    created += 1;
  }
  return created;
}
