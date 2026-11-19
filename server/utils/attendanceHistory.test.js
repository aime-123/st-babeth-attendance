const assert = require('node:assert/strict')
const { test } = require('node:test')
const { dedupeAttendanceRecords } = require('./attendanceHistory')

test('attendance history keeps the latest record per student, class, and day', () => {
  const records = dedupeAttendanceRecords([
    {
      _id: 'record-old',
      studentId: { _id: 'student-1' },
      classId: { _id: 'class-1' },
      date: '2026-11-16T00:00:00.000Z',
      status: 'absent',
      updatedAt: '2026-11-16T08:00:00.000Z'
    },
    {
      _id: 'record-latest',
      studentId: { _id: 'student-1' },
      classId: { _id: 'class-1' },
      date: '2026-11-16T15:00:00.000Z',
      status: 'present',
      updatedAt: '2026-11-16T15:00:00.000Z'
    },
    {
      _id: 'record-next-day',
      studentId: { _id: 'student-1' },
      classId: { _id: 'class-1' },
      date: '2026-11-17T00:00:00.000Z',
      status: 'late',
      updatedAt: '2026-11-17T08:00:00.000Z'
    },
    {
      _id: 'record-other-class',
      studentId: { _id: 'student-1' },
      classId: { _id: 'class-2' },
      date: '2026-11-16T00:00:00.000Z',
      status: 'excused',
      updatedAt: '2026-11-16T08:00:00.000Z'
    }
  ])

  assert.deepEqual(records.map((record) => record._id), [
    'record-next-day',
    'record-latest',
    'record-other-class'
  ])

  assert.deepEqual(
    dedupeAttendanceRecords([
      {
        _id: 'older-present',
        studentId: 'student-2',
        classId: 'class-1',
        date: '2026-11-16T00:00:00.000Z',
        status: 'present',
        updatedAt: '2026-11-16T08:00:00.000Z'
      },
      {
        _id: 'newer-absent',
        studentId: 'student-2',
        classId: 'class-1',
        date: '2026-11-16T00:00:00.000Z',
        status: 'absent',
        updatedAt: '2026-11-16T09:00:00.000Z'
      }
    ], 'present'),
    []
  )
})
