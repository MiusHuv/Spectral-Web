import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

describe('App Component', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        json: async () => ({
          stats: {
            total_asteroids: 1234,
            total_observations: 5678,
            bus_demeo_classes: 24,
            tholen_classes: 12,
          },
        }),
      })) as any
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the current home page without crashing', () => {
    render(<App />);

    expect(screen.getByText('Asteroid & Meteorite Spectral Database')).toBeInTheDocument();
    expect(
      screen.getByText('Professional spectral data library for asteroids and meteorites')
    ).toBeInTheDocument();
  });

  it('displays the search experience and quick links', () => {
    render(<App />);

    expect(
      screen.getByPlaceholderText('Search by name, number, or classification...')
    ).toBeInTheDocument();
    expect(screen.getByText('Quick Links')).toBeInTheDocument();
    expect(screen.getByText('Carbonaceous Chondrite')).toBeInTheDocument();
    expect(screen.getByText('S-type Asteroids')).toBeInTheDocument();
  });

  it('shows the current data cards', () => {
    render(<App />);

    expect(screen.getByText('Meteorite Data')).toBeInTheDocument();
    expect(screen.getByText('Asteroid Data')).toBeInTheDocument();
    expect(screen.getByText('Browse Meteorites')).toBeInTheDocument();
    expect(screen.getByText('Browse Asteroids')).toBeInTheDocument();
  });
});
