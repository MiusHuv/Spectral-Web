import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { AppProvider } from '../../context/AppContext'
import { TaxonomyTree } from '../../components/taxonomy/TaxonomyTree'
import SpectralChart from '../../components/spectral/SpectralChart'
import PropertiesPanel from '../../components/properties/PropertiesPanel'
import { ExportManager } from '../../components/export/ExportManager'

// Mock data for consistent visual tests
const mockAsteroidData = {
  asteroids: [
    {
      id: 1,
      official_number: 1,
      proper_name: 'Ceres',
      bus_demeo_class: 'C',
      tholen_class: 'G',
      orbital_elements: {
        semi_major_axis: 2.77,
        eccentricity: 0.076,
        inclination: 10.6,
        orbital_period: 4.6
      },
      physical_properties: {
        diameter: 939.4,
        albedo: 0.09,
        rotation_period: 9.07
      }
    },
    {
      id: 2,
      official_number: 4,
      proper_name: 'Vesta',
      bus_demeo_class: 'V',
      tholen_class: 'V',
      orbital_elements: {
        semi_major_axis: 2.36,
        eccentricity: 0.089,
        inclination: 7.1,
        orbital_period: 3.6
      },
      physical_properties: {
        diameter: 525.4,
        albedo: 0.42,
        rotation_period: 5.34
      }
    }
  ]
}

const mockSpectralData = {
  spectra: [
    {
      asteroid_id: 1,
      wavelengths: [0.45, 0.55, 0.65, 0.75, 0.85, 0.95, 1.05, 1.15, 1.25, 1.35],
      reflectances: [0.8, 0.85, 0.9, 0.88, 0.86, 0.84, 0.82, 0.80, 0.78, 0.76]
    },
    {
      asteroid_id: 2,
      wavelengths: [0.45, 0.55, 0.65, 0.75, 0.85, 0.95, 1.05, 1.15, 1.25, 1.35],
      reflectances: [0.9, 0.95, 1.0, 0.98, 0.96, 0.94, 0.92, 0.90, 0.88, 0.86]
    }
  ]
}

// Helper function to create consistent snapshots
const createSnapshot = (component: JSX.Element) => {
  const { container } = render(component)
  return container.innerHTML
}

describe('Visual Regression Tests', () => {
  beforeEach(() => {
    // Mock fetch for consistent data
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockAsteroidData
    } as Response)
  })

  describe('TaxonomyTree Component', () => {
    it('should render empty state consistently', () => {
      const snapshot = createSnapshot(
        <AppProvider>
          <TaxonomyTree />
        </AppProvider>
      )
      expect(snapshot).toMatchSnapshot('taxonomy-tree-empty.html')
    })

    it('should render with classifications consistently', () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          classes: [
            { name: 'C', asteroids: [mockAsteroidData.asteroids[0]] },
            { name: 'V', asteroids: [mockAsteroidData.asteroids[1]] }
          ]
        })
      } as Response)

      const snapshot = createSnapshot(
        <AppProvider>
          <TaxonomyTree />
        </AppProvider>
      )
      expect(snapshot).toMatchSnapshot('taxonomy-tree-with-data.html')
    })

    it('should render loading state consistently', () => {
      vi.mocked(fetch).mockImplementation(() => new Promise(() => {})) // Never resolves

      const snapshot = createSnapshot(
        <AppProvider>
          <TaxonomyTree />
        </AppProvider>
      )
      expect(snapshot).toMatchSnapshot('taxonomy-tree-loading.html')
    })

    it('should render error state consistently', () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

      const snapshot = createSnapshot(
        <AppProvider>
          <TaxonomyTree />
        </AppProvider>
      )
      expect(snapshot).toMatchSnapshot('taxonomy-tree-error.html')
    })
  })

  describe('SpectralChart Component', () => {
    it('should render empty chart consistently', () => {
      const snapshot = createSnapshot(
        <AppProvider>
          <SpectralChart selectedAsteroids={[]} />
        </AppProvider>
      )
      expect(snapshot).toMatchSnapshot('spectral-chart-empty.html')
    })

    it('should render single spectrum consistently', () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ spectra: [mockSpectralData.spectra[0]] })
      } as Response)

      const snapshot = createSnapshot(
        <AppProvider>
          <SpectralChart selectedAsteroids={[1]} />
        </AppProvider>
      )
      expect(snapshot).toMatchSnapshot('spectral-chart-single.html')
    })

    it('should render multiple spectra consistently', () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSpectralData
      } as Response)

      const snapshot = createSnapshot(
        <AppProvider>
          <SpectralChart selectedAsteroids={[1, 2]} />
        </AppProvider>
      )
      expect(snapshot).toMatchSnapshot('spectral-chart-multiple.html')
    })

    it('should render no data message consistently', () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ spectra: [] })
      } as Response)

      const snapshot = createSnapshot(
        <AppProvider>
          <SpectralChart selectedAsteroids={[1]} />
        </AppProvider>
      )
      expect(snapshot).toMatchSnapshot('spectral-chart-no-data.html')
    })
  })

  describe('PropertiesPanel Component', () => {
    it('should render empty panel consistently', () => {
      const snapshot = createSnapshot(
        <AppProvider>
          <PropertiesPanel selectedAsteroids={[]} />
        </AppProvider>
      )
      expect(snapshot).toMatchSnapshot('properties-panel-empty.html')
    })

    it('should render single asteroid properties consistently', () => {
      const snapshot = createSnapshot(
        <AppProvider>
          <PropertiesPanel 
            selectedAsteroids={[1]} 
            asteroidData={[mockAsteroidData.asteroids[0]]} 
          />
        </AppProvider>
      )
      expect(snapshot).toMatchSnapshot('properties-panel-single.html')
    })

    it('should render multiple asteroid comparison consistently', () => {
      const snapshot = createSnapshot(
        <AppProvider>
          <PropertiesPanel 
            selectedAsteroids={[1, 2]} 
            asteroidData={mockAsteroidData.asteroids} 
          />
        </AppProvider>
      )
      expect(snapshot).toMatchSnapshot('properties-panel-comparison.html')
    })

    it('should render missing data placeholders consistently', () => {
      const incompleteData = {
        ...mockAsteroidData.asteroids[0],
        physical_properties: {
          diameter: null,
          albedo: undefined,
          rotation_period: 9.07
        }
      }

      const snapshot = createSnapshot(
        <AppProvider>
          <PropertiesPanel 
            selectedAsteroids={[1]} 
            asteroidData={[incompleteData]} 
          />
        </AppProvider>
      )
      expect(snapshot).toMatchSnapshot('properties-panel-missing-data.html')
    })
  })

  describe('ExportManager Component', () => {
    it('should render closed state consistently', () => {
      const snapshot = createSnapshot(
        <AppProvider>
          <ExportManager selectedAsteroidIds={[]} />
        </AppProvider>
      )
      expect(snapshot).toMatchSnapshot('export-manager-closed.html')
    })

    it('should render export options consistently', () => {
      const snapshot = createSnapshot(
        <AppProvider>
          <ExportManager selectedAsteroidIds={[1, 2]} />
        </AppProvider>
      )
      expect(snapshot).toMatchSnapshot('export-manager-open.html')
    })

    it('should render export progress consistently', () => {
      const snapshot = createSnapshot(
        <AppProvider>
          <ExportManager 
            selectedAsteroidIds={[1, 2]} 
          />
        </AppProvider>
      )
      expect(snapshot).toMatchSnapshot('export-manager-progress.html')
    })
  })

  describe('Responsive Layout Snapshots', () => {
    const viewports = [
      { name: 'desktop', width: 1280, height: 720 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'mobile', width: 375, height: 667 }
    ]

    viewports.forEach(viewport => {
      it(`should render layout consistently on ${viewport.name}`, () => {
        // Mock viewport dimensions
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: viewport.width,
        })
        Object.defineProperty(window, 'innerHeight', {
          writable: true,
          configurable: true,
          value: viewport.height,
        })

        const snapshot = createSnapshot(
          <AppProvider>
            <div className="main-layout">
              <TaxonomyTree />
              <SpectralChart selectedAsteroids={[1]} />
              <PropertiesPanel selectedAsteroids={[1]} />
            </div>
          </AppProvider>
        )
        expect(snapshot).toMatchSnapshot(`layout-${viewport.name}.html`)
      })
    })
  })

  describe('Theme Consistency', () => {
    it('should render light theme consistently', () => {
      const snapshot = createSnapshot(
        <div data-theme="light">
          <AppProvider>
            <TaxonomyTree />
          </AppProvider>
        </div>
      )
      expect(snapshot).toMatchSnapshot('theme-light.html')
    })

    it('should render dark theme consistently', () => {
      const snapshot = createSnapshot(
        <div data-theme="dark">
          <AppProvider>
            <TaxonomyTree />
          </AppProvider>
        </div>
      )
      expect(snapshot).toMatchSnapshot('theme-dark.html')
    })
  })
})