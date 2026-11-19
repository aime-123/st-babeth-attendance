import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, CalendarRange, Check, ChevronLeft, ChevronRight, CircleCheck, CircleX, Clock3, Eye, FileCheck2, ListFilter, Printer, RotateCcw, School, Search, ShieldCheck, UserRound, X } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import api from '../../services/api'
import DashboardShell from '../../components/dashboard/DashboardShell'
import { getAttendanceDatePreset } from './attendanceDatePresets'
import { getVisiblePageNumbers } from './attendanceHistoryPagination'

const statusOptions = [
  { value: 'all', label: 'All statuses' },
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'late', label: 'Late' },
  { value: 'excused', label: 'Excused' }
]

const datePresetOptions = [
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'last30', label: 'Last 30 days' },
  { value: 'all', label: 'All dates' }
]

function AttendanceHistoryPage({ role }) {
  const [searchParams] = useSearchParams()
  const [classes, setClasses] = useState([])
  const [schoolSettings, setSchoolSettings] = useState({
    schoolName: 'St Babeth TSS',
    district: '',
    logoDataUrl: ''
  })
  const [records, setRecords] = useState([])
  const [summary, setSummary] = useState({ present: 0, absent: 0, late: 0, excused: 0, total: 0 })
  const [selectedClassId, setSelectedClassId] = useState(() => searchParams.get('classId') || '')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedRecord, setSelectedRecord] = useState(null)
  const detailsCloseButtonRef = useRef(null)

  const filteredRecords = useMemo(() => {
    const term = search.trim().toLowerCase()

    return records.filter((record) => {
      if (!term) {
        return true
      }

      const student = record.studentId || {}
      const values = [
        student.firstName,
        student.lastName,
        student.registrationNumber,
        record.classId?.className,
        record.classId?.classCode
      ]

      return values.join(' ').toLowerCase().includes(term)
    })
  }, [records, search])

  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / rowsPerPage))
  const safeCurrentPage = Math.min(currentPage, pageCount)
  const firstRecordNumber = filteredRecords.length === 0 ? 0 : (safeCurrentPage - 1) * rowsPerPage + 1
  const lastRecordNumber = Math.min(safeCurrentPage * rowsPerPage, filteredRecords.length)
  const visiblePageNumbers = useMemo(
    () => getVisiblePageNumbers(safeCurrentPage, pageCount),
    [pageCount, safeCurrentPage]
  )
  const paginatedRecords = filteredRecords.slice(
    (safeCurrentPage - 1) * rowsPerPage,
    safeCurrentPage * rowsPerPage
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
      console.warn('Unable to load classes for attendance history', apiError)
    }
  }

  const fetchHistory = async () => {
    if (!selectedClassId) {
      setRecords([])
      setSummary({ present: 0, absent: 0, late: 0, excused: 0, total: 0 })
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await api.get('/attendance/history', {
        params: {
          classId: selectedClassId,
          dateFrom,
          dateTo,
          status: statusFilter === 'all' ? undefined : statusFilter
        }
      })

      setRecords(response.data?.data?.items || [])
      setSummary(response.data?.data?.summary || { present: 0, absent: 0, late: 0, excused: 0, total: 0 })
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Unable to load attendance history.')
    } finally {
      setLoading(false)
    }
  }

  const clearHistoryFilters = () => {
    setCurrentPage(1)
    setDateFrom('')
    setDateTo('')
    setStatusFilter('all')
    setSearch('')
  }

  const applyDatePreset = (preset) => {
    const range = getAttendanceDatePreset(preset)
    setCurrentPage(1)
    setDateFrom(range.dateFrom)
    setDateTo(range.dateTo)
  }

  const selectedClass = classes.find((schoolClass) => schoolClass._id === selectedClassId)
  const selectedClassLabel = selectedClass
    ? [selectedClass.classCode, selectedClass.className].filter(Boolean).join(' · ')
    : 'All classes'
  const printDateRange = dateFrom || dateTo
    ? `${dateFrom || 'Any start date'} to ${dateTo || 'Any end date'}`
    : 'All dates'
  const printSummary = filteredRecords.reduce((counts, record) => {
    counts.total += 1
    if (Object.prototype.hasOwnProperty.call(counts, record.status)) {
      counts[record.status] += 1
    }
    return counts
  }, { total: 0, present: 0, absent: 0, late: 0, excused: 0 })
  const activeFilterCount = [dateFrom, dateTo, statusFilter !== 'all', search.trim()].filter(Boolean).length
  const summaryCards = [
    { label: 'Present', value: summary.present, status: 'present', icon: CircleCheck, tone: 'present' },
    { label: 'Absent', value: summary.absent, status: 'absent', icon: CircleX, tone: 'absent' },
    { label: 'Late', value: summary.late, status: 'late', icon: Clock3, tone: 'late' },
    { label: 'Excused', value: summary.excused, status: 'excused', icon: ShieldCheck, tone: 'excused' },
    { label: 'Total records', value: summary.total, status: 'all', icon: FileCheck2, tone: 'total' }
  ]

  useEffect(() => {
    fetchClasses()
  }, [role])

  useEffect(() => {
    let isCurrent = true
    const handleSchoolSettingsUpdated = (event) => {
      if (event.detail) {
        setSchoolSettings((current) => ({ ...current, ...event.detail }))
      }
    }

    window.addEventListener('school-settings-updated', handleSchoolSettingsUpdated)
    api.get('/settings/school')
      .then((response) => {
        if (isCurrent) {
          setSchoolSettings((current) => ({ ...current, ...response.data.data }))
        }
      })
      .catch((apiError) => {
        console.warn('Unable to load school identity for the printable attendance history.', apiError)
      })

    return () => {
      isCurrent = false
      window.removeEventListener('school-settings-updated', handleSchoolSettingsUpdated)
    }
  }, [])

  useEffect(() => {
    fetchHistory()
  }, [selectedClassId, dateFrom, dateTo, statusFilter])

  useEffect(() => {
    if (!selectedRecord) {
      return undefined
    }

    const previousFocus = document.activeElement
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setSelectedRecord(null)
      }
    }

    document.addEventListener('keydown', closeOnEscape)
    const focusTimer = window.setTimeout(() => detailsCloseButtonRef.current?.focus(), 0)

    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      window.clearTimeout(focusTimer)
      previousFocus?.focus?.()
    }
  }, [selectedRecord])

  return (
    <DashboardShell
      role={role}
      title={role === 'admin' ? 'Attendance History' : 'Attendance Log'}
      subtitle={role === 'admin' ? 'Administration' : 'Teacher'}
    >
      <div className="attendance-history-page space-y-6">
        <section className="attendance-history-intro attendance-page-intro relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-6 sm:py-6">
          <div className="attendance-history-intro-glow" aria-hidden="true" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="attendance-history-intro-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
                <CalendarRange className="h-6 w-6" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Attendance records</p>
                <h2 className="mt-1 text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">Attendance history</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                  Review, search, and filter class attendance records by student, date, or status.
                </p>
              </div>
            </div>
            <div className="attendance-history-overview-pill inline-flex min-h-10 shrink-0 items-center gap-2 self-start rounded-full border border-emerald-100 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 sm:self-center">
              <FileCheck2 className="h-4 w-4" aria-hidden="true" />
              {loading ? 'Updating records' : `${summary.total} total records`}
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Attendance summary filters">
          {summaryCards.map((card) => {
            const Icon = card.icon
            const isSelected = statusFilter === card.status
            return (
              <button
                key={card.label}
                type="button"
                onClick={() => {
                  setCurrentPage(1)
                  setStatusFilter(card.status)
                }}
                aria-pressed={isSelected}
                aria-label={`Filter attendance by ${card.label.toLowerCase()}`}
                className={`attendance-history-summary-card attendance-history-summary-${card.tone} group relative flex min-h-28 w-full items-center justify-between overflow-hidden rounded-2xl border p-4 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 sm:p-5 ${isSelected ? 'is-selected' : ''}`}
              >
                <div className="relative z-10">
                  <p className="text-sm font-semibold text-slate-600">{card.label}</p>
                  <p className="mt-2 text-3xl font-extrabold leading-none tracking-tight text-slate-900">{loading ? '—' : card.value}</p>
                  <p className="mt-2 text-[11px] font-semibold text-slate-500">
                    {card.status === 'all' ? 'View all statuses' : 'Click to filter'}
                  </p>
                </div>
                <span className="attendance-history-summary-icon relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                {isSelected && <span className="attendance-history-summary-check absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full" aria-hidden="true"><Check className="h-3 w-3" /></span>}
              </button>
            )
          })}
        </section>

        <section className="attendance-filter-panel attendance-history-filters card-surface overflow-hidden rounded-2xl" aria-label="Attendance history filters">
          <div className="attendance-history-filter-heading flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex items-center gap-3">
              <span className="attendance-history-filter-icon flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800">
                <ListFilter className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Find attendance records</h3>
                <p className="mt-0.5 text-xs text-slate-500">Choose a class and refine the results</p>
              </div>
            </div>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearHistoryFilters}
                className="attendance-history-clear-button inline-flex min-h-9 items-center justify-center gap-1.5 self-start rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 sm:self-auto"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Clear filters
                <span className="attendance-history-filter-count rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px]">{activeFilterCount}</span>
              </button>
            )}
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4 sm:p-6">
            <div className="attendance-history-filter-field">
              <label htmlFor="attendance-history-class" className="mb-1.5 block text-xs font-bold uppercase tracking-[0.08em] text-slate-600">Class</label>
              <select
                id="attendance-history-class"
                value={selectedClassId}
                onChange={(event) => {
                  setCurrentPage(1)
                  setSelectedClassId(event.target.value)
                }}
                className="attendance-history-control w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              >
                <option value="">Select class</option>
                {classes.map((schoolClass) => (
                  <option key={schoolClass._id} value={schoolClass._id}>
                    {schoolClass.className} ({schoolClass.classCode})
                  </option>
                ))}
              </select>
            </div>

            <div className="attendance-history-filter-field">
              <label htmlFor="attendance-history-from" className="mb-1.5 block text-xs font-bold uppercase tracking-[0.08em] text-slate-600">From date</label>
              <input
                id="attendance-history-from"
                type="date"
                value={dateFrom}
                onChange={(event) => {
                  setCurrentPage(1)
                  setDateFrom(event.target.value)
                }}
                className="attendance-history-control w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div className="attendance-history-filter-field">
              <label htmlFor="attendance-history-to" className="mb-1.5 block text-xs font-bold uppercase tracking-[0.08em] text-slate-600">To date</label>
              <input
                id="attendance-history-to"
                type="date"
                value={dateTo}
                onChange={(event) => {
                  setCurrentPage(1)
                  setDateTo(event.target.value)
                }}
                className="attendance-history-control w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div className="attendance-history-filter-field">
              <label htmlFor="attendance-history-status" className="mb-1.5 block text-xs font-bold uppercase tracking-[0.08em] text-slate-600">Attendance status</label>
              <select
                id="attendance-history-status"
                value={statusFilter}
                onChange={(event) => {
                  setCurrentPage(1)
                  setStatusFilter(event.target.value)
                }}
                className="attendance-history-control w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="attendance-history-date-presets">
            <p className="attendance-history-date-presets-label">Quick date ranges</p>
            <div className="attendance-history-date-preset-buttons" role="group" aria-label="Quick date filters">
              {datePresetOptions.map((preset) => {
                const range = getAttendanceDatePreset(preset.value)
                const isSelected = dateFrom === range.dateFrom && dateTo === range.dateTo

                return (
                  <button
                    key={preset.value}
                    type="button"
                    className={`attendance-history-date-preset ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => applyDatePreset(preset.value)}
                    aria-pressed={isSelected}
                  >
                    {preset.label}
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        <section className="attendance-record-panel card-surface overflow-hidden rounded-2xl" aria-label="Attendance history records">
          {error && (
            <div className="attendance-history-error flex items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </div>
          )}

          <div className="attendance-table-toolbar flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                value={search}
                onChange={(event) => {
                  setCurrentPage(1)
                  setSearch(event.target.value)
                }}
                className="attendance-history-search w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                placeholder="Search student or class"
                aria-label="Search attendance records by student"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                type="button"
                onClick={() => window.print()}
                disabled={loading || filteredRecords.length === 0}
                className="attendance-history-print-button"
                aria-label={`Print ${filteredRecords.length} matching attendance records`}
                title="Print all attendance records matching the current filters"
              >
                <Printer className="h-4 w-4" aria-hidden="true" />
                <span>Print</span>
              </button>
              <div className="attendance-history-result-count inline-flex min-h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700" aria-live="polite">
                <CalendarRange className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                Showing <strong className="font-extrabold text-slate-900">{filteredRecords.length}</strong> of {records.length}
                {loading && <span className="attendance-history-updating">Updating</span>}
              </div>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={clearHistoryFilters}
                  className="attendance-history-clear-button inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  Reset
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table attendance-history-table min-w-[640px]">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Student</th>
                  <th scope="col">Status</th>
                  <th scope="col">Details</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="4" className="attendance-history-table-state px-4 py-10 text-center text-slate-500">
                      <span className="inline-flex items-center gap-2">
                        <span className="attendance-history-spinner h-4 w-4 rounded-full border-2 border-emerald-200 border-t-emerald-700" aria-hidden="true" />
                        Loading attendance history…
                      </span>
                    </td>
                  </tr>
                ) : filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="attendance-history-table-state px-4 py-12 text-center text-slate-500">
                      <span className="attendance-history-empty-icon mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                        <Search className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <p className="mt-3 font-semibold text-slate-800">No attendance records found</p>
                      <p className="mt-1 text-sm">Try changing the class, date range, status, or search term.</p>
                      {activeFilterCount > 0 && (
                        <button type="button" onClick={clearHistoryFilters} className="attendance-history-empty-action mt-3 rounded-lg px-3 py-2 text-xs font-bold text-emerald-800 transition hover:bg-emerald-50">
                          Clear filters
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  paginatedRecords.map((record) => (
                    <tr key={`${record._id}-${record.date}`}>
                      <td className="whitespace-nowrap font-medium text-slate-700">
                        {new Date(record.date).toLocaleDateString()}
                      </td>
                      <td>
                        <div className="flex items-center gap-2.5 font-semibold text-slate-800">
                          <span className="attendance-history-student-icon flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                            <UserRound className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <span>{record.studentId?.firstName || 'Student'} {record.studentId?.lastName || ''}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`attendance-history-status attendance-history-status-${record.status} inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold capitalize`}>
                          {record.status === 'present'
                            ? <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" />
                            : record.status === 'absent'
                              ? <CircleX className="h-3.5 w-3.5" aria-hidden="true" />
                              : record.status === 'late'
                                ? <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                                : <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />}
                          {record.status}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="attendance-history-view-details"
                          onClick={() => setSelectedRecord(record)}
                          aria-label={`View details for ${record.studentId?.firstName || 'student'} ${record.studentId?.lastName || ''}`}
                        >
                          <Eye className="h-4 w-4" aria-hidden="true" />
                          View details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!loading && filteredRecords.length > 0 && (
            <nav className="attendance-history-pagination" aria-label="Attendance table pagination">
              <div className="attendance-history-pagination-details">
                <p className="attendance-history-pagination-range" aria-live="polite">
                  Showing <strong>{firstRecordNumber}–{lastRecordNumber}</strong> of <strong>{filteredRecords.length}</strong> records
                </p>
                <label className="attendance-history-page-size">
                  <span>Rows per page</span>
                  <select
                    value={rowsPerPage}
                    onChange={(event) => {
                      setCurrentPage(1)
                      setRowsPerPage(Number(event.target.value))
                    }}
                    aria-label="Rows per page"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </label>
              </div>

              <div className="attendance-history-pagination-controls">
                <button
                  type="button"
                  className="attendance-history-page-button"
                  onClick={() => setCurrentPage(Math.max(1, safeCurrentPage - 1))}
                  disabled={safeCurrentPage === 1}
                  aria-label="Go to previous page"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  <span>Previous</span>
                </button>
                <div className="attendance-history-page-numbers" role="group" aria-label="Choose attendance page">
                  {visiblePageNumbers[0] > 1 && (
                    <>
                      <button type="button" className="attendance-history-page-number" onClick={() => setCurrentPage(1)}>1</button>
                      {visiblePageNumbers[0] > 2 && <span className="attendance-history-page-ellipsis" aria-hidden="true">…</span>}
                    </>
                  )}
                  {visiblePageNumbers.map((pageNumber) => (
                    <button
                      key={pageNumber}
                      type="button"
                      className={`attendance-history-page-number ${safeCurrentPage === pageNumber ? 'is-current' : ''}`}
                      onClick={() => setCurrentPage(pageNumber)}
                      aria-label={`Go to page ${pageNumber}`}
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
                      <button type="button" className="attendance-history-page-number" onClick={() => setCurrentPage(pageCount)}>{pageCount}</button>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  className="attendance-history-page-button"
                  onClick={() => setCurrentPage(Math.min(pageCount, safeCurrentPage + 1))}
                  disabled={safeCurrentPage === pageCount}
                  aria-label="Go to next page"
                >
                  <span>Next</span>
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </nav>
          )}
        </section>

        <section className="attendance-history-print-area" aria-label="Printable attendance history">
          <header className="attendance-history-print-header">
            <div className="attendance-history-print-brand">
              <span className="attendance-history-print-logo">
                {schoolSettings.logoDataUrl
                  ? <img src={schoolSettings.logoDataUrl} alt={`${schoolSettings.schoolName} logo`} />
                  : <School aria-hidden="true" />}
              </span>
              <div className="attendance-history-print-school">
                <p className="attendance-history-print-school-name">{schoolSettings.schoolName}</p>
                <span>Attendance Management System</span>
                {schoolSettings.district && <span>{schoolSettings.district}</span>}
              </div>
            </div>
            <div className="attendance-history-print-title">
              <p>OFFICIAL SCHOOL REPORT</p>
              <h1>Attendance History Report</h1>
              <span className="attendance-history-print-timestamp">Printed {new Date().toLocaleString()}</span>
            </div>
          </header>
          <section className="attendance-history-print-details" aria-label="Report details">
            <h2 className="attendance-history-print-section-title">Report details</h2>
            <dl className="attendance-history-print-meta">
              <div><dt>Class</dt><dd>{selectedClassLabel}</dd></div>
              <div><dt>Date range</dt><dd>{printDateRange}</dd></div>
              {statusFilter !== 'all' && (
                <div><dt>Status filter</dt><dd>{statusOptions.find((option) => option.value === statusFilter)?.label}</dd></div>
              )}
              {search.trim() && <div><dt>Student search</dt><dd>{search.trim()}</dd></div>}
            </dl>
          </section>
          <section className="attendance-history-print-summary" aria-label="Attendance summary">
            <h2 className="attendance-history-print-section-title">Attendance summary</h2>
            <div className="attendance-history-print-summary-grid">
              <div><span>Total records</span><strong>{printSummary.total}</strong></div>
              <div><span>Present</span><strong>{printSummary.present}</strong></div>
              <div><span>Absent</span><strong>{printSummary.absent}</strong></div>
              <div><span>Late</span><strong>{printSummary.late}</strong></div>
              <div><span>Excused</span><strong>{printSummary.excused}</strong></div>
            </div>
          </section>
          <table className="attendance-history-print-table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Student</th>
                <th scope="col">Student ID</th>
                <th scope="col">Status</th>
                <th scope="col">Remarks</th>
                <th scope="col">Recorded by</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => (
                <tr key={`print-${record._id}-${record.date}`}>
                  <td>{new Date(record.date).toLocaleDateString()}</td>
                  <td>{record.studentId?.firstName || 'Student'} {record.studentId?.lastName || ''}</td>
                  <td>{record.studentId?.registrationNumber || '—'}</td>
                  <td>{record.status}</td>
                  <td>{record.remarks || '—'}</td>
                  <td>{record.recordedBy?.fullName || 'System'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {selectedRecord && (
          <div
            className="attendance-history-details-backdrop fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setSelectedRecord(null)
              }
            }}
          >
            <section
              className="attendance-history-details-dialog my-auto w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-7"
              role="dialog"
              aria-modal="true"
              aria-labelledby="attendance-history-details-title"
            >
              <div className="mb-5 flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">Attendance record details</p>
                  <h2 id="attendance-history-details-title" className="mt-1 text-2xl font-extrabold text-slate-900">
                    {selectedRecord.studentId?.firstName || 'Student'} {selectedRecord.studentId?.lastName || ''}
                  </h2>
                </div>
                <button
                  ref={detailsCloseButtonRef}
                  type="button"
                  onClick={() => setSelectedRecord(null)}
                  aria-label="Close attendance record details"
                  className="attendance-history-details-close inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <dl className="grid gap-3 sm:grid-cols-2">
                <div className="attendance-history-details-field rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date</dt>
                  <dd className="mt-1 break-words text-sm font-semibold text-slate-900">
                    {new Date(selectedRecord.date).toLocaleDateString()}
                  </dd>
                </div>
                <div className="attendance-history-details-field rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Student ID</dt>
                  <dd className="mt-1 break-words text-sm font-semibold text-slate-900">
                    {selectedRecord.studentId?.registrationNumber || '—'}
                  </dd>
                </div>
                <div className="attendance-history-details-field rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Class</dt>
                  <dd className="mt-1 break-words text-sm font-semibold text-slate-900">
                    {[selectedRecord.classId?.classCode, selectedRecord.classId?.className].filter(Boolean).join(' · ') || '—'}
                  </dd>
                </div>
                <div className="attendance-history-details-field rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</dt>
                  <dd className="mt-1">
                    <span className={`attendance-history-status attendance-history-status-${selectedRecord.status} inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold capitalize`}>
                      {selectedRecord.status}
                    </span>
                  </dd>
                </div>
                <div className="attendance-history-details-field rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recorded by</dt>
                  <dd className="mt-1 break-words text-sm font-semibold text-slate-900">
                    {selectedRecord.recordedBy?.fullName || 'System'}
                  </dd>
                </div>
                <div className="attendance-history-details-field rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 sm:col-span-2">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Remarks</dt>
                  <dd className="mt-1 break-words text-sm font-semibold text-slate-900">
                    {selectedRecord.remarks || '—'}
                  </dd>
                </div>
              </dl>
            </section>
          </div>
        )}
      </div>
    </DashboardShell>
  )
}

export default AttendanceHistoryPage
