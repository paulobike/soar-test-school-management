const { ROLES } = require('../../_common/enums');

module.exports = class Student {

    constructor({ utils, cache, config, cortex, managers, validators, mongomodels } = {}) {
        this.config             = config;
        this.cortex             = cortex;
        this.mongomodels        = mongomodels;
        this.studentValidators  = validators.student;
        this.httpExposed        = [
            'post=createStudent',
            'get=getStudents',
            'get=getStudent',
            'put=updateStudent',
            'delete=deleteStudent',
        ];
        this.roles = {
            createStudent: [ROLES.SUPERADMIN, ROLES.SCHOOL_ADMIN],
            getStudents:   [ROLES.SUPERADMIN, ROLES.SCHOOL_ADMIN],
            getStudent:    [ROLES.SUPERADMIN, ROLES.SCHOOL_ADMIN],
            updateStudent: [ROLES.SUPERADMIN, ROLES.SCHOOL_ADMIN],
            deleteStudent: [ROLES.SUPERADMIN, ROLES.SCHOOL_ADMIN],
        };
    }

    async _getStudent({ studentId }) {}

    async _nextStudentNumber({ schoolCode }) {}

    async createStudent({ __token, __role, schoolId, classroomId, firstname, lastname, email }) {}

    async getStudents({ __token, __role, __pagination, schoolId }) {}

    async getStudent({ __token, __role, studentId }) {}

    async updateStudent({ __token, __role, studentId, firstname, lastname, email, classroomId }) {}

    async deleteStudent({ __token, __role, studentId }) {}

}
