const assert = require('node:assert/strict')
const { afterEach, mock, test } = require('node:test')
const Class = require('../models/Class')
const classController = require('./classController')
const { isValidSchedule } = classController

afterEach(() => {
  mock.restoreAll()
})

test('teacher class responses populate only the logged-in teacher', async () => {
  let populateOptions
  let classQuery
  const query = {
    populate(options) {
      populateOptions = options
      return this
    },
    sort() {
      return this
    },
    skip() {
      return this
    },
    limit() {
      return this
    },
    async lean() {
      return [{ assignedTeachers: [{ _id: 'teacher-123', fullName: 'Logged In Teacher' }] }]
    }
  }
  mock.method(Class, 'find', (filters) => {
    classQuery = filters
    return query
  })
  mock.method(Class, 'countDocuments', async () => 1)

  const response = {
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
  }

  await classController.getClasses({
    user: { id: 'teacher-123', role: 'teacher' },
    query: {}
  }, response)

  assert.deepEqual(classQuery, { assignedTeachers: 'teacher-123' })
  assert.deepEqual(populateOptions, {
    path: 'assignedTeachers',
    select: 'fullName email role',
    match: { _id: 'teacher-123' }
  })
  assert.equal(response.statusCode, 200)
})

test('class schedules accept optional valid sessions and reject invalid times', () => {
  assert.equal(isValidSchedule([]), true)
  assert.equal(isValidSchedule([{
    day: 'Wednesday',
    startTime: '08:30',
    endTime: '09:45',
    room: 'Room 12'
  }]), true)
  assert.equal(isValidSchedule([{
    day: 'Wednesday',
    startTime: '09:45',
    endTime: '08:30',
    room: ''
  }]), false)
  assert.equal(isValidSchedule([{
    day: 'Funday',
    startTime: '08:30',
    endTime: '09:45',
    room: ''
  }]), false)
})
