import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PropertiesPanel from '../PropertiesPanel';
import type { Asteroid } from '../../../context/AppContext';

const mockAsteroid1: Asteroid = {
  id: 1,
  official_number: 1,
  proper_name: 'Ceres',
  provisional_designation: '1801 GP',
  bus_demeo_class: 'C',
  tholen_class: 'G',
  orbital_elements: {
    semi_major_axis: 2.767,
    eccentricity: 0.0758,
    inclination: 10.593,
    orbital_period: 4.60,
    perihelion_distance: 2.558,
    aphelion_distance: 2.976,
  },
  physical_properties: {
    diameter: 939.4,
    albedo: 0.090,
    rotation_period: 9.074,
    density: 2.16,
  },
};

const mockAsteroid2: Asteroid = {
  id: 2,
  official_number: 2,
  proper_name: 'Pallas',
  provisional_designation: '1802 FA',
  bus_demeo_class: 'B',
  tholen_class: 'B',
  orbital_elements: {
    semi_major_axis: 2.773,
    eccentricity: 0.2313,
    inclination: 34.837,
    orbital_period: 4.62,
  },
  physical_properties: {
    diameter: 512.0,
    albedo: 0.159,
    rotation_period: 7.813,
  },
};

const mockAsteroidIncomplete: Asteroid = {
  id: 3,
  official_number: 3,
  proper_name: 'Juno',
  bus_demeo_class: 'S',
};

const renderPanel = ({
  selectedAsteroids = [],
  asteroidData = {},
  loading = false,
  error = null,
  className,
}: {
  selectedAsteroids?: number[];
  asteroidData?: Record<number, Asteroid>;
  loading?: boolean;
  error?: string | null;
  className?: string;
} = {}) =>
  render(
    <PropertiesPanel
      className={className}
      selectedAsteroids={selectedAsteroids}
      asteroidData={asteroidData}
      loading={loading}
      error={error}
    />
  );

describe('PropertiesPanel', () => {
  describe('Empty States', () => {
    it('displays loading state when loading is true', () => {
      renderPanel({ loading: true });

      expect(screen.getByText('Loading asteroid properties...')).toBeInTheDocument();
    });

    it('displays error state when error exists', () => {
      renderPanel({ error: 'Failed to load data' });

      expect(screen.getByText('Failed to load data')).toBeInTheDocument();
    });

    it('displays no selection message when no asteroids are selected', () => {
      renderPanel();

      expect(screen.getByText('No Asteroids Selected')).toBeInTheDocument();
      expect(
        screen.getByText('Select asteroids from the classification tree to view their properties.')
      ).toBeInTheDocument();
    });

    it('displays loading data message when asteroids are selected but data is not loaded', () => {
      renderPanel({ selectedAsteroids: [1, 2] });

      expect(screen.getByText('Loading Asteroid Data')).toBeInTheDocument();
      expect(screen.getByText('Asteroid property data is being loaded...')).toBeInTheDocument();
    });
  });

  describe('Single Asteroid View', () => {
    it('displays single asteroid details', () => {
      renderPanel({
        selectedAsteroids: [1],
        asteroidData: { 1: mockAsteroid1 },
      });

      expect(screen.getByRole('heading', { level: 3, name: 'Asteroid Properties' })).toBeInTheDocument();
      expect(screen.getByText('1 asteroid selected')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 4, name: 'Ceres' })).toBeInTheDocument();
      expect(screen.getByText('ID: 1')).toBeInTheDocument();
    });

    it('displays all single-asteroid sections and values', () => {
      renderPanel({
        selectedAsteroids: [1],
        asteroidData: { 1: mockAsteroid1 },
      });

      expect(screen.getByText('Identification')).toBeInTheDocument();
      expect(screen.getByText('Classification')).toBeInTheDocument();
      expect(screen.getByText('Orbital Elements')).toBeInTheDocument();
      expect(screen.getByText('Physical Properties')).toBeInTheDocument();
      expect(screen.getByText('1801 GP')).toBeInTheDocument();
      expect(screen.getByText('2.767')).toBeInTheDocument();
      expect(screen.getByText('939.400')).toBeInTheDocument();
      expect(screen.getByText('0.090000')).toBeInTheDocument();
    });

    it('handles missing data with N/A placeholders', () => {
      renderPanel({
        selectedAsteroids: [3],
        asteroidData: { 3: mockAsteroidIncomplete },
      });

      expect(screen.getAllByText('N/A').length).toBeGreaterThan(0);
    });
  });

  describe('Multiple Asteroids View', () => {
    it('displays multiple asteroids in comparison layout', () => {
      renderPanel({
        selectedAsteroids: [1, 2],
        asteroidData: {
          1: mockAsteroid1,
          2: mockAsteroid2,
        },
      });

      expect(screen.getByText('2 asteroids selected')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Ceres' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Pallas' })).toBeInTheDocument();
      expect(screen.getByText('Official Number')).toBeInTheDocument();
      expect(screen.getByText('Diameter')).toBeInTheDocument();
      expect(screen.getByText('939.400')).toBeInTheDocument();
      expect(screen.getByText('512.000')).toBeInTheDocument();
    });

    it('handles mixed complete and incomplete data', () => {
      renderPanel({
        selectedAsteroids: [1, 3],
        asteroidData: {
          1: mockAsteroid1,
          3: mockAsteroidIncomplete,
        },
      });

      expect(screen.getByRole('button', { name: 'Ceres' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Juno' })).toBeInTheDocument();
      expect(screen.getAllByText('N/A').length).toBeGreaterThan(0);
    });
  });

  describe('Layout Switching', () => {
    it('switches from single to multiple view when props change', async () => {
      const { rerender } = renderPanel({
        selectedAsteroids: [1],
        asteroidData: { 1: mockAsteroid1 },
      });

      expect(screen.getByText('1 asteroid selected')).toBeInTheDocument();

      rerender(
        <PropertiesPanel
          selectedAsteroids={[1, 2]}
          asteroidData={{ 1: mockAsteroid1, 2: mockAsteroid2 }}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('2 asteroids selected')).toBeInTheDocument();
      });
    });

    it('switches from multiple to single view when props change', async () => {
      const { rerender } = renderPanel({
        selectedAsteroids: [1, 2],
        asteroidData: { 1: mockAsteroid1, 2: mockAsteroid2 },
      });

      expect(screen.getByText('2 asteroids selected')).toBeInTheDocument();

      rerender(
        <PropertiesPanel
          selectedAsteroids={[1]}
          asteroidData={{ 1: mockAsteroid1 }}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('1 asteroid selected')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper heading hierarchy in single view', () => {
      renderPanel({
        selectedAsteroids: [1],
        asteroidData: { 1: mockAsteroid1 },
      });

      expect(screen.getByRole('heading', { level: 3, name: 'Asteroid Properties' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 4, name: 'Ceres' })).toBeInTheDocument();
      expect(screen.getAllByRole('heading', { level: 5 }).length).toBeGreaterThan(0);
    });

    it('applies custom className prop', () => {
      const { container } = renderPanel({ className: 'custom-class' });

      expect(container.firstChild).toHaveClass('properties-panel');
      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('Number Formatting', () => {
    it('formats large numbers with locale formatting', () => {
      renderPanel({
        selectedAsteroids: [1],
        asteroidData: {
          1: {
            ...mockAsteroid1,
            physical_properties: {
              ...mockAsteroid1.physical_properties,
              diameter: 1234.567,
            },
          },
        },
      });

      expect(screen.getByText('1,234.57')).toBeInTheDocument();
    });

    it('formats small numbers with appropriate precision', () => {
      renderPanel({
        selectedAsteroids: [1],
        asteroidData: {
          1: {
            ...mockAsteroid1,
            physical_properties: {
              ...mockAsteroid1.physical_properties,
              albedo: 0.000123,
            },
          },
        },
      });

      expect(screen.getByText('1.230e-4')).toBeInTheDocument();
    });

    it('handles zero values correctly', () => {
      renderPanel({
        selectedAsteroids: [1],
        asteroidData: {
          1: {
            ...mockAsteroid1,
            orbital_elements: {
              ...mockAsteroid1.orbital_elements,
              eccentricity: 0,
            },
          },
        },
      });

      expect(screen.getByText('0')).toBeInTheDocument();
    });
  });
});
