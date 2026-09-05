import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type StoreCheck = {
  label: string;
  status: "ok" | "fail" | "warn";
  detail: string;
};

export type StoreTestResult = {
  ok: boolean;
  checks: StoreCheck[];
};

async function assertStaff(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .in("role", ["admin", "moderator"])
    .limit(1);
  if (!data?.length) throw new Error("Forbidden");
}

async function rc(path: string, secret: string): Promise<{ status: number; body: any }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(`https://api.revenuecat.com${path}`, {
      headers: { Authorization: `Bearer ${secret}`, Accept: "application/json" },
      signal: controller.signal,
    });
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  } catch {
    return { status: 0, body: null };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Really contacts RevenueCat with the saved keys and reports whether the
 * project, apps, entitlement, products and offering actually exist — rather
 * than only checking that a value was typed in.
 */
export const testStoreConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StoreTestResult> => {
    await assertStaff(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s } = await (supabaseAdmin as any)
      .from("billing_settings")
      .select("*")
      .eq("id", "global")
      .maybeSingle();

    const checks: StoreCheck[] = [];
    const val = (k: string) => String(s?.[k] ?? "").trim();
    const secret = val("rc_secret_api_key");
    const entitlementId = val("rc_entitlement_id") || "pro";
    const monthlyId = val("rc_monthly_product_id");
    const yearlyId = val("rc_yearly_product_id");
    const androidKey = val("rc_android_api_key");
    const iosKey = val("rc_ios_api_key");

    if (!secret) {
      return {
        ok: false,
        checks: [
          {
            label: "Secret key",
            status: "fail",
            detail: "No RevenueCat secret key saved, so nothing can be tested live.",
          },
        ],
      };
    }

    const projectsRes = await rc("/v2/projects", secret);
    if (projectsRes.status === 0) {
      return {
        ok: false,
        checks: [
          {
            label: "Connection to the store service",
            status: "fail",
            detail: "Could not reach RevenueCat (no response). Try again in a moment.",
          },
        ],
      };
    }
    if (projectsRes.status === 401 || projectsRes.status === 403) {
      return {
        ok: false,
        checks: [
          {
            label: "Secret key",
            status: "fail",
            detail:
              "RevenueCat rejected this secret key. Create a new secret API key in RevenueCat and paste it here.",
          },
        ],
      };
    }

    const projects: any[] = projectsRes.body?.items ?? [];
    const project = projects[0];
    if (!project?.id) {
      return {
        ok: false,
        checks: [
          {
            label: "Secret key",
            status: "fail",
            detail: `RevenueCat replied with status ${projectsRes.status} and no project. Check the key has project access.`,
          },
        ],
      };
    }

    checks.push({
      label: "Secret key",
      status: "ok",
      detail: `Working — connected to project "${project.name ?? project.id}".`,
    });

    const pid = project.id as string;
    const [apps, ents, products, offerings] = await Promise.all([
      rc(`/v2/projects/${pid}/apps?limit=50`, secret),
      rc(`/v2/projects/${pid}/entitlements?limit=100`, secret),
      rc(`/v2/projects/${pid}/products?limit=200`, secret),
      rc(`/v2/projects/${pid}/offerings?limit=50`, secret),
    ]);

    const appItems: any[] = apps.body?.items ?? [];
    const playApp = appItems.find((a) => String(a?.type ?? "").includes("play"));
    const appleApp = appItems.find((a) => String(a?.type ?? "").includes("app_store"));

    const keyOf = (a: any): string =>
      String(a?.public_api_key ?? a?.["public_api_key"] ?? "").trim();

    if (!playApp) {
      checks.push({
        label: "Android app in RevenueCat",
        status: "fail",
        detail: "No Google Play app is set up in this RevenueCat project.",
      });
    } else {
      const live = keyOf(playApp);
      checks.push({
        label: "Android app in RevenueCat",
        status: !live || !androidKey ? "warn" : live === androidKey ? "ok" : "fail",
        detail: !androidKey
          ? "Google Play app exists, but no Android key is saved here."
          : !live
            ? "Google Play app exists. RevenueCat did not return its key, so the saved one could not be compared."
            : live === androidKey
              ? "Google Play app found and the saved Android key matches."
              : "The saved Android key does not match the one in RevenueCat.",
      });
    }

    checks.push({
      label: "iPhone app in RevenueCat",
      status: appleApp ? (iosKey ? "ok" : "warn") : "warn",
      detail: appleApp
        ? iosKey
          ? "App Store app found."
          : "App Store app exists but no iPhone key is saved (fine while you focus on Android)."
        : "No App Store app yet (fine while you focus on Android).",
    });

    const entItems: any[] = ents.body?.items ?? [];
    const ent = entItems.find((e) => e?.lookup_key === entitlementId || e?.id === entitlementId);
    checks.push({
      label: `Entitlement "${entitlementId}"`,
      status: ent ? "ok" : "fail",
      detail: ent
        ? "Found in RevenueCat."
        : `Not found. Entitlements in RevenueCat: ${
            entItems.map((e) => e?.lookup_key).filter(Boolean).join(", ") || "none"
          }.`,
    });

    const prodItems: any[] = products.body?.items ?? [];
    const storeIds = prodItems.map((p) => String(p?.store_identifier ?? ""));
    const findProduct = (id: string) =>
      prodItems.find((p) => {
        const sid = String(p?.store_identifier ?? "");
        return sid === id || sid.startsWith(`${id}:`);
      });

    for (const [label, id] of [
      ["Monthly plan", monthlyId],
      ["Yearly plan", yearlyId],
    ] as const) {
      if (!id) {
        checks.push({ label, status: "fail", detail: "No plan id saved." });
        continue;
      }
      const p = findProduct(id);
      checks.push({
        label: `${label} (${id})`,
        status: p ? "ok" : "fail",
        detail: p
          ? `Found in RevenueCat as "${p.store_identifier}".`
          : `Not in RevenueCat. Products there: ${storeIds.filter(Boolean).join(", ") || "none"}.`,
      });
    }

    const offerItems: any[] = offerings.body?.items ?? [];
    const current = offerItems.find((o) => o?.is_current) ?? offerItems[0];
    if (!current) {
      checks.push({
        label: "Offering",
        status: "fail",
        detail: "No offering exists, so the app has nothing to show. Create one in RevenueCat.",
      });
    } else {
      const pkgs = await rc(`/v2/projects/${pid}/offerings/${current.id}/packages?limit=50`, secret);
      const pkgItems: any[] = pkgs.body?.items ?? [];
      checks.push({
        label: `Offering "${current.lookup_key ?? current.id}"`,
        status: pkgItems.length ? (current.is_current ? "ok" : "warn") : "fail",
        detail: !pkgItems.length
          ? "This offering has no packages, so no plans can load in the app."
          : current.is_current
            ? `Live with ${pkgItems.length} package${pkgItems.length === 1 ? "" : "s"}.`
            : `Has ${pkgItems.length} package(s) but is not marked as the current offering.`,
      });
    }

    if (!s?.enabled) {
      checks.push({
        label: "Memberships switched on",
        status: "fail",
        detail: "Turn on 'Memberships active' so members see the upgrade card.",
      });
    }

    return { ok: checks.every((c) => c.status !== "fail"), checks };
  });
