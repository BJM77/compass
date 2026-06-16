import { useEffect, useState } from 'react';

export const MOBILE_BREAKPOINT = 768;

export function useIsMobile(): boolean | undefined {
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

export const MOBILE_MODULES = [
  'DASHBOARD',
  'FACT_FINDING',
  'WHITE_SPACE',
  'MONDAY_PLANNING',
  'FRIDAY_SYNTHESIS',
  'TWIW',
  'TEAM'
] as const;

export type MobileModule = typeof MOBILE_MODULES[number];

// Event handler for mobile navigation
export function navigateToMobileModule(module: MobileModule) {
  window.dispatchEvent(new CustomEvent('mobile-navigate', {
    detail: { module }
  }));
}
