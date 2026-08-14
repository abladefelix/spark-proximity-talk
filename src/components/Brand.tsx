import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import defaultLogo from "@/assets/shatta-s.png.asset.json";

export const DEFAULT_APP_NAME = "SHATTA";
export const DEFAULT_LOGO_URL = defaultLogo.url;

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

export function Brand({ className, size = 28 }: { className?: string; size?: number }) {
  const { data } = useBranding();
  const name = data?.name ?? DEFAULT_APP_NAME;
  const logo = data?.logo ?? DEFAULT_LOGO_URL;

  return (
    <p
      className={
        className ??
        "flex items-center gap-2 text-sm font-semibold tracking-[0.28em] text-muted-foreground"
      }
    >
      <img
        src={logo}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="rounded object-contain"
      />
      {name}
    </p>
  );
}
