export const STUDENTS_PER_PAGE = 10

export const getStudentPageItems = (students, page) => (
  students.slice((page - 1) * STUDENTS_PER_PAGE, page * STUDENTS_PER_PAGE)
)
