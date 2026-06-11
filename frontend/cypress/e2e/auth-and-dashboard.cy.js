describe('Auth and dashboard critical path', () => {
  it('authenticates and loads dashboard stats', () => {
    const apiBaseUrl = Cypress.env('API_BASE_URL') || 'https://d3njdoiji9c3r2.cloudfront.net'

    cy.request('POST', `${apiBaseUrl}/api/team-service/auth/login`, {
      username: 'viewer1',
      password: 'viewer123',
    }).then((response) => {
      const token = response.body.access_token || response.body.token
      expect(token).to.be.a('string')

      cy.visit('/', {
        onBeforeLoad(win) {
          win.localStorage.setItem('acme_token', token)
          win.localStorage.setItem('acme_user', JSON.stringify(response.body.user || {}))
        }
      })
    })

    cy.url({ timeout: 10000 }).should('not.include', '/login')
    cy.contains(/active projects/i, { timeout: 10000 }).should('be.visible')
  })
})
