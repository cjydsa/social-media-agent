import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ApiRequestError } from "../backend/api/errors.js";
import type {
  UploadedFile,
  UploadFilesRequest,
} from "../backend/dto/schemas.js";

export const MAX_UPLOAD_FILES = 5;
export const MAX_UPLOAD_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_UPLOAD_BODY_BYTES = 32 * 1024 * 1024;

const EXTENSION_BY_MEDIA_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

function sniffMediaType(bytes: Buffer): string | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38
  ) {
    return "image/gif";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export interface UploadStorage {
  save(files: UploadFilesRequest["files"]): Promise<UploadedFile[]>;
}

export class LocalUploadStorage implements UploadStorage {
  readonly #directory: string;

  constructor(directory: string) {
    const resolved = path.resolve(directory);
    const root = process.cwd();
    if (!resolved.startsWith(root)) {
      throw new Error(
        `Upload directory must stay inside the repository: ${directory}`,
      );
    }
    this.#directory = resolved;
  }

  get directory(): string {
    return this.#directory;
  }

  async save(files: UploadFilesRequest["files"]): Promise<UploadedFile[]> {
    if (files.length > MAX_UPLOAD_FILES) {
      throw new ApiRequestError(
        "VALIDATION_ERROR",
        `At most ${MAX_UPLOAD_FILES} files per upload.`,
        400,
      );
    }

    await mkdir(this.#directory, { recursive: true });
    const saved: UploadedFile[] = [];

    for (const file of files) {
      let bytes: Buffer;
      try {
        bytes = Buffer.from(file.dataBase64, "base64");
      } catch {
        throw new ApiRequestError(
          "VALIDATION_ERROR",
          `File ${file.fileName} is not valid base64.`,
          400,
        );
      }
      if (bytes.length === 0) {
        throw new ApiRequestError(
          "VALIDATION_ERROR",
          `File ${file.fileName} is empty.`,
          400,
        );
      }
      if (bytes.length > MAX_UPLOAD_FILE_BYTES) {
        throw new ApiRequestError(
          "PAYLOAD_TOO_LARGE",
          `File ${file.fileName} exceeds the 5MB limit.`,
          413,
          { maxBytes: MAX_UPLOAD_FILE_BYTES, fileName: file.fileName },
        );
      }

      const sniffed = sniffMediaType(bytes);
      if (!sniffed || sniffed !== file.mediaType) {
        throw new ApiRequestError(
          "UNSUPPORTED_MEDIA_TYPE",
          `File ${file.fileName} content does not match declared media type.`,
          415,
          { declared: file.mediaType, detected: sniffed ?? "unknown" },
        );
      }

      const extension = EXTENSION_BY_MEDIA_TYPE[file.mediaType] ?? "bin";
      const storedName = `${Date.now()}-${randomBytes(8).toString("hex")}.${extension}`;
      await writeFile(path.join(this.#directory, storedName), bytes);
      saved.push({
        url: `/uploads/${storedName}`,
        fileName: file.fileName,
        size: bytes.length,
        mediaType: file.mediaType,
      });
    }

    return saved;
  }
}
