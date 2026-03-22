import { mockAsteroidData, mockSpectralData, mockClassifications } from '../support/commands'

describe('Asteroid Exploration Workflow', () => {
  beforeEach(() => {
    // Mock API responses
    cy.mockApiResponse('classifications', mockClassifications)
    cy.mockApiResponse('classifications/bus_demeo/asteroids', {
      classes: [
        {
          name: 'C',
          asteroids: [mockAsteroidData.asteroids[0]]
        },
        {
          name: 'V', 
          asteroids: [mockAsteroidData.asteroids[1]]
        }
      ]
    })
    cy.mockApiResponse('spectra/batch', mockSpectralData)
    cy.mockApiResponse('asteroids/batch', mockAsteroidData)
    
    cy.visit('/')
  })

  it('should complete full asteroid exploration workflow', () => {
    // Step 1: Verify initial page load
    cy.dataCy('app-header').should('be.visible')
    cy.dataCy('taxonomy-tree').should('be.visible')
    cy.dataCy('spectral-chart').should('be.visible')
    cy.dataCy('properties-panel').should('be.visible')

    // Step 2: Browse taxonomic classifications
    cy.dataCy('classification-system-selector').should('contain', 'Bus-DeMeo')
    cy.dataCy('taxonomy-tree').within(() => {
      cy.contains('C').should('be.visible')
      cy.contains('V').should('be.visible')
    })

    // Step 3: Expand classification and select asteroids
    cy.dataCy('taxonomy-tree').within(() => {
      cy.contains('C').click()
      cy.waitForApi('classifications')
      
      // Select Ceres
      cy.contains('Ceres').parent().find('[data-cy="asteroid-checkbox"]').check()
    })

    // Step 4: Verify spectral chart updates
    cy.dataCy('spectral-chart').within(() => {
      cy.get('svg').should('be.visible')
      cy.get('.spectral-line').should('have.length', 1)
    })

    // Step 5: Verify properties panel updates
    cy.dataCy('properties-panel').within(() => {
      cy.contains('Ceres').should('be.visible')
      cy.contains('939.4').should('be.visible') // diameter
      cy.contains('2.77').should('be.visible') // semi-major axis
    })

    // Step 6: Select multiple asteroids for comparison
    cy.dataCy('taxonomy-tree').within(() => {
      cy.contains('V').click()
      cy.contains('Vesta').parent().find('[data-cy="asteroid-checkbox"]').check()
    })

    // Step 7: Verify multiple spectra display
    cy.dataCy('spectral-chart').within(() => {
      cy.get('.spectral-line').should('have.length', 2)
      cy.get('.chart-legend').should('be.visible')
    })

    // Step 8: Test interactive features
    cy.dataCy('spectral-chart').within(() => {
      // Test hover tooltip
      cy.get('.spectral-line').first().trigger('mouseover')
      cy.get('.tooltip').should('be.visible')
      
      // Test zoom functionality
      cy.get('svg').trigger('wheel', { deltaY: -100 })
      cy.get('.zoom-controls').should('be.visible')
    })

    // Step 9: Switch classification systems
    cy.dataCy('classification-system-selector').click()
    cy.contains('Tholen').click()
    cy.waitForApi('classifications')

    // Step 10: Verify selection persistence
    cy.dataCy('selection-counter').should('contain', '2 selected')

    // Step 11: Test export functionality
    cy.dataCy('export-button').click()
    cy.dataCy('export-modal').should('be.visible')
    cy.dataCy('export-format-png').click()
    cy.dataCy('export-confirm').click()

    // Step 12: Clear selections
    cy.dataCy('clear-selections').click()
    cy.dataCy('selection-counter').should('contain', '0 selected')
    cy.dataCy('spectral-chart').within(() => {
      cy.get('.spectral-line').should('have.length', 0)
    })
  })

  it('should handle error states gracefully', () => {
    // Mock API error
    cy.intercept('GET', '**/api/classifications**', { statusCode: 500 }).as('classificationsError')
    
    cy.visit('/')
    cy.waitForApi('classificationsError')
    
    // Verify error message display
    cy.dataCy('error-message').should('be.visible')
    cy.dataCy('error-message').should('contain', 'Failed to load classifications')
    
    // Verify retry functionality
    cy.dataCy('retry-button').should('be.visible')
  })

  it('should handle missing spectral data', () => {
    // Mock empty spectral data
    cy.mockApiResponse('spectra/batch', { spectra: [] })
    
    cy.visit('/')
    
    // Select an asteroid
    cy.dataCy('taxonomy-tree').within(() => {
      cy.contains('C').click()
      cy.contains('Ceres').parent().find('[data-cy="asteroid-checkbox"]').check()
    })
    
    // Verify appropriate message for missing spectral data
    cy.dataCy('spectral-chart').within(() => {
      cy.contains('No spectral data available').should('be.visible')
    })
  })

  it('should respect maximum selection limits', () => {
    // Mock many asteroids
    const manyAsteroids = Array.from({ length: 15 }, (_, i) => ({
      ...mockAsteroidData.asteroids[0],
      id: i + 1,
      proper_name: `Asteroid ${i + 1}`
    }))
    
    cy.mockApiResponse('classifications/bus_demeo/asteroids', {
      classes: [{
        name: 'C',
        asteroids: manyAsteroids
      }]
    })
    
    cy.visit('/')
    
    // Try to select more than maximum allowed
    cy.dataCy('taxonomy-tree').within(() => {
      cy.contains('C').click()
      
      // Select first 10 asteroids (assuming max is 10)
      for (let i = 1; i <= 12; i++) {
        cy.contains(`Asteroid ${i}`).parent().find('[data-cy="asteroid-checkbox"]').click()
      }
    })
    
    // Verify warning message appears
    cy.dataCy('selection-warning').should('be.visible')
    cy.dataCy('selection-warning').should('contain', 'Maximum selection limit reached')
  })
})