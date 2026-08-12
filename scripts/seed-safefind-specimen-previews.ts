/**
 * Generate redacted SafeFind specimen previews and upload to R2.
 *
 * Usage: tsx --env-file=.env scripts/seed-safefind-specimen-previews.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { defaultBlurRegions } from "../src/lib/safefind/id-scan/redact-regions";

type Specimen = {
  slug: string;
  documentType: "carte_electeur" | "passeport" | "permis_conduire";
  sourceFile: string;
};

const SPECIMENS: Specimen[] = [
  {
    slug: "carte-electeur",
    documentType: "carte_electeur",
    sourceFile: "carte-electeur-source.png",
  },
  {
    slug: "passeport",
    documentType: "passeport",
    sourceFile: "passeport-source.png",
  },
  {
    slug: "permis-conduire",
    documentType: "permis_conduire",
    sourceFile: "permis-conduire-source.png",
  },
];

const SOURCE_DIR = join(process.cwd(), "content", "safefind-specimens");

function getR2Client() {
  const accountId = process.env.SAFEFIND_R2_ACCOUNT_ID?.trim();
  const bucket = process.env.SAFEFIND_R2_BUCKET?.trim();
  const accessKeyId = process.env.SAFEFIND_R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.SAFEFIND_R2_SECRET_ACCESS_KEY?.trim();
  const publicBaseUrl = process.env.SAFEFIND_R2_PUBLIC_BASE_URL?.trim();
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey || !publicBaseUrl) {
    throw new Error("Missing SAFEFIND_R2_* env vars");
  }
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return {
    client,
    bucket,
    publicBaseUrl: publicBaseUrl.replace(/\/$/, ""),
  };
}

async function redactSpecimen(input: Buffer, documentType: Specimen["documentType"]) {
  const base = sharp(input).rotate();
  const meta = await base.metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (!w || !h) throw new Error("invalid_image");

  let current = sharp(input).rotate();
  const regions = defaultBlurRegions(documentType);

  for (const r of regions) {
    const left = Math.max(0, Math.round(r.x * w));
    const top = Math.max(0, Math.round(r.y * h));
    const width = Math.min(w - left, Math.max(1, Math.round(r.w * w)));
    const height = Math.min(h - top, Math.max(1, Math.round(r.h * h)));
    const blurred = await sharp(await current.toBuffer())
      .extract({ left, top, width, height })
      .blur(14)
      .toBuffer();
    current = sharp(await current.toBuffer()).composite([
      { input: blurred, left, top },
    ]);
  }

  return current.jpeg({ quality: 88, mozjpeg: true }).toBuffer();
}

async function main() {
  const { client, bucket, publicBaseUrl } = getR2Client();
  const uploaded: Record<string, string> = {};

  for (const s of SPECIMENS) {
    const path = join(SOURCE_DIR, s.sourceFile);
    if (!existsSync(path)) {
      throw new Error(`Missing source image: ${path}`);
    }
    const input = readFileSync(path);
    const body = await redactSpecimen(input, s.documentType);
    const key = `safefind/specimens/${s.slug}.jpg`;
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: "image/jpeg",
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    uploaded[s.slug] = `${publicBaseUrl}/${key}`;
    console.log(`UPLOADED ${s.slug} -> ${uploaded[s.slug]} (${body.length} bytes)`);
  }

  console.log("\nR2 specimen URLs:");
  console.log(JSON.stringify(uploaded, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
