// AWS SigV4 (S3 PutObject) using WebCrypto — works on the edge runtime.

const enc = new TextEncoder();

async function hmac(key: ArrayBuffer | Uint8Array, data: string) {
  const k = await crypto.subtle.importKey(
    "raw",
    key as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", k, enc.encode(data));
}

async function sha256Hex(data: string | Uint8Array) {
  const buf = typeof data === "string" ? enc.encode(data) : data;
  const hash = await crypto.subtle.digest("SHA-256", buf as unknown as ArrayBuffer);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type S3Config = {
  endpoint: string; // e.g. https://<account>.r2.cloudflarestorage.com  or https://s3.amazonaws.com
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

export async function s3PutObject(
  cfg: S3Config,
  key: string,
  body: string,
  contentType = "application/json",
): Promise<{ url: string }> {
  const endpoint = cfg.endpoint.replace(/\/+$/, "");
  const url = new URL(`${endpoint}/${cfg.bucket}/${key}`);
  const host = url.host;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const region = cfg.region || "auto";
  const service = "s3";
  const payloadHash = await sha256Hex(body);

  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    "PUT",
    url.pathname,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  let signingKey: ArrayBuffer | Uint8Array = enc.encode(`AWS4${cfg.secretAccessKey}`);
  for (const part of [dateStamp, region, service, "aws4_request"]) {
    signingKey = await hmac(signingKey, part);
  }
  const sigBuf = await hmac(signingKey, stringToSign);
  const signature = [...new Uint8Array(sigBuf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const res = await fetch(url.toString(), {
    method: "PUT",
    headers: {
      "content-type": contentType,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      Authorization: `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`S3 upload failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return { url: url.toString() };
}
