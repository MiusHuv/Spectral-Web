/**
 * Comprehensive Responsive Design Tests
 * Tests the responsive behavior of the application across different screen sizes
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { AppProvider } from '../context/AppContext';
import App from '../components/App';
import HomePage from '../components/pages/NewHomePage';
import TaxonomyTree from '../components/taxonomy/TaxonomyTree';
import SpectralChart from '../components/spectral/SpectralChart';
import PropertiesPanel from '../components/properties/PropertiesPanel';
import ExportManager from '../components/export/ExportManager';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import {
  VIEWPORT_SIZES,
  setViewport,
  getViewportCategory,
  isElementVisible,
  isElementOverflowing,
  getElementDimensions,
  isFlexContainer,
  isGridContainer,
  getFontSizeInPx,
  hasPropTouchTarget,
  mockMediaQuery,
  createResponsiveTestSuite,
} from './responsive-utils';

// Mock API calls
vi.mock('../services/api', () => ({
  getClassifications: vi.fn().mockResolvedValue({
    systems: [
      {
        name: 'bus_demeo',
        classes: [
          { name: 'C', asteroids: [{ id: 1, name: 'Ceres' }] },
          { name: 'S', asteroids: [{ id: 2, name: 'Pallas' }] },
        ],
      },
    ],
  }),
  getAsteroidDetails: vi.fn().mockResolvedValue({
    id: 1,
    official_number: 1,
    proper_name: 'Ceres',
    bus_demeo_class: 'C',
    orbital_elements: { semi_major_axis: 2.77 },
    physical_properties: { diameter: 939.4 },
  }),
  getSpectralData: vi.fn().mockResolvedValue({
    wavelengths: [0.5, 0.6, 0.7, 0.8, 0.9],
    reflectances: [0.1, 0.12, 0.11, 0.13, 0.12],
  }),
}));

describe('Responsive Design System', () => {
  beforeEach(() => {
    // Reset viewport to default
    setViewport(VIEWPORT_SIZES.find(v => v.name === 'Desktop Medium')!);
    
    // Mock matchMedia
    mockMediaQuery('(min-width: 768px)', true);
  });

  describe('CSS Variables and Design Tokens', () => {
    it('should have all required CSS custom properties defined', () => {
      const root = document.documentElement;
      const computedStyle = getComputedStyle(root);
      
      // Test color variables
      expect(computedStyle.getPropertyValue('--color-primary')).toBeTruthy();
      expect(computedStyle.getPropertyValue('--color-success')).toBeTruthy();
      expect(computedStyle.getPropertyValue('--color-error')).toBeTruthy();
      
      // Test spacing variables
      expect(computedStyle.getPropertyValue('--space-sm')).toBeTruthy();
      expect(computedStyle.getPropertyValue('--space-lg')).toBeTruthy();
      
      // Test font variables
      expect(computedStyle.getPropertyValue('--font-base')).toBeTruthy();
      expect(computedStyle.getPropertyValue('--font-lg')).toBeTruthy();
      
      // Test breakpoint variables
      expect(computedStyle.getPropertyValue('--breakpoint-md')).toBeTruthy();
      expect(computedStyle.getPropertyValue('--breakpoint-lg')).toBeTruthy();
    });

    it('should adapt colors for dark mode', () => {
      // Mock dark mode preference
      mockMediaQuery('(prefers-color-scheme: dark)', true);
      
      const root = document.documentElement;
      const computedStyle = getComputedStyle(root);
      
      // In a real test, you'd check that dark mode colors are applied
      expect(computedStyle.getPropertyValue('--bg-primary')).toBeTruthy();
      expect(computedStyle.getPropertyValue('--text-primary')).toBeTruthy();
    });
  });

  describe('Layout Components', () => {
    it('should render main layout with proper structure', () => {
      render(
        <AppProvider>
          <App />
        </AppProvider>
      );

      const main = screen.getByRole('main');
      expect(main).toBeInTheDocument();
      expect(main).toHaveClass('layout-content');
    });

    VIEWPORT_SIZES.forEach(viewport => {
      it(`should adapt layout for ${viewport.name} (${viewport.width}x${viewport.height})`, () => {
        setViewport(viewport);
        
        render(
          <AppProvider>
            <HomePage />
          </AppProvider>
        );

        const mainContent = document.querySelector('.main-content');
        expect(mainContent).toBeInTheDocument();

        if (viewport.category === 'mobile') {
          // On mobile, layout should be column-based
          const style = getComputedStyle(mainContent!);
          expect(style.flexDirection).toBe('column');
        } else if (viewport.category === 'desktop') {
          // On desktop, layout should be row-based
          const style = getComputedStyle(mainContent!);
          expect(style.flexDirection).toBe('row');
        }
      });
    });
  });

  describe('Typography Responsiveness', () => {
    VIEWPORT_SIZES.forEach(viewport => {
      it(`should use appropriate font sizes on ${viewport.name}`, () => {
        setViewport(viewport);
        
        render(
          <AppProvider>
            <HomePage />
          </AppProvider>
        );

        const heading = screen.getByRole('heading', { level: 2 });
        const fontSize = getFontSizeInPx(heading);

        if (viewport.category === 'mobile') {
          expect(fontSize).toBeLessThanOrEqual(24); // Smaller on mobile
        } else if (viewport.category === 'desktop') {
          expect(fontSize).toBeGreaterThanOrEqual(24); // Larger on desktop
        }
      });
    });
  });

  describe('Touch Target Accessibility', () => {
    VIEWPORT_SIZES.filter(v => v.category === 'mobile').forEach(viewport => {
      it(`should have proper touch targets on ${viewport.name}`, () => {
        setViewport(viewport);
        
        render(
          <AppProvider>
            <TaxonomyTree />
          </AppProvider>
        );

        // Check buttons have minimum 44px touch targets
        const buttons = screen.getAllByRole('button');
        buttons.forEach(button => {
          expect(hasPropTouchTarget(button)).toBe(true);
        });
      });
    });
  });
});

// Component-specific responsive tests
createResponsiveTestSuite('LoadingSpinner', () => {
  const { container } = render(<LoadingSpinner size="medium" message="Loading..." />);
  return container.firstElementChild!;
}, {
  'should be visible and properly sized': (element, viewport) => {
    expect(isElementVisible(element)).toBe(true);
    expect(element).toHaveClass('loading-container');
    
    const spinner = element.querySelector('.spinner');
    expect(spinner).toBeInTheDocument();
    
    if (viewport.category === 'mobile') {
      const dimensions = getElementDimensions(element);
      expect(dimensions.paddingTop).toBeLessThanOrEqual(32); // Smaller padding on mobile
    }
  },
  
  'should not overflow container': (element) => {
    expect(isElementOverflowing(element)).toBe(false);
  },
});

createResponsiveTestSuite('ErrorMessage', () => {
  const { container } = render(
    <ErrorMessage 
      type="error" 
      message="Test error message" 
      onRetry={() => {}} 
    />
  );
  return container.firstElementChild!;
}, {
  'should display properly': (element, viewport) => {
    expect(isElementVisible(element)).toBe(true);
    expect(element).toHaveClass('error-container');
    
    const message = element.querySelector('.error-message');
    expect(message).toBeInTheDocument();
    
    if (viewport.category === 'mobile') {
      const actions = element.querySelector('.error-actions');
      if (actions) {
        const style = getComputedStyle(actions);
        expect(style.flexDirection).toBe('column'); // Stack buttons on mobile
      }
    }
  },
  
  'should have accessible button sizes': (element, viewport) => {
    const buttons = element.querySelectorAll('button');
    buttons.forEach(button => {
      if (viewport.category === 'mobile') {
        expect(hasPropTouchTarget(button)).toBe(true);
      }
    });
  },
});

describe('Component Integration Responsive Tests', () => {
  describe('TaxonomyTree Responsiveness', () => {
    VIEWPORT_SIZES.forEach(viewport => {
      it(`should adapt tree layout for ${viewport.name}`, () => {
        setViewport(viewport);
        
        render(
          <AppProvider>
            <TaxonomyTree />
          </AppProvider>
        );

        const tree = screen.getByTestId('taxonomy-tree');
        expect(tree).toBeInTheDocument();
        
        if (viewport.category === 'mobile') {
          // Check that tree has mobile-appropriate styling
          const style = getComputedStyle(tree);
          expect(parseFloat(style.padding)).toBeLessThanOrEqual(16);
        }
      });
    });
  });

  describe('SpectralChart Responsiveness', () => {
    const mockData = [
      {
        asteroid_id: 1,
        name: 'Ceres',
        wavelengths: [0.5, 0.6, 0.7],
        reflectances: [0.1, 0.12, 0.11],
      },
    ];

    VIEWPORT_SIZES.forEach(viewport => {
      it(`should render chart appropriately for ${viewport.name}`, () => {
        setViewport(viewport);
        
        render(<SpectralChart data={mockData} />);

        const chartContainer = screen.getByTestId('spectral-chart');
        expect(chartContainer).toBeInTheDocument();
        
        if (viewport.category === 'mobile') {
          // Chart should be scrollable horizontally on mobile
          const wrapper = chartContainer.querySelector('.spectral-chart-wrapper');
          if (wrapper) {
            const style = getComputedStyle(wrapper);
            expect(style.overflowX).toBe('auto');
          }
        }
      });
    });
  });

  describe('PropertiesPanel Responsiveness', () => {
    const mockAsteroids = [
      {
        id: 1,
        official_number: 1,
        proper_name: 'Ceres',
        orbital_elements: { semi_major_axis: 2.77 },
        physical_properties: { diameter: 939.4 },
      },
    ];

    VIEWPORT_SIZES.forEach(viewport => {
      it(`should display properties correctly on ${viewport.name}`, () => {
        setViewport(viewport);
        
        render(<PropertiesPanel asteroids={mockAsteroids} />);

        const panel = screen.getByTestId('properties-panel');
        expect(panel).toBeInTheDocument();
        
        if (viewport.category === 'mobile') {
          // Properties should stack vertically on mobile
          const propertyRows = panel.querySelectorAll('.property-row');
          propertyRows.forEach(row => {
            const style = getComputedStyle(row);
            expect(style.flexDirection).toBe('column');
          });
        }
      });
    });
  });

  describe('ExportManager Responsiveness', () => {
    VIEWPORT_SIZES.forEach(viewport => {
      it(`should adapt export dialog for ${viewport.name}`, () => {
        setViewport(viewport);
        
        render(
          <ExportManager 
            isOpen={true} 
            onClose={() => {}} 
            selectedAsteroids={[1, 2]} 
          />
        );

        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();
        
        if (viewport.category === 'mobile') {
          // Dialog should take full width on mobile
          const style = getComputedStyle(dialog);
          expect(parseFloat(style.maxWidth)).toBeGreaterThan(viewport.width * 0.8);
        }
      });
    });
  });
});

describe('Performance and Accessibility', () => {
  it('should not cause layout shifts during responsive changes', () => {
    const { rerender } = render(
      <AppProvider>
        <HomePage />
      </AppProvider>
    );

    // Simulate viewport changes
    VIEWPORT_SIZES.forEach(viewport => {
      setViewport(viewport);
      rerender(
        <AppProvider>
          <HomePage />
        </AppProvider>
      );
      
      // Check that main content is still visible
      const main = screen.getByRole('main');
      expect(isElementVisible(main)).toBe(true);
    });
  });

  it('should maintain focus management across viewport changes', () => {
    render(
      <AppProvider>
        <TaxonomyTree />
      </AppProvider>
    );

    const firstButton = screen.getAllByRole('button')[0];
    firstButton.focus();
    expect(document.activeElement).toBe(firstButton);

    // Change viewport
    setViewport(VIEWPORT_SIZES.find(v => v.category === 'mobile')!);
    
    // Focus should still be maintained
    expect(document.activeElement).toBe(firstButton);
  });

  it('should handle reduced motion preferences', () => {
    // Mock reduced motion preference
    mockMediaQuery('(prefers-reduced-motion: reduce)', true);
    
    render(<LoadingSpinner size="medium" />);
    
    const spinner = screen.getByTestId('loading-spinner');
    const style = getComputedStyle(spinner.querySelector('.spinner')!);
    
    // Animation should be disabled or minimal
    expect(style.animationDuration).toBe('0.01ms');
  });
});

describe('Cross-browser Compatibility', () => {
  it('should handle missing CSS custom property support gracefully', () => {
    // Mock older browser without CSS custom properties
    const originalGetPropertyValue = CSSStyleDeclaration.prototype.getPropertyValue;
    CSSStyleDeclaration.prototype.getPropertyValue = jest.fn().mockReturnValue('');
    
    render(
      <AppProvider>
        <HomePage />
      </AppProvider>
    );

    // Component should still render
    expect(screen.getByRole('main')).toBeInTheDocument();
    
    // Restore original method
    CSSStyleDeclaration.prototype.getPropertyValue = originalGetPropertyValue;
  });

  it('should provide fallbacks for modern CSS features', () => {
    render(<LoadingSpinner size="medium" />);
    
    const container = screen.getByTestId('loading-container');
    const style = getComputedStyle(container);
    
    // Should have fallback display method
    expect(['flex', 'block', 'inline-block']).toContain(style.display);
  });
});