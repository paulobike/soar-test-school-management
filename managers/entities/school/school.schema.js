module.exports = {
    getSchools: [],
    createSchool: [
        { model: 'name',        required: true },
        { model: 'code',        required: true },
        { model: 'address' },
        { model: 'phone' },
        { model: 'email' },
        { model: 'maxCapacity' },
    ],
    getSchool: [
        { model: 'schoolId', required: true },
    ],
    updateSchool: [
        { model: 'schoolId',    required: true },
        { model: 'name' },
        { model: 'code' },
        { model: 'address' },
        { model: 'phone' },
        { model: 'email' },
        { model: 'maxCapacity' },
    ],
    deleteSchool: [
        { model: 'schoolId', required: true },
    ],
    createSchoolAdmin: [
        { model: 'schoolId',  required: true },
        { model: 'firstName', required: true },
        { model: 'lastName',  required: true },
        { model: 'email',     required: true },
        { model: 'password',  required: true },
    ],
};
