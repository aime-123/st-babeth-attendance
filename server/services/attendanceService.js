const getAttendanceSummary = async () => ({
  present: 0,
  absent: 0,
  late: 0,
  excused: 0,
  total: 0
})

module.exports = { getAttendanceSummary }
