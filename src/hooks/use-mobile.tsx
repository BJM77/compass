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

/**
 * Desktop navigation media query. Mirrors the Tailwind `nav` screen in tailwind.config.ts:
 * desktop nav only for >= 1367px, or >= 1024px with a fine pointer (mouse/trackpad).
 */
export const DESKTOP_NAV_QUERY = "(min-width: 1367px), (min-width: 1024px) and (pointer: fine)";

/**
 * True on phones and touch tablets (and when 'forceMobile' is on): these use the
 * mobile navigation (sticky bottom menu + slide-out sidebar sheet).
 */
export function useIsMobileNav(): boolean {
  const [isMobileNav, setIsMobileNav] = React.useState<boolean>(false);

  React.useEffect(() => {
    const mql = window.matchMedia(DESKTOP_NAV_QUERY);
    const update = () => {
      const forced = window.localStorage.getItem("forceMobile") === "true";
      const mobile = forced || !mql.matches;
      setIsMobileNav(mobile);
      // Drives the single-column layout CSS in globals.css.
      document.documentElement.classList.toggle("mobile-layout", mobile);
    };
    update();
    mql.addEventListener("change", update);
    window.addEventListener("force-mobile-change", update);
    return () => {
      mql.removeEventListener("change", update);
      window.removeEventListener("force-mobile-change", update);
    };
  }, []);

  return isMobileNav;
}
