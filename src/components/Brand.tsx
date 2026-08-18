import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import defaultLogo from "@/assets/skanaround-logo.png";

export const DEFAULT_APP_NAME = "SKANAROUND";
export const DEFAULT_LOGO_URL = defaultLogo;

export function useBranding() {
  return useQuery({
    queryKey: ["app-branding"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("app_name, logo_url")
        .eq("id", "global")
        .maybeSingle();

      let logo = DEFAULT_LOGO_URL;
      if (data?.logo_url) {
        const { data: signed } = await supabase.storage
          .from("branding")
          .createSignedUrl(data.logo_url, 60 * 60);
        if (signed?.signedUrl) logo = signed.signedUrl;
      }
      return {
        name: data?.app_name?.trim() || DEFAULT_APP_NAME,
        logo,
        logoPath: data?.logo_url ?? null,
      };
    },
  });
}

/**
 * Renders the logo tinted with the current accent colour.
 * The default mark is masked so it always picks up `--primary`;
 * custom uploaded logos are shown as-is (their own colours).
 */
export function BrandMark({
  size = 28,
  className,
  style,
}: {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { data } = useBranding();
  const logo = data?.logo ?? DEFAULT_LOGO_URL;
  const isCustom = Boolean(data?.logoPath);

  if (isCustom) {
    return (
      <img
        src={logo}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        style={{ width: size, height: size, ...style }}
        className={className ? `object-contain ${className}` : "rounded object-contain"}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        width: size,
        height: size,
        display: "inline-block",
        backgroundColor: "var(--primary)",
        WebkitMaskImage: `url(${logo})`,
        maskImage: `url(${logo})`,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        ...style,
      }}
    />
  );
}

export function Brand({ className, size = 28 }: { className?: string; size?: number }) {
  const { data } = useBranding();
  const name = data?.name ?? DEFAULT_APP_NAME;

  return (
    <p
      className={
        className ??
        "flex items-center gap-2 text-sm font-semibold tracking-[0.28em] text-muted-foreground"
      }
    >
      <BrandMark size={size} />
      {name}
    </p>
  );
}
