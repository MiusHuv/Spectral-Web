/**
 * Responsive Design Testing Utilities
 * Provides utilities for testing responsive behavior across different screen sizes
 */
import { vi } from 'vitest';

export interface ViewportSize {
  width: number;
  height: number;
  name: string;
  category: 'mobile' | 'tablet' | 'desktop';
}

// Standard viewport sizes for testing
export const VIEWPORT_SIZES: ViewportSize[] = [
  // Mobile devices
  { width: 320, height: 568, name: 'iPhone SE', category: 'mobile' },
  { width: 375, height: 667, name: 'iPhone 8', category: 'mobile' },
  { width: 414, height: 896, name: 'iPhone 11 Pro Max', category: 'mobile' },
  { width: 360, height: 640, name: 'Android Small', category: 'mobile' },
  { width: 412, height: 732, name: 'Android Large', category: 'mobile' },
  
  // Tablet devices
  { width: 768, height: 1024, name: 'iPad Portrait', category: 'tablet' },
  { width: 1024, height: 768, name: 'iPad Landscape', category: 'tablet' },
  { width: 834, height: 1112, name: 'iPad Pro 10.5"', category: 'tablet' },
  { width: 1112, height: 834, name: 'iPad Pro 10.5" Landscape', category: 'tablet' },
  
  // Desktop sizes
  { width: 1280, height: 720, name: 'Desktop Small', category: 'desktop' },
  { width: 1440, height: 900, name: 'Desktop Medium', category: 'desktop' },
  { width: 1920, height: 1080, name: 'Desktop Large', category: 'desktop' },
  { width: 2560, height: 1440, name: 'Desktop XL', category: 'desktop' },
];

// Breakpoint definitions matching CSS
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

/**
 * Get viewport category based on width
 */
export function getViewportCategory(width: number): 'mobile' | 'tablet' | 'desktop' {
  if (width < BREAKPOINTS.md) return 'mobile';
  if (width < BREAKPOINTS.lg) return 'tablet';
  return 'desktop';
}

/**
 * Check if viewport matches a specific breakpoint
 */
export function matchesBreakpoint(width: number, breakpoint: keyof typeof BREAKPOINTS): boolean {
  return width >= BREAKPOINTS[breakpoint];
}

/**
 * Get active breakpoints for a given width
 */
export function getActiveBreakpoints(width: number): (keyof typeof BREAKPOINTS)[] {
  return Object.keys(BREAKPOINTS).filter(bp => 
    matchesBreakpoint(width, bp as keyof typeof BREAKPOINTS)
  ) as (keyof typeof BREAKPOINTS)[];
}

/**
 * Simulate viewport resize in tests
 */
export function setViewport(size: ViewportSize): void {
  // For jsdom testing environment
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: size.width,
  });
  
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: size.height,
  });
  
  // Trigger resize event
  window.dispatchEvent(new Event('resize'));
}

/**
 * Test helper to check if element has responsive classes
 */
export function hasResponsiveClass(element: Element, className: string): boolean {
  return element.classList.contains(className);
}

/**
 * Test helper to check computed styles
 */
export function getComputedStyleValue(element: Element, property: string): string {
  return window.getComputedStyle(element).getPropertyValue(property);
}

/**
 * Test helper to check if element is visible
 */
export function isElementVisible(element: Element): boolean {
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && 
         style.visibility !== 'hidden' && 
         style.opacity !== '0';
}

/**
 * Test helper to check if element overflows its container
 */
export function isElementOverflowing(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  const parent = element.parentElement;
  
  if (!parent) return false;
  
  const parentRect = parent.getBoundingClientRect();
  
  return rect.right > parentRect.right || 
         rect.bottom > parentRect.bottom ||
         rect.left < parentRect.left ||
         rect.top < parentRect.top;
}

/**
 * Test helper to check if text is truncated
 */
export function isTextTruncated(element: Element): boolean {
  const style = window.getComputedStyle(element);
  return style.textOverflow === 'ellipsis' && 
         style.overflow === 'hidden' && 
         style.whiteSpace === 'nowrap';
}

/**
 * Test helper to measure element dimensions
 */
export function getElementDimensions(element: Element) {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  
  return {
    width: rect.width,
    height: rect.height,
    marginTop: parseFloat(style.marginTop),
    marginRight: parseFloat(style.marginRight),
    marginBottom: parseFloat(style.marginBottom),
    marginLeft: parseFloat(style.marginLeft),
    paddingTop: parseFloat(style.paddingTop),
    paddingRight: parseFloat(style.paddingRight),
    paddingBottom: parseFloat(style.paddingBottom),
    paddingLeft: parseFloat(style.paddingLeft),
  };
}

/**
 * Test helper to check if element uses flexbox
 */
export function isFlexContainer(element: Element): boolean {
  const style = window.getComputedStyle(element);
  return style.display === 'flex' || style.display === 'inline-flex';
}

/**
 * Test helper to check if element uses grid
 */
export function isGridContainer(element: Element): boolean {
  const style = window.getComputedStyle(element);
  return style.display === 'grid' || style.display === 'inline-grid';
}

/**
 * Test helper to check responsive font sizes
 */
export function getFontSizeInPx(element: Element): number {
  const fontSize = window.getComputedStyle(element).fontSize;
  return parseFloat(fontSize);
}

/**
 * Test helper to check if element has proper touch targets (minimum 44px)
 */
export function hasPropTouchTarget(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  return rect.width >= 44 && rect.height >= 44;
}

/**
 * Test helper to check color contrast (simplified)
 */
export function hasGoodContrast(element: Element): boolean {
  const style = window.getComputedStyle(element);
  const color = style.color;
  const backgroundColor = style.backgroundColor;
  
  // This is a simplified check - in real tests you'd use a proper contrast calculation
  return color !== backgroundColor && 
         color !== 'transparent' && 
         backgroundColor !== 'transparent';
}

/**
 * Mock media query for testing
 */
export function mockMediaQuery(query: string, matches: boolean = true) {
  const mediaQuery = {
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => mediaQuery),
  });

  return mediaQuery;
}

/**
 * Test suite helper for responsive testing
 */
export function createResponsiveTestSuite(
  componentName: string,
  renderComponent: () => Element,
  tests: {
    [key: string]: (element: Element, viewport: ViewportSize) => void;
  }
) {
  describe(`${componentName} Responsive Design`, () => {
    VIEWPORT_SIZES.forEach(viewport => {
      describe(`${viewport.name} (${viewport.width}x${viewport.height})`, () => {
        beforeEach(() => {
          setViewport(viewport);
        });

        Object.entries(tests).forEach(([testName, testFn]) => {
          it(testName, () => {
            const element = renderComponent();
            testFn(element, viewport);
          });
        });
      });
    });
  });
}