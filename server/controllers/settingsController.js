const SchoolSettings = require('../models/SchoolSettings')
const { sendSuccess, sendError } = require('../utils/response')

const getSchoolSettings = async (_req, res) => {
  try {
    const settings = await SchoolSettings.findOne({ key: 'school' }).lean()
    return sendSuccess(res, settings || {
      schoolName: 'St Babeth TSS',
      district: '',
      contactEmail: '',
      aboutText: '',
      logoDataUrl: '',
      academicYear: '',
      academicYearStartDate: '',
      academicYearEndDate: '',
      currentTermName: '',
      currentTermStartDate: '',
      currentTermEndDate: ''
    }, 'School settings fetched successfully.')
  } catch (error) {
    console.error(error)
    return sendError(res, 'Unable to fetch school settings.', 500)
  }
}

const updateSchoolSettings = async (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {}
  const {
    schoolName,
    district,
    contactEmail,
    aboutText,
    logoDataUrl,
    academicYear = '',
    academicYearStartDate = '',
    academicYearEndDate = '',
    currentTermName = '',
    currentTermStartDate = '',
    currentTermEndDate = ''
  } = body

  if (typeof schoolName !== 'string' || schoolName.trim().length < 2 || schoolName.trim().length > 120) {
    return sendError(res, 'School name must be between 2 and 120 characters.', 400)
  }

  if (typeof district !== 'string' || district.trim().length > 120) {
    return sendError(res, 'District must be 120 characters or fewer.', 400)
  }

  if (
    typeof contactEmail !== 'string' ||
    (contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim()))
  ) {
    return sendError(res, 'Enter a valid contact email address or leave it blank.', 400)
  }

  if (typeof academicYear !== 'string' || academicYear.trim().length > 40) {
    return sendError(res, 'Academic year must be 40 characters or fewer.', 400)
  }

  if (typeof currentTermName !== 'string' || currentTermName.trim().length > 40) {
    return sendError(res, 'Current term must be 40 characters or fewer.', 400)
  }

  const calendarDates = {
    academicYearStartDate,
    academicYearEndDate,
    currentTermStartDate,
    currentTermEndDate
  }
  for (const [field, value] of Object.entries(calendarDates)) {
    const isValidDate = typeof value === 'string'
      && /^\d{4}-\d{2}-\d{2}$/.test(value)
      && !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime())
      && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value
    if (value !== '' && !isValidDate) {
      return sendError(res, `${field} must be a valid calendar date.`, 400)
    }
  }

  if (Boolean(academicYearStartDate) !== Boolean(academicYearEndDate)) {
    return sendError(res, 'Enter both the academic year start and end dates.', 400)
  }

  if (academicYearStartDate && academicYearStartDate > academicYearEndDate) {
    return sendError(res, 'Academic year end date must be on or after its start date.', 400)
  }

  if (Boolean(currentTermStartDate) !== Boolean(currentTermEndDate)) {
    return sendError(res, 'Enter both the current term start and end dates.', 400)
  }

  if (currentTermStartDate && currentTermStartDate > currentTermEndDate) {
    return sendError(res, 'Current term end date must be on or after its start date.', 400)
  }

  if (
    currentTermStartDate &&
    academicYearStartDate &&
    (currentTermStartDate < academicYearStartDate || currentTermEndDate > academicYearEndDate)
  ) {
    return sendError(res, 'Current term dates must fall within the academic year.', 400)
  }

  if (typeof aboutText !== 'string' || aboutText.trim().length > 1000) {
    return sendError(res, 'About text must be 1,000 characters or fewer.', 400)
  }

  const normalizedLogo = logoDataUrl || ''
  if (
    typeof normalizedLogo !== 'string' ||
    normalizedLogo.length > 2800000 ||
    (normalizedLogo && !/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(normalizedLogo))
  ) {
    return sendError(res, 'Logo must be a PNG, JPEG, or WebP image smaller than 2 MB.', 400)
  }

  try {
    const settings = await SchoolSettings.findOneAndUpdate(
      { key: 'school' },
      {
        $set: {
          schoolName: schoolName.trim(),
          district: district.trim(),
          contactEmail: contactEmail.trim().toLowerCase(),
          aboutText: aboutText.trim(),
          logoDataUrl: normalizedLogo,
          academicYear: academicYear.trim(),
          academicYearStartDate,
          academicYearEndDate,
          currentTermName: currentTermName.trim(),
          currentTermStartDate,
          currentTermEndDate
        },
        $setOnInsert: { key: 'school' }
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean()

    return sendSuccess(res, settings, 'School settings saved successfully.')
  } catch (error) {
    console.error(error)
    return sendError(res, 'Unable to save school settings.', 500)
  }
}

module.exports = { getSchoolSettings, updateSchoolSettings }
