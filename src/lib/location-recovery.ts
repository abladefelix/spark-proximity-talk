/** Translate location-access failures without treating timeouts/network errors as permissions. */
export function locationRecovery(error: unknown, platform: string) {
  const value =
    error && typeof error === "object" ? (error as { code?: unknown; message?: unknown }) : {};
  const code = String(value.code ?? "");
  const message = String(value.message ?? error ?? "").toLowerCase();
  const disabled =
    ["OS-PLUG-GLOC-0007", "OS-PLUG-GLOC-0009", "OS-PLUG-GLOC-0017"].includes(code) ||
    /location services (are |is )?(not enabled|disabled)/.test(message);
  const denied =
    ["OS-PLUG-GLOC-0003", "OS-PLUG-GLOC-0008"].includes(code) ||
    code === "1" ||
    /location.*(denied|restricted)|allow location in your device settings/.test(message);
  if (!disabled && !denied) return null;
  const instructions =
    platform === "ios"
      ? disabled
        ? "On your iPhone, open Settings → Privacy & Security → Location Services and turn Location Services on. Then select SKANAROUND and allow location While Using the App."
        : "Open Settings → Apps → SKANAROUND → Location and choose While Using the App. If access is restricted, check Screen Time restrictions."
      : platform === "android"
        ? "Open your phone’s Settings → Location and turn location on. Then allow location for SKANAROUND in App permissions."
        : "Enable your device’s location services and allow location for this website in your browser’s site settings.";
  return { title: "Enable location", instructions, canOpenSettings: platform === "ios" };
}
