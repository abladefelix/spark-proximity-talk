/**
 * Thin wrapper around the RevenueCat Capacitor SDK.
 *
 * Subscriptions are sold exclusively through Apple In-App Purchase and Google
 * Play Billing, as required by App Store guideline 3.1.1 and Google Play's
 * Payments policy. Nothing here runs on the web build.
 */
import { Capacitor } from "@capacitor/core";
import { Purchases } from "@revenuecat/purchases-capacitor";

export type StorePackage = {
  identifier: string;
  productId: string;
  priceString: string;
  title: string;
  period: "monthly" | "yearly" | "other";
  source: "offering" | "product" | "subscription-option";
  raw: unknown;
};

export type StoreEntitlement = {
  isActive: boolean;
  productId: string | null;
  expiresAt: string | null;
  willRenew: boolean;
  managementUrl: string | null;
};

let configuredFor: string | null = null;
let configuring: { token: string; promise: Promise<boolean> } | null = null;
let lastOptions: { iosApiKey: string | null; androidApiKey: string | null; userId: string } | null =
  null;

/** Remembers the store keys so a purchase can configure on demand. */
export function setStoreOptions(opts: {
  iosApiKey: string | null;
  androidApiKey: string | null;
  userId: string;
}) {
  lastOptions = opts;
}

/** Configures the store right before a purchase if startup never finished. */
async function ensureConfigured() {
  if (configuredFor) return true;
  if (!lastOptions) return false;
  return initStore(lastOptions);
}

const LOOKUP_DEADLINE_MS = 30_000;
const PURCHASE_DEADLINE_MS = 120_000;

function deadlineMessage(action: string) {
  return `${storeName()} did not respond while ${action}. Check your connection and Play Store or App Store account, then try again.`;
}

/** Prevents a native billing call from leaving the app permanently busy. */
async function withStoreDeadline<T>(promise: Promise<T>, action: string, ms = LOOKUP_DEADLINE_MS) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(deadlineMessage(action))), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function isNativeStore() {
  return Capacitor.isNativePlatform();
}

export function storeName() {
  return Capacitor.getPlatform() === "ios" ? "App Store" : "Google Play";
}

/** Configures RevenueCat once per signed-in member. */
export async function initStore(opts: {
  iosApiKey: string | null;
  androidApiKey: string | null;
  userId: string;
}) {
  if (!isNativeStore()) return false;
  const apiKey = Capacitor.getPlatform() === "ios" ? opts.iosApiKey : opts.androidApiKey;
  if (!apiKey) return false;

  const token = `${apiKey}:${opts.userId}`;
  if (configuredFor === token) return true;
  if (configuring?.token === token) return configuring.promise;

  const promise = withStoreDeadline(
    Purchases.configure({ apiKey, appUserID: opts.userId }),
    "connecting to billing",
  )
    .then(() => {
      configuredFor = token;
      return true;
    })
    .finally(() => {
      if (configuring?.token === token) configuring = null;
    });
  configuring = { token, promise };
  return promise;
}

function periodOf(pkg: any): StorePackage["period"] {
  const id = String(pkg?.identifier ?? "").toLowerCase();
  const unit = String(pkg?.product?.subscriptionPeriod ?? "").toUpperCase();
  if (id.includes("annual") || id.includes("year") || unit === "P1Y") return "yearly";
  if (id.includes("month") || unit === "P1M") return "monthly";
  return "other";
}

/**
 * Setup details captured on the last plan load. Surfaced in the app so an
 * admin can see exactly which side of the store setup is incomplete.
 */
export type StoreDiagnostics = {
  platform: string;
  keyPresent: boolean;
  keyPrefix: string | null;
  offeringCount: number;
  currentOffering: string | null;
  productIds: string[];
  requestedProductIds: string[];
  loadSource: "offering" | "product" | null;
  error: string | null;
  at: string;
};

let lastDiagnostics: StoreDiagnostics | null = null;

export function getStoreDiagnostics() {
  return lastDiagnostics;
}

export function clearStoreDiagnostics() {
  lastDiagnostics = null;
}

export function recordStoreError(message: string, keyPresent: boolean, keyPrefix: string | null) {
  lastDiagnostics = {
    platform: Capacitor.getPlatform(),
    keyPresent,
    keyPrefix,
    offeringCount: 0,
    currentOffering: null,
    productIds: [],
    requestedProductIds: [],
    loadSource: null,
    error: message,
    at: new Date().toISOString(),
  };
}

function packageFromOffering(pkg: any): StorePackage {
  return {
    identifier: pkg.identifier,
    productId: pkg.product?.identifier ?? "",
    priceString: pkg.product?.priceString ?? "",
    title: pkg.product?.title ?? pkg.identifier,
    period: periodOf(pkg),
    source: "offering",
    raw: pkg,
  };
}

function periodFromOption(option: any): StorePackage["period"] {
  const unit = String(option?.billingPeriod?.unit ?? "").toLowerCase();
  const value = Number(option?.billingPeriod?.value ?? 1);
  if (unit === "month" && value === 1) return "monthly";
  if (unit === "year" && value === 1) return "yearly";
  return "other";
}

function packageFromProduct(product: any, option?: any): StorePackage {
  const fullPrice = option?.fullPricePhase?.price;
  return {
    identifier: option?.storeProductId ?? option?.id ?? product.identifier,
    productId: product.identifier,
    priceString: fullPrice?.formatted ?? fullPrice?.formattedPrice ?? product.priceString ?? "",
    title: product.title ?? product.identifier,
    period: option
      ? periodFromOption(option)
      : periodOf({ identifier: product.identifier, product }),
    source: option ? "subscription-option" : "product",
    raw: option ?? product,
  };
}

function packagesFromProducts(products: any[]): StorePackage[] {
  return products.flatMap((product) => {
    const options = Array.isArray(product?.subscriptionOptions)
      ? product.subscriptionOptions.filter((option: any) => option?.isBasePlan)
      : [];
    return options.length > 0
      ? options.map((option: any) => packageFromProduct(product, option))
      : [packageFromProduct(product)];
  });
}

function errText(e: unknown) {
  const err = e as any;
  const parts = [err?.message, err?.underlyingErrorMessage, err?.code ? `code ${err.code}` : null]
    .filter(Boolean)
    .map(String);
  return parts.length > 0 ? [...new Set(parts)].join(" — ") : String(e);
}

/** Products available for purchase, priced and localised by the store. */
export async function listPackages(productIds: string[] = []): Promise<StorePackage[]> {
  if (!isNativeStore()) return [];
  clearStoreDiagnostics();
  const notes: string[] = [];
  const requestedProductIds = [...new Set(productIds.map((id) => id.trim()).filter(Boolean))];

  // 1. Offerings. A failure here must never stop the direct product lookup.
  let offerings: any = null;
  try {
    offerings = await withStoreDeadline(Purchases.getOfferings(), "loading plans");
  } catch (e) {
    notes.push(`Offerings failed: ${errText(e)}`);
  }
  let packages: any[] = offerings?.current?.availablePackages ?? [];
  if (packages.length === 0) {
    // No "current" offering set in RevenueCat — fall back to any offering.
    const all = Object.values(offerings?.all ?? {}) as any[];
    packages = all.flatMap((o) => o?.availablePackages ?? []);
  }
  let mapped = packages.map(packageFromOffering);
  let loadSource: StoreDiagnostics["loadSource"] = mapped.length > 0 ? "offering" : null;

  // 2. Direct product lookup. Google Play and the App Store can return the
  // configured products even when no offering was marked Current or its
  // packages were never attached, so this is the reliable path.
  if (mapped.length === 0 && requestedProductIds.length > 0) {
    // Google Play's billing service is often still connecting on first open,
    // so a single empty answer is not proof the plans are missing.
    for (let attempt = 0; attempt < 3 && mapped.length === 0; attempt += 1) {
      if (attempt > 0) await sleep(1_500 * attempt);
      try {
        const direct: any = await withStoreDeadline(
          Purchases.getProducts({ productIdentifiers: requestedProductIds }),
          "loading plans",
        );
        mapped = packagesFromProducts(direct?.products ?? []);
        if (mapped.length > 0) loadSource = "product";
        else if (attempt === 2) notes.push("The store returned no matching products.");
      } catch (e) {
        if (attempt === 2) notes.push(`Product lookup failed: ${errText(e)}`);
      }
    }
  }

  lastDiagnostics = {
    platform: Capacitor.getPlatform(),
    keyPresent: true,
    keyPrefix: null,
    offeringCount: Object.keys(offerings?.all ?? {}).length,
    currentOffering: offerings?.current?.identifier ?? null,
    productIds: mapped.map((p) => p.productId).filter(Boolean),
    requestedProductIds,
    loadSource,
    error:
      mapped.length === 0
        ? requestedProductIds.length === 0
          ? "No store product IDs are set in admin. Add them under Billing."
          : `${storeName()} has no plans for this app yet (${requestedProductIds.join(", ")}). This works only in a build installed from the store's testing track, signed in with an invited tester account, and with matching product IDs. ${notes.join(" ")}`.trim()
        : null,

    at: new Date().toISOString(),
  };
  return mapped;
}

function readEntitlement(customerInfo: any, entitlementId: string): StoreEntitlement {
  const ent =
    customerInfo?.entitlements?.active?.[entitlementId] ??
    customerInfo?.entitlements?.all?.[entitlementId];
  return {
    isActive: Boolean(customerInfo?.entitlements?.active?.[entitlementId]),
    productId: ent?.productIdentifier ?? null,
    expiresAt: ent?.expirationDate ?? null,
    willRenew: Boolean(ent?.willRenew),
    managementUrl: customerInfo?.managementURL ?? null,
  };
}

export function isUserCancelled(error: unknown) {
  const e = error as any;
  return (
    e?.code === "1" ||
    e?.code === 1 ||
    e?.userCancelled === true ||
    /cancel/i.test(String(e?.message ?? ""))
  );
}

/** Runs the native purchase sheet. Throws on failure. */
export async function purchase(pkg: StorePackage, entitlementId: string) {
  clearStoreDiagnostics();
  const configured = await withStoreDeadline(ensureConfigured(), "connecting to billing");
  if (!configured) throw new Error("Store billing is not configured. Please contact support.");
  const request =
    pkg.source === "subscription-option"
      ? Purchases.purchaseSubscriptionOption({ subscriptionOption: pkg.raw as any })
      : pkg.source === "product"
        ? Purchases.purchaseStoreProduct({ product: pkg.raw as any })
        : Purchases.purchasePackage({ aPackage: pkg.raw as any });
  const res: any = await withStoreDeadline(request, "opening checkout", PURCHASE_DEADLINE_MS);
  return readEntitlement(res?.customerInfo, entitlementId);
}

/** Required by App Store review: re-applies purchases on a new device. */
export async function restore(entitlementId: string) {
  clearStoreDiagnostics();
  const configured = await withStoreDeadline(ensureConfigured(), "connecting to billing");
  if (!configured) throw new Error("Store billing is not configured. Please contact support.");
  const res: any = await withStoreDeadline(
    Purchases.restorePurchases(),
    "restoring purchases",
    PURCHASE_DEADLINE_MS,
  );
  return readEntitlement(res?.customerInfo, entitlementId);
}

export async function currentEntitlement(entitlementId: string) {
  if (!isNativeStore()) return null;
  const res: any = await withStoreDeadline(Purchases.getCustomerInfo(), "checking membership");
  return readEntitlement(res?.customerInfo, entitlementId);
}
