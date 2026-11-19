import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, BarChart3, Filter, Printer, RotateCcw, Search } from 'lucide-react'
import api from '../../services/api'
import DashboardShell from '../../components/dashboard/DashboardShell'

const initialSummary = {
  totalStudents: 0,
  total: 0,
  present: 0,
  absent: 0,
  late: 0,
  excused: 0,
  attendanceRate: 0
}

const emptyFilters = { classId: '', dateFrom: '', dateTo: '' }

const makeReport = (data, filters) => {
  if (!data?.summary || !Array.isArray(data.classes)) {
    throw new Error('The report service returned incomplete data. Please try again.')
  }

  return {
    summary: { ...initialSummary, ...data.summary },
    classes: data.classes,
    records: Array.isArray(data.records) ? data.records : [],
    filters,
    generatedAt: new Date().toISOString()
  }
}

function ReportsPage({ role }) {
  const [classes, setClasses] = useState([])
  const [schoolSettings, setSchoolSettings] = useState({
    schoolName: 'St Babeth TSS',
    district: '',
    contactEmail: '',
    logoDataUrl: ''
  })
  const [selectedClassId, setSelectedClassId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [report, setReport] = useState({
    summary: initialSummary,
    classes: [],
    records: [],
    filters: emptyFilters,
    generatedAt: ''
  })
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const filteredClasses = useMemo(() => {
    const term = search.trim().toLowerCase()

    if (!term) {
      return report.classes
    }

    return report.classes.filter((schoolClass) => {
      const values = [schoolClass.className, schoolClass.classCode, schoolClass.trade, schoolClass.level]
      return values.join(' ').toLowerCase().includes(term)
    })
  }, [report.classes, search])

  const currentFilters = { classId: selectedClassId, dateFrom, dateTo }
  const reportIsStale = Object.keys(currentFilters).some((key) => currentFilters[key] !== report.filters[key])

  useEffect(() => {
    let isCurrent = true

    api.get('/settings/school')
      .then((response) => {
        if (isCurrent) {
          setSchoolSettings((current) => ({ ...current, ...response.data.data }))
        }
      })
      .catch((apiError) => {
        console.warn('Unable to load school identity for the printable report.', apiError)
      })

    const loadClasses = async () => {
      try {
        const classesResponse = await api.get('/classes', { params: { limit: 1000 } })
        const classItems = classesResponse.data?.data?.items

        if (!Array.isArray(classItems)) {
          throw new Error('The class list could not be loaded.')
        }

        if (isCurrent) {
          setClasses(classItems)
        }
      } catch (apiError) {
        console.warn('Unable to load classes for attendance reports.', apiError)
        if (isCurrent) {
          setError(apiError.response?.data?.message || apiError.message || 'Unable to load classes for reports. You can still generate a report for all classes.')
        }
      }
    }

    loadClasses()

    return () => {
      isCurrent = false
    }
  }, [role])

  const generateReport = async (filters = currentFilters) => {
    if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
      setError('The start date must be on or before the end date.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await api.get('/reports', {
        params: {
          classId: filters.classId || undefined,
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined
        }
      })

      setReport(makeReport(response.data?.data, filters))
    } catch (apiError) {
      console.warn('Unable to generate attendance report.', apiError)
      setError(apiError.response?.data?.message || apiError.message || 'Unable to generate report.')
    } finally {
      setLoading(false)
    }
  }

  const clearReportFilters = () => {
    setSelectedClassId('')
    setDateFrom('')
    setDateTo('')
    setSearch('')
    generateReport(emptyFilters)
  }

  const reportPeriod = report.filters.dateFrom && report.filters.dateTo
    ? `${report.filters.dateFrom} to ${report.filters.dateTo}`
    : report.filters.dateFrom
      ? `From ${report.filters.dateFrom}`
      : report.filters.dateTo
        ? `Through ${report.filters.dateTo}`
        : 'All available dates'
  const generatedAt = report.generatedAt
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(report.generatedAt))
    : ''

  return (
    <DashboardShell
      role={role}
      title={role === 'admin' ? 'Reports' : 'Class Reports'}
      subtitle={role === 'admin' ? 'Administration' : 'Teacher'}
    >
      <div className="reports-page space-y-6">
        <section className="reports-page-intro flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-emerald-700">School insights</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">Attendance reports</h2>
            <p className="mt-1 text-sm text-slate-600">Choose a class and date range, then generate a report or print it as a PDF.</p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={loading || reportIsStale || !report.generatedAt}
            className="reports-print-button inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-700 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            Print / Save as PDF
          </button>
        </section>

        <form
          className="reports-filter-panel card-surface p-5"
          aria-label="Report filters"
          onSubmit={(event) => {
            event.preventDefault()
            generateReport()
          }}
        >
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-900">Report filters</h3>
            <p className="mt-1 text-sm text-slate-500">Choose any class or date range. Leave dates blank to include all available attendance.</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr_1fr]">
            <div>
              <label htmlFor="report-class" className="mb-1 block text-sm font-medium text-slate-700">Class</label>
              <select
                id="report-class"
                value={selectedClassId}
                onChange={(event) => setSelectedClassId(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 focus:border-blue-500 focus:outline-none"
              >
                <option value="">All classes</option>
                {classes.map((schoolClass) => (
                  <option key={schoolClass._id} value={schoolClass._id}>
                    {schoolClass.className} ({schoolClass.classCode})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="report-date-from" className="mb-1 block text-sm font-medium text-slate-700">From</label>
              <input
                id="report-date-from"
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="report-date-to" className="mb-1 block text-sm font-medium text-slate-700">To</label>
              <input
                id="report-date-to"
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                aria-label="Generate attendance report"
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
              >
                <Filter className="h-4 w-4" aria-hidden="true" />
                {loading ? 'Generating...' : 'Generate report'}
              </button>
            </div>
          </div>
          {reportIsStale && !loading && (
            <p className="mt-3 text-xs font-medium text-amber-700" role="status">
              Filters changed. Select Generate report to refresh the results.
            </p>
          )}
        </form>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </div>
        )}

        <header className="reports-print-heading">
          <div className="reports-print-brand">
            {schoolSettings.logoDataUrl && (
              <img src={schoolSettings.logoDataUrl} alt="" className="reports-print-logo" />
            )}
            <div>
              <p className="reports-print-school-name">{schoolSettings.schoolName}</p>
              <p className="reports-print-school-caption">Attendance Management System</p>
              {schoolSettings.district && <p className="reports-print-district">{schoolSettings.district}</p>}
            </div>
          </div>
          <div className="reports-print-title">
            <p className="reports-print-kicker">OFFICIAL SCHOOL REPORT</p>
            <h1>Attendance report</h1>
          </div>
        </header>
        <section className="reports-print-meta" aria-label="Report details">
          <div>
            <span>Class</span>
            <strong>{report.filters.classId ? classes.find((schoolClass) => schoolClass._id === report.filters.classId)?.className || 'Selected class' : 'All classes'}</strong>
          </div>
          <div>
            <span>Reporting period</span>
            <strong>{reportPeriod}</strong>
          </div>
          <div>
            <span>Generated</span>
            <strong>{generatedAt || 'Pending report generation'}</strong>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-4 md:grid-cols-4 2xl:grid-cols-7" aria-label="Report summary">
          {[
            { label: 'Students', value: report.summary.totalStudents, tone: 'bg-blue-100 text-blue-700' },
            { label: 'Marked entries', value: report.summary.total, tone: 'bg-slate-200 text-slate-700' },
            { label: 'Present', value: report.summary.present, tone: 'bg-emerald-100 text-emerald-700' },
            { label: 'Absent', value: report.summary.absent, tone: 'bg-red-100 text-red-700' },
            { label: 'Late', value: report.summary.late, tone: 'bg-amber-100 text-amber-700' },
            { label: 'Excused', value: report.summary.excused, tone: 'bg-sky-100 text-sky-700' },
            { label: 'Attendance rate', value: `${report.summary.attendanceRate || 0}%`, tone: 'bg-emerald-100 text-emerald-700' }
          ].map((card) => (
            <div key={card.label} className="reports-summary-card card-surface p-5">
              <p className="text-sm text-slate-500">{card.label}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className={`rounded-full px-3 py-1 text-lg font-bold ${card.tone}`}>{card.value}</span>
              </div>
            </div>
          ))}
        </section>
        <p className="-mt-3 text-xs text-slate-500">Attendance rate is based on marked attendance entries in the selected period.</p>

        <section className="reports-breakdown-panel card-surface overflow-hidden" aria-label="Class attendance report">
          <div className="reports-table-toolbar flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <BarChart3 className="h-4 w-4" aria-hidden="true" />
                Class attendance breakdown
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Showing {filteredClasses.length} of {report.classes.length} classes · {reportPeriod}
              </p>
            </div>

            <div className="reports-table-actions flex flex-col gap-2 sm:flex-row">
              <label className="relative block w-full sm:max-w-xs">
                <span className="sr-only">Search classes in the report</span>
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" aria-hidden="true" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="reports-search-input w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="Search classes"
                />
              </label>
              {(search || selectedClassId || dateFrom || dateTo) && (
                <button
                  type="button"
                  onClick={clearReportFilters}
                  disabled={loading}
                  className="reports-reset-button inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  Reset filters
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table min-w-[780px]">
              <thead>
                <tr>
                  <th scope="col">Class</th>
                  <th scope="col">Students</th>
                  <th scope="col">Present</th>
                  <th scope="col">Absent</th>
                  <th scope="col">Late</th>
                  <th scope="col">Excused</th>
                  <th scope="col">Rate</th>
                </tr>
              </thead>
              <tbody>
                {loading && report.classes.length === 0 ? (
                  <tr><td colSpan="7" className="px-4 py-10 text-center text-slate-500">Loading attendance report…</td></tr>
                ) : filteredClasses.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-10 text-center text-slate-500">
                      {!report.generatedAt
                        ? 'Select your report options, then choose Generate report to view attendance.'
                        : report.classes.length === 0
                          ? 'No class data is available for this report.'
                          : 'No classes match your search.'}
                    </td>
                  </tr>
                ) : (
                  filteredClasses.map((schoolClass) => (
                    <tr key={schoolClass._id}>
                      <td>
                        <div className="font-semibold text-slate-800">{schoolClass.className}</div>
                        <div className="text-xs text-slate-500">{schoolClass.classCode}</div>
                      </td>
                      <td className="font-semibold text-slate-800">{schoolClass.totalStudents}</td>
                      <td className="font-medium text-emerald-700">{schoolClass.present}</td>
                      <td className="font-medium text-red-700">{schoolClass.absent}</td>
                      <td className="font-medium text-amber-700">{schoolClass.late}</td>
                      <td className="font-medium text-sky-700">{schoolClass.excused}</td>
                      <td>
                        <span className="reports-rate-badge rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          {schoolClass.attendanceRate}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
        <footer className="reports-print-footer">
          <span>{schoolSettings.schoolName} · Attendance Management System</span>
          {schoolSettings.contactEmail && <span>{schoolSettings.contactEmail}</span>}
        </footer>
      </div>
    </DashboardShell>
  )
}

export default ReportsPage
