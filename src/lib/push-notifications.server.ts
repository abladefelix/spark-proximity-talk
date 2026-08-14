import { Buffer } from "node:buffer";

export type ApnsResult = { sent: boolean; reason?: string };

function base64url(input: string | Uint8Array): string {
  const buffer = typeof input === "string" ? Buffer.from(input, "utf-8") : Buffer.from(input);
  return buffer.toString("base64url");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const base64 = pem
    .replace(/-----BEGIN [^-\n]+-----/g, "")
    .replace(/-----END [^-\n]+-----/g, "")
    .replace(/\s/g, "");
  const buffer = Buffer.from(base64, "base64");
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function derToRawP256(der: Uint8Array): Uint8Array {
  let i = 0;
  if (der[i] !== 0x30) throw new Error("Invalid DER signature: not a SEQUENCE");
  i++;
  let len = der[i];
  i++;
  if (len & 0x80) {
    const bytes = len & 0x7f;
    len = 0;
    for (let b = 0; b < bytes; b++) {
      len = (len << 8) | der[i];
      i++;
    }
  }

  function readInteger(): Uint8Array {
    if (der[i] !== 0x02) throw new Error("Invalid DER signature: expected INTEGER");
    i++;
    const nLen = der[i];
    i++;
    const n = der.slice(i, i + nLen);
    i += nLen;
    return n;
  }

  const r = readInteger();
  const s = readInteger();

  function pad32(bytes: Uint8Array): Uint8Array {
    if (bytes.length === 32) return bytes;
    if (bytes.length > 32) return bytes.slice(bytes.length - 32);
    const padded = new Uint8Array(32);
    padded.set(bytes, 32 - bytes.length);
    return padded;
  }

  const raw = new Uint8Array(64);
  raw.set(pad32(r));
  raw.set(pad32(s), 32);
  return raw;
}

async function signApnsJwt(pemKey: string, keyId: string, teamId: string): Promise<string> {
  const webCrypto = globalThis.crypto;
  const key = await webCrypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(pemKey),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const header = { alg: "ES256", kid: keyId };
  const payload = { iss: teamId, iat: Math.floor(Date.now() / 1000) };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const derSignature = await webCrypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    Buffer.from(signingInput)
  );
  const rawSignature = derToRawP256(new Uint8Array(derSignature));

  return `${signingInput}.${base64url(rawSignature)}`;
}

export async function sendApnsNotification({
  token,
  title,
  body,
  data,
}: {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<ApnsResult> {
  const key = (process.env["APNS_KEY"] ?? "").replace(/\\n/g, "\n");
  const keyId = process.env["APNS_KEY_ID"];
  const teamId = process.env["APNS_TEAM_ID"];
  const bundleId = process.env["APNS_BUNDLE_ID"] ?? "app.lovable.b0859620d8d149a093f5f6acf2710f99";

  if (!key || !keyId || !teamId) {
    return { sent: false, reason: "apns-not-configured" };
  }

  let jwt: string;
  try {
    jwt = await signApnsJwt(key, keyId, teamId);
  } catch (e) {
    return { sent: false, reason: `apns-jwt-error: ${e instanceof Error ? e.message : String(e)}` };
  }

  const production = process.env["APNS_PRODUCTION"] === "true";
  const endpoint = `https://${production ? "api" : "api.sandbox"}.push.apple.com/3/device/${token}`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `bearer ${jwt}`,
        "apns-topic": bundleId,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "apns-expiration": "0",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        aps: {
          alert: { title, body },
          sound: "default",
          badge: 1,
        },
        data: data ?? {},
      }),
    });

    if (!res.ok) {
      let reasonText = res.statusText;
      try {
        const json = (await res.json()) as { reason?: string };
        if (json.reason) reasonText = json.reason;
      } catch {
        /* ignore parse errors */
      }
      return { sent: false, reason: `apns-${res.status}: ${reasonText}` };
    }

    return { sent: true };
  } catch (e) {
    return { sent: false, reason: `apns-fetch-error: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export function shouldDeleteApnsToken(reason?: string): boolean {
  if (!reason) return false;
  const fatal = [
    "Unregistered",
    "BadDeviceToken",
    "BadCertificate",
    "BadCertificateEnvironment",
    "DeviceTokenNotForTopic",
    "InvalidProviderToken",
    "ExpiredProviderToken",
  ];
  return fatal.some((f) => reason.includes(f));
}
