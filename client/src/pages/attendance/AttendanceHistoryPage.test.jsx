import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import AttendanceHistoryPage from './AttendanceHistoryPage'
import { getAttendanceDatePreset } from './attendanceDatePresets'
import { getVisiblePageNumbers } from './attendanceHistoryPagination'

describe('attendance history page', () => {
  it('creates local-date ranges for this week, this month, and the last 30 days', () => {
    const referenceDate = new Date(2026, 10, 18, 12)

    expect(getAttendanceDatePreset('week', referenceDate)).toEqual({
      dateFrom: '2026-11-16',
      dateTo: '2026-11-18'
    })
    expect(getAttendanceDatePreset('month', referenceDate)).toEqual({
      dateFrom: '2026-11-01',
      dateTo: '2026-11-18'
    })
    expect(getAttendanceDatePreset('last30', referenceDate)).toEqual({
      dateFrom: '2026-10-20',
      dateTo: '2026-11-18'
    })
    expect(getAttendanceDatePreset('all', referenceDate)).toEqual({
      dateFrom: '',
      dateTo: ''
    })
  })

  it('keeps the numbered pagination window within five pages at either end', () => {
    expect(getVisiblePageNumbers(1, 8)).toEqual([1, 2, 3, 4, 5])
    expect(getVisiblePageNumbers(8, 8)).toEqual([4, 5, 6, 7, 8])
    expect(getVisiblePageNumbers(1, 1)).toEqual([1])
  })

  it('renders interactive summary cards and accessible filter fields', () => {
    const markup = renderToString(
      <MemoryRouter initialEntries={['/admin/history']}>
        <AttendanceHistoryPage role="admin" />
      </MemoryRouter>
    )

    expect(markup).toContain('Attendance history')
    expect(markup).toContain('aria-label="Attendance summary filters"')
    expect(markup).toContain('aria-label="Filter attendance by present"')
    expect(markup).toContain('aria-pressed="true"')
    expect(markup).toContain('Find attendance records')
    expect(markup).toContain('attendance-history-class')
    expect(markup).toContain('attendance-history-from')
    expect(markup).toContain('attendance-history-to')
    expect(markup).toContain('Quick date filters')
    expect(markup).toContain('This week')
    expect(markup).toContain('This month')
    expect(markup).toContain('Last 30 days')
    expect(markup).toContain('attendance-history-status')
    expect(markup).toContain('Search attendance records by student')
    expect(markup).toContain('>Print</span>')
    expect(markup).toContain('Print all attendance records matching the current filters')
    expect(markup).toContain('Printable attendance history')
    expect(markup).toContain('Attendance History Report')
    expect(markup).toContain('St Babeth TSS')
    expect(markup).toContain('attendance-history-print-logo')
    expect(markup).toContain('Report details')
    expect(markup).toContain('Attendance summary')
    expect(markup).toContain('attendance-history-print-summary-grid')
    expect(markup).not.toContain('<dt>Status filter</dt>')
    expect(markup).not.toContain('<dt>Student search</dt>')
    expect(markup).toContain('Attendance history records')
    expect(markup).toContain('<th scope="col">Date</th>')
    expect(markup).toContain('<th scope="col">Student</th>')
    expect(markup).toContain('<th scope="col">Status</th>')
    expect(markup).toContain('<th scope="col">Details</th>')
    expect(markup.match(/<th scope="col">Remarks<\/th>/g)).toHaveLength(1)
    expect(markup.match(/<th scope="col">Recorded by<\/th>/g)).toHaveLength(1)
  })
})
