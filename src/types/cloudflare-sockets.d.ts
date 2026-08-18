declare module "cloudflare:sockets" {
  export function connect(
    address: { hostname: string; port: number } | string,
    options?: { secureTransport?: "on" | "off" | "starttls"; allowHalfOpen?: boolean },
  ): {
    readable: ReadableStream<Uint8Array>;
    writable: WritableStream<Uint8Array>;
    close(): Promise<void>;
    startTls(): ReturnType<typeof connect>;
  };
}
