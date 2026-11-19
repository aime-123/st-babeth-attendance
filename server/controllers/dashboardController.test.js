const assert = require('node:assert/strict')
const { afterEach, mock, test } = require('node:test')
const Class = require('../models/Class')
const Student = require('../models/Student')
const Attendance = require('../models/Attendance')
const { getTeacherDashboard } = require('./dashboardController')

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

test('teacher dashboard returns assigned class schedules and attendance follow-ups', async () => {
  const classQuery = {
    populate() {
      return this
    },
    async lean() {
      return [{
        _id: 'class-1',
        className: 'Form 1A',
        schedule: [{ day: 'Wednesday', startTime: '08:30', endTime: '09:45', room: 'Room 12' }]
      }]
    }
  }
  mock.method(Class, 'find', (filters) => {
    assert.deepEqual(filters, { assignedTeachers: 'teacher-1', status: 'active' })
    return classQuery
  })
  mock.method(Student, 'aggregate', async () => [{ _id: 'class-1', total: 3 }])
  mock.method(Attendance, 'aggregate', async () => [{ _id: 'class-1', marked: 2, present: 1, absent: 1 }])

  const response = createResponse()
  await getTeacherDashboard({ user: { id: 'teacher-1' } }, response)

  assert.equal(response.statusCode, 200)
  assert.equal(response.body.data.stats[1].value, '1')
  assert.deepEqual(response.body.data.pendingAttendance, [{
    classId: 'class-1',
    className: 'Form 1A',
    marked: 2,
    total: 3
  }])
  assert.equal(response.body.data.schedule[0].room, 'Room 12')
  assert.deepEqual(Object.keys(response.body.data).sort(), ['pendingAttendance', 'schedule', 'stats'])
})

test('teacher with no assigned classes receives no school-wide attendance data', async () => {
  const classQuery = {
    populate() {
      return this
    },
    async lean() {
      return []
    }
  }
  mock.method(Class, 'find', () => classQuery)
  mock.method(Student, 'aggregate', async () => [])
  mock.method(Attendance, 'aggregate', async (pipeline) => {
    assert.deepEqual(pipeline[0].$match.classId.$in, [])
    return []
  })

  const response = createResponse()
  await getTeacherDashboard({ user: { id: 'teacher-without-classes' } }, response)

  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.body.data.schedule, [])
  assert.deepEqual(response.body.data.pendingAttendance, [])
  assert.equal(response.body.data.stats[1].value, '0')
})

test('teacher dashboard reports data failures instead of returning demo statistics', async () => {
  mock.method(Class, 'find', () => ({
    populate() { return this },
    async lean() { throw new Error('Database unavailable') }
  }))
  mock.method(console, 'error', () => {})

  const response = createResponse()
  await getTeacherDashboard({ user: { id: 'teacher-1' } }, response)

  assert.equal(response.statusCode, 500)
  assert.deepEqual(response.body, {
    success: false,
    message: 'Unable to load teacher dashboard data.'
  })
})
