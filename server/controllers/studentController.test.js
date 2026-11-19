const assert = require('node:assert/strict')
const { afterEach, mock, test } = require('node:test')
const Student = require('../models/Student')
const Class = require('../models/Class')
const studentController = require('./studentController')

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

test('student registration rejects SDMS numbers containing letters', async () => {
  const response = createResponse()

  await studentController.createStudent({
    user: { id: 'admin-1', role: 'admin' },
    body: {
      registrationNumber: 'SDMS123',
      firstName: 'Test',
      lastName: 'Student',
      guardianName: 'Parent',
      guardianPhone: '0780000000',
      gender: 'female',
      classId: 'class-1',
      academicYear: '2026/2027',
      enrollmentDate: '2026-11-16'
    }
  }, response)

  assert.equal(response.statusCode, 400)
  assert.match(response.body.message, /digits only/i)
})

test('student registration requires parent or guardian contact details', async () => {
  const response = createResponse()

  await studentController.createStudent({
    user: { id: 'admin-1', role: 'admin' },
    body: {
      registrationNumber: '123456',
      firstName: 'Test',
      lastName: 'Student',
      gender: 'female',
      classId: 'class-1',
      academicYear: '2026/2027',
      enrollmentDate: '2026-11-16'
    }
  }, response)

  assert.equal(response.statusCode, 400)
  assert.match(response.body.message, /parent or guardian name and phone/i)
})

test('student registration rejects guardian phone numbers outside the Rwanda format', async () => {
  const response = createResponse()

  await studentController.createStudent({
    user: { id: 'admin-1', role: 'admin' },
    body: {
      registrationNumber: '123456',
      firstName: 'Test',
      lastName: 'Student',
      guardianName: 'Parent',
      guardianPhone: '078000000',
      gender: 'female',
      classId: 'class-1',
      academicYear: '2026/2027',
      enrollmentDate: '2026-11-16'
    }
  }, response)

  assert.equal(response.statusCode, 400)
  assert.match(response.body.message, /guardian phone.*\+250.*9 digits/i)
})

test('student registration accepts Rwanda international guardian numbers', async () => {
  mock.method(Class, 'findById', async () => ({ _id: 'class-1', assignedTeachers: [] }))
  mock.method(Student, 'findOne', async () => null)
  let createdStudent
  mock.method(Student, 'create', async (student) => {
    createdStudent = student
    return { _id: 'student-1' }
  })
  mock.method(Student, 'findById', () => ({
    populate: () => ({ lean: async () => ({ ...createdStudent, _id: 'student-1' }) })
  }))
  const response = createResponse()

  await studentController.createStudent({
    user: { id: 'admin-1', role: 'admin' },
    body: {
      registrationNumber: '123456',
      firstName: 'Test',
      lastName: 'Student',
      guardianName: 'Parent',
      guardianPhone: '+250780000000',
      gender: 'female',
      classId: 'class-1',
      academicYear: '2026/2027',
      enrollmentDate: '2026-11-16'
    }
  }, response)

  assert.equal(response.statusCode, 201)
  assert.equal(createdStudent.guardianPhone, '+250780000000')
})

test('student updates reject SDMS numbers containing non-digit characters', async () => {
  mock.method(Student, 'findById', async () => ({ _id: 'student-1' }))
  const response = createResponse()

  await studentController.updateStudent({
    user: { id: 'admin-1', role: 'admin' },
    params: { id: 'student-1' },
    body: { registrationNumber: '123-456' }
  }, response)

  assert.equal(response.statusCode, 400)
  assert.match(response.body.message, /digits only/i)
})

test('student updates reject guardian phone numbers outside the Rwanda format', async () => {
  mock.method(Student, 'findById', async () => ({ _id: 'student-1' }))
  const response = createResponse()

  await studentController.updateStudent({
    user: { id: 'admin-1', role: 'admin' },
    params: { id: 'student-1' },
    body: { guardianPhone: '07800000000' }
  }, response)

  assert.equal(response.statusCode, 400)
  assert.match(response.body.message, /guardian phone.*\+250.*9 digits/i)
})
