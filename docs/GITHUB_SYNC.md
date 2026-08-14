# GitHub Sync

Lovable syncs this project two-way with a GitHub repository. Connecting the repo
is a UI action — it cannot be done from the agent.

## Connect

1. In the Lovable editor, open the **+** menu in the chat input (bottom left).
2. Choose **GitHub → Connect project** and authorize the Lovable GitHub App.
3. Pick the account/organisation, then click **Create Repository**.

After that, edits made in Lovable push automatically, and pushes to GitHub sync
back into Lovable in real time.

## What is committed

Everything in the project checkout, including:

- `src/` web app, `supabase/` migrations
- `ios/` and `android/` native projects
- `docs/` (this folder) — kept updated as features land

Not committed: `.env` values, `node_modules`, `dist`, `google-services.json`,
APNs `.p8` keys, or any signing keystore. Keep credentials in backend secrets and
in your local machine only.

## Working locally

```bash
git clone <your-repo>
bun install
bun run dev            # web at http://localhost:8080
bun run build && npx cap sync
```

Push to the default branch and the change appears in Lovable. Use branches +
pull requests for review; enable *Account Settings → Labs → GitHub Branch
Switching* to switch branches inside Lovable.
