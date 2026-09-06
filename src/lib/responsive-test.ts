/**
 * Test responsive behavior across common device sizes
 * Use this in development to test different viewports
 */
export const DEVICE_SIZES = {
  mobile: { width: 375, height: 667 },    // iPhone SE
  mobileLarge: { width: 428, height: 926 }, // iPhone 14 Pro Max
  tablet: { width: 768, height: 1024 },   // iPad
  tabletLarge: { width: 1024, height: 1366 }, // iPad Pro
  desktop: { width: 1440, height: 900 },
  desktopLarge: { width: 1920, height: 1080 },
};

export function simulateDevice(device: keyof typeof DEVICE_SIZES) {
  if (typeof window === 'undefined') return;
  
  const size = DEVICE_SIZES[device];
  window.resizeTo(size.width, size.height);
  
  // Dispatch resize event
  window.dispatchEvent(new Event('resize'));
  
  console.log(`[Responsive Test] Simulated ${device} viewport: ${size.width}x${size.height}`);
}
