import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import AdminDashboard from './AdminDashboard'

vi.mock('recharts', () => ({
  Bar: () => null,
  BarChart: () => null,
  CartesianGrid: () => null,
  ResponsiveContainer: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null
}))

describe('admin dashboard', () => {
  it('renders the attendance summary and primary admin actions', () => {
    const markup = renderToString(
      <MemoryRouter initialEntries={['/admin']}>
        <AdminDashboard />
      </MemoryRouter>
    )

    expect(markup).toContain('Welcome, Administrator')
    expect(markup).toContain('Attendance overview')
    expect(markup).toContain('Notifications')
    expect(markup.indexOf('aria-label="Notifications"')).toBeGreaterThan(markup.indexOf('aria-label="Switch to dark mode"'))
    expect(markup).toContain('View attendance history')
    expect(markup).not.toContain('Take attendance')
    expect(markup).toContain('Class performance')
    expect(markup).toContain('dashboard-stat-icon')
    expect(markup).toContain('aria-label="Toggle navigation menu"')
    expect(markup).toContain('aria-controls="navigation-group-school-management"')
    expect(markup).toContain('aria-current="page"')
    expect(markup).toContain('Student Management')
  })
})
