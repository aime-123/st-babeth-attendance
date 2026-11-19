import { formatStudentName } from './studentNameFormatting'
import { normalizeRwandaPhone } from './rwandaPhone'

const columnAliases = {
  registrationNumber: ['sdmsnumber', 'registrationnumber', 'sdms'],
  firstName: ['firstname'],
  lastName: ['lastname'],
  guardianName: ['parentguardianname', 'guardianname', 'parentname'],
  guardianPhone: ['guardianphone', 'parentguardianphone', 'parentphone'],
  gender: ['gender'],
  classValue: ['class', 'classname', 'classcode', 'classid'],
  academicYear: ['academicyear'],
  enrollmentDate: ['enrollmentdate'],
  status: ['status']
}

const requiredColumns = [
  ['registrationNumber', 'SDMS number'],
  ['firstName', 'First name'],
  ['lastName', 'Last name'],
  ['guardianName', 'Parent/guardian name'],
  ['guardianPhone', 'Guardian phone'],
  ['gender', 'Gender'],
  ['classValue', 'Class'],
  ['academicYear', 'Academic year'],
  ['enrollmentDate', 'Enrollment date']
]

const normalizeHeader = (value) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '')
const getCellText = (value) => value === null || value === undefined ? '' : String(value).trim()
const normalizeRegistrationNumber = (value) => getCellText(value).toLocaleLowerCase()

const toDateInput = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.round(value * 86400000))
    return date.toISOString().slice(0, 10)
  }

  const text = getCellText(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const date = new Date(`${text}T00:00:00.000Z`)
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
  }

  const slashDate = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slashDate) {
    const [, month, day, year] = slashDate
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
    if (date.getUTCFullYear() === Number(year) && date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day)) {
      return date.toISOString().slice(0, 10)
    }
    return ''
  }

  return ''
}

const resolveClass = (value, classes) => {
  const normalizedValue = getCellText(value).toLocaleLowerCase()
  if (!normalizedValue) return null

  return classes.find((schoolClass) => [
    schoolClass._id,
    schoolClass.classCode,
    schoolClass.className,
    [schoolClass.classCode, schoolClass.className].filter(Boolean).join(' · ')
  ].some((candidate) => getCellText(candidate).toLocaleLowerCase() === normalizedValue))
}

export const parseStudentSpreadsheetRows = (rows, classes, existingStudents) => {
  const [headerRow, ...dataRows] = rows
  if (!headerRow?.length) {
    throw new Error('The spreadsheet is empty or has no header row.')
  }

  const headers = headerRow.map(normalizeHeader)
  const columns = Object.fromEntries(Object.entries(columnAliases).map(([field, aliases]) => [
    field,
    headers.findIndex((header) => aliases.includes(header))
  ]))
  const missingColumns = requiredColumns
    .filter(([field]) => columns[field] === -1)
    .map(([, label]) => label)

  if (missingColumns.length) {
    throw new Error(`Missing required columns: ${missingColumns.join(', ')}.`)
  }

  const existingNumbers = new Set(existingStudents.map((student) => normalizeRegistrationNumber(student.registrationNumber)))
  const importedCounts = new Map()
  const populatedRows = dataRows
    .map((cells, index) => ({ cells, rowNumber: index + 2 }))
    .filter(({ cells }) => cells.some((cell) => getCellText(cell)))

  for (const { cells } of populatedRows) {
    const number = normalizeRegistrationNumber(cells[columns.registrationNumber])
    if (number) importedCounts.set(number, (importedCounts.get(number) || 0) + 1)
  }

  return populatedRows.map(({ cells, rowNumber }) => {
    const registrationNumber = getCellText(cells[columns.registrationNumber])
    const firstName = getCellText(cells[columns.firstName])
    const lastName = getCellText(cells[columns.lastName])
    const guardianName = getCellText(cells[columns.guardianName])
    const rawGuardianPhone = getCellText(cells[columns.guardianPhone])
    const guardianPhone = normalizeRwandaPhone(rawGuardianPhone)
    const rawGender = getCellText(cells[columns.gender]).toLocaleLowerCase()
    const gender = rawGender === 'm' ? 'male' : rawGender === 'f' ? 'female' : rawGender
    const classValue = cells[columns.classValue]
    const schoolClass = resolveClass(classValue, classes)
    const academicYear = getCellText(cells[columns.academicYear])
    const enrollmentDate = toDateInput(cells[columns.enrollmentDate])
    const rawStatus = columns.status === -1 ? '' : getCellText(cells[columns.status]).toLocaleLowerCase()
    const status = rawStatus || 'active'
    const data = {
      registrationNumber,
      firstName: formatStudentName('firstName', firstName),
      lastName: formatStudentName('lastName', lastName),
      guardianName: formatStudentName('guardianName', guardianName),
      guardianPhone,
      gender,
      classId: schoolClass?._id || '',
      academicYear,
      enrollmentDate,
      status
    }
    const issues = []
    const normalizedNumber = normalizeRegistrationNumber(registrationNumber)

    if (!registrationNumber) issues.push('SDMS number is required.')
    else if (!/^\d+$/.test(registrationNumber)) issues.push('SDMS number must contain digits only.')
    else if (existingNumbers.has(normalizedNumber)) issues.push('SDMS number already exists.')
    else if (importedCounts.get(normalizedNumber) > 1) issues.push('SDMS number is duplicated in this file.')
    if (!firstName) issues.push('First name is required.')
    if (!lastName) issues.push('Last name is required.')
    if (!guardianName) issues.push('Parent/guardian name is required.')
    if (!rawGuardianPhone) issues.push('Guardian phone is required.')
    else if (!guardianPhone) issues.push('Guardian phone must use +250 followed by 9 digits, or 10 local digits starting with 0.')
    if (!['male', 'female'].includes(gender)) issues.push('Gender must be male or female.')
    if (!schoolClass) issues.push(`Class "${getCellText(classValue)}" does not match an existing class.`)
    if (!academicYear) issues.push('Academic year is required.')
    if (!enrollmentDate) issues.push('Enrollment date is required or invalid.')
    if (!['active', 'inactive'].includes(status)) issues.push('Status must be active or inactive.')

    return {
      id: rowNumber,
      rowNumber,
      data,
      issues,
      selected: issues.length === 0,
      saved: false,
      saveError: ''
    }
  })
}
