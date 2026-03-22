describe('API Integration Tests', () => {
  beforeEach(() => {
    // Use real API endpoints for integration testing
    cy.visit('/')
  })

  it('should load classifications from API', () => {
    cy.intercept('GET', '**/api/classifications').as('getClassifications')
    
    cy.visit('/')
    cy.waitForApi('getClassifications')
    
    cy.get('@getClassifications').should((interception) => {
      expect(interception.response?.statusCode).to.equal(200)
      expect(interception.response?.body).to.have.property('systems')
      expect(interception.response?.body.systems).to.be.an('array')
    })
  })

  it('should load asteroids by classification', () => {
    cy.intercept('GET', '**/api/classifications/bus_demeo/asteroids**').as('getAsteroids')
    
    cy.dataCy('taxonomy-tree').within(() => {
      cy.contains('C').click()
    })
    
    cy.waitForApi('getAsteroids')
    
    cy.get('@getAsteroids').should((interception) => {
      expect(interception.response?.statusCode).to.equal(200)
      expect(interception.response?.body).to.have.property('classes')
      expect(interception.response?.body.classes).to.be.an('array')
    })
  })

  it('should load spectral data for selected asteroids', () => {
    cy.intercept('POST', '**/api/spectra/batch').as('getSpectra')
    
    // First select an asteroid
    cy.dataCy('taxonomy-tree').within(() => {
      cy.contains('C').click()
      cy.get('[data-cy="asteroid-checkbox"]').first().check()
    })
    
    cy.waitForApi('getSpectra')
    
    cy.get('@getSpectra').should((interception) => {
      expect(interception.response?.statusCode).to.equal(200)
      expect(interception.response?.body).to.have.property('spectra')
      expect(interception.response?.body.spectra).to.be.an('array')
    })
  })

  it('should load asteroid properties', () => {
    cy.intercept('POST', '**/api/asteroids/batch').as('getAsteroidDetails')
    
    // Select an asteroid
    cy.dataCy('taxonomy-tree').within(() => {
      cy.contains('C').click()
      cy.get('[data-cy="asteroid-checkbox"]').first().check()
    })
    
    cy.waitForApi('getAsteroidDetails')
    
    cy.get('@getAsteroidDetails').should((interception) => {
      expect(interception.response?.statusCode).to.equal(200)
      expect(interception.response?.body).to.have.property('asteroids')
      expect(interception.response?.body.asteroids).to.be.an('array')
    })
  })

  it('should handle API errors gracefully', () => {
    // Mock server error
    cy.intercept('GET', '**/api/classifications', { statusCode: 500 }).as('serverError')
    
    cy.visit('/')
    cy.waitForApi('serverError')
    
    // Verify error handling
    cy.dataCy('error-message').should('be.visible')
    cy.dataCy('error-message').should('contain', 'server error')
  })

  it('should handle network timeouts', () => {
    // Mock slow response
    cy.intercept('GET', '**/api/classifications', (req) => {
      req.reply((res) => {
        res.delay(15000) // Longer than timeout
        res.send({ statusCode: 200, body: { systems: [] } })
      })
    }).as('slowResponse')
    
    cy.visit('/')
    
    // Should show timeout error
    cy.dataCy('error-message', { timeout: 20000 }).should('be.visible')
    cy.dataCy('error-message').should('contain', 'timeout')
  })

  it('should validate API response schemas', () => {
    cy.intercept('GET', '**/api/classifications').as('getClassifications')
    
    cy.visit('/')
    cy.waitForApi('getClassifications')
    
    cy.get('@getClassifications').should((interception) => {
      const body = interception.response?.body
      
      // Validate classification response schema
      expect(body).to.have.property('systems')
      expect(body.systems).to.be.an('array')
      
      if (body.systems.length > 0) {
        const system = body.systems[0]
        expect(system).to.have.property('name')
        expect(system).to.have.property('classes')
        expect(system.classes).to.be.an('array')
      }
    })
  })

  it('should handle pagination correctly', () => {
    cy.intercept('GET', '**/api/classifications/bus_demeo/asteroids**').as('getAsteroidsPage')
    
    cy.dataCy('taxonomy-tree').within(() => {
      cy.contains('C').click()
    })
    
    cy.waitForApi('getAsteroidsPage')
    
    // Check if pagination controls appear for large datasets
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="pagination-controls"]').length > 0) {
        cy.dataCy('pagination-next').click()
        cy.waitForApi('getAsteroidsPage')
        
        cy.get('@getAsteroidsPage.all').should('have.length.at.least', 2)
      }
    })
  })

  it('should export data correctly', () => {
    cy.intercept('POST', '**/api/export/data').as('exportData')
    
    // Select asteroids first
    cy.dataCy('taxonomy-tree').within(() => {
      cy.contains('C').click()
      cy.get('[data-cy="asteroid-checkbox"]').first().check()
    })
    
    // Trigger export
    cy.dataCy('export-button').click()
    cy.dataCy('export-format-csv').click()
    cy.dataCy('export-confirm').click()
    
    cy.waitForApi('exportData')
    
    cy.get('@exportData').should((interception) => {
      expect(interception.response?.statusCode).to.equal(200)
      // Verify export response contains data
      expect(interception.response?.headers).to.have.property('content-type')
    })
  })
})