const classroom = {
    _id:       { model: 'id' },
    name:      { model: 'name' },
    school:    { model: 'id' },
    capacity:  { model: 'capacity' },
    resources: { type: 'array' },
    createdBy: { model: 'id' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
};

module.exports = {
    getClassrooms: {
        classrooms: { type: 'array', items: classroom },
        total:      { type: 'number' },
        page:       { type: 'number' },
        limit:      { type: 'number' },
    },
    createClassroom: { classroom },
    getClassroom:    { classroom },
    updateClassroom: { classroom },
    deleteClassroom: { success: { type: 'boolean' } },
};
