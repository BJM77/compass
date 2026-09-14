import { useState, useEffect } from 'react';
import { MOBILE_BREAKPOINT } from '@/hooks/use-mobile';

export function useResponsive() {
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    setWindowWidth(window.innerWidth);

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isForceMobile = typeof window !== 'undefined' && window.localStorage.getItem('forceMobile') === 'true';
  const isMobile = isForceMobile || windowWidth < MOBILE_BREAKPOINT;

  return {
    windowWidth,
    isMobile,
    isTablet: !isForceMobile && windowWidth >= MOBILE_BREAKPOINT && windowWidth < 1024,
    isDesktop: !isForceMobile && windowWidth >= 1024,
    isLargeScreen: !isForceMobile && windowWidth >= 1280,
    breakpoint: isMobile ? 'mobile' : windowWidth < 1024 ? 'tablet' : 'desktop',
  };
}
