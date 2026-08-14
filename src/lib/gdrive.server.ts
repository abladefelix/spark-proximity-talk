// Google Drive upload using an admin-provided OAuth client + refresh token.

export type DriveConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  folderId?: string | null;
};

async function getAccessToken(cfg: DriveConfig) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      refresh_token: cfg.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const json = (await res.json()) as { access_token?: string; error_description?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(`Google token exchange failed: ${json.error_description ?? res.status}`);
  }
  return json.access_token;
}

export async function driveUpload(
  cfg: DriveConfig,
  name: string,
  body: string,
  mimeType = "application/json",
): Promise<{ id: string }> {
  const token = await getAccessToken(cfg);
  const boundary = `skanaround${crypto.randomUUID()}`;
  const metadata = {
    name,
    ...(cfg.folderId ? { parents: [cfg.folderId] } : {}),
  };
  const payload =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n${body}\r\n--${boundary}--`;

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: payload,
    },
  );
  const json = (await res.json()) as { id?: string; error?: { message?: string } };
  if (!res.ok || !json.id) {
    throw new Error(`Drive upload failed: ${json.error?.message ?? res.status}`);
  }
  return { id: json.id };
}
