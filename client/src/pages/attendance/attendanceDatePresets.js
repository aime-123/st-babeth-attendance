const formatDateInput = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export const getAttendanceDatePreset = (preset, referenceDate = new Date()) => {
  const endDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate())
  let startDate

  if (preset === 'week') {
    const daysSinceMonday = (endDate.getDay() + 6) % 7
    startDate = new Date(endDate)
    startDate.setDate(endDate.getDate() - daysSinceMonday)
  } else if (preset === 'month') {
    startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1)
  } else if (preset === 'last30') {
    startDate = new Date(endDate)
    startDate.setDate(endDate.getDate() - 29)
  } else {
    return { dateFrom: '', dateTo: '' }
  }

  return {
    dateFrom: formatDateInput(startDate),
    dateTo: formatDateInput(endDate)
  }
}
