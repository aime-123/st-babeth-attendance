import { useEffect, useState } from 'react'
import { AlertCircle, CalendarDays, CheckCircle2, Eye, FileText, Trash2, Upload } from 'lucide-react'
import api from '../../services/api'
import TimetablePreview from '../../components/dashboard/TimetablePreview'
import { createTimetablePreview } from '../../components/dashboard/timetablePreviewUtils'

const MAX_FILE_SIZE = 2 * 1024 * 1024

const readFileAsBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => {
    const result = reader.result
    const separatorIndex = typeof result === 'string' ? result.indexOf(',') : -1
    if (separatorIndex < 0) {
      reject(new Error('The selected file could not be read. Please choose it again.'))
      return
    }

    resolve(result.slice(separatorIndex + 1))
  }
  reader.onerror = () => reject(new Error('The selected file could not be read. Please choose it again.'))
  reader.readAsDataURL(file)
})

function TeacherTimetablesPage() {
  const [teachers, setTeachers] = useState([])
  const [selectedTeacherId, setSelectedTeacherId] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [previewDocument, setPreviewDocument] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let isCurrent = true

    api.get('/users?role=teacher')
      .then((response) => {
        const users = response.data?.data
        if (!Array.isArray(users)) {
          throw new Error('The teacher list returned an unexpected response.')
        }

        if (isCurrent) {
          setTeachers(users)
          setSelectedTeacherId(users[0]?._id || '')
        }
      })
      .catch((apiError) => {
        if (isCurrent) {
          setError(apiError.response?.data?.message || apiError.message || 'Unable to load teachers.')
        }
      })
      .finally(() => {
        if (isCurrent) setLoading(false)
      })

    return () => {
      isCurrent = false
    }
  }, [])

  const selectedTeacher = teachers.find((teacher) => teacher._id === selectedTeacherId)

  const handleTeacherChange = (event) => {
    setSelectedTeacherId(event.target.value)
    setSelectedFile(null)
    setPreviewDocument(null)
    setError('')
    setSuccess('')
  }

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] || null
    event.target.value = ''
    setSelectedFile(file)
    setError('')
    setSuccess('')

    if (file && file.size === 0) {
      setSelectedFile(null)
      setError('The selected timetable file is empty.')
    } else if (file && file.size > MAX_FILE_SIZE) {
      setSelectedFile(null)
      setError('Timetable files must be 2 MB or smaller.')
    }
  }

  const handleUpload = async (event) => {
    event.preventDefault()
    if (!selectedTeacher || !selectedFile) return

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const contentBase64 = await readFileAsBase64(selectedFile)
      const response = await api.put(`/users/${selectedTeacher._id}/timetable`, {
        fileName: selectedFile.name,
        contentType: selectedFile.type || 'application/octet-stream',
        contentBase64
      })
      const timetableDocument = response.data?.data
      if (!timetableDocument?.fileName) {
        throw new Error('The timetable upload returned an unexpected response.')
      }

      setTeachers((current) => current.map((teacher) => (
        teacher._id === selectedTeacher._id ? { ...teacher, timetableDocument } : teacher
      )))
      setSelectedFile(null)
      setSuccess(`Timetable uploaded for ${selectedTeacher.fullName}.`)
    } catch (apiError) {
      setError(apiError.response?.data?.message || apiError.message || 'Unable to upload the timetable.')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async () => {
    if (!selectedTeacher) return

    setRemoving(true)
    setError('')
    setSuccess('')

    try {
      await api.delete(`/users/${selectedTeacher._id}/timetable`)
      setTeachers((current) => current.map((teacher) => (
        teacher._id === selectedTeacher._id ? { ...teacher, timetableDocument: null } : teacher
      )))
      setSuccess(`Timetable removed for ${selectedTeacher.fullName}.`)
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Unable to remove the timetable.')
    } finally {
      setRemoving(false)
    }
  }

  const handlePreview = async () => {
    if (!selectedTeacher) return

    setPreviewing(true)
    setError('')

    try {
      const response = await api.get(`/users/${selectedTeacher._id}/timetable`)
      const document = response.data?.data
      if (!document?.fileName || typeof document.contentBase64 !== 'string') {
        throw new Error('The saved timetable could not be opened for preview.')
      }

      setPreviewDocument({ ...document, ...createTimetablePreview(document) })
    } catch (apiError) {
      setError(apiError.response?.data?.message || apiError.message || 'Unable to open the timetable preview.')
    } finally {
      setPreviewing(false)
    }
  }

  return (
    <div className="teacher-timetables-page space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <span className="teacher-timetable-brand-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <CalendarDays className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Teacher timetables</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Upload one weekly timetable per teacher. Admins can preview it here; teachers can preview or download it from their My Timetable page.
            </p>
          </div>
        </div>
      </header>

      {error && (
        <div className="teacher-timetable-message-error flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}
      {success && (
        <div className="teacher-timetable-message-success flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{success}</p>
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="teacher-timetable-upload-heading">
        <h3 id="teacher-timetable-upload-heading" className="text-lg font-bold text-slate-900">Upload a timetable</h3>
        {loading ? (
          <p className="mt-4 text-sm text-slate-600" role="status">Loading teachers…</p>
        ) : teachers.length === 0 ? (
          <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No teachers are registered yet.</p>
        ) : (
          <form className="mt-5 space-y-5" onSubmit={handleUpload}>
            <div>
              <label htmlFor="timetable-teacher" className="mb-1.5 block text-sm font-semibold text-slate-700">Teacher</label>
              <select
                id="timetable-teacher"
                value={selectedTeacherId}
                onChange={handleTeacherChange}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100 sm:max-w-xl"
              >
                {teachers.map((teacher) => (
                  <option key={teacher._id} value={teacher._id}>{teacher.fullName}</option>
                ))}
              </select>
            </div>

            {selectedTeacher?.timetableDocument?.fileName && (
              <div className="teacher-timetable-document-card flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{selectedTeacher.timetableDocument.fileName}</p>
                    <p className="mt-0.5 text-xs text-slate-600">
                      Uploaded {new Date(selectedTeacher.timetableDocument.uploadedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handlePreview}
                    disabled={previewing || removing || saving}
                    className="teacher-timetable-preview-button inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-emerald-700 bg-emerald-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Eye className="h-4 w-4" aria-hidden="true" />
                    {previewing ? 'Opening…' : 'Preview'}
                  </button>
                  <button
                    type="button"
                    onClick={handleRemove}
                    disabled={removing || saving || previewing}
                    className="teacher-timetable-remove-button inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    {removing ? 'Removing…' : 'Remove'}
                  </button>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="timetable-file" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Timetable document
              </label>
              <input
                id="timetable-file"
                type="file"
                accept="*/*"
                onChange={handleFileChange}
                className="teacher-timetable-file-input block w-full max-w-xl rounded-xl border border-slate-300 bg-white text-sm text-slate-700 file:mr-4 file:min-h-11 file:border-0 file:bg-emerald-50 file:px-4 file:font-semibold file:text-emerald-800 hover:file:bg-emerald-100"
              />
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Any file format or image is accepted. Maximum file size: 2 MB.
              </p>
            </div>

            {selectedFile && (
              <p className="text-sm text-slate-600">Selected: <span className="font-semibold text-slate-800">{selectedFile.name}</span></p>
            )}

            <button
              type="submit"
              disabled={!selectedFile || saving || removing}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              {saving ? 'Uploading…' : selectedTeacher?.timetableDocument?.fileName ? 'Replace timetable' : 'Upload timetable'}
            </button>
          </form>
        )}
      </section>
      {previewDocument && (
        <TimetablePreview document={previewDocument} onClose={() => setPreviewDocument(null)} />
      )}
    </div>
  )
}

export default TeacherTimetablesPage
