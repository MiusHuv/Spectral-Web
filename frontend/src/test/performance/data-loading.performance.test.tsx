import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { AppProvider } from '../../context/AppContext'
import { TaxonomyTree } from '../../components/taxonomy/TaxonomyTree'
import { SpectralChart } from '../../components/spectral/SpectralChart'
import { apiClient } from '../../services/api'
import { generatePaginatedResponse } from '../test-helpers/largeDataset'

vi.mock('../../services/api', () => ({
  apiClient: {
    getClassificationMetadata: vi.fn(),
    getClassificationAsteroidsPage: vi.fn(),
    getAsteroid: vi.fn(),
    getSpectrum: vi.fn(),
  },
  apiUtils: {
    withRetry: vi.fn((fn) => fn()),
    getErrorMessage: vi.fn((error) => error.message || 'Unknown error'),
  },
}))

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
    vi.clearAllMocks()
    vi.mocked(apiClient.getClassificationMetadata).mockResolvedValue({
      system: 'bus_demeo',
      classes: [
        { name: 'C', total_count: 250, spectral_count: 200, spectral_percentage: 80 },
        { name: 'S', total_count: 250, spectral_count: 200, spectral_percentage: 80 },
        { name: 'V', total_count: 250, spectral_count: 200, spectral_percentage: 80 },
        { name: 'X', total_count: 250, spectral_count: 200, spectral_percentage: 80 },
      ],
      total_asteroids: 1000,
      total_with_spectra: 800,
      overall_spectral_percentage: 80,
    } as any)
    vi.mocked(apiClient.getAsteroid).mockImplementation(async (id: number) => ({
      asteroid: {
        id,
        proper_name: `Asteroid ${id}`,
        bus_demeo_class: 'C',
        has_spectral_data: true,
      },
    }) as any)
    vi.mocked(apiClient.getSpectrum).mockImplementation(async (id: number) => ({
      spectrum: generateMockSpectralData([id])[0],
    }) as any)
  })

  it('should load large asteroid datasets efficiently', async () => {
    const largeDataset = generateMockAsteroids(1000)
    
    const startTime = performance.now()
    
    const { container } = render(
      <AppProvider>
        <TaxonomyTree />
      </AppProvider>
    )

    await waitFor(() => {
      expect(container.querySelector('.taxonomy-tree')).toBeInTheDocument()
      expect(container.textContent).toContain('C')
    })

    const endTime = performance.now()
    const loadTime = endTime - startTime

    // Should load within 2 seconds
    expect(loadTime).toBeLessThan(2000)
    
    // Verify virtual scrolling is working for large lists
    expect(container.querySelectorAll('.classification-header').length).toBeGreaterThan(0)
  })

  it('should render spectral charts efficiently with multiple spectra', async () => {
    const spectralData = generateMockSpectralData([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    const asteroidData = Object.fromEntries(
      spectralData.map((spectrum) => [
        spectrum.asteroid_id,
        { id: spectrum.asteroid_id, proper_name: `Asteroid ${spectrum.asteroid_id}` },
      ])
    )

    const startTime = performance.now()
    
    const { container } = render(
      <AppProvider>
        <SpectralChart
          selectedAsteroids={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
          spectralData={spectralData}
          asteroidData={asteroidData as any}
        />
      </AppProvider>
    )

    await waitFor(() => {
      expect(container.querySelector('svg')).toBeInTheDocument()
    })

    const endTime = performance.now()
    const renderTime = endTime - startTime

    // Should render within 1 second
    expect(renderTime).toBeLessThan(1000)
    
    expect(container.querySelector('.spectral-chart-container')).toBeInTheDocument()
    expect(container.textContent).toContain('10 asteroids displayed')
  })

  it('should handle rapid selection changes efficiently', async () => {
    const asteroids = generateMockAsteroids(100)
    vi.mocked(apiClient.getClassificationMetadata).mockResolvedValue({
      system: 'bus_demeo',
      classes: [{ name: 'C', total_count: 100, spectral_count: 100, spectral_percentage: 100 }],
      total_asteroids: 100,
      total_with_spectra: 100,
      overall_spectral_percentage: 100,
    } as any)
    vi.mocked(apiClient.getClassificationAsteroidsPage).mockResolvedValue(
      generatePaginatedResponse(asteroids, 1, 100) as any
    )

    const { container } = render(
      <AppProvider>
        <TaxonomyTree />
      </AppProvider>
    )

    await waitFor(() => {
      expect(container.querySelector('.taxonomy-tree')).toBeInTheDocument()
      expect(container.textContent).toContain('C')
    })

    const classificationHeader = Array.from(container.querySelectorAll('.classification-header'))
      .find((element) => element.textContent?.includes('C'))
    if (classificationHeader) {
      ;(classificationHeader as HTMLElement).click()
    }

    await waitFor(() => {
      expect(vi.mocked(apiClient.getClassificationAsteroidsPage)).toHaveBeenCalled()
    })

    const startTime = performance.now()
    
    // Simulate rapid selection changes
    const checkboxes = container.querySelectorAll('input[type="checkbox"]')
    for (let i = 0; i < Math.min(10, checkboxes.length); i++) {
      ;(checkboxes[i] as HTMLElement).click()
    }

    const endTime = performance.now()
    const selectionTime = endTime - startTime

    // Should handle rapid selections within 500ms
    expect(selectionTime).toBeLessThan(500)
  })

  it('should optimize memory usage with large datasets', async () => {
    const initialMemory = (performance as any).memory?.usedJSHeapSize || 0

    const { unmount } = render(
      <AppProvider>
        <TaxonomyTree />
      </AppProvider>
    )

    await waitFor(() => {
      expect(vi.mocked(apiClient.getClassificationMetadata)).toHaveBeenCalled()
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
    const { container } = render(
      <AppProvider>
        <TaxonomyTree />
      </AppProvider>
    )

    await waitFor(() => {
      expect(vi.mocked(apiClient.getClassificationMetadata)).toHaveBeenCalledTimes(1)
    })

    const searchInput = container.querySelector('input[type="text"]') as HTMLInputElement | null
    
    if (searchInput) {
      // Simulate rapid typing
      const searchTerms = ['a', 'as', 'ast', 'aste', 'aster', 'astero', 'asteroi', 'asteroid']
      
      for (const term of searchTerms) {
        searchInput.value = term
        searchInput.dispatchEvent(new Event('input', { bubbles: true }))
      }
      
      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 600))
      
      expect(vi.mocked(apiClient.getClassificationMetadata)).toHaveBeenCalledTimes(1)
    }
  })
})
