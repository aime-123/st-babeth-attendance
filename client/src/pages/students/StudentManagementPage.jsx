import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, ChevronDown, Eye, FileSpreadsheet, Filter, Pencil, Plus, Search, Trash2, Upload, Users, X } from 'lucide-react'
import DashboardShell from '../../components/dashboard/DashboardShell'
import api from '../../services/api'
import { formatStudentName } from './studentNameFormatting'
import { getRwandaNationalNumber } from './rwandaPhone'
import { groupStudentsByClass } from './groupStudentsByClass'
import { parseStudentSpreadsheetRows } from './studentSpreadsheetImport'
import StudentDetailsDialog from './StudentDetailsDialog'

const currentAcademicYear = () => {
  const now = new Date()
  const year = now.getFullYear() - (now.getMonth() < 8 ? 1 : 0)
  return `${year}/${year + 1}`
}

const createEmptyForm = () => ({
  registrationNumber: '',
  firstName: '',
  lastName: '',
  guardianName: '',
  guardianPhone: '',
  gender: '',
  classId: '',
  academicYear: currentAcademicYear(),
  enrollmentDate: new Date().toISOString().slice(0, 10),
  status: 'active'
})

const getClassName = (schoolClass) => {
  if (!schoolClass) return '—'
  return [schoolClass.classCode, schoolClass.className].filter(Boolean).join(' · ')
}

const getStudentInitials = (student) => [student.firstName, student.lastName]
  .filter(Boolean)
  .map((name) => name[0])
  .join('')
  .slice(0, 2)
  .toUpperCase()

function StudentManagementPage() {
  const [students, setStudents] = useState([])
  const [classes, setClasses] = useState([])
  const [form, setForm] = useState(createEmptyForm)
  const [editingId, setEditingId] = useState(null)
  const [viewingStudent, setViewingStudent] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [classFilter, setClassFilter] = useState('all')
  const [isFormOpen, setFormOpen] = useState(false)
  const [isImportOpen, setImportOpen] = useState(false)
  const [isLoading, setLoading] = useState(true)
  const [isSaving, setSaving] = useState(false)
  const [importRows, setImportRows] = useState([])
  const [importError, setImportError] = useState('')
  const [importSuccess, setImportSuccess] = useState('')
  const [isImporting, setImporting] = useState(false)
  const [isImportSaving, setImportSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const formRef = useRef(null)
  const importFileRef = useRef(null)

  useEffect(() => {
    let isCurrent = true

    Promise.all([
      api.get('/students'),
      api.get('/classes?limit=1000')
    ])
      .then(([studentResponse, classResponse]) => {
        if (!isCurrent) return
        setStudents(studentResponse.data?.data || [])
        setClasses(classResponse.data?.data?.items || [])
      })
      .catch((requestError) => {
        if (isCurrent) {
          setError(requestError.response?.data?.message || 'Unable to load students and classes. Please try again.')
        }
      })
      .finally(() => {
        if (isCurrent) setLoading(false)
      })

    return () => {
      isCurrent = false
    }
  }, [])

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase()

    return students.filter((student) => {
      const matchesSearch = !query || [
        student.firstName,
        student.lastName,
        student.registrationNumber,
        student.academicYear
      ].filter(Boolean).join(' ').toLowerCase().includes(query)

      const matchesStatus = statusFilter === 'all' || student.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [students, search, statusFilter])

  const studentGroups = useMemo(() => {
    return groupStudentsByClass(filteredStudents, classes)
  }, [filteredStudents, classes])
  const selectedStudentGroup = studentGroups.find((group) => group.id === classFilter)

  const activeCount = students.filter((student) => student.status === 'active').length
  const inactiveCount = students.length - activeCount
  const selectableImportRows = importRows.filter((row) => row.issues.length === 0 && !row.saved)
  const selectedImportCount = selectableImportRows.filter((row) => row.selected).length
  const trimmedSdmsNumber = form.registrationNumber.trim()
  const normalizedSdmsNumber = trimmedSdmsNumber.toLocaleLowerCase()
  const isSdmsNumberInvalid = Boolean(trimmedSdmsNumber) && !/^\d+$/.test(trimmedSdmsNumber)
  const isGuardianPhoneInvalid = !/^\d{9}$/.test(form.guardianPhone)
  const isSdmsNumberDuplicate = Boolean(normalizedSdmsNumber) && students.some((student) => (
    student._id !== editingId &&
    String(student.registrationNumber || '').trim().toLocaleLowerCase() === normalizedSdmsNumber
  ))

  const updateForm = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: formatStudentName(name, value) }))
    setError('')
  }

  const updateSdmsNumber = (event) => {
    const { value } = event.target
    if (!/^\d*$/.test(value)) {
      setError('SDMS number must contain digits only.')
      return
    }

    setForm((current) => ({ ...current, registrationNumber: value }))
    setError('')
  }

  const updateGuardianPhone = (event) => {
    const { value } = event.target
    if (!/^\d*$/.test(value)) {
      setError('Guardian phone must contain digits only.')
      return
    }

    setForm((current) => ({ ...current, guardianPhone: value }))
    setError('')
  }

  const handleSpreadsheetUpload = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setImportRows([])
    setImportError('')
    setImportSuccess('')
    setSuccess('')
    setImporting(true)
    try {
      if (!/\.xlsx$/i.test(file.name)) {
        throw new Error('Please choose an Excel workbook in .xlsx format.')
      }

      const { readSheet } = await import('read-excel-file/browser')
      const worksheetRows = await readSheet(file, 1)
      const parsedRows = parseStudentSpreadsheetRows(worksheetRows, classes, students)
      if (!parsedRows.length) {
        throw new Error('The spreadsheet does not contain any student rows.')
      }
      setImportRows(parsedRows)
    } catch (parseError) {
      setImportError(parseError.message || 'Unable to read this Excel workbook.')
    } finally {
      setImporting(false)
    }
  }

  const saveSelectedImportRows = async () => {
    const selectedRows = importRows.filter((row) => row.selected && row.issues.length === 0 && !row.saved)
    if (!selectedRows.length) return

    setImportSaving(true)
    setImportError('')
    setImportSuccess('')
    setSuccess('')
    let rowsAfterSave = importRows
    const savedStudents = []
    let failedCount = 0

    for (const row of selectedRows) {
      try {
        const response = await api.post('/students', row.data)
        savedStudents.push(response.data.data)
        rowsAfterSave = rowsAfterSave.map((current) => current.id === row.id
          ? { ...current, selected: false, saved: true, saveError: '' }
          : current)
      } catch (requestError) {
        failedCount += 1
        rowsAfterSave = rowsAfterSave.map((current) => current.id === row.id
          ? { ...current, saveError: requestError.response?.data?.message || 'Unable to save this student.' }
          : current)
      }
      setImportRows(rowsAfterSave)
    }

    if (savedStudents.length) {
      setStudents((current) => [...savedStudents, ...current])
    }
    if (savedStudents.length) {
      setImportSuccess(`Imported ${savedStudents.length} student${savedStudents.length === 1 ? '' : 's'}${failedCount ? `; ${failedCount} row${failedCount === 1 ? '' : 's'} could not be saved.` : '.'}`)
    }
    if (failedCount) {
      setImportError('Some selected rows could not be saved. Review the error shown for each row and retry if needed.')
    }
    setImportSaving(false)
  }

  const updateImportSelection = (rowId, selected) => {
    setImportRows((current) => current.map((row) => row.id === rowId ? { ...row, selected } : row))
  }

  const updateAllImportSelection = (selected) => {
    setImportRows((current) => current.map((row) => (
      row.issues.length === 0 && !row.saved ? { ...row, selected } : row
    )))
  }

  const clearImportPreview = () => {
    setImportRows([])
    setImportError('')
    setImportSuccess('')
  }

  const closeForm = () => {
    setForm(createEmptyForm())
    setEditingId(null)
    setFormOpen(false)
    setError('')
  }

  useEffect(() => {
    if (!isFormOpen) return undefined

    const previousFocus = document.activeElement
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeForm()
        return
      }

      if (event.key === 'Tab') {
        const focusableElements = formRef.current?.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')
        if (!focusableElements?.length) return

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

  const closeStudentDetails = useCallback(() => setViewingStudent(null), [])

  const openNewForm = () => {
    setForm(createEmptyForm())
    setEditingId(null)
    setFormOpen(true)
    setError('')
  }

  const openEditForm = (student) => {
    setForm({
      registrationNumber: student.registrationNumber || '',
      firstName: formatStudentName('firstName', student.firstName || ''),
      lastName: formatStudentName('lastName', student.lastName || ''),
      guardianName: student.guardianName || '',
      guardianPhone: getRwandaNationalNumber(student.guardianPhone || ''),
      gender: student.gender || '',
      classId: student.classId?._id || student.classId || '',
      academicYear: student.academicYear || currentAcademicYear(),
      enrollmentDate: student.enrollmentDate ? new Date(student.enrollmentDate).toISOString().slice(0, 10) : '',
      status: student.status || 'active'
    })
    setEditingId(student._id)
    setFormOpen(true)
    setError('')
  }

  const saveStudent = async (event) => {
    event.preventDefault()

    if (isSdmsNumberInvalid) {
      setError('SDMS number must contain digits only.')
      formRef.current?.querySelector('[name="registrationNumber"]')?.focus()
      return
    }

    if (isGuardianPhoneInvalid) {
      setError('Enter the 9 digits after +250 for the guardian phone.')
      formRef.current?.querySelector('[name="guardianPhone"]')?.focus()
      return
    }

    if (isSdmsNumberDuplicate) {
      setError('This SDMS number is already assigned to another student. Enter a unique SDMS number.')
      formRef.current?.querySelector('[name="registrationNumber"]')?.focus()
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const response = editingId
        ? await api.put(`/students/${editingId}`, { ...form, guardianPhone: `+250${form.guardianPhone}` })
        : await api.post('/students', { ...form, guardianPhone: `+250${form.guardianPhone}` })
      const savedStudent = response.data.data

      setStudents((current) => editingId
        ? current.map((student) => student._id === editingId ? savedStudent : student)
        : [savedStudent, ...current])
      setSuccess(editingId ? 'Student details updated.' : 'Student registered successfully.')
      closeForm()
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save student details. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const deleteStudent = async (student) => {
    if (!window.confirm(`Remove ${student.firstName} ${student.lastName} from the student register?`)) {
      return
    }

    setError('')
    setSuccess('')
    try {
      await api.delete(`/students/${student._id}`)
      setStudents((current) => current.filter((item) => item._id !== student._id))
      setSuccess(`${student.firstName} ${student.lastName} was removed.`)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to remove this student. Please try again.')
    }
  }

  const clearFilters = () => {
    setSearch('')
    setStatusFilter('all')
    setClassFilter('all')
  }

  return (
    <DashboardShell role="admin" title="Student Management" subtitle="Administration">
      <div className="space-y-6">
        <section className="grid gap-3 sm:grid-cols-3" aria-label="Student summary">
          {[
            { label: 'Total students', value: students.length },
            { label: 'Active students', value: activeCount },
            { label: 'Inactive students', value: inactiveCount }
          ].map((stat) => (
            <article key={stat.label} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <p className="text-sm font-medium text-slate-600">{stat.label}</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{isLoading ? '—' : stat.value}</p>
            </article>
          ))}
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-700">School administration</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">Student register</h2>
            <p className="mt-1 text-sm text-slate-600">Register students, update their class details, and manage enrollment status.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={isFormOpen ? closeForm : openNewForm}
              aria-expanded={isFormOpen}
              aria-controls="student-editor"
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
            >
              {isFormOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {isFormOpen ? 'Close form' : 'Add student'}
            </button>
            <button
              type="button"
              onClick={() => setImportOpen((current) => !current)}
              aria-expanded={isImportOpen}
              aria-controls="student-excel-import-panel"
              disabled={isImporting || isImportSaving}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-700 bg-white px-5 py-2.5 text-sm font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
              {isImportOpen ? 'Close import' : 'Import students'}
            </button>
          </div>
        </section>

        {isImportOpen && (
          <section id="student-excel-import-panel" className="student-excel-import rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm sm:p-5" aria-labelledby="student-import-title">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 id="student-import-title" className="text-sm font-bold text-slate-900">Import students</h3>
                <p className="mt-1 text-xs text-slate-600">Upload an .xlsx file, review the rows, then save selected students.</p>
              </div>
              <div className="shrink-0">
                <input
                  ref={importFileRef}
                  type="file"
                  accept=".xlsx"
                  onChange={handleSpreadsheetUpload}
                  className="sr-only"
                  aria-label="Choose an Excel workbook"
                  disabled={isLoading || isImporting || isImportSaving}
                />
                <button
                  type="button"
                  onClick={() => importFileRef.current?.click()}
                  disabled={isLoading || isImporting || isImportSaving}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-emerald-700 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  {isLoading ? 'Loading student data…' : isImporting ? 'Reading workbook…' : 'Choose Excel file'}
                </button>
              </div>
            </div>
            <details className="mt-3 text-xs">
              <summary className="w-fit cursor-pointer font-semibold text-emerald-800">Excel column requirements</summary>
              <p className="mt-2 leading-5 text-slate-600">
                Include SDMS number, first and last name, parent/guardian name and phone, gender, class, academic year, and enrollment date. Status is optional. Format SDMS and phone columns as text to preserve leading zeroes.
              </p>
            </details>
            {importError && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{importError}</p>}
            {importSuccess && <p role="status" className="mt-3 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-emerald-800">{importSuccess}</p>}
            {importRows.length > 0 && (
              <div className="mt-5 border-t border-emerald-200 pt-4">
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Review imported students</h4>
                    <p className="mt-0.5 text-xs text-slate-600" aria-live="polite">
                      {selectableImportRows.length} ready · {importRows.length - selectableImportRows.length} need correction or are already saved
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={clearImportPreview}
                      disabled={isImportSaving}
                      className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Discard preview
                    </button>
                    <button
                      type="button"
                      onClick={saveSelectedImportRows}
                      disabled={selectedImportCount === 0 || isImportSaving}
                      className="inline-flex min-h-9 items-center justify-center rounded-lg bg-emerald-800 px-3 text-xs font-semibold text-white transition hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isImportSaving ? 'Saving students…' : `Save selected students (${selectedImportCount})`}
                    </button>
                  </div>
                </div>
                <div className="max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white">
                  <table className="w-full min-w-[760px] text-left text-xs">
                    <thead className="sticky top-0 bg-slate-100 text-slate-700">
                      <tr>
                        <th className="px-3 py-2 font-semibold">
                          <input
                            type="checkbox"
                            aria-label="Select all valid imported students"
                            checked={selectableImportRows.length > 0 && selectedImportCount === selectableImportRows.length}
                            onChange={(event) => updateAllImportSelection(event.target.checked)}
                            disabled={selectableImportRows.length === 0 || isImportSaving}
                          />
                        </th>
                        <th className="px-3 py-2 font-semibold">Excel row</th>
                        <th className="px-3 py-2 font-semibold">Student</th>
                        <th className="px-3 py-2 font-semibold">Parent / guardian</th>
                        <th className="px-3 py-2 font-semibold">Class</th>
                        <th className="px-3 py-2 font-semibold">Enrollment</th>
                        <th className="px-3 py-2 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {importRows.map((row) => {
                        const schoolClass = classes.find((item) => String(item._id) === String(row.data.classId))
                        const rowStatus = row.saved ? 'Saved' : row.issues.length ? 'Needs correction' : row.saveError ? 'Not saved' : 'Ready'
                        return (
                          <tr key={row.id} className={row.issues.length || row.saveError ? 'bg-red-50/50' : ''}>
                            <td className="px-3 py-2.5">
                              <input
                                type="checkbox"
                                aria-label={`Select Excel row ${row.rowNumber}`}
                                checked={row.selected}
                                onChange={(event) => updateImportSelection(row.id, event.target.checked)}
                                disabled={row.issues.length > 0 || row.saved || isImportSaving}
                              />
                            </td>
                            <td className="px-3 py-2.5 text-slate-600">{row.rowNumber}</td>
                            <td className="px-3 py-2.5">
                              <p className="font-semibold text-slate-900">{row.data.firstName} {row.data.lastName}</p>
                              <p className="mt-0.5 text-slate-500">SDMS: {row.data.registrationNumber || '—'} · {row.data.gender || '—'}</p>
                            </td>
                            <td className="px-3 py-2.5 text-slate-700">
                              <p>{row.data.guardianName || '—'}</p>
                              <p className="mt-0.5 text-slate-500">{row.data.guardianPhone || '—'}</p>
                            </td>
                            <td className="px-3 py-2.5 text-slate-700">{schoolClass ? getClassName(schoolClass) : '—'}</td>
                            <td className="px-3 py-2.5 text-slate-700">
                              <p>{row.data.academicYear || '—'}</p>
                              <p className="mt-0.5 text-slate-500">{row.data.enrollmentDate || '—'}</p>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={`inline-flex rounded-full px-2 py-1 font-semibold ${row.saved ? 'bg-emerald-100 text-emerald-800' : row.issues.length || row.saveError ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-700'}`}>
                                {rowStatus}
                              </span>
                              {(row.issues.length > 0 || row.saveError) && (
                                <p className="mt-1 max-w-48 text-red-700">{[...row.issues, row.saveError].filter(Boolean).join(' ')}</p>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}

        {isFormOpen && (
          <div
            className="teacher-management-modal-backdrop fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeForm()
            }}
          >
          <section
            id="student-editor"
            ref={formRef}
            className="student-management-form teacher-management-form my-auto max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:max-h-[calc(100vh-3rem)] sm:p-7"
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-form-title"
          >
            <div className="student-form-heading teacher-form-heading mb-6 flex items-start justify-between gap-3 border-b border-slate-200 pb-5">
              <div>
                <span className="teacher-form-icon mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-amber-200 bg-gradient-to-br from-amber-100 to-emerald-100 text-emerald-800">
                  <Users className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="student-form-eyebrow inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-emerald-900">
                  Student records <span className="student-form-eyebrow-divider" aria-hidden="true">/</span> Enrollment
                </span>
                <h2 id="student-form-title" className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">{editingId ? 'Edit student' : 'Register a student'}</h2>
                <p className="mt-1 max-w-xl text-sm leading-6 text-slate-600">Enter the student’s personal information and enrollment details. Fields marked <span className="font-semibold text-rose-600">*</span> are required.</p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                aria-label="Close student form"
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-emerald-400 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              >
                <X className="h-4 w-4" />
                <span className="hidden sm:inline">Close</span>
              </button>
            </div>
            {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <form onSubmit={saveStudent} className="student-registration-form space-y-4">
              <section className="student-form-section rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5" aria-labelledby="student-personal-details">
                <div className="mb-4">
                  <h3 id="student-personal-details" className="text-sm font-bold text-slate-900">Personal information</h3>
                  <p className="mt-0.5 text-xs text-slate-500">Basic details used to identify the student.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="student-form-label text-sm font-semibold text-slate-700 sm:col-span-2">
                    SDMS number <span className="text-rose-600">*</span>
                    <input name="registrationNumber" value={form.registrationNumber} onChange={updateSdmsNumber} required maxLength={60} autoComplete="off" inputMode="numeric" pattern="[0-9]+" title="Use digits only for the SDMS number." className="student-form-input mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-normal text-slate-900 shadow-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10" placeholder="Enter digits only" aria-invalid={isSdmsNumberInvalid || isSdmsNumberDuplicate} aria-describedby={isSdmsNumberInvalid ? 'student-sdms-format-error' : isSdmsNumberDuplicate ? 'student-sdms-error' : 'student-sdms-help'} />
                    {isSdmsNumberInvalid ? (
                      <span id="student-sdms-format-error" className="mt-1 block text-xs font-semibold text-red-700">Use digits only for the SDMS number.</span>
                    ) : isSdmsNumberDuplicate ? (
                      <span id="student-sdms-error" className="mt-1 block text-xs font-semibold text-red-700">This SDMS number is already used by another student. Enter a different number.</span>
                    ) : (
                      <span id="student-sdms-help" className="mt-1 block text-xs font-normal text-slate-500">Enter the official SDMS number using digits only. Each student must have a different number.</span>
                    )}
                  </label>
                  <label className="student-form-label text-sm font-semibold text-slate-700">
                    First name <span className="text-rose-600">*</span>
                    <input name="firstName" value={form.firstName} onChange={updateForm} required maxLength={80} autoComplete="given-name" className="student-form-input mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-normal text-slate-900 shadow-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10" placeholder="Enter first name" />
                  </label>
                  <label className="student-form-label text-sm font-semibold text-slate-700">
                    Last name <span className="text-rose-600">*</span>
                    <input name="lastName" value={form.lastName} onChange={updateForm} required maxLength={80} autoComplete="family-name" className="student-form-input mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-normal text-slate-900 shadow-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10" placeholder="Enter last name" />
                  </label>
                  <label className="student-form-label text-sm font-semibold text-slate-700">
                    Gender <span className="text-rose-600">*</span>
                    <select name="gender" value={form.gender} onChange={updateForm} required className="student-form-input student-form-select mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-normal text-slate-900 shadow-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10">
                      <option className="student-form-placeholder-option" value="">Select gender</option>
                      <option value="female">Female</option>
                      <option value="male">Male</option>
                    </select>
                  </label>
                </div>
              </section>

              <section className="student-form-section rounded-2xl border border-slate-200 bg-slate-50/60 p-4" aria-labelledby="student-enrollment-details">
                <div className="mb-3">
                  <h3 id="student-enrollment-details" className="text-sm font-bold text-slate-900">Enrollment details</h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="student-form-label text-sm font-semibold text-slate-700">
                    Class <span className="text-rose-600">*</span>
                    <select name="classId" value={form.classId} onChange={updateForm} required className="student-form-input student-form-select mt-1.5 min-h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 shadow-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10">
                      <option className="student-form-placeholder-option" value="">Select class</option>
                      {classes.map((schoolClass) => (
                        <option key={schoolClass._id} value={schoolClass._id}>{getClassName(schoolClass)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="student-form-label text-sm font-semibold text-slate-700">
                    Academic year <span className="text-rose-600">*</span>
                    <input name="academicYear" value={form.academicYear} onChange={updateForm} required maxLength={20} className="student-form-input mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-normal text-slate-900 shadow-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10" />
                  </label>
                  <label className="student-form-label text-sm font-semibold text-slate-700">
                    Enrollment date <span className="text-rose-600">*</span>
                    <input type="date" name="enrollmentDate" value={form.enrollmentDate} onChange={updateForm} required className="student-form-input mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-normal text-slate-900 shadow-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10" />
                  </label>
                  <label className="student-form-label text-sm font-semibold text-slate-700">
                    <span className="flex items-center justify-between gap-2">
                      Parent/guardian name{!editingId && <span className="text-rose-600"> *</span>}
                    </span>
                    <input name="guardianName" value={form.guardianName} onChange={updateForm} required={!editingId} maxLength={120} autoComplete="name" className="student-form-input mt-1.5 min-h-10 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 font-normal text-slate-900 shadow-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10" placeholder="Parent/guardian name" />
                  </label>
                  <label className="student-form-label text-sm font-semibold text-slate-700">
                    Guardian phone<span className="text-rose-600"> *</span>
                    <div className="mt-1.5 flex min-h-10 w-full overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm focus-within:border-emerald-600 focus-within:ring-4 focus-within:ring-emerald-600/10">
                      <span className="inline-flex items-center border-r border-slate-300 bg-slate-100 px-3.5 text-sm font-semibold text-slate-700">+250</span>
                      <input name="guardianPhone" type="tel" inputMode="numeric" pattern="[0-9]{9}" value={form.guardianPhone} onChange={updateGuardianPhone} required maxLength={9} autoComplete="tel-national" title="Enter the 9 digits after +250." className="min-w-0 flex-1 bg-transparent px-3.5 py-2 font-normal text-slate-900 outline-none" placeholder="780000000" />
                    </div>
                    <span className="mt-1 block text-xs font-normal text-slate-500">Enter 9 digits after +250.</span>
                  </label>
                  <label htmlFor="student-status" className="student-form-label text-sm font-semibold text-slate-700">
                    Status
                    <select id="student-status" name="status" value={form.status} onChange={updateForm} className="student-form-input student-form-select mt-1.5 min-h-10 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-normal text-slate-900 shadow-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10">
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </label>
                </div>
              </section>
              <div className="teacher-form-actions student-form-actions sticky bottom-0 -mx-5 -mb-5 flex justify-center gap-3 border-t border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:-mx-7 sm:-mb-7 sm:px-7">
                <button type="button" onClick={closeForm} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
                  Cancel
                </button>
                <button type="submit" disabled={isSaving} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-800 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-900 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
                  {isSaving ? 'Saving…' : editingId ? 'Save changes' : 'Register student'}
                </button>
              </div>
            </form>
          </section>
          </div>
        )}

        <section className="student-management-list min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-label="Student list">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-start gap-3">
              <span className="student-list-heading-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
                <Users className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="student-list-eyebrow text-xs font-bold uppercase tracking-[0.14em]">School register</p>
                <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">Students</h2>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="student-list-filter student-search-filter flex min-h-12 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5">
                <Search className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-500 sm:w-44" placeholder="Search students" aria-label="Search students" />
              </label>
              <label className="student-list-filter student-search-filter flex min-h-12 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5">
                <Filter className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)} className="w-full cursor-pointer appearance-none bg-transparent text-sm font-semibold text-slate-900 outline-none" aria-label="Filter by class">
                  <option value="all">All classes</option>
                  {classes.map((schoolClass) => <option key={schoolClass._id} value={schoolClass._id}>{schoolClass.classCode}</option>)}
                </select>
                <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
              </label>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="student-list-filter min-h-11 rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm text-slate-800 outline-none" aria-label="Filter by student status">
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {(search || statusFilter !== 'all' || classFilter !== 'all') && (
            <button type="button" onClick={clearFilters} className="student-clear-filters mb-4 inline-flex min-h-9 items-center rounded-lg px-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50 hover:text-emerald-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
              Clear all filters
            </button>
          )}

          {error && !isFormOpen && (
            <p role="alert" className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </p>
          )}
          {success && <p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">{success}</p>}

          {isLoading ? (
            <div className="flex min-h-40 items-center justify-center text-sm font-medium text-slate-600">Loading students…</div>
          ) : students.length === 0 && classes.length === 0 ? (
            <div className="student-empty-state flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 text-center">
              <Users className="h-8 w-8 text-slate-400" aria-hidden="true" />
              <h3 className="mt-3 font-semibold text-slate-900">No students registered yet</h3>
              <p className="mt-1 max-w-md text-sm text-slate-600">Add a student to start building the school register.</p>
              <button type="button" onClick={openNewForm} className="mt-4 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">Add first student</button>
            </div>
          ) : (
            <div className="student-class-roster-picker space-y-5">
              <div>
                <h3 className="mb-2 text-sm font-bold text-slate-800">Choose a class to view its students</h3>
                <div className="student-class-buttons flex flex-wrap gap-2" role="group" aria-label="Choose a class student list">
                  {studentGroups.map((group) => {
                    const schoolClass = group.schoolClass
                    const groupTitle = schoolClass
                      ? getClassName(schoolClass)
                      : group.id === 'unassigned' ? 'No class assigned' : 'Other class'

                    return (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => setClassFilter(group.id)}
                        aria-pressed={classFilter === group.id}
                        className="student-class-select-button inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                      >
                        <span>{groupTitle}</span>
                        <span className="student-class-select-count rounded-full px-2 py-0.5 text-xs font-bold">{group.students.length}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {classFilter === 'all' ? (
                <div className="student-class-selection-prompt flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed px-5 text-center">
                  <Users className="h-8 w-8" aria-hidden="true" />
                  <p className="mt-3 font-semibold">Select a class above</p>
                  <p className="mt-1 text-sm">Only that class’s student table will be shown.</p>
                </div>
              ) : selectedStudentGroup ? (() => {
                const group = selectedStudentGroup
                const schoolClass = group.schoolClass
                const groupTitle = schoolClass
                  ? getClassName(schoolClass)
                  : group.id === 'unassigned' ? 'No class assigned' : 'Other class'
                const headingId = `student-class-${group.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`

                return (
                  <section key={group.id} className="student-class-group overflow-hidden rounded-xl border border-slate-200" aria-labelledby={headingId}>
                    <div className="student-class-group-heading flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
                      <div>
                        <h3 id={headingId} className="text-base font-bold">{groupTitle}</h3>
                        {schoolClass && (
                          <p className="mt-0.5 text-xs font-medium">
                            {[schoolClass.level, schoolClass.trade, schoolClass.academicYear].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                      <span className="student-class-group-count rounded-full px-3 py-1 text-xs font-bold">
                        {group.students.length} {group.students.length === 1 ? 'student' : 'students'}
                      </span>
                    </div>
                    <div className="student-management-table-wrap overflow-x-auto">
                      <table className="student-management-table w-full min-w-[680px] border-collapse text-left" aria-label={`Students in ${groupTitle}`}>
                        <thead>
                          <tr className="text-xs font-bold uppercase tracking-[0.1em] text-slate-600">
                            <th scope="col" className="px-4 py-3.5">Student</th>
                            <th scope="col" className="px-4 py-3.5">SDMS number</th>
                            <th scope="col" className="px-4 py-3.5">Academic year</th>
                            <th scope="col" className="px-4 py-3.5">Status</th>
                            <th scope="col" className="px-4 py-3.5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.students.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">No students in this class match the selected filters.</td>
                            </tr>
                          ) : group.students.map((student) => (
                            <tr key={student._id} className="student-management-table-row">
                              <td className="px-4 py-3.5">
                                <div className="flex min-w-0 items-center gap-3">
                                  <span className="student-management-avatar flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-extrabold" aria-hidden="true">
                                    {getStudentInitials(student)}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="truncate font-bold text-slate-900">{student.firstName} {student.lastName}</p>
                                    <p className="mt-0.5 text-xs capitalize text-slate-600">{student.gender}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3.5">
                                <span className="student-registration-code rounded-md px-2 py-1 font-mono text-xs font-semibold">{student.registrationNumber}</span>
                              </td>
                              <td className="px-4 py-3.5 text-sm font-medium">{student.academicYear}</td>
                              <td className="px-4 py-3.5">
                                <span className={`student-status-pill inline-flex items-center gap-2 rounded-full px-2.5 py-1.5 text-xs font-bold capitalize ${student.status === 'active' ? 'is-active' : 'is-inactive'}`}>
                                  <span className="student-status-dot h-1.5 w-1.5 rounded-full" aria-hidden="true" />
                                  {student.status}
                                </span>
                              </td>
                              <td className="px-4 py-3.5">
                                <div className="flex justify-end gap-2">
                                  <button type="button" onClick={() => setViewingStudent(student)} aria-label={`View details for ${student.firstName} ${student.lastName}`} title="View student details" className="student-table-action is-view inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
                                    <Eye className="h-4 w-4" aria-hidden="true" />
                                  </button>
                                  <button type="button" onClick={() => openEditForm(student)} aria-label={`Edit ${student.firstName} ${student.lastName}`} title="Edit student" className="student-table-action is-edit inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
                                    <Pencil className="h-4 w-4" aria-hidden="true" />
                                  </button>
                                  <button type="button" onClick={() => deleteStudent(student)} aria-label={`Delete ${student.firstName} ${student.lastName}`} title="Delete student" className="student-table-action is-delete inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500">
                                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )
              })() : (
                <div className="student-class-selection-prompt rounded-xl border border-dashed px-5 py-8 text-center">
                  <p className="font-semibold">That class is no longer available.</p>
                  <button type="button" onClick={() => setClassFilter('all')} className="mt-2 text-sm font-semibold underline">Choose another class</button>
                </div>
              )}
            </div>
          )}
        </section>

        {viewingStudent && <StudentDetailsDialog student={viewingStudent} onClose={closeStudentDetails} />}
      </div>
    </DashboardShell>
  )
}

export default StudentManagementPage
