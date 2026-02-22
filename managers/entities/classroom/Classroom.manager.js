const { ROLES } = require('../../_common/enums');

module.exports = class Classroom {

    constructor({ utils, cache, config, cortex, managers, validators, mongomodels } = {}) {
        this.config               = config;
        this.cortex               = cortex;
        this.mongomodels          = mongomodels;
        this.classroomValidators  = validators.classroom;
        this.httpExposed          = [
            'post=createClassroom',
            'get=getClassrooms',
            'get=getClassroom',
            'put=updateClassroom',
            'delete=deleteClassroom',
        ];
        this.roles = {
            createClassroom: [ROLES.SUPERADMIN, ROLES.SCHOOL_ADMIN],
            getClassrooms:   [ROLES.SUPERADMIN, ROLES.SCHOOL_ADMIN],
            getClassroom:    [ROLES.SUPERADMIN, ROLES.SCHOOL_ADMIN],
            updateClassroom: [ROLES.SUPERADMIN, ROLES.SCHOOL_ADMIN],
            deleteClassroom: [ROLES.SUPERADMIN, ROLES.SCHOOL_ADMIN],
        };
    }

    async _getClassroom({ classroomId }) {}

    async createClassroom({ __token, __role, schoolId, name, capacity, resources }) {}

    async getClassrooms({ __token, __role, __pagination, schoolId }) {}

    async getClassroom({ __token, __role, classroomId }) {}

    async updateClassroom({ __token, __role, classroomId, name, capacity, resources }) {}

    async deleteClassroom({ __token, __role, classroomId }) {}

}
