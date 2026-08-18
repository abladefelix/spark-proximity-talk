/**
 * Minimal SMTP client for the Worker runtime (uses cloudflare:sockets).
 * Supports implicit TLS (port 465) and STARTTLS (port 587/25) with AUTH LOGIN / PLAIN.
 */

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean; // implicit TLS
  user?: string | null;
  password?: string | null;
};

export type SmtpMessage = {
  from: string;
  fromName?: string | null;
  to: string;
  replyTo?: string | null;
  subject: string;
  text: string;
  html?: string | null;
};

const enc = new TextEncoder();
const dec = new TextDecoder();

type Conn = {
  writer: WritableStreamDefaultWriter<Uint8Array>;
  reader: ReadableStreamDefaultReader<Uint8Array>;
  buffer: string;
};

async function readReply(conn: Conn): Promise<{ code: number; text: string }> {
  for (;;) {
    const lines = conn.buffer.split("\r\n");
    // a complete reply ends with "NNN <space>..."
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (/^\d{3} /.test(line)) {
        const text = lines.slice(0, i + 1).join("\n");
        conn.buffer = lines.slice(i + 1).join("\r\n");
        return { code: Number(line.slice(0, 3)), text };
      }
    }
    const { value, done } = await conn.reader.read();
    if (done) throw new Error("SMTP connection closed unexpectedly");
    conn.buffer += dec.decode(value, { stream: true });
  }
}

async function send(conn: Conn, line: string, expect: number[]): Promise<string> {
  await conn.writer.write(enc.encode(line + "\r\n"));
  const reply = await readReply(conn);
  if (!expect.includes(Math.floor(reply.code / 100)) && !expect.includes(reply.code)) {
    throw new Error(`SMTP error after "${line.split(" ")[0]}": ${reply.text}`);
  }
  return reply.text;
}

function b64(value: string): string {
  return btoa(unescape(encodeURIComponent(value)));
}

function dotStuff(body: string): string {
  return body
    .split("\r\n")
    .map((l) => (l.startsWith(".") ? "." + l : l))
    .join("\r\n");
}

function buildMime(msg: SmtpMessage): string {
  const boundary = `sk_${Math.random().toString(36).slice(2)}`;
  const fromHeader = msg.fromName ? `"${msg.fromName.replace(/"/g, "")}" <${msg.from}>` : msg.from;
  const headers = [
    `From: ${fromHeader}`,
    `To: ${msg.to}`,
    msg.replyTo ? `Reply-To: ${msg.replyTo}` : null,
    `Subject: ${msg.subject}`,
    `Date: ${new Date().toUTCString()}`,
    `MIME-Version: 1.0`,
  ].filter(Boolean) as string[];

  if (!msg.html) {
    headers.push(`Content-Type: text/plain; charset="utf-8"`);
    return headers.join("\r\n") + "\r\n\r\n" + msg.text.replace(/\n/g, "\r\n");
  }

  headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
  const body = [
    `--${boundary}`,
    `Content-Type: text/plain; charset="utf-8"`,
    ``,
    msg.text.replace(/\n/g, "\r\n"),
    `--${boundary}`,
    `Content-Type: text/html; charset="utf-8"`,
    ``,
    msg.html.replace(/\n/g, "\r\n"),
    `--${boundary}--`,
    ``,
  ].join("\r\n");
  return headers.join("\r\n") + "\r\n\r\n" + body;
}

export async function sendSmtpMail(config: SmtpConfig, msg: SmtpMessage): Promise<void> {
  // Opaque specifier so the bundler does not try to resolve the Worker
  // built-in at build time (it only exists at runtime on workerd).
  const socketsModule = "cloudflare" + ":sockets";
  const { connect } = (await import(/* @vite-ignore */ socketsModule)) as {
    connect: (
      address: { hostname: string; port: number },
      options?: { secureTransport?: "on" | "off" | "starttls"; allowHalfOpen?: boolean },
    ) => any;
  };


  let socket = connect(
    { hostname: config.host, port: config.port },
    { secureTransport: config.secure ? "on" : "starttls", allowHalfOpen: false },
  );

  let conn: Conn = {
    writer: socket.writable.getWriter(),
    reader: socket.readable.getReader(),
    buffer: "",
  };

  try {
    const greeting = await readReply(conn);
    if (Math.floor(greeting.code / 100) !== 2) throw new Error(`SMTP greeting: ${greeting.text}`);

    const ehlo = await send(conn, `EHLO skanaround`, [2]);

    if (!config.secure) {
      if (!/STARTTLS/i.test(ehlo)) throw new Error("Server does not support STARTTLS");
      await send(conn, "STARTTLS", [2]);
      conn.writer.releaseLock();
      conn.reader.releaseLock();
      socket = socket.startTls();
      conn = {
        writer: socket.writable.getWriter(),
        reader: socket.readable.getReader(),
        buffer: "",
      };
      await send(conn, `EHLO skanaround`, [2]);
    }

    if (config.user && config.password) {
      await send(conn, "AUTH LOGIN", [334]);
      await send(conn, b64(config.user), [334]);
      await send(conn, b64(config.password), [2]);
    }

    await send(conn, `MAIL FROM:<${msg.from}>`, [2]);
    await send(conn, `RCPT TO:<${msg.to}>`, [2]);
    await send(conn, "DATA", [3]);
    await conn.writer.write(enc.encode(dotStuff(buildMime(msg)) + "\r\n.\r\n"));
    const stored = await readReply(conn);
    if (Math.floor(stored.code / 100) !== 2) throw new Error(`SMTP send failed: ${stored.text}`);
    try {
      await send(conn, "QUIT", [2]);
    } catch {
      /* ignore */
    }
  } finally {
    try {
      conn.writer.releaseLock();
      conn.reader.releaseLock();
      await socket.close();
    } catch {
      /* ignore */
    }
  }
}
