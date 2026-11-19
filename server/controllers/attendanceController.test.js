const assert = require('node:assert/strict')
const { afterEach, mock, test } = require('node:test')
const Attendance = require('../models/Attendance')
const Student = require('../models/Student')
const User = require('../models/User')
const attendanceController = require('./attendanceController')

afterEach(() => {
  mock.restoreAll()
})

const createResponse = () => ({
  statusCode: null,
  body: null,
  status(statusCode) {
    this.statusCode = statusCode
    return this
  },
  json(body) {
    this.body = body
    return this
  }
})

test('custom attendance reasons are saved only to the logged-in teacher and deduplicated', async () => {
  const teacher = {
    status: 'active',
    customAttendanceReasons: ['Family matter'],
    async save() {}
  }
  let requestedTeacherId
  mock.method(User, 'findById', async (teacherId) => {
    requestedTeacherId = teacherId
    return teacher
  })
  const response = createResponse()

  await attendanceController.saveCustomAttendanceReasons({
    user: { id: 'teacher-123' },
    body: { reasons: ['Transport issue', ' transport ISSUE ', 'Family matter'] }
  }, response)

  assert.equal(requestedTeacherId, 'teacher-123')
  assert.deepEqual(teacher.customAttendanceReasons, ['Family matter', 'Transport issue'])
  assert.deepEqual(response.body.data.items, ['Family matter', 'Transport issue'])
  assert.equal(response.statusCode, 200)
})

test('custom attendance reasons reject blank and oversized entries', async () => {
  const response = createResponse()
  let databaseWasQueried = false
  mock.method(User, 'findById', async () => {
    databaseWasQueried = true
  })

  await attendanceController.saveCustomAttendanceReasons({
    user: { id: 'teacher-123' },
    body: { reasons: ['  ', 'x'.repeat(101)] }
  }, response)

  assert.equal(response.statusCode, 400)
  assert.equal(databaseWasQueried, false)
})

test('mark attendance rejects a duplicate student entry before saving', async () => {
  let writeWasAttempted = false
  mock.method(Student, 'find', () => ({
    select() {
      return this
    },
    async lean() {
      return [{ _id: 'student-123' }]
    }
  }))
  mock.method(Attendance, 'bulkWrite', async () => {
    writeWasAttempted = true
  })
  const response = createResponse()

  await attendanceController.markAttendance({
    user: { id: 'admin-123', role: 'admin' },
    body: {
      classId: 'class-123',
      date: '2026-11-16',
      entries: [
        { studentId: 'student-123', status: 'present' },
        { studentId: 'student-123', status: 'absent' }
      ]
    }
  }, response)

  assert.equal(response.statusCode, 400)
  assert.match(response.body.message, /one attendance entry per class and date/i)
  assert.equal(writeWasAttempted, false)
})
