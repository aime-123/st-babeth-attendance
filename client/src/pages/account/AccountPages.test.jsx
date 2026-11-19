import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import ProfilePage from './ProfilePage'
import SecurityAccessPage from './SecurityAccessPage'

describe('account pages', () => {
  it('shows profile details and a working save action', () => {
    const markup = renderToString(
      <MemoryRouter>
        <ProfilePage role="teacher" />
      </MemoryRouter>
    )

    expect(markup).toContain('My Profile')
    expect(markup).toContain('Loading your profile')
  })

  it('provides password change fields and visibility controls', () => {
    const markup = renderToString(
      <MemoryRouter>
        <SecurityAccessPage role="teacher" />
      </MemoryRouter>
    )

    expect(markup).toContain('Security &amp; Access')
    expect(markup).toContain('Current password')
    expect(markup).toContain('New password')
    expect(markup).toContain('Confirm new password')
    expect(markup).toContain('Change password')
  })
})
