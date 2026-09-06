import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Responsive grid layout helper
 * Automatically adjusts columns based on screen size
 */
export const responsiveGrid = {
  // 1 column on mobile, 2 on tablet, 3 on desktop
  cardGrid: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6",
  
  // 1 column on mobile, 2 on tablet, 4 on desktop
  compactGrid: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4",
  
  // 2 columns on mobile, 3 on tablet, 5 on desktop
  metricGrid: "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4",
  
  // Full width on mobile, 2 columns on tablet, 3 on desktop with sidebar
  dashboardGrid: "grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6",
};

/**
 * Responsive text sizing
 */
export const responsiveText = {
  heading1: "text-2xl md:text-3xl lg:text-4xl font-black",
  heading2: "text-xl md:text-2xl lg:text-3xl font-black",
  heading3: "text-lg md:text-xl lg:text-2xl font-bold",
  body: "text-sm md:text-base",
  small: "text-xs md:text-sm",
  tiny: "text-[10px] md:text-xs",
};

/**
 * Responsive spacing
 */
export const responsiveSpacing = {
  section: "space-y-4 md:space-y-6 lg:space-y-8",
  card: "p-3 md:p-4 lg:p-6",
  container: "px-3 md:px-4 lg:px-6",
};

/**
 * Check if a device is mobile (client-side only)
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768;
}

/**
 * Check if a device is tablet (client-side only)
 */
export function isTabletDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth >= 768 && window.innerWidth < 1024;
}

/**
 * Get device type (client-side only)
 */
export function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop';
  const width = window.innerWidth;
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}
