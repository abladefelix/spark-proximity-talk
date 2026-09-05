import { Buffer } from "node:buffer";

export type FcmResult = { sent: boolean; reason?: string };

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

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

function readServiceAccount(): ServiceAccount | null {
  const raw = process.env["FCM_SERVICE_ACCOUNT"];
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ServiceAccount;
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) return null;
    return { ...parsed, private_key: parsed.private_key.replace(/\\n/g, "\n") };
  } catch {
    return null;
  }
}

async function getAccessToken(account: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;

  const key = await globalThis.crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(account.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await globalThis.crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    Buffer.from(signingInput)
  );
  const assertion = `${signingInput}.${base64url(new Uint8Array(signature))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) throw new Error(`google-oauth-${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("google-oauth-no-token");
  return json.access_token;
}

export async function sendFcmNotification({
  token,
  title,
  body,
  data,
}: {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<FcmResult> {
  const account = readServiceAccount();
  if (!account) return { sent: false, reason: "fcm-not-configured" };

  let accessToken: string;
  try {
    accessToken = await getAccessToken(account);
  } catch (e) {
    return { sent: false, reason: `fcm-auth-error: ${e instanceof Error ? e.message : String(e)}` };
  }

  try {
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token,
            notification: { title, body },
            data: data ?? {},
            android: {
              priority: "HIGH",
              notification: {
                sound: "default",
                icon: "ic_stat_skanaround",
                channel_id: "skanaround_default",
              },
            },
          },
        }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      return { sent: false, reason: `fcm-${res.status}: ${text}` };
    }
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: `fcm-fetch-error: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export function shouldDeleteFcmToken(reason?: string): boolean {
  if (!reason) return false;
  return (
    reason.includes("UNREGISTERED") ||
    reason.includes("INVALID_ARGUMENT") ||
    reason.includes("NOT_FOUND")
  );
}
