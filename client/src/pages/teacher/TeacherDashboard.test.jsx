import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import TeacherDashboard from './TeacherDashboard'

describe('teacher dashboard', () => {
  it('renders a personalized greeting and truthful loading state', () => {
    const markup = renderToString(
      <MemoryRouter initialEntries={['/teacher']}>
        <TeacherDashboard />
      </MemoryRouter>
    )

    expect(markup).toContain('Welcome back,')
    expect(markup).toContain('Teacher</h2>')
    expect(markup).toContain('Loading your teaching dashboard')
    expect(markup).toContain('Today’s schedule')
    expect(markup).toContain('Loading today’s schedule')
    expect(markup).not.toContain('176')
    expect(markup).toContain('aria-controls="navigation-group-teaching"')
    expect(markup).toContain('My Timetable')
    expect(markup).toContain('aria-current="page"')
    expect(markup).toContain('Take Attendance')
    expect(markup).not.toContain('Teacher Management')
    expect(markup).not.toContain('Reports')
    expect(markup).not.toContain('Settings')
  })
})
