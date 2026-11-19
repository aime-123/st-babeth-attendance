import { describe, expect, it } from 'vitest'
import { parseStudentSpreadsheetRows } from './studentSpreadsheetImport'

const headers = [
  'SDMS number',
  'First name',
  'Last name',
  'Parent/guardian name',
  'Guardian phone',
  'Gender',
  'Class',
  'Academic year',
  'Enrollment date',
  'Status'
]

const classes = [{ _id: 'class-1', classCode: 'P1', className: 'Primary One' }]

describe('parseStudentSpreadsheetRows', () => {
  it('maps valid student rows and normalizes Excel date values', () => {
    const rows = parseStudentSpreadsheetRows([
      headers,
      ['00123', 'mARY', 'sMITH', 'jANE DOE', '0780000000', 'F', 'P1', '2026/2027', new Date('2026-09-01T00:00:00.000Z'), '']
    ], classes, [])

    expect(rows).toEqual([{
      id: 2,
      rowNumber: 2,
      data: {
        registrationNumber: '00123',
        firstName: 'MARY',
        lastName: 'Smith',
        guardianName: 'JANE Doe',
        guardianPhone: '+250780000000',
        gender: 'female',
        classId: 'class-1',
        academicYear: '2026/2027',
        enrollmentDate: '2026-09-01',
        status: 'active'
      },
      issues: [],
      selected: true,
      saved: false,
      saveError: ''
    }])
  })

  it('marks invalid phone numbers, unknown classes, and duplicate SDMS numbers for review', () => {
    const rows = parseStudentSpreadsheetRows([
      headers,
      ['123', 'Mary', 'Smith', 'Jane Doe', '078000000', 'female', 'Unknown', '2026/2027', '2026-09-01', 'active'],
      ['123', 'John', 'Smith', 'Jane Doe', '0780000000', 'male', 'P1', '2026/2027', '2026-09-01', 'active']
    ], classes, [{ registrationNumber: '999' }])

    expect(rows[0].issues).toEqual(expect.arrayContaining([
      'Guardian phone must use +250 followed by 9 digits, or 10 local digits starting with 0.',
      'Class "Unknown" does not match an existing class.',
      'SDMS number is duplicated in this file.'
    ]))
    expect(rows[1].issues).toContain('SDMS number is duplicated in this file.')
    expect(rows.every((row) => row.selected === false)).toBe(true)
  })

  it('rejects spreadsheets missing required columns', () => {
    expect(() => parseStudentSpreadsheetRows([['First name'], ['Mary']], classes, []))
      .toThrow(/Missing required columns: SDMS number, Last name/)
  })
})
