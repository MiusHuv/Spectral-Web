import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { AppProvider } from '../../context/AppContext'
import { TaxonomyTree } from '../../components/taxonomy/TaxonomyTree'
import { SpectralChart } from '../../components/spectral/SpectralChart'

// Mock large dataset
const generateMockAsteroids = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    official_number: i + 1,
    proper_name: `Asteroid ${i + 1}`,
    bus_demeo_class: ['C', 'S', 'V', 'X'][i % 4],
    tholen_class: ['C', 'S', 'M', 'E'][i % 4],
    orbital_elements: {
      semi_major_axis: 2.0 + Math.random() * 2,
      eccentricity: Math.random() * 0.3,
      inclination: Math.random() * 30,
      orbital_period: 3 + Math.random() * 5
    },
    physical_properties: {
      diameter: 10 + Math.random() * 1000,
      albedo: Math.random() * 0.5,
      rotation_period: 5 + Math.random() * 20
    }
  }))
}

const generateMockSpectralData = (asteroidIds: number[]) => {
  return asteroidIds.map(id => ({
    asteroid_id: id,
    wavelengths: Array.from({ length: 100 }, (_, i) => 0.45 + (i * 0.02)),
    reflectances: Array.from({ length: 100 }, () => 0.5 + Math.random() * 0.5)
  }))
}

describe('Data Loading Performance Tests', () => {
  beforeEach(() => {
    // Mock fetch for performance tests
    global.fetch = vi.fn()
  })

  it('should load large asteroid datasets efficiently', async () => {
    const largeDataset = generateMockAsteroids(1000)
    
    // Mock API response
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        classes: [
          { name: 'C', asteroids: largeDataset.slice(0, 250) },
          { name: 'S', asteroids: largeDataset.slice(250, 500) },
          { name: 'V', asteroids: largeDataset.slice(500, 750) },
          { name: 'X', asteroids: largeDataset.slice(750, 1000) }
        ]
      })
    } as Response)

    const startTime = performance.now()
    
    const { container } = render(
      <AppProvider>
        <TaxonomyTree />
      </AppProvider>
    )

    await waitFor(() => {
      expect(container.querySelector('[data-cy="taxonomy-tree"]')).toBeInTheDocument()
    })

    const endTime = performance.now()
    const loadTime = endTime - startTime

    // Should load within 2 seconds
    expect(loadTime).toBeLessThan(2000)
    
    // Verify virtual scrolling is working for large lists
    const asteroidItems = container.querySelectorAll('[data-cy="asteroid-item"]')
    // Should not render all 1000 items at once (virtual scrolling)
    expect(asteroidItems.length).toBeLessThan(100)
  })

  it('should render spectral charts efficiently with multiple spectra', async () => {
    const spectralData = generateMockSpectralData([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ spectra: spectralData })
    } as Response)

    const startTime = performance.now()
    
    const { container } = render(
      <AppProvider>
        <SpectralChart selectedAsteroids={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]} />
      </AppProvider>
    )

    await waitFor(() => {
      expect(container.querySelector('svg')).toBeInTheDocument()
    })

    const endTime = performance.now()
    const renderTime = endTime - startTime

    // Should render within 1 second
    expect(renderTime).toBeLessThan(1000)
    
    // Verify all spectral lines are rendered
    const spectralLines = container.querySelectorAll('.spectral-line')
    expect(spectralLines.length).toBe(10)
  })

  it('should handle rapid selection changes efficiently', async () => {
    const asteroids = generateMockAsteroids(100)
    
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          classes: [{ name: 'C', asteroids }]
        })
      } as Response)
      .mockResolvedValue({
        ok: true,
        json: async () => ({ spectra: [] })
      } as Response)

    const { container } = render(
      <AppProvider>
        <TaxonomyTree />
      </AppProvider>
    )

    await waitFor(() => {
      expect(container.querySelector('[data-cy="taxonomy-tree"]')).toBeInTheDocument()
    })

    const startTime = performance.now()
    
    // Simulate rapid selection changes
    const checkboxes = container.querySelectorAll('input[type="checkbox"]')
    for (let i = 0; i < Math.min(10, checkboxes.length); i++) {
      checkboxes[i].click()
    }

    const endTime = performance.now()
    const selectionTime = endTime - startTime

    // Should handle rapid selections within 500ms
    expect(selectionTime).toBeLessThan(500)
  })

  it('should optimize memory usage with large datasets', async () => {
    const initialMemory = (performance as any).memory?.usedJSHeapSize || 0
    
    const largeDataset = generateMockAsteroids(5000)
    
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        classes: [{ name: 'C', asteroids: largeDataset }]
      })
    } as Response)

    const { unmount } = render(
      <AppProvider>
        <TaxonomyTree />
      </AppProvider>
    )

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled()
    })

    const peakMemory = (performance as any).memory?.usedJSHeapSize || 0
    
    // Cleanup
    unmount()
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc()
    }
    
    const finalMemory = (performance as any).memory?.usedJSHeapSize || 0
    
    // Memory should not increase by more than 50MB
    const memoryIncrease = (peakMemory - initialMemory) / (1024 * 1024)
    expect(memoryIncrease).toBeLessThan(50)
    
    // Memory should be mostly cleaned up after unmount
    const memoryLeak = (finalMemory - initialMemory) / (1024 * 1024)
    expect(memoryLeak).toBeLessThan(10)
  })

  it('should debounce search and filter operations', async () => {
    let callCount = 0
    
    vi.mocked(fetch).mockImplementation(async () => {
      callCount++
      return {
        ok: true,
        json: async () => ({ classes: [] })
      } as Response
    })

    const { container } = render(
      <AppProvider>
        <TaxonomyTree />
      </AppProvider>
    )

    const searchInput = container.querySelector('input[type="search"]')
    
    if (searchInput) {
      // Simulate rapid typing
      const searchTerms = ['a', 'as', 'ast', 'aste', 'aster', 'astero', 'asteroi', 'asteroid']
      
      for (const term of searchTerms) {
        searchInput.value = term
        searchInput.dispatchEvent(new Event('input', { bubbles: true }))
      }
      
      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 600))
      
      // Should only make one API call due to debouncing
      expect(callCount).toBeLessThanOrEqual(2) // Initial load + debounced search
    }
  })
})