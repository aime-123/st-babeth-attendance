import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import TeacherManagementPage from './TeacherManagementPage'
import { formatTeacherName } from './teacherName'

describe('teacher management page', () => {
  it('uppercases the first name and title-cases the remaining names as entered', () => {
    expect(formatTeacherName('ninziza aime gentil')).toBe('NINZIZA Aime Gentil')
    expect(formatTeacherName("mukamana-jean d'élise")).toBe("MUKAMANA-JEAN D'Élise")
  })

  it('keeps the teacher form closed until the admin opens it', () => {
    const markup = renderToString(
      <MemoryRouter>
        <TeacherManagementPage />
      </MemoryRouter>
    )

    expect(markup).toContain('Add teacher')
    expect(markup).toContain('aria-expanded="false"')
    expect(markup).not.toContain('id="teacher-editor"')
    expect(markup).not.toContain('teacher-password')
    expect(markup).toContain('teacher-management-summary-icon')
    expect(markup).toContain('Attendance enabled')
    expect(markup).toContain('Available classes')
  })
})
