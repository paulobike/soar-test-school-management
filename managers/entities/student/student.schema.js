module.exports = {
    getStudents: [
        { model: 'schoolId', required: true },
    ],
    createStudent: [
        { model: 'schoolId',    required: true },
        { model: 'firstName',   required: true },
        { model: 'lastName',    required: true },
        { model: 'email',       required: true },
        { model: 'classroomId' },
    ],
    getStudent: [
        { model: 'studentId', required: true },
    ],
    updateStudent: [
        { model: 'studentId',   required: true },
        { model: 'firstName' },
        { model: 'lastName' },
        { model: 'email' },
        { model: 'classroomId' },
    ],
    deleteStudent: [
        { model: 'studentId', required: true },
    ],
};
