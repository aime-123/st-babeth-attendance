const assert = require('node:assert/strict')
const { afterEach, mock, test } = require('node:test')
const User = require('../models/User')
const userController = require('./userController')

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

test('admin timetable upload stores a file for the selected teacher without returning its contents', async () => {
  const fileContent = Buffer.from('weekly timetable')
  const teacher = {
    timetableDocument: null,
    async save() {
      this.saved = true
    }
  }
  let query
  mock.method(User, 'findOne', async (filters) => {
    query = filters
    return teacher
  })

  const response = createResponse()
  await userController.uploadTeacherTimetable({
    params: { id: 'teacher-123' },
    body: {
      fileName: 'C:\\uploads\\week.png',
      contentType: 'image/png',
      contentBase64: fileContent.toString('base64')
    }
  }, response)

  assert.deepEqual(query, { _id: 'teacher-123', role: 'teacher' })
  assert.equal(teacher.saved, true)
  assert.equal(teacher.timetableDocument.fileName, 'week.png')
  assert.equal(teacher.timetableDocument.contentType, 'image/png')
  assert.equal(teacher.timetableDocument.contentBase64, fileContent.toString('base64'))
  assert.equal(response.statusCode, 200)
  assert.equal(response.body.data.fileName, 'week.png')
  assert.equal('contentBase64' in response.body.data, false)
})

test('admin timetable upload rejects invalid base64 data', async () => {
  mock.method(User, 'findOne', async () => {
    throw new Error('Invalid upload must not query a teacher.')
  })

  const response = createResponse()
  await userController.uploadTeacherTimetable({
    params: { id: 'teacher-123' },
    body: { fileName: 'week.png', contentType: 'image/png', contentBase64: 'not-base64' }
  }, response)

  assert.equal(response.statusCode, 400)
  assert.match(response.body.message, /valid timetable file/i)
})

test('admin timetable retrieval includes the saved content for in-page previews', async () => {
  const document = {
    fileName: 'weekly.pdf',
    contentType: 'application/pdf',
    contentBase64: Buffer.from('pdf-content').toString('base64'),
    uploadedAt: new Date('2026-09-01T00:00:00.000Z')
  }
  const query = {
    select(fields) {
      assert.equal(fields, 'timetableDocument')
      return this
    },
    async lean() {
      return { timetableDocument: document }
    }
  }
  let filters
  mock.method(User, 'findOne', (queryFilters) => {
    filters = queryFilters
    return query
  })

  const response = createResponse()
  await userController.getTeacherTimetable({ params: { id: 'teacher-123' } }, response)

  assert.deepEqual(filters, { _id: 'teacher-123', role: 'teacher' })
  assert.equal(response.statusCode, 200)
  assert.equal(response.body.data.contentBase64, document.contentBase64)
  assert.equal(response.body.data.fileName, document.fileName)
})
