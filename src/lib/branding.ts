import { useEffect, useState } from "react";
import { getBrandingUrls } from "@/lib/mediuns-read.functions";
import defaultLogo from "@/assets/templohub-logo.png.asset.json";

export const BRANDING_LOGO_EVENT = "templohub:branding-logo-updated";

export function useBrandingLogo(): string {
  const [url, setUrl] = useState<string>(defaultLogo.url);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const { appLogoUrl } = await getBrandingUrls();
        if (alive) setUrl(appLogoUrl || defaultLogo.url);
      } catch {
        if (alive) setUrl(defaultLogo.url);
      }
    };
    void load();
    const handler = () => void load();
    window.addEventListener(BRANDING_LOGO_EVENT, handler);
    return () => { alive = false; window.removeEventListener(BRANDING_LOGO_EVENT, handler); };
  }, []);
  return url;
}

