import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, ArrowDown, ArrowUp, ArrowUpDown, Check, Eye, EyeOff, Pencil, Plus, RotateCcw, Search, ShieldCheck, UserPlus, Users, X } from 'lucide-react'
import api from '../../services/api'
import DashboardShell from '../../components/dashboard/DashboardShell'
import { formatTeacherName } from './teacherName'

const initialForm = {
  fullName: '',
  email: '',
  username: '',
  password: '',
  confirmPassword: '',
  classIds: [],
  canMarkAttendance: true
}

function TeacherManagementPage() {
  const [teachers, setTeachers] = useState([])
  const [classes, setClasses] = useState([])
  const [form, setForm] = useState(initialForm)
  const [editingId, setEditingId] = useState('')
  const [isFormOpen, setFormOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [accessFilter, setAccessFilter] = useState('all')
  const [sort, setSort] = useState({ key: 'name', direction: 'asc' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')
  const formRef = useRef(null)

  const filteredTeachers = useMemo(() => {
    const term = search.trim().toLowerCase()
    return teachers
      .filter((teacher) => {
        const matchesSearch = !term || `${teacher.fullName} ${teacher.email} ${teacher.username || ''}`.toLowerCase().includes(term)
        const matchesStatus = statusFilter === 'all' || (teacher.status || 'active') === statusFilter
        const canMarkAttendance = teacher.permissions?.canMarkAttendance !== false
        const matchesAccess = accessFilter === 'all' ||
          (accessFilter === 'enabled' ? canMarkAttendance : !canMarkAttendance)
        return matchesSearch && matchesStatus && matchesAccess
      })
      .sort((first, second) => {
        let comparison = 0
        if (sort.key === 'classes') {
          comparison = (first.assignedClassIds?.length || 0) - (second.assignedClassIds?.length || 0)
        } else if (sort.key === 'access') {
          comparison = Number(first.permissions?.canMarkAttendance === false) - Number(second.permissions?.canMarkAttendance === false)
        } else if (sort.key === 'status') {
          comparison = String(first.status || 'active').localeCompare(String(second.status || 'active'))
        } else {
          comparison = String(first.fullName || '').localeCompare(String(second.fullName || ''))
        }
        return comparison * (sort.direction === 'asc' ? 1 : -1)
      })
  }, [teachers, search, statusFilter, accessFilter, sort])

  const loadData = async () => {
    try {
      const [teacherResponse, classResponse] = await Promise.all([
        api.get('/users?role=teacher'),
        api.get('/classes?limit=500')
      ])
      setLoadError('')
      setTeachers(teacherResponse.data?.data || [])
      setClasses(classResponse.data?.data?.items || [])
    } catch (apiError) {
      setLoadError(apiError.response?.data?.message || 'Unable to load teachers and classes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (!isFormOpen) {
      return undefined
    }

    const previousFocus = document.activeElement
    const closeForm = () => {
      setForm(initialForm)
      setEditingId('')
      setShowPassword(false)
      setShowConfirmPassword(false)
      setError('')
      setFormOpen(false)
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeForm()
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

  const handleClassToggle = (classId) => {
    setForm((current) => ({
      ...current,
      classIds: current.classIds.includes(classId)
        ? current.classIds.filter((id) => id !== classId)
        : [...current.classIds, classId]
    }))
  }

  const toggleAllClasses = () => {
    const allClassIds = classes.map((schoolClass) => String(schoolClass._id))
    const allSelected = allClassIds.length > 0 && allClassIds.every((classId) => form.classIds.includes(classId))

    setForm((current) => ({
      ...current,
      classIds: allSelected
        ? current.classIds.filter((classId) => !allClassIds.includes(classId))
        : [...new Set([...current.classIds, ...allClassIds])]
    }))
  }

  const resetForm = () => {
    setForm(initialForm)
    setEditingId('')
    setShowPassword(false)
    setShowConfirmPassword(false)
    setError('')
    setFormOpen(false)
  }

  const openNewTeacherForm = () => {
    setForm(initialForm)
    setEditingId('')
    setShowPassword(false)
    setShowConfirmPassword(false)
    setError('')
    setFormOpen(true)
  }

  const handleEdit = (teacher) => {
    setEditingId(teacher._id)
    setForm({
      fullName: teacher.fullName || '',
      email: teacher.email || '',
      username: teacher.username || '',
      password: '',
      confirmPassword: '',
      classIds: (teacher.assignedClassIds || []).map((id) => String(id)),
      canMarkAttendance: teacher.permissions?.canMarkAttendance !== false
    })
    setError('')
    setFormOpen(true)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!editingId && form.password !== form.confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSaving(true)
    setError('')

    const payload = {
      fullName: form.fullName,
      ...(editingId ? { email: form.email } : {}),
      classIds: form.classIds,
      permissions: { canMarkAttendance: form.canMarkAttendance }
    }

    try {
      if (editingId) {
        await api.patch(`/users/${editingId}`, payload)
      } else {
        await api.post('/users', {
          ...payload,
          email: form.email,
          username: form.username,
          password: form.password
        })
      }

      resetForm()
      await loadData()
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Unable to save teacher.')
    } finally {
      setSaving(false)
    }
  }

  const classesForTeacher = (teacher) => {
    const assignedIds = new Set((teacher.assignedClassIds || []).map((id) => String(id)))
    return classes.filter((schoolClass) => assignedIds.has(String(schoolClass._id)))
  }

  const toggleSort = (key) => {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const renderSortButton = (label, key) => {
    const active = sort.key === key
    const SortIcon = !active ? ArrowUpDown : sort.direction === 'asc' ? ArrowUp : ArrowDown
    return (
      <button
        type="button"
        onClick={() => toggleSort(key)}
        aria-label={`Sort by ${label}${active ? `, currently ${sort.direction === 'asc' ? 'ascending' : 'descending'}` : ''}`}
        className="inline-flex items-center gap-1.5 text-left transition hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        {label}
        <SortIcon className={`h-3.5 w-3.5 ${active ? 'text-blue-600' : 'text-slate-400'}`} aria-hidden="true" />
      </button>
    )
  }

  const clearDirectoryFilters = () => {
    setSearch('')
    setStatusFilter('all')
    setAccessFilter('all')
    setSort({ key: 'name', direction: 'asc' })
  }

  const selectedClassCount = classes.filter((schoolClass) => form.classIds.includes(String(schoolClass._id))).length
  const allClassesSelected = classes.length > 0 && selectedClassCount === classes.length

  return (
    <DashboardShell role="admin" title="Teacher Management" subtitle="Staff, access & class assignments">
      <div className="teacher-management-page space-y-6">
        <section className="teacher-management-intro flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-700">Staff administration</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">Manage teachers and access</h2>
            <p className="mt-1 text-sm text-slate-600">Register staff, assign classes, and manage attendance permissions.</p>
          </div>
          <button
            type="button"
            onClick={isFormOpen ? resetForm : openNewTeacherForm}
            aria-expanded={isFormOpen}
            aria-controls="teacher-editor"
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-800 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 active:translate-y-0"
          >
            {isFormOpen ? <X className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            {isFormOpen ? 'Close form' : 'Add teacher'}
          </button>
        </section>

        <section className="grid gap-4 sm:grid-cols-3" aria-label="Teacher management summary">
          <article className="card-surface flex items-center gap-4 p-5">
            <span className="teacher-management-summary-icon flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <Users className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm text-slate-500">Registered teachers</p>
              <p className="text-2xl font-bold text-slate-900">{teachers.length}</p>
            </div>
          </article>
          <article className="card-surface flex items-center gap-4 p-5">
            <span className="teacher-management-summary-icon flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm text-slate-500">Attendance enabled</p>
              <p className="text-2xl font-bold text-slate-900">
                {teachers.filter((teacher) => teacher.permissions?.canMarkAttendance !== false).length}
              </p>
            </div>
          </article>
          <article className="card-surface flex items-center gap-4 p-5">
            <span className="teacher-management-summary-icon flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
              <Check className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm text-slate-500">Available classes</p>
              <p className="text-2xl font-bold text-slate-900">{classes.length}</p>
            </div>
          </article>
        </section>

        {loadError && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {loadError}
          </div>
        )}

        {isFormOpen && (
          <div
            className="teacher-management-modal-backdrop fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                resetForm()
              }
            }}
          >
          <section
            id="teacher-editor"
            ref={formRef}
            className="teacher-management-form card-surface my-auto max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-2xl p-5 shadow-2xl sm:max-h-[calc(100vh-3rem)] sm:p-7"
            role="dialog"
            aria-modal="true"
            aria-labelledby="teacher-form-title"
          >
            <div className="teacher-form-heading mb-6 flex items-start justify-between gap-3 rounded-2xl p-4 sm:p-5">
              <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                <span className="teacher-form-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 sm:h-12 sm:w-12">
                  <UserPlus className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="teacher-form-kicker inline-flex rounded-full border border-emerald-200 bg-white/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.13em] text-emerald-800 sm:text-[11px]">
                    {editingId ? 'Staff account · Update' : 'Staff administration · New account'}
                  </p>
                  <h2 id="teacher-form-title" className="mt-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{editingId ? 'Edit teacher' : 'Register a teacher'}</h2>
                  <p className="mt-1 max-w-xl text-sm leading-5 text-slate-600">Set up login details, attendance access, and class assignments.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={resetForm}
                aria-label="Close teacher form"
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-emerald-400 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <X className="h-4 w-4" />
                <span className="hidden sm:inline">Close</span>
              </button>
            </div>

            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <form className="teacher-registration-form space-y-5" onSubmit={handleSubmit}>
              <section className="teacher-form-section">
                <div className="mb-4">
                  <h3 className="text-sm font-bold text-slate-900">Account details</h3>
                  <p className="mt-0.5 text-xs text-slate-500">The teacher will use these details to access the portal.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className={!editingId ? 'sm:col-span-2' : ''}>
                    <label htmlFor="teacher-name" className="mb-1.5 block text-sm font-semibold text-slate-700">Full name <span className="text-rose-600">*</span></label>
                    <input
                      id="teacher-name"
                      value={form.fullName}
                      onChange={(event) => setForm((current) => ({ ...current, fullName: formatTeacherName(event.target.value) }))}
                      autoComplete="name"
                      className="teacher-form-input w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                      placeholder="Enter the teacher’s full name"
                      minLength={2}
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="teacher-email" className="mb-1.5 block text-sm font-semibold text-slate-700">Email address <span className="text-rose-600">*</span></label>
                    <input
                      id="teacher-email"
                      type="email"
                      value={form.email}
                      onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                      autoComplete="email"
                      className="teacher-form-input w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                      placeholder="Enter teacher email (e.g. name@school.edu)"
                      required
                    />
                  </div>
                    {!editingId && (
                    <>
                      <div>
                        <label htmlFor="teacher-username" className="mb-1.5 block text-sm font-semibold text-slate-700">Username <span className="text-rose-600">*</span></label>
                        <input
                          id="teacher-username"
                          value={form.username}
                          onChange={(event) => setForm((current) => ({ ...current, username: event.target.value.toLowerCase() }))}
                          autoComplete="username"
                          className="teacher-form-input w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                          placeholder="e.g. jean.mukamana"
                          minLength={3}
                          maxLength={30}
                          pattern="[a-zA-Z0-9._-]{3,30}"
                          title="Use 3–30 letters, numbers, dots, underscores, or hyphens."
                          required
                        />
                        <p className="mt-1 text-xs text-slate-500">3–30 letters, numbers, dots, underscores, or hyphens.</p>
                      </div>
                      <div>
                        <label htmlFor="teacher-password" className="mb-1.5 block text-sm font-semibold text-slate-700">Initial password <span className="text-rose-600">*</span></label>
                        <div className="relative">
                          <input
                            id="teacher-password"
                            type={showPassword ? 'text' : 'password'}
                            value={form.password}
                            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                            autoComplete="new-password"
                            className="teacher-form-input w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 pr-12 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                            placeholder="Enter initial password (8+ characters)"
                            minLength={8}
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((visible) => !visible)}
                            className="teacher-password-toggle absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center rounded-r-xl text-slate-500 transition hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            aria-pressed={showPassword}
                            aria-controls="teacher-password"
                          >
                            {showPassword ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label htmlFor="teacher-confirm-password" className="mb-1.5 block text-sm font-semibold text-slate-700">Confirm password <span className="text-rose-600">*</span></label>
                        <div className="relative">
                          <input
                            id="teacher-confirm-password"
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={form.confirmPassword}
                            onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                            autoComplete="new-password"
                            className="teacher-form-input w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 pr-12 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                            placeholder="Enter the same password again"
                            minLength={8}
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword((visible) => !visible)}
                            className="teacher-password-toggle absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center rounded-r-xl text-slate-500 transition hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600"
                            aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                            aria-pressed={showConfirmPassword}
                            aria-controls="teacher-confirm-password"
                          >
                            {showConfirmPassword ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
                          </button>
                        </div>
                        {form.confirmPassword && form.password !== form.confirmPassword && (
                          <p className="mt-1 text-xs font-medium text-rose-700" role="status">Passwords do not match.</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </section>

              <fieldset className="teacher-form-fieldset rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                <legend className="px-1 text-sm font-bold text-slate-900">Attendance permission</legend>
                <label className={`teacher-permission-option mt-1 flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${form.canMarkAttendance ? 'is-enabled' : ''}`}>
                  <input
                    type="checkbox"
                    checked={form.canMarkAttendance}
                    onChange={(event) => setForm((current) => ({ ...current, canMarkAttendance: event.target.checked }))}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-800">Can mark attendance</span>
                    <span className="mt-1 block text-xs leading-relaxed text-slate-500">This permission is required in addition to being assigned to a class.</span>
                  </span>
                  <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
                </label>
              </fieldset>

              <fieldset className="teacher-form-fieldset rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                <legend className="px-1 text-sm font-bold text-slate-900">Class assignments</legend>
                <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <p className="text-xs leading-relaxed text-slate-500">Select the classes this teacher can access.</p>
                    <p className="teacher-class-selected-count mt-1 text-xs font-semibold text-emerald-800" aria-live="polite">
                      {selectedClassCount} of {classes.length} selected
                    </p>
                  </div>
                  {classes.length > 0 && (
                    <button
                      type="button"
                      onClick={toggleAllClasses}
                      className="teacher-class-select-all rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:border-emerald-400 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                    >
                      {allClassesSelected ? 'Clear selection' : 'Select all classes'}
                    </button>
                  )}
                </div>
                <div className="teacher-class-list grid max-h-64 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                  {classes.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500 sm:col-span-2">Create classes before assigning teachers.</p>
                  ) : (
                    classes.map((schoolClass) => (
                      <label key={schoolClass._id} className={`teacher-class-option flex cursor-pointer items-start gap-3 rounded-xl border bg-white px-3 py-3 transition ${form.classIds.includes(String(schoolClass._id)) ? 'is-selected' : ''}`}>
                        <input
                          type="checkbox"
                          checked={form.classIds.includes(String(schoolClass._id))}
                          onChange={() => handleClassToggle(String(schoolClass._id))}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-800">{schoolClass.className}</span>
                          <span className="block text-xs text-slate-500">{schoolClass.classCode} · {schoolClass.level} · {schoolClass.academicYear}</span>
                        </span>
                        <span className={`teacher-class-status inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${schoolClass.status === 'active' ? 'teacher-class-status-active bg-emerald-50 text-emerald-700' : 'teacher-class-status-inactive bg-slate-200 text-slate-600'}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${schoolClass.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} aria-hidden="true" />
                          {schoolClass.status}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </fieldset>

              <div className="teacher-form-actions sticky bottom-0 -mx-5 -mb-5 flex justify-center gap-3 border-t border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:-mx-7 sm:-mb-7 sm:px-7">
                {editingId && (
                  <button type="button" onClick={resetForm} className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  disabled={saving || loading}
                  className="teacher-management-primary-action inline-flex min-w-44 items-center justify-center gap-2 rounded-xl bg-emerald-800 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-900 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {saving ? 'Saving...' : editingId ? 'Save changes' : 'Register teacher'}
                </button>
              </div>
            </form>
          </section>
          </div>
        )}

          <section className="card-surface overflow-hidden">
            <div className="border-b border-slate-200 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Staff directory</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">Teachers and access</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {loading ? 'Loading teacher records…' : `Showing ${filteredTeachers.length} of ${teachers.length} teachers`}
                </p>
                <p className="mt-1 text-xs text-slate-400">Search or filter the directory; select a column heading to sort.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="relative block sm:col-span-3 lg:col-span-1">
                  <span className="sr-only">Search teachers</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="Search name or email"
                  />
                </label>
                <label>
                  <span className="sr-only">Filter teachers by account status</span>
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100">
                    <option value="all">All account statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
                <label>
                  <span className="sr-only">Filter by attendance permission</span>
                  <select value={accessFilter} onChange={(event) => setAccessFilter(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100">
                    <option value="all">All permissions</option>
                    <option value="enabled">Attendance enabled</option>
                    <option value="disabled">Attendance disabled</option>
                  </select>
                </label>
              </div>
                {(search || statusFilter !== 'all' || accessFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={clearDirectoryFilters}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Clear filters
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <div className="p-10 text-center text-sm text-slate-500">Loading teacher directory...</div>
            ) : filteredTeachers.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                  <Users className="h-6 w-6" />
                </span>
                <p className="mt-3 font-semibold text-slate-800">{search ? 'No teachers match your search.' : 'No teachers registered yet.'}</p>
                <p className="mt-1 text-sm text-slate-500">Register a teacher and assign the classes they are responsible for.</p>
                {(search || statusFilter !== 'all' || accessFilter !== 'all') && (
                  <button type="button" onClick={clearDirectoryFilters} className="mt-4 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                    Clear directory filters
                  </button>
                )}
              </div>
            ) : (
              <div className="teacher-management-table-wrap data-table-wrap">
                <table className="teacher-management-table data-table min-w-[780px]">
                  <thead>
                    <tr>
                      <th scope="col">{renderSortButton('Teacher', 'name')}</th>
                      <th scope="col">{renderSortButton('Assigned classes', 'classes')}</th>
                      <th scope="col">{renderSortButton('Attendance access', 'access')}</th>
                      <th scope="col">{renderSortButton('Account status', 'status')}</th>
                      <th scope="col" className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTeachers.map((teacher) => {
                      const assignedClasses = classesForTeacher(teacher)
                      const canMarkAttendance = teacher.permissions?.canMarkAttendance !== false
                      const isActive = (teacher.status || 'active') === 'active'

                      return (
                        <tr key={teacher._id} className="teacher-management-table-row">
                          <td className="min-w-[220px]">
                            <div className="flex items-center gap-3">
                              <span className="teacher-management-avatar flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold uppercase text-blue-700">
                                {(teacher.fullName || 'T').split(/\s+/).slice(0, 2).map((part) => part[0]).join('')}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-slate-900">{teacher.fullName}</p>
                                <p className="truncate text-xs text-slate-500">{teacher.email}</p>
                                {teacher.username && <p className="truncate text-xs font-medium text-emerald-700">@{teacher.username}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="min-w-[230px]">
                            {assignedClasses.length ? (
                              <div className="flex flex-wrap gap-1.5">
                                {assignedClasses.map((schoolClass) => (
                                  <span key={schoolClass._id} title={`${schoolClass.className} (${schoolClass.classCode})`} className="teacher-management-class-tag rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800">
                                    {schoolClass.className}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-sm text-slate-500">No classes assigned</span>
                            )}
                            <p className="mt-1 text-xs text-slate-500">{assignedClasses.length} {assignedClasses.length === 1 ? 'class' : 'classes'}</p>
                          </td>
                          <td>
                            <span className={`teacher-management-access ${canMarkAttendance ? 'teacher-management-access-enabled bg-emerald-50 text-emerald-700' : 'teacher-management-access-disabled bg-amber-50 text-amber-700'} inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold`}>
                              <ShieldCheck className="h-3.5 w-3.5" />
                              {canMarkAttendance ? 'Enabled' : 'Disabled'}
                            </span>
                          </td>
                          <td>
                            <span className={`teacher-management-status ${isActive ? 'teacher-management-status-active bg-emerald-50 text-emerald-700' : 'teacher-management-status-inactive bg-slate-100 text-slate-600'} inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} aria-hidden="true" />
                              {isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="min-w-[145px] text-right">
                            <button
                              type="button"
                              onClick={() => handleEdit(teacher)}
                              aria-label={`Edit access for ${teacher.fullName}`}
                              className="teacher-management-edit inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-400 hover:bg-emerald-50 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 active:translate-y-0"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit access
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
      </div>
    </DashboardShell>
  )
}

export default TeacherManagementPage
