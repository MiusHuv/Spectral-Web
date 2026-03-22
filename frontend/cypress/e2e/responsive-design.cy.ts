describe('Responsive Design Tests', () => {
  const viewports = [
    { name: 'Desktop', width: 1280, height: 720 },
    { name: 'Tablet Landscape', width: 1024, height: 768 },
    { name: 'Tablet Portrait', width: 768, height: 1024 },
    { name: 'Mobile Large', width: 414, height: 896 }
  ]

  viewports.forEach(viewport => {
    describe(`${viewport.name} (${viewport.width}x${viewport.height})`, () => {
      beforeEach(() => {
        cy.viewport(viewport.width, viewport.height)
        cy.visit('/')
      })

      it('should display layout correctly', () => {
        // Check main layout components are visible
        cy.dataCy('app-header').should('be.visible')
        cy.dataCy('main-layout').should('be.visible')

        if (viewport.width >= 1024) {
          // Desktop/Tablet landscape: side-by-side layout
          cy.dataCy('taxonomy-tree').should('be.visible')
          cy.dataCy('spectral-chart').should('be.visible')
          cy.dataCy('properties-panel').should('be.visible')
        } else {
          // Mobile: stacked layout or tabs
          cy.dataCy('mobile-tabs').should('be.visible')
        }
      })

      it('should handle navigation appropriately', () => {
        if (viewport.width < 768) {
          // Mobile: hamburger menu
          cy.dataCy('mobile-menu-button').should('be.visible')
          cy.dataCy('mobile-menu-button').click()
          cy.dataCy('mobile-menu').should('be.visible')
        } else {
          // Desktop/Tablet: full navigation
          cy.dataCy('main-navigation').should('be.visible')
        }
      })

      it('should maintain functionality across viewports', () => {
        // Test core functionality works regardless of viewport
        cy.dataCy('taxonomy-tree').within(() => {
          cy.contains('C').click()
        })

        // Verify spectral chart is accessible
        if (viewport.width < 768) {
          // On mobile, might need to switch tabs
          cy.dataCy('spectral-tab').click()
        }
        cy.dataCy('spectral-chart').should('be.visible')
      })
    })
  })

  it('should handle orientation changes', () => {
    cy.viewport('ipad-2')
    cy.visit('/')
    
    // Portrait mode
    cy.dataCy('main-layout').should('have.class', 'portrait')
    
    // Landscape mode
    cy.viewport('ipad-2', 'landscape')
    cy.dataCy('main-layout').should('have.class', 'landscape')
  })
})