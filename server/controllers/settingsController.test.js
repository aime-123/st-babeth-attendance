const assert = require('node:assert/strict')
const { afterEach, mock, test } = require('node:test')
const SchoolSettings = require('../models/SchoolSettings')
const settingsController = require('./settingsController')

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

const validSettings = {
  schoolName: 'St Babeth TSS',
  district: '',
  contactEmail: '',
  aboutText: '',
  logoDataUrl: '',
  academicYear: '2026-2027',
  academicYearStartDate: '2026-09-01',
  academicYearEndDate: '2027-07-31',
  currentTermName: 'Term 1',
  currentTermStartDate: '2026-09-01',
  currentTermEndDate: '2026-12-20'
}

test('school settings save academic calendar fields', async () => {
  let savedFields
  mock.method(SchoolSettings, 'findOneAndUpdate', (_filter, update) => {
    savedFields = update.$set
    return { lean: async () => update.$set }
  })
  const response = createResponse()

  await settingsController.updateSchoolSettings({ body: validSettings }, response)

  assert.equal(response.statusCode, 200)
  assert.equal(savedFields.academicYear, '2026-2027')
  assert.equal(savedFields.currentTermName, 'Term 1')
  assert.equal(savedFields.currentTermStartDate, '2026-09-01')
})

test('school settings reject invalid or reversed calendar dates', async () => {
  let databaseWasQueried = false
  mock.method(SchoolSettings, 'findOneAndUpdate', () => {
    databaseWasQueried = true
  })
  const response = createResponse()

  await settingsController.updateSchoolSettings({
    body: { ...validSettings, academicYearStartDate: '2026-02-30' }
  }, response)

  assert.equal(response.statusCode, 400)
  assert.match(response.body.message, /valid calendar date/i)
  assert.equal(databaseWasQueried, false)

  const reversedDatesResponse = createResponse()
  await settingsController.updateSchoolSettings({
    body: {
      ...validSettings,
      academicYearStartDate: '2027-07-31',
      academicYearEndDate: '2026-09-01'
    }
  }, reversedDatesResponse)

  assert.equal(reversedDatesResponse.statusCode, 400)
  assert.match(reversedDatesResponse.body.message, /end date must be on or after its start date/i)
})

test('school settings require paired dates and keep the term within the academic year', async () => {
  const response = createResponse()

  await settingsController.updateSchoolSettings({
    body: { ...validSettings, currentTermEndDate: '' }
  }, response)
  assert.equal(response.statusCode, 400)
  assert.match(response.body.message, /both the current term start and end dates/i)

  const outsideYearResponse = createResponse()
  await settingsController.updateSchoolSettings({
    body: {
      ...validSettings,
      currentTermStartDate: '2027-07-01',
      currentTermEndDate: '2027-08-01'
    }
  }, outsideYearResponse)
  assert.equal(outsideYearResponse.statusCode, 400)
  assert.match(outsideYearResponse.body.message, /within the academic year/i)
})
