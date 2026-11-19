import { useEffect, useRef, useState } from 'react'
import { Download, Eye, FileText, Maximize2, Minimize2, Minus, Plus, RotateCcw, X } from 'lucide-react'
import { getTimetablePreviewKind } from './timetablePreviewUtils'

function TimetablePreview({ document, onClose }) {
  const dialogRef = useRef(null)
  const closeButtonRef = useRef(null)
  const onCloseRef = useRef(onClose)
  const [imageError, setImageError] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [isExpanded, setIsExpanded] = useState(false)
  const previewKind = getTimetablePreviewKind(document)
  const { previewUrl, textContent, previewError } = document
  const canZoom = previewKind === 'image' && Boolean(previewUrl) && !imageError

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const previousFocus = window.document.activeElement
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onCloseRef.current()
        return
      }

      if (canZoom && !event.altKey && !event.ctrlKey && !event.metaKey) {
        if (event.key === '+' || event.key === '=') {
          event.preventDefault()
          setZoom((current) => Math.min(2.5, Math.round((current + 0.25) * 100) / 100))
        } else if (event.key === '-') {
          event.preventDefault()
          setZoom((current) => Math.max(0.5, Math.round((current - 0.25) * 100) / 100))
        } else if (event.key === '0') {
          setZoom(1)
        }
      }

      if (event.key === 'Tab') {
        const focusableElements = dialogRef.current?.querySelectorAll('button:not(:disabled), a[href], iframe, [tabindex]:not([tabindex="-1"])')
        if (!focusableElements?.length) return

        const firstElement = focusableElements[0]
        const lastElement = focusableElements[focusableElements.length - 1]
        if (event.shiftKey && window.document.activeElement === firstElement) {
          event.preventDefault()
          lastElement.focus()
        } else if (!event.shiftKey && window.document.activeElement === lastElement) {
          event.preventDefault()
          firstElement.focus()
        }
      }
    }

    window.document.body.style.overflow = 'hidden'
    window.document.addEventListener('keydown', handleKeyDown)
    closeButtonRef.current?.focus()

    return () => {
      window.document.body.style.overflow = ''
      window.document.removeEventListener('keydown', handleKeyDown)
      if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
      previousFocus?.focus?.()
    }
  }, [canZoom, previewUrl])

  return (
    <div
      className="teacher-timetable-preview teacher-timetable-preview-backdrop fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 p-2 backdrop-blur-md sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        ref={dialogRef}
        className={`teacher-timetable-preview-dialog flex ${isExpanded ? 'h-full max-h-full' : 'max-h-[94vh]'} w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="timetable-preview-title"
      >
        <header className="teacher-timetable-preview-header flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-nowrap sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="teacher-timetable-preview-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
              <Eye className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700">Timetable preview</p>
              <h2 id="timetable-preview-title" className="truncate text-sm font-bold text-slate-900 sm:text-base">{document.fileName}</h2>
              <p className="mt-0.5 text-xs text-slate-500">{previewKind === 'image' ? 'Image document' : previewKind === 'pdf' ? 'PDF document' : previewKind === 'text' ? 'Text document' : 'Document preview'}</p>
            </div>
          </div>
          <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap">
            {canZoom && (
              <div className="teacher-timetable-preview-controls flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm" aria-label="Image zoom controls">
                <button
                  type="button"
                  onClick={() => setZoom((current) => Math.max(0.5, Math.round((current - 0.25) * 100) / 100))}
                  disabled={zoom <= 0.5}
                  aria-label="Zoom out"
                  title="Zoom out (−)"
                  className="teacher-timetable-preview-tool-button inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Minus className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(1)}
                  aria-label={`Reset zoom, currently ${Math.round(zoom * 100)} percent`}
                  title="Reset zoom (0)"
                  className="teacher-timetable-preview-tool-button min-w-12 rounded-md px-1 text-center text-xs font-bold tabular-nums transition hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((current) => Math.min(2.5, Math.round((current + 0.25) * 100) / 100))}
                  disabled={zoom >= 2.5}
                  aria-label="Zoom in"
                  title="Zoom in (+)"
                  className="teacher-timetable-preview-tool-button inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </button>
                <span className="mx-0.5 h-5 w-px bg-slate-200" aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => setZoom(1)}
                  aria-label="Fit image to view"
                  title="Fit to view"
                  className="teacher-timetable-preview-tool-button inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            )}
            {previewUrl && (
              <button
                type="button"
                onClick={() => setIsExpanded((current) => !current)}
                aria-label={isExpanded ? 'Exit expanded preview' : 'Expand preview'}
                title={isExpanded ? 'Exit expanded preview' : 'Expand preview'}
                className="teacher-timetable-preview-tool-button inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              >
                {isExpanded
                  ? <Minimize2 className="h-4 w-4" aria-hidden="true" />
                  : <Maximize2 className="h-4 w-4" aria-hidden="true" />}
              </button>
            )}
            {previewUrl && (
              <a
                href={previewUrl}
                download={document.fileName}
                className="teacher-timetable-preview-download inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Download</span>
              </a>
            )}
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="Close timetable preview"
              className="teacher-timetable-preview-close inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="teacher-timetable-preview-content relative min-h-0 flex-1 overflow-auto bg-slate-100 p-3 sm:p-5">
          {previewError ? (
            <div className="teacher-timetable-preview-error mx-auto flex min-h-64 max-w-xl flex-col items-center justify-center rounded-xl border border-rose-200 bg-rose-50 p-6 text-center">
              <FileText className="h-9 w-9 text-rose-700" aria-hidden="true" />
              <p className="mt-3 font-semibold text-rose-900">Preview unavailable</p>
              <p className="mt-1 text-sm text-rose-800">{previewError}</p>
            </div>
          ) : !previewUrl ? (
            <p className="flex min-h-64 items-center justify-center text-sm font-medium text-slate-600" role="status">
              Preparing timetable preview…
            </p>
          ) : previewKind === 'image' ? (
            imageError ? (
              <div className="teacher-timetable-preview-unsupported mx-auto flex min-h-64 max-w-xl flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                <FileText className="h-10 w-10 text-emerald-700" aria-hidden="true" />
                <p className="mt-3 font-semibold text-slate-900">This image cannot be displayed in the browser</p>
                <p className="mt-1 text-sm text-slate-600">Download the file to open it in an image viewer.</p>
              </div>
            ) : (
              <div className="teacher-timetable-preview-image-stage flex min-h-full min-w-full items-center justify-center overflow-auto rounded-xl p-3 sm:p-5">
                <img
                  src={previewUrl}
                  alt={`Preview of ${document.fileName}`}
                  onError={() => setImageError(true)}
                  style={{ transform: `scale(${zoom})` }}
                  className="teacher-timetable-preview-image max-h-[75vh] max-w-full rounded-lg object-contain shadow-sm transition-transform duration-200 ease-out"
                />
              </div>
            )
          ) : previewKind === 'pdf' ? (
            <iframe src={previewUrl} title={`Preview of ${document.fileName}`} sandbox="allow-scripts allow-same-origin" className="h-[75vh] min-h-96 w-full rounded-lg border border-slate-200 bg-white" />
          ) : previewKind === 'text' ? (
            <pre className="mx-auto min-h-64 max-w-5xl whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-white p-4 font-mono text-sm leading-6 text-slate-800 shadow-sm">
              {textContent}
            </pre>
          ) : (
            <div className="teacher-timetable-preview-unsupported mx-auto flex min-h-64 max-w-xl flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <FileText className="h-10 w-10 text-emerald-700" aria-hidden="true" />
              <p className="mt-3 font-semibold text-slate-900">This file type cannot be previewed in the browser</p>
              <p className="mt-1 text-sm text-slate-600">
                You can still download the original timetable using the button above.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default TimetablePreview
