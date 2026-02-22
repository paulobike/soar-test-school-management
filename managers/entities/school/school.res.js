const school = {
    _id:         { model: 'id' },
    name:        { model: 'name' },
    code:        { model: 'code' },
    address:     { model: 'address' },
    phone:       { type: 'string' },
    email:       { model: 'email' },
    maxCapacity: { model: 'maxCapacity' },
    createdBy:   { model: 'id' },
    createdAt:   { type: 'string' },
    updatedAt:   { type: 'string' },
};

module.exports = {
    getSchools: {
        schools: { type: 'array', items: school },
        total:   { type: 'number' },
        page:    { type: 'number' },
        limit:   { type: 'number' },
    },
    createSchool:  { school },
    getSchool:     { school },
    updateSchool:  { school },
    deleteSchool:  { success: { type: 'boolean' } },
    createSchoolAdmin: {
        user: {
            _id:       { model: 'id' },
            firstname: { model: 'firstName' },
            lastname:  { model: 'lastName' },
            email:     { model: 'email' },
            role:      { model: 'role' },
            school:    { model: 'id' },
        },
    },
};
