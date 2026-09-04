/**
 * Thin wrapper around the RevenueCat Capacitor SDK.
 *
 * Subscriptions are sold exclusively through Apple In-App Purchase and Google
 * Play Billing, as required by App Store guideline 3.1.1 and Google Play's
 * Payments policy. Nothing here runs on the web build.
 */
import { Capacitor } from "@capacitor/core";

export type StorePackage = {
  identifier: string;
  productId: string;
  priceString: string;
  title: string;
  period: "monthly" | "yearly" | "other";
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

export function isNativeStore() {
  return Capacitor.isNativePlatform();
}

export function storeName() {
  return Capacitor.getPlatform() === "ios" ? "App Store" : "Google Play";
}

async function sdk() {
  const mod = await import("@revenuecat/purchases-capacitor");
  return mod.Purchases;
}

/** Configures RevenueCat once per signed-in member. */
export async function initStore(opts: {
  iosApiKey: string | null;
  androidApiKey: string | null;
  userId: string;
}) {
  if (!isNativeStore()) return false;
  const apiKey =
    Capacitor.getPlatform() === "ios" ? opts.iosApiKey : opts.androidApiKey;
  if (!apiKey) return false;

  const token = `${apiKey}:${opts.userId}`;
  const Purchases = await sdk();
  if (configuredFor === token) return true;
  await Purchases.configure({ apiKey, appUserID: opts.userId });
  configuredFor = token;
  return true;
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
  error: string | null;
  at: string;
};

let lastDiagnostics: StoreDiagnostics | null = null;

export function getStoreDiagnostics() {
  return lastDiagnostics;
}

export function recordStoreError(message: string, keyPresent: boolean, keyPrefix: string | null) {
  lastDiagnostics = {
    platform: Capacitor.getPlatform(),
    keyPresent,
    keyPrefix,
    offeringCount: 0,
    currentOffering: null,
    productIds: [],
    error: message,
    at: new Date().toISOString(),
  };
}

/** Products available for purchase, priced and localised by the store. */
export async function listPackages(): Promise<StorePackage[]> {
  if (!isNativeStore()) return [];
  const Purchases = await sdk();
  const offerings: any = await Purchases.getOfferings();
  let packages: any[] = offerings?.current?.availablePackages ?? [];
  if (packages.length === 0) {
    // No "current" offering set in RevenueCat — fall back to any offering.
    const all = Object.values(offerings?.all ?? {}) as any[];
    packages = all.flatMap((o) => o?.availablePackages ?? []);
  }
  const mapped = packages.map((p) => ({
    identifier: p.identifier,
    productId: p.product?.identifier ?? "",
    priceString: p.product?.priceString ?? "",
    title: p.product?.title ?? p.identifier,
    period: periodOf(p),
    raw: p,
  }));
  lastDiagnostics = {
    platform: Capacitor.getPlatform(),
    keyPresent: true,
    keyPrefix: null,
    offeringCount: Object.keys(offerings?.all ?? {}).length,
    currentOffering: offerings?.current?.identifier ?? null,
    productIds: mapped.map((p) => p.productId).filter(Boolean),
    error:
      mapped.length === 0
        ? Object.keys(offerings?.all ?? {}).length === 0
          ? "The store returned no offerings. In RevenueCat, create an offering, add packages to it, and mark it Current."
          : "Offerings exist but no products are available. The products are usually not active in the store, or this build/tester account is not on a testing track."
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
  const Purchases = await sdk();
  const res: any = await Purchases.purchasePackage({ aPackage: pkg.raw as any });
  return readEntitlement(res?.customerInfo, entitlementId);
}

/** Required by App Store review: re-applies purchases on a new device. */
export async function restore(entitlementId: string) {
  const Purchases = await sdk();
  const res: any = await Purchases.restorePurchases();
  return readEntitlement(res?.customerInfo, entitlementId);
}

export async function currentEntitlement(entitlementId: string) {
  if (!isNativeStore()) return null;
  const Purchases = await sdk();
  const res: any = await Purchases.getCustomerInfo();
  return readEntitlement(res?.customerInfo, entitlementId);
}
