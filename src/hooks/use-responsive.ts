import { useState, useEffect } from 'react';

export function useResponsive() {
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 0
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    // Initial setting
    setWindowWidth(window.innerWidth);

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return {
    windowWidth,
    isMobile: windowWidth < 768,
    isTablet: windowWidth >= 768 && windowWidth < 1024,
    isDesktop: windowWidth >= 1024,
    isLargeScreen: windowWidth >= 1280,
    breakpoint: windowWidth < 768 ? 'mobile' : windowWidth < 1024 ? 'tablet' : 'desktop',
  };
}
