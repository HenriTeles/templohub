import { useEffect, useState } from "react";
import { db as supabase } from "@/lib/db";
import defaultLogo from "@/assets/templohub-logo.png.asset.json";

export const BRANDING_LOGO_EVENT = "templohub:branding-logo-updated";

export function useBrandingLogo(): string {
  const [url, setUrl] = useState<string>(defaultLogo.url);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await supabase.from("app_settings").select("logo_path").eq("id", 1).maybeSingle();
      const path = (data as { logo_path: string | null } | null)?.logo_path;
      if (!path) { if (alive) setUrl(defaultLogo.url); return; }
      const { data: signed } = await supabase.storage.from("app-branding").createSignedUrl(path, 3600);
      if (alive && signed?.signedUrl) setUrl(signed.signedUrl);
    };
    load();
    const handler = () => load();
    window.addEventListener(BRANDING_LOGO_EVENT, handler);
    return () => { alive = false; window.removeEventListener(BRANDING_LOGO_EVENT, handler); };
  }, []);
  return url;
}
