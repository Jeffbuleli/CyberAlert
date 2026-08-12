import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export type SafefindR2Config = {
  accountId: string;
  bucket: string;
  publicBaseUrl: string;
  accessKeyId: string;
  secretAccessKey: string;
};

export function safefindR2Configured(): boolean {
  return Boolean(getSafefindR2Config());
}

export function getSafefindR2Config(): SafefindR2Config | null {
  const accountId = process.env.SAFEFIND_R2_ACCOUNT_ID?.trim();
  const bucket = process.env.SAFEFIND_R2_BUCKET?.trim();
  const publicBaseUrl = process.env.SAFEFIND_R2_PUBLIC_BASE_URL?.trim();
  const accessKeyId = process.env.SAFEFIND_R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.SAFEFIND_R2_SECRET_ACCESS_KEY?.trim();
  if (!accountId || !bucket || !publicBaseUrl || !accessKeyId || !secretAccessKey) {
    return null;
  }
  return {
    accountId,
    bucket,
    publicBaseUrl: publicBaseUrl.replace(/\/$/, ""),
    accessKeyId,
    secretAccessKey,
  };
}

function getClient(cfg: SafefindR2Config): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

export function safefindPreviewObjectKey(token: string): string {
  const now = new Date();
  const ym = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return `safefind/previews/${ym}/${token}.jpg`;
}

export function safefindPreviewPublicUrl(cfg: SafefindR2Config, objectKey: string): string {
  return `${cfg.publicBaseUrl}/${objectKey}`;
}

export async function putSafefindPreviewToR2(args: {
  token: string;
  body: Buffer;
}): Promise<string | null> {
  const cfg = getSafefindR2Config();
  if (!cfg) return null;
  const objectKey = safefindPreviewObjectKey(args.token);
  try {
    const client = getClient(cfg);
    await client.send(
      new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: objectKey,
        Body: args.body,
        ContentType: "image/jpeg",
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    return safefindPreviewPublicUrl(cfg, objectKey);
  } catch (e) {
    console.error("[safefind/r2] putObject failed", {
      key: objectKey,
      message: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}
