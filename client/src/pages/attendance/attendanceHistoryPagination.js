export const getVisiblePageNumbers = (currentPage, pageCount) => {
  const firstPage = Math.max(1, Math.min(currentPage - 2, pageCount - 4))
  const lastPage = Math.min(pageCount, firstPage + 4)

  return Array.from({ length: lastPage - firstPage + 1 }, (_, index) => firstPage + index)
}
