const assert = require('node:assert/strict')
const { afterEach, mock, test } = require('node:test')
const TeacherNotification = require('../models/TeacherNotification')
const User = require('../models/User')
const notificationController = require('./notificationController')

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

test('broadcast messages are saved for active teachers', async () => {
  const teachers = [{ _id: 'teacher-a' }, { _id: 'teacher-b' }]
  const query = {
    select(fields) {
      assert.equal(fields, '_id')
      return this
    },
    async lean() {
      return teachers
    }
  }
  let insertedMessages
  mock.method(User, 'find', (filters) => {
    assert.deepEqual(filters, { role: 'teacher', status: 'active' })
    return query
  })
  mock.method(TeacherNotification, 'insertMany', async (messages) => {
    insertedMessages = messages
    return messages.map((message) => ({
      ...message,
      toObject() {
        return message
      }
    }))
  })

  const response = createResponse()
  await notificationController.sendTeacherMessage({
    user: { id: 'admin-a' },
    body: { title: 'School update', message: 'Please check the new timetable.' }
  }, response)

  assert.equal(insertedMessages.length, 2)
  assert.equal(insertedMessages[0].senderAdminId, 'admin-a')
  assert.equal(insertedMessages[0].title, 'School update')
  assert.equal(response.statusCode, 201)
  assert.equal(response.body.data.recipientCount, 2)
})

test('broadcast rejects a missing message before querying teachers', async () => {
  mock.method(User, 'find', () => {
    throw new Error('Invalid messages must not query teachers.')
  })

  const response = createResponse()
  await notificationController.sendTeacherMessage({
    user: { id: 'admin-a' },
    body: { title: 'Update', message: '   ' }
  }, response)

  assert.equal(response.statusCode, 400)
  assert.match(response.body.message, /message must be between/i)
})

test('teacher message read updates are scoped to that teacher', async () => {
  const notification = {
    _id: '507f1f77bcf86cd799439011',
    teacherId: 'teacher-a',
    readAt: new Date('2026-11-16T18:00:00.000Z')
  }
  mock.method(TeacherNotification, 'findOneAndUpdate', (filters, update, options) => {
    assert.deepEqual(filters, {
      _id: notification._id,
      teacherId: 'teacher-a'
    })
    assert.ok(update.$set.readAt instanceof Date)
    assert.deepEqual(options, { new: true })
    return { lean: async () => notification }
  })

  const response = createResponse()
  await notificationController.markTeacherMessageRead({
    user: { id: 'teacher-a' },
    params: { id: notification._id }
  }, response)

  assert.equal(response.statusCode, 200)
  assert.equal(response.body.data, notification)
})
