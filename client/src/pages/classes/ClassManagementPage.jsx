import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, CalendarDays, Filter, Pencil, Plus, RotateCcw, Search, Trash2, UserRound, X } from 'lucide-react'
import api from '../../services/api'
import DashboardShell from '../../components/dashboard/DashboardShell'
import { getStudentPageItems, STUDENTS_PER_PAGE } from './studentPagination'

const getCurrentAcademicYear = () => {
  const now = new Date()
  const currentYear = now.getFullYear()
  const startYear = now.getMonth() >= 8 ? currentYear : currentYear - 1
  return `${startYear}/${startYear + 1}`
}

const createInitialForm = () => ({
  className: '',
  classCode: '',
  trade: '',
  level: '',
  academicYear: getCurrentAcademicYear(),
  assignedTeachers: [],
  status: 'active',
  description: '',
  schedule: []
})

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const classTrades = [
  'Software Development',
  'Multimedia Production',
  'General Education'
]

const classLevelsByTrade = {
  'Software Development': ['L3', 'L4', 'L5'],
  'Multimedia Production': ['L3', 'L4', 'L5'],
  'General Education': ['S1', 'S2', 'S3']
}

const classCodesByTradeAndLevel = {
  'Software Development': {
    L3: ['L3 SOD'],
    L4: ['L4 SOD'],
    L5: ['L5 SOD']
  },
  'Multimedia Production': {
    L3: ['L3 MMP'],
    L4: ['L4 MMP'],
    L5: ['L5 MMP']
  },
  'General Education': {
    S1: ['S1A', 'S1B'],
    S2: ['S2A', 'S2B'],
    S3: ['S3A', 'S3B']
  }
}

function ClassManagementPage({ role }) {
  const [classes, setClasses] = useState([])
  const [students, setStudents] = useState([])
  const [studentPage, setStudentPage] = useState(1)
  const [teachers, setTeachers] = useState([])
  const [form, setForm] = useState(createInitialForm)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [editingId, setEditingId] = useState(null)
  const [isFormOpen, setFormOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [studentsLoading, setStudentsLoading] = useState(role === 'teacher')
  const [studentsError, setStudentsError] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const formRef = useRef(null)
  const availableClassLevels = classLevelsByTrade[form.trade] || []
  const availableClassCodes = classCodesByTradeAndLevel[form.trade]?.[form.level] || []

  const filteredClasses = useMemo(() => {
    return classes.filter((schoolClass) => {
      const matchesText = !search || [schoolClass.className, schoolClass.classCode, schoolClass.trade, schoolClass.level]
        .join(' ')
        .toLowerCase()
        .includes(search.toLowerCase())

      const matchesStatus = statusFilter === 'all' || schoolClass.status === statusFilter
      return matchesText && matchesStatus
    })
  }, [classes, search, statusFilter])

  const studentPageCount = Math.max(1, Math.ceil(students.length / STUDENTS_PER_PAGE))
  const currentStudentPage = Math.min(studentPage, studentPageCount)
  const paginatedStudents = getStudentPageItems(students, currentStudentPage)
  const firstStudentNumber = students.length === 0 ? 0 : (currentStudentPage - 1) * STUDENTS_PER_PAGE + 1
  const lastStudentNumber = Math.min(currentStudentPage * STUDENTS_PER_PAGE, students.length)

  const fetchTeachers = useCallback(async () => {
    if (role !== 'admin') {
      return
    }

    try {
      const response = await api.get('/users?role=teacher')
      setTeachers(response.data?.data || [])
    } catch (error) {
      console.warn('Unable to load teachers', error)
    }
  }, [role])

  const fetchClasses = useCallback(async () => {
    try {
      const response = await api.get('/classes')
      setClasses(response.data?.data?.items || [])
    } catch (error) {
      console.warn('Unable to load classes', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchStudents = useCallback(async () => {
    if (role !== 'teacher') {
      return
    }

    try {
      const response = await api.get('/students')
      setStudents(response.data?.data || [])
    } catch (requestError) {
      setStudentsError(requestError.response?.data?.message || 'Unable to load students in your classes.')
    } finally {
      setStudentsLoading(false)
    }
  }, [role])

  useEffect(() => {
    fetchTeachers()
    fetchClasses()
    fetchStudents()
  }, [fetchClasses, fetchStudents, fetchTeachers])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => {
      if (name === 'trade') {
        return { ...prev, trade: value, level: '', classCode: '' }
      }

      if (name === 'level') {
        return { ...prev, level: value, classCode: '' }
      }

      return { ...prev, [name]: value }
    })
  }

  const handleTeacherToggle = (teacherId) => {
    setForm((prev) => {
      const selected = prev.assignedTeachers.includes(teacherId)
      return {
        ...prev,
        assignedTeachers: selected
          ? prev.assignedTeachers.filter((id) => id !== teacherId)
          : [...prev.assignedTeachers, teacherId]
      }
    })
  }

  const handleScheduleChange = (index, field, value) => {
    setForm((previous) => ({
      ...previous,
      schedule: previous.schedule.map((session, sessionIndex) => (
        sessionIndex === index ? { ...session, [field]: value } : session
      ))
    }))
  }

  const addScheduleSession = () => {
    setForm((previous) => ({
      ...previous,
      schedule: [...previous.schedule, { day: 'Monday', startTime: '', endTime: '', room: '' }]
    }))
  }

  const removeScheduleSession = (index) => {
    setForm((previous) => ({
      ...previous,
      schedule: previous.schedule.filter((_, sessionIndex) => sessionIndex !== index)
    }))
  }

  const resetForm = () => {
    setForm(createInitialForm())
    setEditingId(null)
    setError('')
    setFormOpen(false)
  }

  const openNewClassForm = () => {
    setForm(createInitialForm())
    setEditingId(null)
    setError('')
    setFormOpen(true)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      const payload = { ...form, assignedTeachers: form.assignedTeachers }

      if (editingId) {
        await api.put(`/classes/${editingId}`, payload)
      } else {
        await api.post('/classes', payload)
      }

      resetForm()
      fetchClasses()
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Unable to save class.')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (schoolClass) => {
    setEditingId(schoolClass._id)
    setForm({
      className: schoolClass.className,
      classCode: schoolClass.classCode,
      trade: schoolClass.trade,
      level: schoolClass.level,
      academicYear: schoolClass.academicYear,
      assignedTeachers: schoolClass.assignedTeachers?.map((teacher) => teacher._id || teacher) || [],
      status: schoolClass.status,
      description: schoolClass.description || '',
      schedule: schoolClass.schedule?.map((session) => ({ ...session })) || []
    })
    setError('')
    setFormOpen(true)
  }

  useEffect(() => {
    if (!isFormOpen) {
      return undefined
    }

    const previousFocus = document.activeElement
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setForm(createInitialForm())
        setEditingId(null)
        setError('')
        setFormOpen(false)
        return
      }

      if (event.key === 'Tab') {
        const focusableElements = formRef.current?.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')
        if (!focusableElements?.length) {
          return
        }

        const firstElement = focusableElements[0]
        const lastElement = focusableElements[focusableElements.length - 1]

        if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault()
          lastElement.focus()
        } else if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault()
          firstElement.focus()
        }
      }
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)
    window.setTimeout(() => formRef.current?.querySelector('input')?.focus(), 0)

    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', handleKeyDown)
      previousFocus?.focus?.()
    }
  }, [isFormOpen])

  const handleDelete = async (classId) => {
    if (!window.confirm('Delete this class?')) {
      return
    }

    try {
      await api.delete(`/classes/${classId}`)
      fetchClasses()
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Unable to delete class.')
    }
  }

  const clearClassFilters = () => {
    setSearch('')
    setStatusFilter('all')
  }

  const activeClassCount = classes.filter((schoolClass) => schoolClass.status === 'active').length
  const inactiveClassCount = classes.length - activeClassCount

  return (
    <DashboardShell role={role} title={role === 'admin' ? 'Class Management' : 'My Classes'} subtitle={role === 'admin' ? 'Administration' : 'Teacher'}>
      <div className="class-management-page space-y-6">
        <section className="grid gap-3 sm:grid-cols-3" aria-label="Class summary">
          {[
            { label: 'Total classes', value: loading ? '—' : classes.length },
            { label: 'Active classes', value: loading ? '—' : activeClassCount },
            { label: 'Inactive classes', value: loading ? '—' : inactiveClassCount }
          ].map((stat) => (
            <article key={stat.label} className="class-summary-card rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
              <p className="text-sm font-medium text-slate-600">{stat.label}</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{stat.value}</p>
            </article>
          ))}
        </section>

        <section className="class-management-intro flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-700">{role === 'admin' ? 'Class administration' : 'Teaching workspace'}</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">{role === 'admin' ? 'Manage your classes' : 'My classes'}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {role === 'admin'
                ? 'Create classes, assign teachers, and review class status.'
                : 'Review your assigned classes and class status.'}
            </p>
          </div>
          {role === 'admin' && (
            <button
              type="button"
              onClick={isFormOpen ? resetForm : openNewClassForm}
              aria-expanded={isFormOpen}
              aria-controls="class-editor"
              className="class-management-create-action inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-800 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 active:translate-y-0"
            >
              {isFormOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {isFormOpen ? 'Close form' : 'Create class'}
            </button>
          )}
        </section>

        {isFormOpen && role === 'admin' && (
          <div
            className="class-management-modal-backdrop fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                resetForm()
              }
            }}
          >
            <section
              id="class-editor"
              ref={formRef}
              className="class-management-form class-management-panel card-surface my-auto w-full max-w-3xl rounded-2xl p-5 shadow-2xl sm:p-7"
              role="dialog"
              aria-modal="true"
              aria-labelledby="class-form-title"
            >
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500">Class setup</p>
                <h2 id="class-form-title" className="text-2xl font-bold text-slate-900">{editingId ? 'Edit class' : 'Create class'}</h2>
                <p className="mt-1 text-sm text-slate-600">Enter class details and assign the teachers.</p>
              </div>
              <button
                type="button"
                onClick={resetForm}
                aria-label="Close class form"
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-emerald-400 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <X className="h-4 w-4" />
                <span className="hidden sm:inline">Close</span>
              </button>
            </div>

            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Class name</label>
                  <input name="className" value={form.className} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 focus:border-blue-500 focus:outline-none" placeholder="Form 3A" required />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Trade</label>
                  <select name="trade" value={form.trade} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 focus:border-blue-500 focus:outline-none" required>
                    <option value="" disabled>Select a trade</option>
                    {form.trade && !classTrades.includes(form.trade) && (
                      <option value={form.trade}>{form.trade} (current)</option>
                    )}
                    {classTrades.map((trade) => <option key={trade} value={trade}>{trade}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Level</label>
                  <select name="level" value={form.level} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 focus:border-blue-500 focus:outline-none" required disabled={!form.trade}>
                    <option value="" disabled>{form.trade ? 'Select a level' : 'Select a trade first'}</option>
                    {form.level && !availableClassLevels.includes(form.level) && (
                      <option value={form.level}>{form.level} (current)</option>
                    )}
                    {availableClassLevels.map((level) => <option key={level} value={level}>{level}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Class code</label>
                  <select name="classCode" value={form.classCode} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 focus:border-blue-500 focus:outline-none" required disabled={!form.level}>
                    <option value="" disabled>{form.level ? 'Select a class code' : 'Select a trade and level first'}</option>
                    {form.classCode && !availableClassCodes.includes(form.classCode) && (
                      <option value={form.classCode}>{form.classCode} (current)</option>
                    )}
                    {availableClassCodes.map((classCode) => <option key={classCode} value={classCode}>{classCode}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Academic year</label>
                  <input name="academicYear" value={form.academicYear} readOnly aria-readonly="true" title="Academic year is set automatically" className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-slate-600 focus:outline-none" required />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
                  <select name="status" value={form.status} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 focus:border-blue-500 focus:outline-none">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <section className="rounded-xl border border-slate-200 p-4" aria-labelledby="class-schedule-heading">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 id="class-schedule-heading" className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <CalendarDays className="h-4 w-4 text-emerald-700" />
                      Weekly schedule
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">Add class times so teachers can see their upcoming lessons.</p>
                  </div>
                  <button type="button" onClick={addScheduleSession} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                    <Plus className="h-3.5 w-3.5" />
                    Add session
                  </button>
                </div>
                {form.schedule.length === 0 && (
                  <p className="rounded-lg bg-slate-50 px-3 py-3 text-xs text-slate-500">No class times added. Schedule details are optional.</p>
                )}
                <div className="space-y-3">
                  {form.schedule.map((session, index) => (
                    <div key={`schedule-${index}`} className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1.2fr_auto]">
                      <div>
                        <label htmlFor={`schedule-day-${index}`} className="mb-1 block text-xs font-medium text-slate-700">Day</label>
                        <select id={`schedule-day-${index}`} value={session.day} onChange={(event) => handleScheduleChange(index, 'day', event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm focus:border-emerald-500 focus:outline-none">
                          {weekdays.map((day) => <option key={day} value={day}>{day}</option>)}
                        </select>
                      </div>
                      <div>
                        <label htmlFor={`schedule-start-${index}`} className="mb-1 block text-xs font-medium text-slate-700">Starts</label>
                        <input id={`schedule-start-${index}`} type="time" value={session.startTime} onChange={(event) => handleScheduleChange(index, 'startTime', event.target.value)} required className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm focus:border-emerald-500 focus:outline-none" />
                      </div>
                      <div>
                        <label htmlFor={`schedule-end-${index}`} className="mb-1 block text-xs font-medium text-slate-700">Ends</label>
                        <input id={`schedule-end-${index}`} type="time" value={session.endTime} onChange={(event) => handleScheduleChange(index, 'endTime', event.target.value)} required className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm focus:border-emerald-500 focus:outline-none" />
                      </div>
                      <div>
                        <label htmlFor={`schedule-room-${index}`} className="mb-1 block text-xs font-medium text-slate-700">Room (optional)</label>
                        <input id={`schedule-room-${index}`} value={session.room} onChange={(event) => handleScheduleChange(index, 'room', event.target.value)} maxLength={60} className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm focus:border-emerald-500 focus:outline-none" placeholder="e.g. Room 12" />
                      </div>
                      <button type="button" onClick={() => removeScheduleSession(index)} aria-label={`Remove schedule session ${index + 1}`} className="self-end rounded-lg p-2 text-slate-500 transition hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
                <textarea name="description" value={form.description} onChange={handleChange} rows={3} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 focus:border-blue-500 focus:outline-none" placeholder="Class notes or schedule details" />
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">Assign teachers</p>
                <div className="class-management-teacher-list space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  {teachers.length === 0 ? (
                    <p className="text-sm text-slate-500">No teachers available.</p>
                  ) : (
                    teachers.map((teacher) => (
                      <label key={teacher._id} className="class-management-teacher-option flex cursor-pointer items-center gap-3 rounded-xl border border-transparent bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-emerald-400 hover:bg-emerald-50">
                        <input
                          type="checkbox"
                          checked={form.assignedTeachers.includes(teacher._id)}
                          onChange={() => handleTeacherToggle(teacher._id)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600"
                        />
                        <UserRound className="h-4 w-4 text-slate-500" />
                        <span>{teacher.fullName}</span>
                        <span className="text-slate-400">({teacher.email})</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {role === 'admin' && (
                <button type="submit" disabled={saving} className="class-management-primary-action mx-auto flex w-fit min-w-[150px] items-center justify-center gap-2 rounded-xl bg-[#0d2d5d] px-5 py-2.5 font-semibold text-white shadow-sm transition hover:bg-[#123d7a] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70">
                  <Plus className="h-4 w-4" />
                  {saving ? (editingId ? 'Updating class...' : 'Saving class...') : (editingId ? 'Update class' : 'Save class')}
                </button>
              )}
            </form>
            </section>
          </div>
        )}

        <div className="class-management-panel card-surface min-w-0 overflow-hidden p-5 sm:p-6">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Overview</p>
                <h2 className="text-2xl font-bold text-slate-900">Classes</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Showing {filteredClasses.length} of {classes.length} classes
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <label className="class-management-filter flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400 sm:w-40" placeholder="Search classes" aria-label="Search classes" />
                </label>
                <label className="class-management-filter flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <Filter className="h-4 w-4 text-slate-400" />
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="bg-transparent text-sm outline-none" aria-label="Filter classes by status">
                    <option value="all">All statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
              </div>
            </div>
            {(search || statusFilter !== 'all') && (
              <button
                type="button"
                onClick={clearClassFilters}
                className="mb-4 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Clear filters
              </button>
            )}

            {error && !isFormOpen && (
              <div role="alert" className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            {loading ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-500">Loading classes...</div>
            ) : (
              <div className="class-management-table-wrap overflow-x-auto rounded-xl border border-slate-200">
                <table className="class-management-table data-table min-w-[760px]">
                  <thead>
                    <tr>
                      <th scope="col">Name</th>
                      <th scope="col">Code</th>
                      <th scope="col">Trade</th>
                      <th scope="col">{role === 'teacher' ? 'Teacher' : 'Teachers'}</th>
                      <th scope="col">Status</th>
                      {role === 'admin' && <th scope="col" className="text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClasses.length === 0 ? (
                      <tr>
                        <td colSpan={role === 'admin' ? 6 : 5} className="px-4 py-6 text-center text-slate-500">No classes found.</td>
                      </tr>
                    ) : (
                      filteredClasses.map((schoolClass) => (
                        <tr key={schoolClass._id} className="class-management-table-row">
                          <td className="class-management-name-cell">
                            <div>
                              <p className="font-semibold text-slate-900">{schoolClass.className}</p>
                              <p className="text-xs text-slate-500">{schoolClass.academicYear}</p>
                            </div>
                          </td>
                          <td><span className="class-management-code inline-flex rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs font-semibold text-slate-700">{schoolClass.classCode}</span></td>
                          <td>{schoolClass.trade}</td>
                          <td>
                            <div className="flex max-w-[240px] flex-wrap gap-1.5">
                              {(schoolClass.assignedTeachers || []).map((teacher) => (
                                <span key={teacher._id || teacher} className="class-management-teacher-tag inline-flex max-w-full truncate rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                                  {teacher.fullName || teacher.email || 'Teacher'}
                                </span>
                              ))}
                              {(schoolClass.assignedTeachers || []).length === 0 && <span className="class-management-unassigned text-xs italic text-slate-500">Unassigned</span>}
                            </div>
                          </td>
                          <td>
                            <span className={`class-management-status inline-flex min-w-[76px] items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${schoolClass.status === 'active' ? 'class-management-status-active bg-emerald-50 text-emerald-700' : 'class-management-status-inactive bg-amber-50 text-amber-700'}`}>
                              <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${schoolClass.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'}`} aria-hidden="true" />
                              {schoolClass.status || 'inactive'}
                            </span>
                          </td>
                          {role === 'admin' && (
                            <td className="class-management-actions-cell text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button type="button" onClick={() => handleEdit(schoolClass)} aria-label={`Edit ${schoolClass.className}`} className="class-management-edit inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-400 hover:bg-emerald-50 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 active:translate-y-0">
                                  <Pencil className="h-3.5 w-3.5" />
                                  Edit
                                </button>
                                <button type="button" onClick={() => handleDelete(schoolClass._id)} aria-label={`Delete ${schoolClass.className}`} className="class-management-delete inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:-translate-y-0.5 hover:border-rose-400 hover:bg-rose-100 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 active:translate-y-0">
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Delete
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
        </div>

        {role === 'teacher' && (
          <section className="teacher-student-roster class-management-panel card-surface min-w-0 overflow-hidden p-5 sm:p-6" aria-labelledby="teacher-student-roster-title">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-500">Class rosters</p>
                <h2 id="teacher-student-roster-title" className="teacher-student-roster-title text-2xl font-bold">Students in your classes</h2>
                <p className="mt-1 text-sm text-slate-500">All students enrolled in classes assigned to you.</p>
              </div>
              <span className="teacher-student-count inline-flex items-center rounded-full px-3 py-1.5 text-sm font-semibold" aria-live="polite">
                {studentsLoading ? 'Loading students…' : `${students.length} ${students.length === 1 ? 'student' : 'students'} · 10 per page`}
              </span>
            </div>

            {studentsError ? (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {studentsError}
              </div>
            ) : (
              <div className="teacher-student-roster-table-wrap class-management-table-wrap overflow-x-auto rounded-xl border">
                <table className="teacher-student-roster-table class-management-table data-table min-w-[760px]">
                  <thead>
                    <tr>
                      <th scope="col">Student</th>
                      <th scope="col">SDMS number</th>
                      <th scope="col">Class</th>
                      <th scope="col">Level</th>
                      <th scope="col">Academic year</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentsLoading ? (
                      <tr>
                        <td colSpan={6} role="status" className="px-4 py-8 text-center text-slate-500">Loading students in your classes…</td>
                      </tr>
                    ) : students.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center">
                          <p className="font-semibold text-slate-800">No students assigned yet</p>
                          <p className="mt-1 text-sm text-slate-500">Students enrolled in your classes will appear here.</p>
                        </td>
                      </tr>
                    ) : paginatedStudents.map((student) => {
                      const studentName = [student.firstName, student.lastName].filter(Boolean).join(' ') || 'Unnamed student'
                      const studentClass = student.classId

                      return (
                        <tr key={student._id} className="class-management-table-row">
                          <td className="class-management-name-cell">
                            <span className="font-semibold text-slate-900">{studentName}</span>
                          </td>
                          <td>
                            <span className="class-management-code inline-flex rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs font-semibold text-slate-700">
                              {student.registrationNumber || '—'}
                            </span>
                          </td>
                          <td>
                            <div>
                              <p className="font-semibold text-slate-900">{studentClass?.className || '—'}</p>
                              {studentClass?.classCode && <p className="text-xs text-slate-500">{studentClass.classCode}</p>}
                            </div>
                          </td>
                          <td>{studentClass?.level || '—'}</td>
                          <td>{student.academicYear || '—'}</td>
                          <td>
                            <span className={`class-management-status inline-flex min-w-[76px] items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${student.status === 'active' ? 'class-management-status-active bg-emerald-50 text-emerald-700' : 'class-management-status-inactive bg-amber-50 text-amber-700'}`}>
                              <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${student.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'}`} aria-hidden="true" />
                              {student.status || 'inactive'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {!studentsLoading && !studentsError && (
              <nav className="teacher-student-pagination mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Student list pagination">
                <p className="teacher-student-pagination-summary text-sm" aria-live="polite">
                  Showing <span className="font-semibold">{firstStudentNumber}–{lastStudentNumber}</span> of <span className="font-semibold">{students.length}</span> students
                </p>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setStudentPage(currentStudentPage - 1)}
                    disabled={currentStudentPage === 1}
                    className="teacher-student-page-button min-h-10 rounded-lg border px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="teacher-student-page-number whitespace-nowrap text-sm font-semibold" aria-current="page">
                    Page {currentStudentPage} of {studentPageCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setStudentPage(currentStudentPage + 1)}
                    disabled={currentStudentPage === studentPageCount}
                    className="teacher-student-page-button min-h-10 rounded-lg border px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </nav>
            )}
          </section>
        )}
      </div>
    </DashboardShell>
  )
}

export default ClassManagementPage
