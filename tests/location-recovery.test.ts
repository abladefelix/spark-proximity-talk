import { describe, expect, test } from "bun:test";
import { locationRecovery } from "../src/lib/location-recovery";

describe("location recovery", () => {
  test("iOS system switch off explains the global setting and offers Settings", () => {
    const help = locationRecovery({ code: "OS-PLUG-GLOC-0007" }, "ios");
    expect(help?.canOpenSettings).toBe(true);
    expect(help?.instructions).toContain("Privacy & Security");
  });
  test("previous permission denial explains app permission", () => {
    expect(locationRecovery({ code: "OS-PLUG-GLOC-0003" }, "ios")?.instructions).toContain(
      "While Using the App",
    );
    expect(
      locationRecovery(
        new Error("Allow location in your device settings, then check in again."),
        "ios",
      ),
    ).not.toBeNull();
  });
  test("legacy disabled messages and browser permission errors are recognized", () => {
    expect(locationRecovery(new Error("Location services are not enabled"), "ios")).not.toBeNull();
    expect(locationRecovery({ code: 1 }, "web")?.canOpenSettings).toBe(false);
  });
  test("Android instructions do not offer an iOS settings link", () => {
    expect(locationRecovery({ code: "OS-PLUG-GLOC-0007" }, "android")?.canOpenSettings).toBe(false);
  });
  test("timeouts and backend errors are not misclassified", () => {
    expect(locationRecovery({ code: "OS-PLUG-GLOC-0010", message: "Timeout" }, "ios")).toBeNull();
    expect(locationRecovery(new Error("Failed to fetch"), "ios")).toBeNull();
  });
});
