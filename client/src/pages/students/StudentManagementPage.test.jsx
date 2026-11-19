import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import StudentManagementPage from './StudentManagementPage'
import StudentDetailsDialog from './StudentDetailsDialog'
import { groupStudentsByClass } from './groupStudentsByClass'
import { formatStudentName } from './studentNameFormatting'

describe('admin student management page', () => {
  it('formats first and last names consistently', () => {
    expect(formatStudentName('firstName', 'mARy')).toBe('MARY')
    expect(formatStudentName('lastName', 'mCDONALD')).toBe('Mcdonald')
    expect(formatStudentName('guardianName', 'mARY jANE DOE')).toBe('MARY Jane Doe')
    expect(formatStudentName('lastName', '')).toBe('')
  })

  it('renders the student register and its primary action', () => {
    const markup = renderToString(
      <MemoryRouter initialEntries={['/admin/students']}>
        <StudentManagementPage />
      </MemoryRouter>
    )

    expect(markup).toContain('Student register')
    expect(markup).toContain('Add student')
    expect(markup).toContain('Import students')
    expect(markup).toContain('Search students')
    expect(markup).toContain('aria-label="Filter by class"')
    expect(markup).toContain('All classes')
    expect(markup).toContain('Filter by student status')
    expect(markup).toContain('Student Management')
    expect(markup).not.toContain('Showing ')
    expect(markup).not.toContain('Each class has its own student table.')
  })

  it('keeps students in separate class groups and preserves unassigned students', () => {
    const classes = [
      { _id: 'class-a', className: 'Class A', classCode: 'A1' },
      { _id: 'class-b', className: 'Class B', classCode: 'B1' },
      { _id: 'class-c', className: 'Class C', classCode: 'C1' }
    ]
    const students = [
      { _id: 'student-a1', classId: { _id: 'class-a' } },
      { _id: 'student-b1', classId: { _id: 'class-b' } },
      { _id: 'student-a2', classId: 'class-a' },
      { _id: 'student-unassigned', classId: null }
    ]

    const groups = groupStudentsByClass(students, classes)

    expect(groups.map((group) => group.schoolClass?.className || 'No class assigned')).toEqual([
      'Class A',
      'Class B',
      'Class C',
      'No class assigned'
    ])
    expect(groups.map((group) => group.students.map((student) => student._id))).toEqual([
      ['student-a1', 'student-a2'],
      ['student-b1'],
      [],
      ['student-unassigned']
    ])
  })

  it('shows complete student information in an accessible details dialog', () => {
    const markup = renderToString(
      <StudentDetailsDialog
        student={{
          _id: 'student-a1',
          firstName: 'MARY',
          lastName: 'Doe',
          registrationNumber: '12345',
          gender: 'female',
          classId: { classCode: 'L3 SOD', className: 'Software Development' },
          academicYear: '2025/2026',
          enrollmentDate: '2025-09-01T00:00:00.000Z',
          status: 'active',
          guardianName: 'Jane Doe',
          guardianPhone: '0780000000'
        }}
        onClose={() => {}}
      />
    )

    expect(markup).toContain('role="dialog"')
    expect(markup).toContain('aria-modal="true"')
    expect(markup).toContain('MARY')
    expect(markup).toContain('Doe')
    expect(markup).toContain('12345')
    expect(markup).toContain('Jane Doe')
    expect(markup).toContain('0780000000')
    expect(markup).toContain('Close student details')
  })
})
