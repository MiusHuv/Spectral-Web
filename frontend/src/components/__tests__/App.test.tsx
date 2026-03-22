import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

describe('App Component', () => {
  it('renders without crashing', () => {
    render(<App />);
    expect(screen.getByText('Asteroid Spectral Visualization')).toBeInTheDocument();
  });

  it('displays welcome message', () => {
    render(<App />);
    expect(screen.getByText(/Welcome to Asteroid Spectral Visualization/i)).toBeInTheDocument();
  });

  it('shows feature cards', () => {
    render(<App />);
    expect(screen.getByText('Taxonomic Classifications')).toBeInTheDocument();
    expect(screen.getByText('Spectral Analysis')).toBeInTheDocument();
    expect(screen.getByText('Properties Explorer')).toBeInTheDocument();
    expect(screen.getByText('Data Export')).toBeInTheDocument();
  });
});