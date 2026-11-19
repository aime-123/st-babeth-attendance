import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import LoginPage from './LoginPage'
import { getPostLoginPath } from './loginRedirect'

describe('login page', () => {
  it('clearly labels sign-in fields without exposing demo accounts', () => {
    const markup = renderToString(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    )

    expect(markup).toContain('Sign in to your account')
    expect(markup).toContain('Enter your school email or username and password')
    expect(markup).toContain('aria-label="Switch to dark mode"')
    expect(markup).toContain('role="switch"')
    expect(markup).toContain('aria-checked="false"')
    expect(markup).toContain('Email address or username')
    expect(markup).toContain('aria-label="Show password"')
    expect(markup).not.toContain('Explore the demo')
    expect(markup).not.toContain('aria-label="Use administrator demo account"')
    expect(markup).not.toContain('aria-label="Use teacher demo account"')
    expect(markup).toContain('Need help signing in?')
    expect(markup).toContain('Please contact your school administrator for account support.')
    expect(markup).not.toContain('Students learning together at school')
    expect(markup).not.toContain('admin@stbabeth.edu')
    expect(markup).not.toContain('Admin@123')
    expect(markup).not.toContain('teacher@stbabeth.edu')
    expect(markup).not.toContain('Teacher@123')
  })

  it('returns users to an allowed page for their role after sign-in', () => {
    expect(getPostLoginPath('admin', {
      pathname: '/admin/reports',
      search: '?range=month',
      hash: '#attendance'
    })).toBe('/admin/reports?range=month#attendance')

    expect(getPostLoginPath('teacher', {
      pathname: '/admin/reports',
      search: '?range=month'
    })).toBe('/teacher')
    expect(getPostLoginPath('admin', { pathname: 'https://example.com' })).toBe('/admin')
  })
})
