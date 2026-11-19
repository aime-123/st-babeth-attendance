import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Eye, Save, Search } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import api from '../../services/api'
import DashboardShell from '../../components/dashboard/DashboardShell'
import { getVisiblePageNumbers } from './attendanceHistoryPagination'

const DEFAULT_ROWS_PER_PAGE = 5

const absenceReasonOptions = [
  { value: 'illness', label: 'Illness or medical reason' },
  { value: 'family', label: 'Family matter' },
  { value: 'transport', label: 'Transport issue' },
  { value: 'personal', label: 'Personal reason' },
  { value: 'appointment', label: 'Medical appointment' },
  { value: 'family_emergency', label: 'Family emergency' },
  { value: 'weather', label: 'Severe weather or unsafe travel' },
  { value: 'bereavement', label: 'Bereavement in the family' },
  { value: 'religious', label: 'Religious observance' },
  { value: 'school_activity', label: 'School-approved activity' },
  { value: 'other', label: 'Other - write the reason' }
]

const getReasonOptionValue = (reason, customReasons = []) => {
  const normalizedReason = reason.trim().toLocaleLowerCase()
  const matchingOption = absenceReasonOptions.find(
    (option) => option.value !== 'other' && option.label.toLocaleLowerCase() === normalizedReason
  )
  if (matchingOption) {
    return matchingOption.value
  }

  const customReasonIndex = customReasons.findIndex(
    (customReason) => customReason.toLocaleLowerCase() === normalizedReason
  )
  return customReasonIndex >= 0 ? `custom-${customReasonIndex}` : (reason ? 'other' : '')
}

const getLatestSavedAt = (records) => {
  const timestamp = records.reduce((latest, record) => {
    const recordTime = Date.parse(record.updatedAt || record.createdAt || '')
    return Number.isFinite(recordTime) ? Math.max(latest, recordTime) : latest
  }, 0)

  return timestamp ? new Date(timestamp).toLocaleString() : ''
}

function AttendanceManagementPage({ role }) {
  const [searchParams] = useSearchParams()
  const [classes, setClasses] = useState([])
  const [students, setStudents] = useState([])
  const [selectedClassId, setSelectedClassId] = useState(() => searchParams.get('classId') || '')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))
  const [attendanceMap, setAttendanceMap] = useState({})
  const [reasonTypes, setReasonTypes] = useState({})
  const [remarks, setRemarks] = useState({})
  const [customAbsenceReasons, setCustomAbsenceReasons] = useState([])
  const [customReasonsLoaded, setCustomReasonsLoaded] = useState(role !== 'teacher')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [reasonWarning, setReasonWarning] = useState('')
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_ROWS_PER_PAGE)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState('')
  const customAbsenceReasonsRef = useRef(customAbsenceReasons)

  const reasonOptions = useMemo(() => [
    ...absenceReasonOptions.filter((option) => option.value !== 'other'),
    ...customAbsenceReasons.map((reason, index) => ({ value: `custom-${index}`, label: reason })),
    absenceReasonOptions.find((option) => option.value === 'other')
  ], [customAbsenceReasons])

  const statusCounts = useMemo(() => {
    const counts = { present: 0, absent: 0, other: 0, total: students.length }

    students.forEach((student) => {
      const status = attendanceMap[student._id]
      if (status === 'present' || status === 'absent') {
        counts[status] += 1
      } else if (status) {
        counts.other += 1
      }
    })

    return counts
  }, [students, attendanceMap])

  const filteredStudents = useMemo(() => {
    const term = search.trim().toLowerCase()

    return students.filter((student) => {
      if (!term) {
        return true
      }

      const values = [
        student.firstName,
        student.lastName,
        student.registrationNumber,
        student.classId?.className,
        student.classId?.classCode
      ]

      return values.join(' ').toLowerCase().includes(term)
    })
  }, [students, search])

  const pageCount = Math.max(1, Math.ceil(filteredStudents.length / rowsPerPage))
  const safeCurrentPage = Math.min(currentPage, pageCount)
  const firstStudentNumber = filteredStudents.length === 0 ? 0 : (safeCurrentPage - 1) * rowsPerPage + 1
  const lastStudentNumber = Math.min(safeCurrentPage * rowsPerPage, filteredStudents.length)
  const visiblePageNumbers = useMemo(
    () => getVisiblePageNumbers(safeCurrentPage, pageCount),
    [pageCount, safeCurrentPage]
  )
  const paginatedStudents = filteredStudents.slice(
    (safeCurrentPage - 1) * rowsPerPage,
    safeCurrentPage * rowsPerPage
  )

  const absentStudents = useMemo(
    () => students.filter((student) => attendanceMap[student._id] === 'absent'),
    [students, attendanceMap]
  )

  const fetchClasses = async () => {
    try {
      const response = await api.get('/classes')
      const list = response.data?.data?.items || []
      setClasses(list)

      const requestedClassId = searchParams.get('classId')
      if (requestedClassId && list.some((schoolClass) => schoolClass._id === requestedClassId)) {
        setSelectedClassId(requestedClassId)
      } else if (!selectedClassId && list.length > 0) {
        setSelectedClassId(list[0]._id)
      }
    } catch (apiError) {
      console.warn('Unable to load classes for attendance', apiError)
    }
  }

  const fetchAttendanceForSession = async (classId, date, customReasons) => {
    if (!classId) {
      setStudents([])
      setAttendanceMap({})
      setReasonTypes({})
      setRemarks({})
      setLastSavedAt('')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')
    setStudents([])
    setAttendanceMap({})
    setReasonTypes({})
    setRemarks({})
    setLastSavedAt('')

    try {
      const [studentsResponse, attendanceResponse] = await Promise.all([
        api.get('/students', { params: { classId } }),
        api.get('/attendance', { params: { classId, date } })
      ])

      const classStudents = studentsResponse.data?.data || []
      const attendanceRecords = attendanceResponse.data?.data?.items || []
      setLastSavedAt(getLatestSavedAt(attendanceRecords))

      const map = {}
      const reasonTypeMap = {}
      const remarksMap = {}

      attendanceRecords.forEach((record) => {
        const studentId = record.studentId?._id || record.studentId
        map[studentId] = record.status
        remarksMap[studentId] = record.remarks || ''
        reasonTypeMap[studentId] = getReasonOptionValue(record.remarks || '', customReasons)
      })

      setStudents(classStudents)
      setAttendanceMap(
        classStudents.reduce((accumulator, student) => {
          accumulator[student._id] = map[student._id] || 'present'
          return accumulator
        }, {})
      )
      setReasonTypes(
        classStudents.reduce((accumulator, student) => {
          accumulator[student._id] = reasonTypeMap[student._id] || ''
          return accumulator
        }, {})
      )
      setRemarks(
        classStudents.reduce((accumulator, student) => {
          accumulator[student._id] = remarksMap[student._id] || ''
          return accumulator
        }, {})
      )
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Unable to load attendance data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchClasses()

    if (role !== 'teacher') {
      setCustomAbsenceReasons([])
      setCustomReasonsLoaded(true)
      return
    }

    const fetchCustomAttendanceReasons = async () => {
      try {
        const response = await api.get('/attendance/reasons')
        setCustomAbsenceReasons(response.data?.data?.items || [])
        setReasonWarning('')
      } catch (apiError) {
        setReasonWarning(
          apiError.response?.data?.message || 'Saved custom reasons could not be loaded. You can still add a new reason.'
        )
      } finally {
        setCustomReasonsLoaded(true)
      }
    }
    fetchCustomAttendanceReasons()
  }, [role])

  useEffect(() => {
    customAbsenceReasonsRef.current = customAbsenceReasons
  }, [customAbsenceReasons])

  useEffect(() => {
    if (!customReasonsLoaded) {
      return
    }

    if (!selectedClassId) {
      setLoading(false)
      return
    }

    fetchAttendanceForSession(selectedClassId, selectedDate, customAbsenceReasonsRef.current)
  }, [selectedClassId, selectedDate, customReasonsLoaded])

  const handleStatusChange = (studentId, status) => {
    setAttendanceMap((previous) => ({ ...previous, [studentId]: status }))
  }

  const handleAbsentChange = (studentId, isAbsent) => {
    handleStatusChange(studentId, isAbsent ? 'absent' : 'present')
  }

  const handleRemarkChange = (studentId, value) => {
    setRemarks((previous) => ({ ...previous, [studentId]: value }))
  }

  const handleReasonOptionChange = (studentId, optionValue) => {
    const option = reasonOptions.find((reasonOption) => reasonOption.value === optionValue)
    setReasonTypes((previous) => ({ ...previous, [studentId]: optionValue }))
    setRemarks((previous) => ({
      ...previous,
      [studentId]: optionValue === 'other' || !option ? '' : option.label
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!selectedClassId) {
      setError('Please select a class before saving attendance.')
      return
    }

    const absentWithoutReason = students.find((student) => {
      if (attendanceMap[student._id] !== 'absent') {
        return false
      }

      const reason = remarks[student._id]?.trim() || ''
      return !reason || (reasonTypes[student._id] === 'other' && (reason.length < 2 || reason.length > 100))
    })
    if (absentWithoutReason) {
      setError(`Add a valid reason for ${absentWithoutReason.firstName} ${absentWithoutReason.lastName}'s absence before saving.`)
      return
    }

    setError('')
    setReviewOpen(true)
  }

  const handleConfirmSave = async () => {
    if (saving) {
      return
    }

    const knownReasons = new Set([
      ...absenceReasonOptions
        .filter((option) => option.value !== 'other')
        .map((option) => option.label.toLocaleLowerCase()),
      ...customAbsenceReasons.map((reason) => reason.toLocaleLowerCase())
    ])
    const customReasonsToAdd = [...new Set(
      students
        .filter((student) => attendanceMap[student._id] === 'absent' && reasonTypes[student._id] === 'other')
        .map((student) => remarks[student._id]?.trim() || '')
        .filter((reason) => reason && !knownReasons.has(reason.toLocaleLowerCase()))
    )]

    setSaving(true)
    setError('')
    setSuccess('')
    setReasonWarning('')

    try {
      const entries = students.map((student) => ({
        studentId: student._id,
        status: attendanceMap[student._id] || 'present',
        remarks: remarks[student._id] || ''
      }))

      const response = await api.post('/attendance/mark', {
        classId: selectedClassId,
        date: selectedDate,
        entries
      })

      setLastSavedAt(getLatestSavedAt(response.data?.data?.items || []) || new Date().toLocaleString())
      setSuccess('Attendance saved successfully.')
      setReviewOpen(false)
      if (customReasonsToAdd.length > 0) {
        try {
          const response = await api.post('/attendance/reasons', { reasons: customReasonsToAdd })
          const savedReasons = response.data?.data?.items
          if (!Array.isArray(savedReasons)) {
            throw new Error('The saved custom reasons response was invalid.')
          }

          setCustomAbsenceReasons(savedReasons)
          setReasonTypes((previous) => {
            const updated = { ...previous }
            students.forEach((student) => {
              if (attendanceMap[student._id] === 'absent') {
                updated[student._id] = getReasonOptionValue(remarks[student._id] || '', savedReasons)
              }
            })
            return updated
          })
          setSuccess('Attendance saved. Your new reason has been added to your personal list.')
        } catch (reasonApiError) {
          setReasonWarning(
            reasonApiError.response?.data?.message ||
              'Attendance was saved, but the new reason could not be added to your personal list.'
          )
        }
      }
    } catch (apiError) {
      setReviewOpen(false)
      setError(apiError.response?.data?.message || 'Unable to save attendance.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardShell
      role={role}
      title={role === 'admin' ? 'Attendance Management' : 'Mark Attendance'}
      subtitle={role === 'admin' ? 'Administration' : 'Teacher'}
    >
      <div className="attendance-management-page space-y-6">
        <section className="attendance-page-intro rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-sm font-semibold text-emerald-700">Daily register</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">Record student attendance</h2>
          <p className="mt-1 text-sm text-slate-600">Choose a class and date, then mark students who are absent. Students not marked absent count as present unless you select Late or Excused.</p>
        </section>

        <section className="attendance-filter-panel card-surface p-5 sm:p-6" aria-labelledby="attendance-session-title">
          <div className="attendance-step-heading attendance-session-heading mb-5">
            <span className="attendance-step-number" aria-hidden="true">01</span>
            <div>
              <p className="attendance-step-kicker">Step 1</p>
              <h3 id="attendance-session-title" className="font-semibold text-slate-900">Set the class and date</h3>
              <p className="mt-1 text-sm text-slate-500">Choose the class register and school day. The matching student list will load below.</p>
            </div>
          </div>
          <div className="attendance-session-fields grid gap-3 md:grid-cols-2">
            <div className="attendance-session-field">
              <label htmlFor="attendance-class" className="attendance-field-label">Class</label>
              <select
                id="attendance-class"
                required
                value={selectedClassId}
                onChange={(event) => {
                  setCurrentPage(1)
                  setSelectedClassId(event.target.value)
                }}
                className="attendance-field-control w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 focus:border-blue-500 focus:outline-none"
              >
                <option value="">Select a class</option>
                {classes.map((schoolClass) => (
                  <option key={schoolClass._id} value={schoolClass._id}>
                    {schoolClass.className} ({schoolClass.classCode})
                  </option>
                ))}
              </select>
              <p className="attendance-field-hint">Choose one of your assigned classes.</p>
            </div>

            <div className="attendance-session-field">
              <label htmlFor="attendance-date" className="attendance-field-label">Date of attendance</label>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  id="attendance-date"
                  type="date"
                  required
                  value={selectedDate}
                  onChange={(event) => {
                    setCurrentPage(1)
                    setSelectedDate(event.target.value)
                  }}
                  className="attendance-field-control w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <p className="attendance-field-hint">Select the school day for this register.</p>
            </div>
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" role="group" aria-label="Attendance totals for this form">
          {[
            { label: 'Present', value: statusCounts.present, tone: 'bg-emerald-100 text-emerald-700' },
            { label: 'Absent', value: statusCounts.absent, tone: 'bg-blue-100 text-blue-700' },
            { label: 'Late or excused', value: statusCounts.other, tone: 'bg-sky-100 text-sky-700' },
            { label: 'Total students', value: statusCounts.total, tone: 'bg-slate-200 text-slate-700' }
          ].map((card) => (
            <div key={card.label} className="attendance-summary-card card-surface p-4">
              <p className="text-sm text-slate-500">{card.label}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className={`rounded-full px-3 py-1 text-lg font-bold ${card.tone}`}>{card.value}</span>
              </div>
            </div>
          ))}
        </div>

        <section className="attendance-record-panel card-surface overflow-hidden" aria-label="Student attendance">
          {error && (
            <div role="alert" className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {success && (
            <div role="status" className="flex items-center gap-2 border-b border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
              <CheckCircle2 className="h-4 w-4" />
              {success}
            </div>
          )}

          {reasonWarning && (
            <div role="status" className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {reasonWarning}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="attendance-record-heading attendance-step-two-heading flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="attendance-step-number" aria-hidden="true">02</span>
                  <div>
                    <p className="attendance-step-kicker">Step 2</p>
                    <h3 className="font-semibold text-slate-900">Mark absent students</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">Mark absences and add a reason. Others are present unless marked late or excused.</p>
                  </div>
                </div>
                <span className="attendance-absence-count" aria-live="polite">
                  <span className="attendance-absence-count-value">{statusCounts.absent}</span>
                  {statusCounts.absent === 1 ? ' student absent' : ' students absent'}
                </span>
              </div>
              <label className="attendance-search-field attendance-roster-search relative mx-auto w-full max-w-md">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  value={search}
                  onChange={(event) => {
                    setCurrentPage(1)
                    setSearch(event.target.value)
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="Search name or ID"
                  aria-label="Find a student by name or registration number"
                />
              </label>
            </div>

            <div className="attendance-roster-scroll overflow-x-auto">
              <table className="data-table attendance-marking-table min-w-[680px]">
                <thead>
                  <tr>
                    <th scope="col">Student</th>
                    <th scope="col">Status</th>
                    <th scope="col">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {loading || filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="px-4 py-10 text-center text-slate-500">
                        {loading
                          ? 'Loading attendance list...'
                          : !selectedClassId
                            ? 'Choose a class to load its students.'
                            : error
                              ? 'Unable to load the attendance list. Please try again.'
                            : students.length === 0
                              ? 'No students are enrolled in this class.'
                              : 'No students match your search.'}
                      </td>
                    </tr>
                  ) : (
                    paginatedStudents.map((student) => (
                      <tr
                        key={student._id}
                        className={`attendance-student-row ${attendanceMap[student._id] === 'absent' ? 'is-absent' : ''}`}
                      >
                        <td>
                          <div className="attendance-student-identity">
                            <span className="min-w-0">
                              <span className="attendance-student-name block font-semibold text-slate-800">
                                {student.firstName} {student.lastName}
                              </span>
                              <span className="attendance-student-number mt-1 block text-xs text-slate-500">
                                {student.registrationNumber || '—'}
                              </span>
                            </span>
                          </div>
                        </td>
                        <td>
                          <label className={`attendance-absent-toggle inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 font-semibold ${
                            attendanceMap[student._id] === 'absent'
                              ? 'attendance-absence-toggle-selected border-blue-300 bg-blue-50 text-blue-700'
                              : 'border-slate-200 bg-white text-slate-700'
                          }`}>
                            <input
                              type="checkbox"
                              checked={attendanceMap[student._id] === 'absent'}
                              onChange={(event) => handleAbsentChange(student._id, event.target.checked)}
                              aria-label={`Mark ${student.firstName} ${student.lastName} absent`}
                              className="h-4 w-4 accent-blue-600"
                            />
                            {attendanceMap[student._id] === 'absent' ? 'Absent' : 'Mark absent'}
                          </label>
                          <details className="mt-2">
                            <summary className="cursor-pointer text-xs font-medium text-slate-500">
                              {attendanceMap[student._id] === 'late'
                                ? 'Status: Late'
                                : attendanceMap[student._id] === 'excused'
                                  ? 'Status: Excused'
                                  : 'Set late or excused'}
                            </summary>
                            <select
                              value={attendanceMap[student._id] === 'late' || attendanceMap[student._id] === 'excused' ? attendanceMap[student._id] : ''}
                              onChange={(event) => handleStatusChange(student._id, event.target.value || 'present')}
                              disabled={attendanceMap[student._id] === 'absent'}
                              aria-label={`Other status for ${student.firstName} ${student.lastName}`}
                              className="attendance-field-control mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <option value="">Present</option>
                              <option value="late">Late</option>
                              <option value="excused">Excused</option>
                            </select>
                          </details>
                        </td>
                        <td>
                          {attendanceMap[student._id] === 'absent' ? (
                            <div className="space-y-2">
                              <select
                                value={reasonTypes[student._id] || ''}
                                onChange={(event) => handleReasonOptionChange(student._id, event.target.value)}
                                required
                                className="attendance-field-control w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 focus:border-blue-500 focus:outline-none"
                                aria-label={`Select an absence reason for ${student.firstName} ${student.lastName}`}
                              >
                                <option value="">Select a reason</option>
                                {reasonOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                              {reasonTypes[student._id] === 'other' && (
                                <input
                                  value={remarks[student._id] || ''}
                                  onChange={(event) => handleRemarkChange(student._id, event.target.value)}
                                  required
                                  maxLength={100}
                                  className="attendance-field-control w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 focus:border-blue-500 focus:outline-none"
                                  aria-label={`Write the absence reason for ${student.firstName} ${student.lastName}`}
                                  placeholder="Write the reason"
                                />
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300" aria-label="No reason needed">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {!loading && filteredStudents.length > 0 && (
              <nav className="attendance-history-pagination attendance-roster-pagination" aria-label="Student attendance pagination">
                <div className="attendance-history-pagination-details">
                  <p className="attendance-history-pagination-range" aria-live="polite">
                    Showing <strong>{firstStudentNumber}–{lastStudentNumber}</strong> of <strong>{filteredStudents.length}</strong> students
                    {search.trim() && ` matching “${search.trim()}”`}
                  </p>
                  <label className="attendance-history-page-size">
                    <span>Students per page</span>
                    <select
                      value={rowsPerPage}
                      onChange={(event) => {
                        setCurrentPage(1)
                        setRowsPerPage(Number(event.target.value))
                      }}
                      aria-label="Students per page"
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                    </select>
                  </label>
                </div>

                <div className="attendance-history-pagination-controls attendance-roster-pagination-controls">
                  <button
                    type="button"
                    className="attendance-history-page-button"
                    onClick={() => setCurrentPage(Math.max(1, safeCurrentPage - 1))}
                    disabled={safeCurrentPage === 1}
                    aria-label="Go to previous student page"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    <span>Previous</span>
                  </button>
                  <div className="attendance-history-page-numbers" role="group" aria-label="Choose student page">
                    {visiblePageNumbers[0] > 1 && (
                      <>
                        <button
                          type="button"
                          className="attendance-history-page-number"
                          onClick={() => setCurrentPage(1)}
                          aria-label="Go to student page 1"
                        >
                          1
                        </button>
                        {visiblePageNumbers[0] > 2 && <span className="attendance-history-page-ellipsis" aria-hidden="true">…</span>}
                      </>
                    )}
                    {visiblePageNumbers.map((pageNumber) => (
                      <button
                        key={pageNumber}
                        type="button"
                        className={`attendance-history-page-number ${safeCurrentPage === pageNumber ? 'is-current' : ''}`}
                        onClick={() => setCurrentPage(pageNumber)}
                        aria-label={`Go to student page ${pageNumber}`}
                        aria-current={safeCurrentPage === pageNumber ? 'page' : undefined}
                      >
                        {pageNumber}
                      </button>
                    ))}
                    {visiblePageNumbers[visiblePageNumbers.length - 1] < pageCount && (
                      <>
                        {visiblePageNumbers[visiblePageNumbers.length - 1] < pageCount - 1 && (
                          <span className="attendance-history-page-ellipsis" aria-hidden="true">…</span>
                        )}
                        <button
                          type="button"
                          className="attendance-history-page-number"
                          onClick={() => setCurrentPage(pageCount)}
                          aria-label={`Go to student page ${pageCount}`}
                        >
                          {pageCount}
                        </button>
                      </>
                    )}
                  </div>
                  <span className="attendance-roster-page-status" aria-live="polite">
                    Page <strong>{safeCurrentPage}</strong> of <strong>{pageCount}</strong>
                  </span>
                  <button
                    type="button"
                    className="attendance-history-page-button"
                    onClick={() => setCurrentPage(Math.min(pageCount, safeCurrentPage + 1))}
                    disabled={safeCurrentPage === pageCount}
                    aria-label="Go to next student page"
                  >
                    <span>Next</span>
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </nav>
            )}

            <div className="attendance-save-bar attendance-step-three flex flex-col gap-4 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="flex items-start gap-3">
                <span className="attendance-step-number attendance-step-number-action" aria-hidden="true">03</span>
                <div>
                  <p className="attendance-step-kicker">Step 3</p>
                  <h3 className="font-semibold text-slate-900">Review before saving</h3>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                    Review all {students.length} students in this class. Students on other pages or hidden by search are included.
                  </p>
                  {lastSavedAt && (
                    <p className="mt-1 text-xs text-slate-500">Last saved: {lastSavedAt}</p>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={!selectedClassId || students.length === 0 || loading || saving}
                className="attendance-review-button inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
              >
                <Eye className="h-4 w-4" />
                Review all students
              </button>
            </div>
          </form>
        </section>

        {reviewOpen && (
          <div className="attendance-review-backdrop fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4">
            <section
              className="attendance-review-dialog card-surface my-auto max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-5 shadow-2xl sm:p-7"
              role="dialog"
              aria-modal="true"
              aria-labelledby="attendance-review-title"
            >
              <div className="mb-5">
                <p className="text-sm font-semibold text-emerald-700">Final check</p>
                <h2 id="attendance-review-title" className="mt-1 text-xl font-bold text-slate-900">
                  Review attendance before saving
                </h2>
                <p className="mt-1 text-sm text-slate-600">Confirm the class, date, and absences below.</p>
              </div>

              <dl className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-3">
                  <dt className="text-xs font-medium text-slate-500">Class</dt>
                  <dd className="mt-1 font-semibold text-slate-800">
                    {classes.find((schoolClass) => schoolClass._id === selectedClassId)?.className || 'Selected class'}
                  </dd>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <dt className="text-xs font-medium text-slate-500">Date</dt>
                  <dd className="mt-1 font-semibold text-slate-800">{selectedDate}</dd>
                </div>
                <div className="rounded-xl bg-emerald-50 p-3">
                  <dt className="text-xs font-medium text-emerald-700">Present</dt>
                  <dd className="mt-1 text-lg font-bold text-emerald-800">{statusCounts.present}</dd>
                </div>
                <div className="rounded-xl bg-blue-50 p-3">
                  <dt className="text-xs font-medium text-blue-700">Absent</dt>
                  <dd className="mt-1 text-lg font-bold text-blue-800">{statusCounts.absent}</dd>
                </div>
                <div className="rounded-xl bg-amber-50 p-3">
                  <dt className="text-xs font-medium text-amber-700">Late or excused</dt>
                  <dd className="mt-1 text-lg font-bold text-amber-800">{statusCounts.other}</dd>
                </div>
                <div className="rounded-xl bg-slate-100 p-3">
                  <dt className="text-xs font-medium text-slate-500">Total students</dt>
                  <dd className="mt-1 text-lg font-bold text-slate-800">{statusCounts.total}</dd>
                </div>
              </dl>

              <section className="mt-5">
                <h3 className="font-semibold text-slate-900">Absent students and reasons</h3>
                {absentStudents.length === 0 ? (
                  <p className="mt-2 rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-600">
                    No students are marked absent. All remaining students will be saved with their selected status.
                  </p>
                ) : (
                  <ul className="mt-2 max-h-56 space-y-2 overflow-y-auto">
                    {absentStudents.map((student) => (
                      <li key={student._id} className="flex flex-col gap-1 rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                        <span className="font-medium text-slate-800">
                          {student.firstName} {student.lastName}
                          <span className="ml-2 text-xs font-normal text-slate-500">
                            {student.registrationNumber || ''}
                          </span>
                        </span>
                        <span className="text-sm text-slate-700">{remarks[student._id]}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <p className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                Saving will record all {students.length} students, including students hidden by search.
              </p>

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setReviewOpen(false)}
                  disabled={saving}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Back to editing
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSave}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Saving attendance...' : 'Confirm and save'}
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </DashboardShell>
  )
}

export default AttendanceManagementPage
