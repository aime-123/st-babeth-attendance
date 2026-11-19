import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import SettingsPage from './SettingsPage'

describe('settings page', () => {
  it('shows the school information fields and save action', () => {
    const markup = renderToString(
      <MemoryRouter>
        <SettingsPage role="admin" />
      </MemoryRouter>
    )

    expect(markup).toContain('School Information')
    expect(markup).toContain('School Logo')
    expect(markup).toContain('Change image…')
    expect(markup).toContain('Upload a PNG, JPEG, or WebP image up to 2 MB.')
    expect(markup).not.toContain('white details inside the emblem')
    expect(markup).toContain('School Name')
    expect(markup).toContain('District')
    expect(markup).toContain('Contact Email')
    expect(markup).toContain('About Text')
    expect(markup).toContain('Academic Calendar')
    expect(markup).toContain('Academic Year Starts')
    expect(markup).toContain('Current Term')
    expect(markup).toContain('Attendance Rules')
    expect(markup).toContain('One record per student, class, and day')
    expect(markup).toContain('These rules are informational and cannot be changed here.')
    expect(markup).toContain('Loading settings…')
    expect(markup).toContain('settings-page')
    expect(markup).toContain('settings-panel')
    expect(markup).not.toContain('bg-[#0b3027]')
    expect(markup).not.toContain('Default Loan Period')
    expect(markup).not.toContain('Default Minimum Stock Level')
  })
})
