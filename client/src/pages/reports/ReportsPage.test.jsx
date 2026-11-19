import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import ReportsPage from './ReportsPage'

describe('attendance reports page', () => {
  it('exposes report generation, filters, and printable PDF action', () => {
    const markup = renderToString(
      <MemoryRouter>
        <ReportsPage role="admin" />
      </MemoryRouter>
    )

    expect(markup).toContain('Attendance reports')
    expect(markup).toContain('OFFICIAL SCHOOL REPORT')
    expect(markup).toContain('Reporting period')
    expect(markup).toContain('reports-print-footer')
    expect(markup).toContain('St Babeth TSS')
    expect(markup).toContain('Generate report')
    expect(markup).toContain('aria-label="Generate attendance report"')
    expect(markup).toContain('aria-busy="false"')
    expect(markup).toContain('Print / Save as PDF')
    expect(markup).toContain('All classes')
    expect(markup).toContain('Marked entries')
    expect(markup).toContain('Excused')
  })
})
