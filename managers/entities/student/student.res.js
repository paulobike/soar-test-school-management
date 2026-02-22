const student = {
    _id:           { model: 'id' },
    studentNumber: { type: 'string' },
    firstname:     { model: 'firstName' },
    lastname:      { model: 'lastName' },
    email:         { model: 'email' },
    school:        { model: 'id' },
    classroom:     { model: 'id' },
    createdAt:     { type: 'string' },
    updatedAt:     { type: 'string' },
};

module.exports = {
    getStudents: {
        students: { type: 'array', items: student },
        total:    { type: 'number' },
        page:     { type: 'number' },
        limit:    { type: 'number' },
    },
    createStudent: { student },
    getStudent:    { student },
    updateStudent: { student },
    deleteStudent: { success: { type: 'boolean' } },
};
