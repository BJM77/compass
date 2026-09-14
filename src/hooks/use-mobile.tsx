import * as React from "react";
export const MOBILE_BREAKPOINT = 768;

/**
 * Standardized responsive hook for mobile screen detection.
 * Consolidates breakpoint logic to 768px (Tailwind 'md') and respects 'forceMobile' setting.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = React.useState<boolean>(false);

  React.useEffect(() => {
    const checkMobile = () => {
      if (typeof window !== "undefined" && window.localStorage.getItem("forceMobile") === "true") {
        setIsMobile(true);
      } else if (typeof window !== "undefined") {
        setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
      }
    };

    checkMobile();

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => checkMobile();

    mql.addEventListener("change", onChange);
    window.addEventListener("resize", onChange);
    window.addEventListener("force-mobile-change", onChange);

    return () => {
      mql.removeEventListener("change", onChange);
      window.removeEventListener("resize", onChange);
      window.removeEventListener("force-mobile-change", onChange);
    };
  }, []);

  return isMobile;
}
