import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

const getClassName = (schoolClass) => {
  if (!schoolClass) return '—'
  return [schoolClass.classCode, schoolClass.className].filter(Boolean).join(' · ')
}

const formatEnrollmentDate = (value) => {
  if (!value) return '—'

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString()
}

function StudentDetailsDialog({ student, onClose }) {
  const closeButtonRef = useRef(null)

  useEffect(() => {
    const previousFocus = document.activeElement
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', closeOnEscape)
    window.setTimeout(() => closeButtonRef.current?.focus(), 0)

    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      previousFocus?.focus?.()
    }
  }, [onClose, student._id])

  const details = [
    ['SDMS number', student.registrationNumber],
    ['Gender', student.gender],
    ['Class', getClassName(student.classId)],
    ['Academic year', student.academicYear],
    ['Enrollment date', formatEnrollmentDate(student.enrollmentDate)],
    ['Status', student.status],
    ['Parent / guardian', student.guardianName],
    ['Guardian phone', student.guardianPhone]
  ]

  return (
    <div
      className="student-details-backdrop fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="student-details-dialog my-auto w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-7"
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-details-title"
      >
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">Student information</p>
            <h2 id="student-details-title" className="mt-1 text-2xl font-extrabold text-slate-900">
              {student.firstName} {student.lastName}
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close student details"
            className="student-details-close inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2">
          {details.map(([label, value]) => (
            <div key={label} className="student-details-field rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
              <dd className="mt-1 break-words text-sm font-semibold text-slate-900">{value || '—'}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}

export default StudentDetailsDialog
