import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import ClassManagementPage from './ClassManagementPage'
import { getStudentPageItems } from './studentPagination'

describe('class management page', () => {
  it('keeps the class form closed until the admin opens it', () => {
    const markup = renderToString(
      <MemoryRouter>
        <ClassManagementPage role="admin" />
      </MemoryRouter>
    )

    expect(markup).toContain('Create class')
    expect(markup).toContain('aria-expanded="false"')
    expect(markup).not.toContain('id="class-editor"')
    expect(markup).not.toContain('Class name')
  })
  
  it('shows teacher-focused class guidance in the teacher view', () => {
    const markup = renderToString(
      <MemoryRouter>
        <ClassManagementPage role="teacher" />
      </MemoryRouter>
    )

    expect(markup).toContain('Review your assigned classes and class status.')
    expect(markup).toContain('Students in your classes')
    expect(markup).toContain('SDMS number')
    expect(markup).toContain('Academic year')
    expect(markup).not.toContain('Create classes, assign teachers')
  })

  it('does not show the teacher student roster on the admin page', () => {
    const markup = renderToString(
      <MemoryRouter>
        <ClassManagementPage role="admin" />
      </MemoryRouter>
    )

    expect(markup).not.toContain('Students in your classes')
  })

  it('limits each student roster page to 10 students', () => {
    const students = Array.from({ length: 25 }, (_, index) => ({ id: index + 1 }))

    expect(getStudentPageItems(students, 1)).toHaveLength(10)
    expect(getStudentPageItems(students, 2).map((student) => student.id)).toEqual(
      Array.from({ length: 10 }, (_, index) => index + 11)
    )
    expect(getStudentPageItems(students, 3).map((student) => student.id)).toEqual([21, 22, 23, 24, 25])
  })
})
