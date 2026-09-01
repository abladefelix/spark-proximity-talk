#!/usr/bin/env node
/**
 * SKANAROUND — copy storage buckets + files from the managed backend to the
 * self-hosted one.
 *
 *   SRC_URL=... SRC_SERVICE_KEY=... \
 *   DST_URL=... DST_SERVICE_KEY=... \
 *   node deploy/wsl/migrate-storage.mjs
 *
 * Idempotent: existing objects are overwritten (upsert).
 */

import { createClient } from '@supabase/supabase-js';

const need = (k) => {
  const v = process.env[k];
  if (!v) {
    console.error(`Missing env ${k}`);
    process.exit(1);
  }
  return v;
};

const src = createClient(need('SRC_URL'), need('SRC_SERVICE_KEY'), {
  auth: { persistSession: false },
});
const dst = createClient(need('DST_URL'), need('DST_SERVICE_KEY'), {
  auth: { persistSession: false },
});

async function listAll(client, bucket, prefix = '') {
  const out = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await client.storage
      .from(bucket)
      .list(prefix, { limit: 100, offset });
    if (error) throw error;
    if (!data?.length) break;
    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) out.push(...(await listAll(client, bucket, path)));
      else out.push(path);
    }
    if (data.length < 100) break;
    offset += data.length;
  }
  return out;
}

const { data: buckets, error: bErr } = await src.storage.listBuckets();
if (bErr) throw bErr;

for (const bucket of buckets) {
  console.log(`\n== bucket ${bucket.name} (public=${bucket.public})`);
  const { error: createErr } = await dst.storage.createBucket(bucket.name, {
    public: bucket.public,
    fileSizeLimit: bucket.file_size_limit ?? undefined,
    allowedMimeTypes: bucket.allowed_mime_types ?? undefined,
  });
  if (createErr && !/already exists/i.test(createErr.message)) throw createErr;

  const paths = await listAll(src, bucket.name);
  console.log(`   ${paths.length} objects`);
  let done = 0;
  for (const path of paths) {
    const { data: blob, error: dErr } = await src.storage.from(bucket.name).download(path);
    if (dErr) {
      console.warn(`   ! download ${path}: ${dErr.message}`);
      continue;
    }
    const body = Buffer.from(await blob.arrayBuffer());
    const { error: uErr } = await dst.storage.from(bucket.name).upload(path, body, {
      upsert: true,
      contentType: blob.type || 'application/octet-stream',
    });
    if (uErr) console.warn(`   ! upload ${path}: ${uErr.message}`);
    else if (++done % 25 === 0) console.log(`   ${done}/${paths.length}`);
  }
  console.log(`   copied ${done}/${paths.length}`);
}

console.log('\nStorage migration complete.');
