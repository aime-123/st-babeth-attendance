import { useEffect, useState } from 'react'
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  FileImage,
  FileText,
  RefreshCw
} from 'lucide-react'
import api from '../../services/api'
import TimetablePreview from '../../components/dashboard/TimetablePreview'
import { createTimetablePreview, getTimetablePreviewKind } from '../../components/dashboard/timetablePreviewUtils'

const getCurrentWeek = (date) => {
  const start = new Date(date)
  const weekday = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - weekday)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)

  const format = (value, options) => new Intl.DateTimeFormat('en', options).format(value)
  const startMonth = format(start, { month: 'short' })
  const endMonth = format(end, { month: 'short' })
  return startMonth === endMonth
    ? `${startMonth} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`
    : `${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}, ${start.getFullYear()}`
}

const getDocumentTypeLabel = (document) => {
  const kind = getTimetablePreviewKind(document)
  if (kind === 'image') return 'Image timetable'
  if (kind === 'pdf') return 'PDF document'
  if (kind === 'text') return 'Text document'
  const extension = document.fileName.includes('.') ? document.fileName.split('.').pop().toUpperCase() : 'FILE'
  return `${extension} document`
}

function TeacherTimetablePage() {
  const [timetableDocument, setTimetableDocument] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const [timetablePreview, setTimetablePreview] = useState(null)
  const [inlinePreview, setInlinePreview] = useState(null)
  const [today] = useState(() => new Date())
  const todayLabel = new Intl.DateTimeFormat('en', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(today)
  const weekLabel = getCurrentWeek(today)

  useEffect(() => {
    let isCurrent = true

    api.get('/users/me/timetable')
      .then((response) => {
        const document = response.data?.data
        if (document !== null && (!document?.fileName || typeof document.contentBase64 !== 'string')) {
          throw new Error('The timetable response was incomplete.')
        }

        if (isCurrent) {
          setTimetableDocument(document)
          setError('')
        }
      })
      .catch((apiError) => {
        console.warn('Unable to load teacher timetable.', apiError)
        if (isCurrent) {
          setError(apiError.response?.data?.message || 'Your timetable could not be loaded.')
        }
      })
      .finally(() => {
        if (isCurrent) {
          setLoading(false)
          setRefreshing(false)
        }
      })

    return () => {
      isCurrent = false
    }
  }, [retryCount])

  useEffect(() => {
    if (!timetableDocument) {
      setInlinePreview(null)
      return undefined
    }

    let preparedPreview
    try {
      preparedPreview = { ...timetableDocument, ...createTimetablePreview(timetableDocument) }
    } catch (previewError) {
      preparedPreview = {
        ...timetableDocument,
        previewKind: 'unsupported',
        previewUrl: '',
        textContent: '',
        previewError: previewError.message || 'This file could not be prepared for preview.'
      }
    }
    setInlinePreview(preparedPreview)

    return () => {
      if (preparedPreview.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(preparedPreview.previewUrl)
    }
  }, [timetableDocument])

  const handleRefresh = () => {
    setError('')
    setLoading(true)
    setRefreshing(true)
    setRetryCount((count) => count + 1)
  }

  const openTimetablePreview = () => {
    try {
      setTimetablePreview({ ...timetableDocument, ...createTimetablePreview(timetableDocument) })
    } catch (previewError) {
      setTimetablePreview({
        ...timetableDocument,
        previewKind: 'unsupported',
        previewUrl: '',
        textContent: '',
        previewError: previewError.message || 'This file could not be prepared for preview.'
      })
    }
  }

  const documentType = timetableDocument ? getDocumentTypeLabel(timetableDocument) : ''
  const uploadedDate = timetableDocument?.uploadedAt
    ? new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(timetableDocument.uploadedAt))
    : 'Date unavailable'

  return (
    <div className="teacher-my-timetable-page space-y-6">
      <header className="teacher-my-timetable-hero relative overflow-hidden rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm sm:p-7">
        <div className="teacher-my-timetable-hero-glow" aria-hidden="true" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="teacher-my-timetable-hero-icon flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800 shadow-sm">
              <CalendarDays className="h-7 w-7" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Teacher workspace</p>
              <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">My timetable</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Your weekly teaching plan is displayed below as soon as it loads. Download a copy whenever you need one.
              </p>
            </div>
          </div>
          <div className="teacher-my-timetable-today shrink-0 rounded-2xl border border-emerald-100 bg-emerald-50/80 px-4 py-3 sm:min-w-52">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-800">
              <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
              Today
            </p>
            <p className="mt-1.5 text-sm font-bold text-slate-900">{todayLabel}</p>
          </div>
        </div>
      </header>

      <section className="teacher-my-timetable-panel rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="teacher-timetable-heading">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="teacher-my-timetable-section-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
              <FileText className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h3 id="teacher-timetable-heading" className="text-lg font-bold text-slate-900">Weekly timetable</h3>
              <p className="mt-1 text-sm text-slate-500">Your timetable for this school week</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="teacher-my-timetable-week inline-flex min-h-9 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
              <CalendarDays className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
              {weekLabel}
            </span>
            {!loading && (
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                className="teacher-my-timetable-refresh inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:cursor-wait disabled:opacity-60"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
                Refresh
              </button>
            )}
          </div>
        </div>

        <div className="pt-5">
          {loading ? (
            <div className="teacher-my-timetable-loading rounded-2xl border border-slate-200 bg-slate-50 p-5" role="status">
              <div className="flex items-center gap-3">
                <span className="teacher-my-timetable-loading-icon flex h-10 w-10 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm">
                  <RefreshCw className="h-5 w-5 animate-spin" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-semibold text-slate-800">Loading your timetable…</p>
                  <p className="mt-0.5 text-sm text-slate-500">This will only take a moment.</p>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3" aria-hidden="true">
                <div className="teacher-my-timetable-skeleton h-16 rounded-xl" />
                <div className="teacher-my-timetable-skeleton h-16 rounded-xl" />
                <div className="teacher-my-timetable-skeleton h-16 rounded-xl" />
              </div>
            </div>
          ) : error ? (
            <div className="teacher-my-timetable-error flex flex-col gap-4 rounded-2xl border border-rose-200 bg-rose-50 p-5 sm:flex-row sm:items-center sm:justify-between" role="alert">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" aria-hidden="true" />
                <div>
                  <p className="font-bold text-rose-900">We couldn’t load your timetable</p>
                  <p className="mt-1 text-sm text-rose-800">{error}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRefresh}
                className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-800 transition hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Try again
              </button>
            </div>
          ) : timetableDocument ? (
            <div className="space-y-5">
              <div className="teacher-my-timetable-document flex flex-col gap-5 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/50 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div className="flex min-w-0 items-start gap-4">
                  <span className="teacher-my-timetable-file-icon flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-100">
                    {getTimetablePreviewKind(timetableDocument) === 'image'
                      ? <FileImage className="h-7 w-7" aria-hidden="true" />
                      : <FileText className="h-7 w-7" aria-hidden="true" />}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="max-w-full truncate text-base font-bold text-slate-900 sm:text-lg">{timetableDocument.fileName}</p>
                      <span className="teacher-my-timetable-ready inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Available
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm text-slate-600">{documentType}</p>
                    <p className="mt-3 text-xs font-medium text-slate-500">Last updated {uploadedDate}</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={openTimetablePreview}
                    className="teacher-my-timetable-preview-button inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold shadow-sm transition hover:-translate-y-0.5 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                  >
                    <Eye className="h-4 w-4" aria-hidden="true" />
                    Open larger preview
                  </button>
                  <a
                    href={`data:${timetableDocument.contentType};base64,${timetableDocument.contentBase64}`}
                    download={timetableDocument.fileName}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-800 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    Download
                  </a>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <article className="teacher-my-timetable-info-card rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Schedule</p>
                  <p className="mt-1.5 flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <CalendarDays className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                    Weekly timetable
                  </p>
                </article>
                <article className="teacher-my-timetable-info-card rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">File type</p>
                  <p className="mt-1.5 flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <FileText className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                    {documentType}
                  </p>
                </article>
                <article className="teacher-my-timetable-info-card rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Updated</p>
                  <p className="mt-1.5 flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <Clock3 className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                    {uploadedDate}
                  </p>
                </article>
              </div>

              <section className="teacher-my-timetable-inline-preview overflow-hidden rounded-2xl border border-slate-200" aria-label="Timetable preview">
                <div className="teacher-my-timetable-inline-preview-header flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
                  <div className="flex items-center gap-2.5">
                    <span className="teacher-my-timetable-inline-preview-icon flex h-9 w-9 items-center justify-center rounded-xl">
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Timetable preview</h4>
                      <p className="text-xs text-slate-500">{timetableDocument.fileName}</p>
                    </div>
                  </div>
                  <span className="teacher-my-timetable-inline-preview-hint text-xs font-medium">
                    {inlinePreview?.previewKind === 'image' ? 'Image' : inlinePreview?.previewKind === 'pdf' ? 'PDF' : inlinePreview?.previewKind === 'text' ? 'Text file' : 'File preview'}
                  </span>
                </div>
                <div className="teacher-my-timetable-inline-preview-content">
                  {!inlinePreview ? (
                    <p className="p-8 text-center text-sm text-slate-600" role="status">Preparing your timetable…</p>
                  ) : inlinePreview.previewError ? (
                    <p className="p-8 text-center text-sm text-slate-700" role="status">{inlinePreview.previewError} You can download the file above.</p>
                  ) : inlinePreview.previewKind === 'image' ? (
                    <div className="flex min-h-64 items-center justify-center p-4 sm:min-h-96 sm:p-6">
                      <img
                        src={inlinePreview.previewUrl}
                        alt={`Timetable: ${timetableDocument.fileName}`}
                        className="max-h-[75vh] max-w-full rounded-xl object-contain shadow-md"
                      />
                    </div>
                  ) : inlinePreview.previewKind === 'pdf' ? (
                    <iframe
                      src={inlinePreview.previewUrl}
                      title={`Timetable: ${timetableDocument.fileName}`}
                      sandbox="allow-scripts allow-same-origin"
                      className="h-[70vh] min-h-[32rem] w-full bg-white"
                    />
                  ) : inlinePreview.previewKind === 'text' ? (
                    <pre className="max-h-[70vh] min-h-64 overflow-auto whitespace-pre-wrap break-words p-5 font-mono text-sm leading-6 text-slate-800 sm:p-6">
                      {inlinePreview.textContent}
                    </pre>
                  ) : (
                    <div className="flex min-h-64 flex-col items-center justify-center px-6 py-10 text-center">
                      <FileText className="h-9 w-9 text-emerald-700" aria-hidden="true" />
                      <p className="mt-3 font-semibold text-slate-900">This file type cannot be previewed here</p>
                      <p className="mt-1 text-sm text-slate-600">Download the timetable to open it on your device.</p>
                    </div>
                  )}
                </div>
              </section>
            </div>
          ) : (
            <div className="teacher-my-timetable-empty rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-5 py-10 text-center sm:px-8">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200">
                <CalendarDays className="h-8 w-8" aria-hidden="true" />
              </span>
              <h4 className="mt-5 text-lg font-bold text-slate-900">Your timetable is on its way</h4>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
                There isn’t a weekly timetable uploaded to your account yet. Please check back later or ask your administrator to add it.
              </p>
              <button
                type="button"
                onClick={handleRefresh}
                className="mt-5 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-emerald-700 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Check again
              </button>
            </div>
          )}
        </div>
      </section>

      {timetablePreview && (
        <TimetablePreview document={timetablePreview} onClose={() => setTimetablePreview(null)} />
      )}
    </div>
  )
}

export default TeacherTimetablePage
