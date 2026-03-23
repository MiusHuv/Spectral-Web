import { act } from 'react'
import { describe, it, expect, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { SpectralChart } from '../../components/spectral/SpectralChart'

// Generate high-resolution spectral data for performance testing
const generateHighResSpectralData = (asteroidCount: number, pointCount: number = 1000) => {
  return Array.from({ length: asteroidCount }, (_, i) => ({
    asteroid_id: i + 1,
    wavelengths: Array.from({ length: pointCount }, (_, j) => 0.45 + (j * 0.002)),
    reflectances: Array.from({ length: pointCount }, (_, j) => {
      // Generate realistic spectral curve with noise
      const base = 0.5 + 0.3 * Math.sin((j / pointCount) * Math.PI * 2)
      const noise = (Math.random() - 0.5) * 0.1
      return Math.max(0, Math.min(1, base + noise))
    })
  }))
}

describe('Chart Rendering Performance Tests', () => {
  beforeEach(() => {
    // Mock D3 performance optimizations
    Object.defineProperty(window, 'requestAnimationFrame', {
      value: (callback: FrameRequestCallback) => setTimeout(callback, 16),
      writable: true
    })
  })

  const buildAsteroidData = (count: number) =>
    Object.fromEntries(
      Array.from({ length: count }, (_, index) => [
        index + 1,
        { id: index + 1, proper_name: `Asteroid ${index + 1}` }
      ])
    )

  it('should render high-resolution spectral data efficiently', async () => {
    const highResData = generateHighResSpectralData(1, 2000) // 2000 data points

    const startTime = performance.now()
    
    const { container } = render(
      <SpectralChart
        data={highResData}
        asteroidData={buildAsteroidData(1)}
      />
    )

    await waitFor(() => {
      expect(container.querySelector('svg')).toBeInTheDocument()
      expect(container.querySelector('.spectral-line')).toBeInTheDocument()
    })

    const endTime = performance.now()
    const renderTime = endTime - startTime

    // Should render high-res data within 1 second
    expect(renderTime).toBeLessThan(1000)
    
    // Verify SVG path is created
    const path = container.querySelector('.spectral-line')
    expect(path).toBeInTheDocument()
  })

  it('should handle multiple overlaid spectra efficiently', async () => {
    const multipleSpectra = generateHighResSpectralData(10, 500) // 10 spectra, 500 points each

    const startTime = performance.now()
    
    const { container } = render(
      <SpectralChart
        data={multipleSpectra}
        asteroidData={buildAsteroidData(10)}
      />
    )

    await waitFor(() => {
      const spectralLines = container.querySelectorAll('.spectral-line')
      expect(spectralLines.length).toBe(10)
    })

    const endTime = performance.now()
    const renderTime = endTime - startTime

    // Should render 10 spectra within 2 seconds
    expect(renderTime).toBeLessThan(2000)
  })

  it('should optimize zoom and pan operations', async () => {
    const spectralData = generateHighResSpectralData(3, 1000)

    const { container } = render(
      <SpectralChart
        data={spectralData}
        asteroidData={buildAsteroidData(3)}
      />
    )

    await waitFor(() => {
      expect(container.querySelector('svg')).toBeInTheDocument()
    })

    const svg = container.querySelector('svg')!
    
    // Measure zoom performance
    const startTime = performance.now()

    await act(async () => {
      // Simulate zoom operations
      for (let i = 0; i < 10; i++) {
        svg.dispatchEvent(new WheelEvent('wheel', {
          deltaY: -100,
          bubbles: true
        }))
      }
    })

    const endTime = performance.now()
    const zoomTime = endTime - startTime

    await act(async () => {
      // Let asynchronous chart updates settle without baking timer delay into the metric.
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    // Measure interaction cost, not timer scheduling overhead.
    // Keep a strict upper bound but tolerate renderer/timer variance in CI.
    expect(zoomTime).toBeLessThan(700)
  })

  it('should efficiently update chart when data changes', async () => {
    const initialData = generateHighResSpectralData(2, 500)
    const updatedData = generateHighResSpectralData(4, 500)

    const { container, rerender } = render(
      <SpectralChart
        data={initialData}
        asteroidData={buildAsteroidData(2)}
      />
    )

    await waitFor(() => {
      expect(container.querySelectorAll('.spectral-line').length).toBe(2)
    })

    const startTime = performance.now()
    
    // Update with more asteroids
    rerender(
      <SpectralChart
        data={updatedData}
        asteroidData={buildAsteroidData(4)}
      />
    )

    await waitFor(() => {
      expect(container.querySelectorAll('.spectral-line').length).toBe(4)
    })

    const endTime = performance.now()
    const updateTime = endTime - startTime

    // Chart updates should be fast (< 500ms)
    expect(updateTime).toBeLessThan(500)
  })

  it('should handle tooltip interactions efficiently', async () => {
    const spectralData = generateHighResSpectralData(1, 1000)

    const { container } = render(
      <SpectralChart
        data={spectralData}
        asteroidData={buildAsteroidData(1)}
      />
    )

    await waitFor(() => {
      expect(container.querySelector('.spectral-line')).toBeInTheDocument()
    })

    const spectralLine = container.querySelector('.spectral-line-overlay')!
    
    const startTime = performance.now()
    
    await act(async () => {
      // Simulate rapid mouse movements for tooltip
      for (let i = 0; i < 50; i++) {
        spectralLine.dispatchEvent(new MouseEvent('mousemove', {
          clientX: 100 + i * 2,
          clientY: 100,
          bubbles: true
        }))
      }
    })
    
    const endTime = performance.now()
    const tooltipTime = endTime - startTime

    // Full-suite jsdom execution can make 50 synthetic mousemoves noticeably slower.
    expect(tooltipTime).toBeLessThan(250)
  })

  it('should optimize legend rendering with many items', async () => {
    const manySpectra = generateHighResSpectralData(20, 100) // 20 different spectra

    const startTime = performance.now()
    
    const { container } = render(
      <SpectralChart
        data={manySpectra}
        asteroidData={buildAsteroidData(20)}
      />
    )

    await waitFor(() => {
      expect(container.querySelector('.legend')).toBeInTheDocument()
    })

    const endTime = performance.now()
    const legendTime = endTime - startTime

    // Legend with 20 items should render quickly
    expect(legendTime).toBeLessThan(500)
    
    // Verify all legend items are present
    const legendItems = container.querySelectorAll('.legend-item')
    expect(legendItems.length).toBe(20)
  })

  it('should handle canvas fallback for very large datasets', async () => {
    const massiveData = generateHighResSpectralData(1, 10000) // 10,000 data points

    const startTime = performance.now()
    
    const { container } = render(
      <SpectralChart
        data={massiveData}
        asteroidData={buildAsteroidData(1)}
      />
    )

    await waitFor(() => {
      // Should either render SVG efficiently or fall back to canvas
      const hasVisualization = container.querySelector('svg') || container.querySelector('canvas')
      expect(hasVisualization).toBeInTheDocument()
    })

    const endTime = performance.now()
    const renderTime = endTime - startTime

    // Even massive datasets should render within 3 seconds
    expect(renderTime).toBeLessThan(3000)
  })
})
