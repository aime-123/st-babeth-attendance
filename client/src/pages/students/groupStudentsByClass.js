export const groupStudentsByClass = (students, classes) => {
  const groupsById = new Map(classes.map((schoolClass) => [
    String(schoolClass._id),
    { id: String(schoolClass._id), schoolClass, students: [] }
  ]))
  const studentsWithoutClass = []

  students.forEach((student) => {
    const studentClass = student.classId
    const classId = studentClass?._id || studentClass

    if (!classId) {
      studentsWithoutClass.push(student)
      return
    }

    const id = String(classId)
    if (!groupsById.has(id)) {
      groupsById.set(id, {
        id,
        schoolClass: typeof studentClass === 'object' ? studentClass : null,
        students: []
      })
    }

    groupsById.get(id).students.push(student)
  })

  const groups = [...groupsById.values()]
  if (studentsWithoutClass.length) {
    groups.push({ id: 'unassigned', schoolClass: null, students: studentsWithoutClass })
  }

  return groups
}
