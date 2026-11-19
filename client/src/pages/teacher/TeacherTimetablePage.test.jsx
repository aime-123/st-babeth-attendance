import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import TeacherTimetablePage from './TeacherTimetablePage'

describe('teacher timetable page', () => {
  it('renders a dedicated weekly timetable view', () => {
    const markup = renderToString(<TeacherTimetablePage />)

    expect(markup).toContain('My timetable')
    expect(markup).toContain('Weekly timetable')
    expect(markup).toContain('Loading your timetable')
    expect(markup).toContain('This will only take a moment.')
    expect(markup).not.toContain('Upload a timetable')
  })
})
