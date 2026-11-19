const getReferenceId = (value) => String(value?._id || value || '')

const getRecordTime = (record) => {
  const timestamp = new Date(record.updatedAt || record.createdAt || record.date).getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}

const dedupeAttendanceRecords = (records, statusFilter = '') => {
  const latestRecords = new Map()

  for (const record of records) {
    const date = new Date(record.date)
    if (Number.isNaN(date.getTime())) {
      latestRecords.set(`record:${getReferenceId(record._id)}`, record)
      continue
    }

    const key = [
      getReferenceId(record.classId),
      getReferenceId(record.studentId),
      date.toISOString().slice(0, 10)
    ].join(':')
    const existing = latestRecords.get(key)

    if (!existing || getRecordTime(record) > getRecordTime(existing)) {
      latestRecords.set(key, record)
    }
  }

  return [...latestRecords.values()]
    .filter((record) => !statusFilter || record.status === statusFilter)
    .sort((first, second) => (
      new Date(second.date).getTime() - new Date(first.date).getTime()
      || getRecordTime(second) - getRecordTime(first)
    ))
}

module.exports = { dedupeAttendanceRecords }
