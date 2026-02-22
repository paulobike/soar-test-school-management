module.exports = {
    getClassrooms: [
        { model: 'schoolId', required: true },
    ],
    createClassroom: [
        { model: 'schoolId',      required: true },
        { model: 'name',          required: true },
        { model: 'capacity',      required: true },
        { model: 'arrayOfStrings' },
    ],
    getClassroom: [
        { model: 'classroomId', required: true },
    ],
    updateClassroom: [
        { model: 'classroomId',   required: true },
        { model: 'name' },
        { model: 'capacity' },
        { model: 'arrayOfStrings' },
    ],
    deleteClassroom: [
        { model: 'classroomId', required: true },
    ],
};
