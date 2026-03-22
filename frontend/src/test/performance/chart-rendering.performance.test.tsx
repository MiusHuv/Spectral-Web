import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { SpectralChart } from '../../components/spectral/SpectralChart'
import { AppProvider } from '../../context/AppContext'

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
    global.fetch = vi.fn()
    
    // Mock D3 performance optimizations
    Object.defineProperty(window, 'requestAnimationFrame', {
      value: (callback: FrameRequestCallback) => setTimeout(callback, 16),
      writable: true
    })
  })

  it('should render high-resolution spectral data efficiently', async () => {
    const highResData = generateHighResSpectralData(1, 2000) // 2000 data points
    
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ spectra: highResData })
    } as Response)

    const startTime = performance.now()
    
    const { container } = render(
      <AppProvider>
        <SpectralChart selectedAsteroids={[1]} />
      </AppProvider>
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
    const path = container.querySelector('.spectral-line path')
    expect(path).toBeInTheDocument()
  })

  it('should handle multiple overlaid spectra efficiently', async () => {
    const multipleSpectra = generateHighResSpectralData(10, 500) // 10 spectra, 500 points each
    
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ spectra: multipleSpectra })
    } as Response)

    const startTime = performance.now()
    
    const { container } = render(
      <AppProvider>
        <SpectralChart selectedAsteroids={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]} />
      </AppProvider>
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
    
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ spectra: spectralData })
    } as Response)

    const { container } = render(
      <AppProvider>
        <SpectralChart selectedAsteroids={[1, 2, 3]} />
      </AppProvider>
    )

    await waitFor(() => {
      expect(container.querySelector('svg')).toBeInTheDocument()
    })

    const svg = container.querySelector('svg')!
    
    // Measure zoom performance
    const startTime = performance.now()
    
    // Simulate zoom operations
    for (let i = 0; i < 10; i++) {
      svg.dispatchEvent(new WheelEvent('wheel', {
        deltaY: -100,
        bubbles: true
      }))
    }
    
    // Wait for zoom operations to complete
    await new Promise(resolve => setTimeout(resolve, 100))
    
    const endTime = performance.now()
    const zoomTime = endTime - startTime

    // Zoom operations should be smooth (< 200ms for 10 operations)
    expect(zoomTime).toBeLessThan(200)
  })

  it('should efficiently update chart when data changes', async () => {
    const initialData = generateHighResSpectralData(2, 500)
    const updatedData = generateHighResSpectralData(4, 500)
    
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ spectra: initialData })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ spectra: updatedData })
      } as Response)

    const { container, rerender } = render(
      <AppProvider>
        <SpectralChart selectedAsteroids={[1, 2]} />
      </AppProvider>
    )

    await waitFor(() => {
      expect(container.querySelectorAll('.spectral-line').length).toBe(2)
    })

    const startTime = performance.now()
    
    // Update with more asteroids
    rerender(
      <AppProvider>
        <SpectralChart selectedAsteroids={[1, 2, 3, 4]} />
      </AppProvider>
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
    
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ spectra: spectralData })
    } as Response)

    const { container } = render(
      <AppProvider>
        <SpectralChart selectedAsteroids={[1]} />
      </AppProvider>
    )

    await waitFor(() => {
      expect(container.querySelector('.spectral-line')).toBeInTheDocument()
    })

    const spectralLine = container.querySelector('.spectral-line')!
    
    const startTime = performance.now()
    
    // Simulate rapid mouse movements for tooltip
    for (let i = 0; i < 50; i++) {
      spectralLine.dispatchEvent(new MouseEvent('mousemove', {
        clientX: 100 + i * 2,
        clientY: 100,
        bubbles: true
      }))
    }
    
    const endTime = performance.now()
    const tooltipTime = endTime - startTime

    // Tooltip interactions should be responsive (< 100ms for 50 movements)
    expect(tooltipTime).toBeLessThan(100)
  })

  it('should optimize legend rendering with many items', async () => {
    const manySpectra = generateHighResSpectralData(20, 100) // 20 different spectra
    
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ spectra: manySpectra })
    } as Response)

    const startTime = performance.now()
    
    const { container } = render(
      <AppProvider>
        <SpectralChart selectedAsteroids={Array.from({ length: 20 }, (_, i) => i + 1)} />
      </AppProvider>
    )

    await waitFor(() => {
      expect(container.querySelector('.chart-legend')).toBeInTheDocument()
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
    
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ spectra: massiveData })
    } as Response)

    const startTime = performance.now()
    
    const { container } = render(
      <AppProvider>
        <SpectralChart selectedAsteroids={[1]} />
      </AppProvider>
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