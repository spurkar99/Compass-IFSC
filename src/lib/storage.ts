// ---------------------------------------------------------------------------
// Where the JSON state physically lives.
//
// Two backends, chosen by one environment variable:
//
//   COMPASS_S3_BUCKET unset  ->  plain files in /data      (your laptop)
//   COMPASS_S3_BUCKET set    ->  objects in that S3 bucket (AWS Amplify)
//
// The reason for the second one: Amplify runs Next.js on Lambda, where the
// disk is read-only. Nothing else about the app changes — the shape of the
// data, the engine, and the reset behaviour are all identical either way.
//
// Reads that find nothing return null. The caller (store.ts) then falls back
// to the seed data compiled into the build, which is how a brand-new empty
// bucket still comes up showing the demo.
// ---------------------------------------------------------------------------

import { promises as fs } from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.join(process.cwd(), 'data');

function bucket(): string {
  return process.env.COMPASS_S3_BUCKET?.trim() ?? '';
}

function prefix(): string {
  const raw = process.env.COMPASS_S3_PREFIX?.trim() ?? 'state';
  return raw.replace(/^\/+|\/+$/g, '');
}

export function storageMode(): 'files' | 's3' {
  return bucket() ? 's3' : 'files';
}

/** Human-readable description of where state is being kept. For diagnostics. */
export function storageDescription(): string {
  return bucket() ? `s3://${bucket()}/${prefix()}/` : `${DATA_DIR}/`;
}

// The S3 client is created once per warm Lambda and imported dynamically, so a
// laptop running on files never loads the AWS SDK at all.
let cachedClient: unknown = null;

async function s3Client() {
  const { S3Client } = await import('@aws-sdk/client-s3');
  if (!cachedClient) {
    // No credentials are passed. On Amplify the SSR compute role supplies
    // them; locally the standard AWS credential chain does.
    cachedClient = new S3Client({ region: process.env.AWS_REGION?.trim() || 'us-east-1' });
  }
  return cachedClient as InstanceType<typeof S3Client>;
}

function keyFor(fileName: string): string {
  return `${prefix()}/${fileName}`;
}

/** Read a state file. Returns null if it does not exist yet or cannot be read. */
export async function readRaw(fileName: string): Promise<string | null> {
  if (!bucket()) {
    try {
      return await fs.readFile(path.join(DATA_DIR, fileName), 'utf8');
    } catch {
      return null;
    }
  }

  try {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const client = await s3Client();
    const response = await client.send(
      new GetObjectCommand({ Bucket: bucket(), Key: keyFor(fileName) }),
    );
    return (await response.Body?.transformToString('utf-8')) ?? null;
  } catch (error) {
    // A missing object is the normal case on a fresh bucket, and is silent.
    // Anything else is worth seeing in the logs, because it means the app is
    // about to fall back to seed data when it should not have to.
    const name = (error as { name?: string })?.name;
    if (name !== 'NoSuchKey' && name !== 'NotFound') {
      console.warn(`[storage] could not read ${keyFor(fileName)}: ${String(error)}`);
    }
    return null;
  }
}

/**
 * Write a state file. This one deliberately throws on failure: if saving a
 * rule silently did nothing, the officer would think it had been filed.
 */
export async function writeRaw(fileName: string, body: string): Promise<void> {
  if (!bucket()) {
    await fs.writeFile(path.join(DATA_DIR, fileName), body, 'utf8');
    return;
  }

  const { PutObjectCommand } = await import('@aws-sdk/client-s3');
  const client = await s3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: keyFor(fileName),
      Body: body,
      ContentType: 'application/json; charset=utf-8',
    }),
  );
}
