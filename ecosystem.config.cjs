// PM2 process definition for the self-hosted (Windows VPS) deployment.
// Start:   pm2 start ecosystem.config.cjs
// Reload:  pm2 startOrReload ecosystem.config.cjs --update-env
const fs = require("node:fs");
const path = require("node:path");

/** Minimal .env reader — the repo .env holds publishable values only. */
function readEnvFile(file) {
  const out = {};
  try {
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
      if (!m || line.trim().startsWith("#")) continue;
      out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* no .env — rely on machine environment variables */
  }
  return out;
}

const fileEnv = readEnvFile(path.join(__dirname, ".env"));

module.exports = {
  apps: [
    {
      name: "skanaround",
      script: ".output/server/index.mjs",
      interpreter: "node",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_memory_restart: "600M",
      env: {
        ...fileEnv,
        // Machine environment variables win (that is where secrets live).
        ...(process.env.SUPABASE_SERVICE_ROLE_KEY
          ? { SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY }
          : {}),
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: "3000",
      },
      out_file: "logs/out.log",
      error_file: "logs/error.log",
      time: true,
    },
  ],
};
