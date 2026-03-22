/**
 * Basic Responsive Design Tests
 * Simple tests to verify responsive components work correctly
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import Button from '../components/common/Button';

describe('Responsive Components', () => {
  describe('LoadingSpinner', () => {
    it('should render with default props', () => {
      render(<LoadingSpinner />);
      const spinner = screen.getByTestId('loading-spinner');
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveClass('loading-container');
    });

    it('should render different sizes', () => {
      const { rerender } = render(<LoadingSpinner size="small" />);
      let spinner = screen.getByTestId('loading-spinner');
      expect(spinner.querySelector('.loading-spinner')).toHaveClass('small');

      rerender(<LoadingSpinner size="large" />);
      spinner = screen.getByTestId('loading-spinner');
      expect(spinner.querySelector('.loading-spinner')).toHaveClass('large');
    });

    it('should render different variants', () => {
      const { rerender } = render(<LoadingSpinner variant="dots" />);
      let spinner = screen.getByTestId('loading-spinner');
      expect(spinner.querySelector('.loading-spinner')).toHaveClass('dots');

      rerender(<LoadingSpinner variant="inline" />);
      spinner = screen.getByTestId('loading-spinner');
      expect(spinner).toHaveClass('loading-inline');
    });

    it('should display message when provided', () => {
      render(<LoadingSpinner message="Loading data..." />);
      expect(screen.getByText('Loading data...')).toBeInTheDocument();
    });
  });

  describe('ErrorMessage', () => {
    it('should render with default props', () => {
      render(<ErrorMessage message="Test error" />);
      const errorMessage = screen.getByTestId('error-message');
      expect(errorMessage).toBeInTheDocument();
      expect(errorMessage).toHaveClass('error-container', 'error');
      expect(screen.getByText('Test error')).toBeInTheDocument();
    });

    it('should render different types', () => {
      const { rerender } = render(<ErrorMessage message="Warning" type="warning" />);
      let errorMessage = screen.getByTestId('error-message');
      expect(errorMessage).toHaveClass('warning');

      rerender(<ErrorMessage message="Info" type="info" />);
      errorMessage = screen.getByTestId('error-message');
      expect(errorMessage).toHaveClass('info');

      rerender(<ErrorMessage message="Success" type="success" />);
      errorMessage = screen.getByTestId('error-message');
      expect(errorMessage).toHaveClass('success');
    });

    it('should show retry button when onRetry is provided', () => {
      const mockRetry = () => {};
      render(<ErrorMessage message="Test error" onRetry={mockRetry} />);
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });

    it('should show dismiss button when dismissible', () => {
      const mockDismiss = () => {};
      render(<ErrorMessage message="Test error" dismissible onDismiss={mockDismiss} />);
      expect(screen.getByLabelText('Dismiss error')).toBeInTheDocument();
    });

    it('should show details toggle when details provided', () => {
      render(<ErrorMessage message="Test error" details="Error details here" />);
      expect(screen.getByText('Show details')).toBeInTheDocument();
    });
  });

  describe('Button', () => {
    it('should render with default props', () => {
      render(<Button>Click me</Button>);
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('btn', 'btn--primary', 'btn--medium');
      expect(screen.getByText('Click me')).toBeInTheDocument();
    });

    it('should render different variants', () => {
      const { rerender } = render(<Button variant="secondary">Secondary</Button>);
      let button = screen.getByRole('button');
      expect(button).toHaveClass('btn--secondary');

      rerender(<Button variant="outline">Outline</Button>);
      button = screen.getByRole('button');
      expect(button).toHaveClass('btn--outline');

      rerender(<Button variant="ghost">Ghost</Button>);
      button = screen.getByRole('button');
      expect(button).toHaveClass('btn--ghost');
    });

    it('should render different sizes', () => {
      const { rerender } = render(<Button size="small">Small</Button>);
      let button = screen.getByRole('button');
      expect(button).toHaveClass('btn--small');

      rerender(<Button size="large">Large</Button>);
      button = screen.getByRole('button');
      expect(button).toHaveClass('btn--large');
    });

    it('should show loading state', () => {
      render(<Button loading>Loading</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('btn--loading');
      expect(button).toBeDisabled();
      expect(screen.getByTestId('button-loading')).toBeInTheDocument();
    });

    it('should be full width when specified', () => {
      render(<Button fullWidth>Full Width</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('btn--full-width');
    });

    it('should render with icon', () => {
      render(<Button icon={<span>🔍</span>}>Search</Button>);
      expect(screen.getByText('🔍')).toBeInTheDocument();
      expect(screen.getByText('Search')).toBeInTheDocument();
    });
  });

  describe('CSS Variables', () => {
    it('should have design system variables available', () => {
      const root = document.documentElement;
      const computedStyle = getComputedStyle(root);
      
      // Test that key variables are defined
      expect(computedStyle.getPropertyValue('--color-primary')).toBeTruthy();
      expect(computedStyle.getPropertyValue('--space-lg')).toBeTruthy();
      expect(computedStyle.getPropertyValue('--font-base')).toBeTruthy();
      expect(computedStyle.getPropertyValue('--radius-md')).toBeTruthy();
    });
  });

  describe('Responsive Behavior', () => {
    beforeEach(() => {
      // Reset viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 768,
      });
    });

    it('should handle viewport changes gracefully', () => {
      const { container } = render(<LoadingSpinner />);
      
      // Simulate mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
      window.dispatchEvent(new Event('resize'));
      
      // Component should still be rendered
      expect(container.firstChild).toBeInTheDocument();
    });

    it('should maintain accessibility across viewport sizes', () => {
      render(<Button>Accessible Button</Button>);
      const button = screen.getByRole('button');
      
      // Should be a button element
      expect(button.tagName).toBe('BUTTON');
      
      // Should be focusable
      button.focus();
      expect(document.activeElement).toBe(button);
    });
  });
});