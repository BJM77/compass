import { useEffect, useState } from 'react';

export const MOBILE_BREAKPOINT = 768;

export function useIsMobile(): boolean | undefined {
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const checkMobile = () => {
      if (typeof window !== 'undefined' && window.localStorage.getItem('forceMobile') === 'true') {
        setIsMobile(true);
      } else {
        setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    const onForceMobileChange = () => checkMobile();
    window.addEventListener('force-mobile-change', onForceMobileChange);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('force-mobile-change', onForceMobileChange);
    };
  }, []);

  return isMobile;
}

export const MOBILE_MODULES = [
  'DASHBOARD',
  'FACT_FINDING',
  'WHITE_SPACE',
  'MONDAY_PLANNING',
  'FRIDAY_FW',
  'TWIW',
  'TEAM',
  'MANAGE_TIME'
] as const;

export type MobileModule = typeof MOBILE_MODULES[number];

// Event handler for mobile navigation
export function navigateToMobileModule(module: MobileModule) {
  window.dispatchEvent(new CustomEvent('mobile-navigate', {
    detail: { module }
  }));
}
