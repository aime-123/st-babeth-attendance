import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import TeacherTimetablesPage from './TeacherTimetablesPage'

describe('admin teacher timetables page', () => {
  it('renders the teacher timetable upload section', () => {
    const markup = renderToString(<TeacherTimetablesPage />)

    expect(markup).toContain('Teacher timetables')
    expect(markup).toContain('Upload a timetable')
    expect(markup).toContain('Loading teachers')
  })
})
