/// <reference types="cypress" />

// Custom commands for asteroid spectral app testing

Cypress.Commands.add('dataCy', (value: string) => {
  return cy.get(`[data-cy=${value}]`)
})

Cypress.Commands.add('waitForApi', (alias: string) => {
  return cy.wait(`@${alias}`)
})

Cypress.Commands.add('mockApiResponse', (endpoint: string, response: any) => {
  return cy.intercept('GET', `**/api/${endpoint}**`, response).as(endpoint)
})

// Common test data
export const mockAsteroidData = {
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

export const mockSpectralData = {
  spectra: [
    {
      asteroid_id: 1,
      wavelengths: [0.45, 0.55, 0.65, 0.75, 0.85, 0.95],
      reflectances: [0.8, 0.85, 0.9, 0.88, 0.86, 0.84]
    },
    {
      asteroid_id: 2,
      wavelengths: [0.45, 0.55, 0.65, 0.75, 0.85, 0.95],
      reflectances: [0.9, 0.95, 1.0, 0.98, 0.96, 0.94]
    }
  ]
}

export const mockClassifications = {
  systems: [
    {
      name: 'bus_demeo',
      classes: ['C', 'S', 'V', 'X', 'D', 'T', 'B', 'K', 'L', 'A', 'Q', 'R', 'O']
    },
    {
      name: 'tholen',
      classes: ['C', 'S', 'M', 'E', 'P', 'A', 'D', 'T', 'B', 'F', 'G', 'Q', 'R', 'V']
    }
  ]
}