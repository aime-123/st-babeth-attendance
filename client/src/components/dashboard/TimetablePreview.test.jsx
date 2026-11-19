import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import TimetablePreview from './TimetablePreview'
import { createTimetablePreview, getTimetablePreviewKind } from './timetablePreviewUtils'

describe('timetable preview format detection', () => {
  it('previews images, PDFs, and readable text files in the browser', () => {
    expect(getTimetablePreviewKind({ fileName: 'week.png', contentType: 'image/png' })).toBe('image')
    expect(getTimetablePreviewKind({ fileName: 'week.pdf', contentType: 'application/pdf' })).toBe('pdf')
    expect(getTimetablePreviewKind({ fileName: 'week.csv', contentType: 'application/octet-stream' })).toBe('text')
  })

  it('reports an in-browser unsupported format for other documents', () => {
    expect(getTimetablePreviewKind({ fileName: 'week.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })).toBe('unsupported')
  })

  it('uses the original image bytes and detects the image format for preview', () => {
    const imageBytes = Uint8Array.from([0xff, 0xd8, 0xff, 0x00])
    const contentBase64 = btoa(String.fromCharCode(...imageBytes))
    const preview = createTimetablePreview({
      fileName: 'timetable.jpeg',
      contentType: 'application/octet-stream',
      contentBase64
    })

    expect(preview.previewKind).toBe('image')
    expect(preview.previewUrl).toBe(`data:image/jpeg;base64,${contentBase64}`)
  })

  it('renders an accessible image preview dialog with an optional download action', () => {
    const markup = renderToString(
      <TimetablePreview
        document={{
          fileName: 'week.png',
          contentType: 'image/png',
          contentBase64: 'aW1hZ2U=',
          previewUrl: 'blob:preview',
          previewKind: 'image',
          textContent: ''
        }}
        onClose={() => {}}
      />
    )

    expect(markup).toContain('role="dialog"')
    expect(markup).toContain('aria-modal="true"')
    expect(markup).toContain('alt="Preview of week.png"')
    expect(markup).toContain('download="week.png"')
    expect(markup).toContain('aria-label="Zoom out"')
    expect(markup).toContain('aria-label="Zoom in"')
    expect(markup).toContain('aria-label="Expand preview"')
  })
})
