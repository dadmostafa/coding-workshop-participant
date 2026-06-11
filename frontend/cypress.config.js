import { defineConfig } from 'cypress'

const baseUrl = process.env.CYPRESS_BASE_URL || 'http://localhost:3000'

export default defineConfig({
  e2e: {
    baseUrl,
    supportFile: 'cypress/support/e2e.js',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx}',
    video: false,
    screenshotOnRunFailure: true,
  },
})
