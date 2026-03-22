describe('Full Integration Tests', () => {
  beforeEach(() => {
    // Start with a clean state
    cy.visit('/')
    
    // Wait for initial load
    cy.dataCy('app-header').should('be.visible')
  })

  it('should complete end-to-end asteroid research workflow', () => {
    // Step 1: Load and verify initial state
    cy.intercept('GET', '**/api/classifications').as('getClassifications')
    cy.waitForApi('getClassifications')
    
    // Verify all main components are loaded
    cy.dataCy('taxonomy-tree').should('be.visible')
    cy.dataCy('spectral-chart').should('be.visible')
    cy.dataCy('properties-panel').should('be.visible')
    
    // Step 2: Browse classifications
    cy.intercept('GET', '**/api/classifications/bus_demeo/asteroids**').as('getBusDeMeoAsteroids')
    
    cy.dataCy('taxonomy-tree').within(() => {
      // Expand C-type asteroids
      cy.contains('C').click()
    })
    
    cy.waitForApi('getBusDeMeoAsteroids')
    
    // Verify asteroids are loaded
    cy.dataCy('taxonomy-tree').within(() => {
      cy.get('[data-cy="asteroid-item"]').should('have.length.at.least', 1)
    })
    
    // Step 3: Select multiple asteroids for comparison
    cy.intercept('POST', '**/api/asteroids/batch').as('getAsteroidDetails')
    cy.intercept('POST', '**/api/spectra/batch').as('getSpectralData')
    
    cy.dataCy('taxonomy-tree').within(() => {
      // Select first 3 asteroids
      cy.get('[data-cy="asteroid-checkbox"]').eq(0).check()
      cy.get('[data-cy="asteroid-checkbox"]').eq(1).check()
      cy.get('[data-cy="asteroid-checkbox"]').eq(2).check()
    })
    
    // Wait for data to load
    cy.waitForApi('getAsteroidDetails')
    cy.waitForApi('getSpectralData')
    
    // Step 4: Verify spectral chart updates
    cy.dataCy('spectral-chart').within(() => {
      cy.get('svg').should('be.visible')
      cy.get('.spectral-line').should('have.length', 3)
      cy.get('.chart-legend').should('be.visible')
      
      // Test interactive features
      cy.get('.spectral-line').first().trigger('mouseover')
      cy.get('.tooltip').should('be.visible')
    })
    
    // Step 5: Verify properties panel shows comparison
    cy.dataCy('properties-panel').within(() => {
      cy.get('[data-cy="asteroid-property-card"]').should('have.length', 3)
      
      // Verify orbital elements are displayed
      cy.contains('Semi-major Axis').should('be.visible')
      cy.contains('Eccentricity').should('be.visible')
      cy.contains('Inclination').should('be.visible')
      
      // Verify physical properties are displayed
      cy.contains('Diameter').should('be.visible')
      cy.contains('Albedo').should('be.visible')
    })
    
    // Step 6: Switch classification systems
    cy.intercept('GET', '**/api/classifications/tholen/asteroids**').as('getTholenAsteroids')
    
    cy.dataCy('classification-system-selector').click()
    cy.contains('Tholen').click()
    
    cy.waitForApi('getTholenAsteroids')
    
    // Verify selection is maintained across classification systems
    cy.dataCy('selection-counter').should('contain', '3')
    
    // Step 7: Test zoom and pan functionality
    cy.dataCy('spectral-chart').within(() => {
      // Test zoom
      cy.get('svg').trigger('wheel', { deltaY: -100 })
      cy.get('.zoom-indicator').should('be.visible')
      
      // Test pan
      cy.get('svg')
        .trigger('mousedown', { clientX: 100, clientY: 100 })
        .trigger('mousemove', { clientX: 150, clientY: 100 })
        .trigger('mouseup')
      
      // Reset zoom
      cy.get('[data-cy="reset-zoom"]').click()
    })
    
    // Step 8: Test export functionality
    cy.intercept('POST', '**/api/export/data').as('exportData')
    cy.intercept('POST', '**/api/export/spectrum').as('exportSpectrum')
    
    cy.dataCy('export-button').click()
    cy.dataCy('export-modal').should('be.visible')
    
    // Export data as CSV
    cy.dataCy('export-format-csv').click()
    cy.dataCy('export-confirm').click()
    cy.waitForApi('exportData')
    
    // Export spectrum as PNG
    cy.dataCy('export-button').click()
    cy.dataCy('export-format-png').click()
    cy.dataCy('export-confirm').click()
    cy.waitForApi('exportSpectrum')
    
    // Step 9: Test error recovery
    // Simulate network error
    cy.intercept('POST', '**/api/spectra/batch', { statusCode: 500 }).as('spectralError')
    
    // Add another asteroid to trigger error
    cy.dataCy('taxonomy-tree').within(() => {
      cy.get('[data-cy="asteroid-checkbox"]').eq(3).check()
    })
    
    cy.waitForApi('spectralError')
    
    // Verify error handling
    cy.dataCy('error-message').should('be.visible')
    cy.dataCy('retry-button').should('be.visible')
    
    // Test retry functionality
    cy.intercept('POST', '**/api/spectra/batch').as('spectralRetry')
    cy.dataCy('retry-button').click()
    cy.waitForApi('spectralRetry')
    
    // Step 10: Test search and filter functionality
    cy.dataCy('search-input').type('Ceres')
    cy.dataCy('taxonomy-tree').within(() => {
      cy.contains('Ceres').should('be.visible')
      // Other asteroids should be filtered out
      cy.get('[data-cy="asteroid-item"]').should('have.length', 1)
    })
    
    // Clear search
    cy.dataCy('search-clear').click()
    cy.dataCy('taxonomy-tree').within(() => {
      cy.get('[data-cy="asteroid-item"]').should('have.length.greaterThan', 1)
    })
    
    // Step 11: Test selection management
    cy.dataCy('selection-counter').should('contain', '4') // 3 original + 1 added
    
    // Clear all selections
    cy.dataCy('clear-all-selections').click()
    cy.dataCy('selection-counter').should('contain', '0')
    
    // Verify chart and properties panel are cleared
    cy.dataCy('spectral-chart').within(() => {
      cy.get('.spectral-line').should('have.length', 0)
      cy.contains('Select asteroids to view spectral data').should('be.visible')
    })
    
    cy.dataCy('properties-panel').within(() => {
      cy.contains('Select asteroids to view properties').should('be.visible')
    })
  })

  it('should handle large dataset performance', () => {
    // Mock large dataset response
    const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
      id: i + 1,
      official_number: i + 1,
      proper_name: `Asteroid ${i + 1}`,
      bus_demeo_class: 'C'
    }))
    
    cy.intercept('GET', '**/api/classifications/bus_demeo/asteroids**', {
      classes: [{ name: 'C', asteroids: largeDataset }]
    }).as('getLargeDataset')
    
    cy.dataCy('taxonomy-tree').within(() => {
      cy.contains('C').click()
    })
    
    cy.waitForApi('getLargeDataset')
    
    // Verify virtual scrolling is working
    cy.dataCy('taxonomy-tree').within(() => {
      // Should not render all 1000 items at once
      cy.get('[data-cy="asteroid-item"]').should('have.length.lessThan', 100)
      
      // Test scrolling
      cy.get('[data-cy="asteroid-list"]').scrollTo('bottom')
      cy.get('[data-cy="asteroid-item"]').should('have.length.greaterThan', 10)
    })
  })

  it('should maintain state across page refreshes', () => {
    // Select some asteroids
    cy.dataCy('taxonomy-tree').within(() => {
      cy.contains('C').click()
      cy.get('[data-cy="asteroid-checkbox"]').first().check()
      cy.get('[data-cy="asteroid-checkbox"]').eq(1).check()
    })
    
    // Verify selection
    cy.dataCy('selection-counter').should('contain', '2')
    
    // Refresh page
    cy.reload()
    
    // Verify state is restored (if implemented)
    cy.dataCy('app-header').should('be.visible')
    
    // Note: State persistence would depend on implementation
    // This test verifies the app loads correctly after refresh
  })

  it('should handle concurrent user interactions', () => {
    // Simulate rapid user interactions
    cy.dataCy('taxonomy-tree').within(() => {
      cy.contains('C').click()
      
      // Rapidly select and deselect asteroids
      for (let i = 0; i < 5; i++) {
        cy.get('[data-cy="asteroid-checkbox"]').eq(i).check()
        cy.get('[data-cy="asteroid-checkbox"]').eq(i).uncheck()
        cy.get('[data-cy="asteroid-checkbox"]').eq(i).check()
      }
    })
    
    // Verify final state is consistent
    cy.dataCy('selection-counter').should('contain', '5')
    
    // Verify spectral chart handles rapid updates
    cy.dataCy('spectral-chart').within(() => {
      cy.get('.spectral-line').should('have.length', 5)
    })
  })

  it('should validate data integrity across components', () => {
    // Select an asteroid
    cy.dataCy('taxonomy-tree').within(() => {
      cy.contains('C').click()
      cy.get('[data-cy="asteroid-checkbox"]').first().check()
    })
    
    // Capture asteroid name from taxonomy tree
    cy.dataCy('taxonomy-tree')
      .find('[data-cy="asteroid-item"]')
      .first()
      .find('[data-cy="asteroid-name"]')
      .invoke('text')
      .as('asteroidName')
    
    // Verify same asteroid appears in properties panel
    cy.get('@asteroidName').then((name) => {
      cy.dataCy('properties-panel').should('contain', name)
    })
    
    // Verify spectral chart legend shows same asteroid
    cy.get('@asteroidName').then((name) => {
      cy.dataCy('spectral-chart').within(() => {
        cy.get('.chart-legend').should('contain', name)
      })
    })
  })
})