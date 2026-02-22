const { ROLES, AUDIT_ACTIONS, AUDIT_RESOURCES } = require('../../_common/enums');

module.exports = class Classroom {

    constructor({ utils, cache, config, cortex, managers, validators, mongomodels } = {}) {
        this.config               = config;
        this.cortex               = cortex;
        this.mongomodels          = mongomodels;
        this.auditLog             = managers.auditLog;
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
        this.rateLimits = {
            createClassroom: { window: 60, max: 30 },
            getClassrooms:   { window: 60, max: 60 },
            getClassroom:    { window: 60, max: 60 },
            updateClassroom: { window: 60, max: 30 },
            deleteClassroom: { window: 60, max: 10 },
        };
    }

    async _getClassroom({ classroomId }) {
        const classroom = await this.mongomodels.classroom.findById(classroomId);
        if (!classroom || classroom.deletedAt) return { error: 'classroom_not_found', code: 404 };
        return { classroom };
    }

    async createClassroom({ __token, __role, __rateLimit, schoolId, name, capacity, resources }) {
        if (__token.role === ROLES.SCHOOL_ADMIN && __token.school?.toString() !== schoolId) {
            return { error: 'forbidden', code: 403 };
        }

        const validationErrors = await this.classroomValidators.createClassroom({ name, capacity, resources });
        if (validationErrors) return { errors: validationErrors, message: 'request_validation_error' };

        const created = await this.mongomodels.classroom.create({
            name, capacity, resources,
            school:    schoolId,
            createdBy: __token.userId,
        });
        await this.auditLog.log({ actor: __token.userId, action: AUDIT_ACTIONS.CREATE, resource: AUDIT_RESOURCES.CLASSROOM, resourceId: created._id, changes: { before: null, after: created } });
        return { classroom: created };
    }

    async getClassrooms({ __token, __role, __rateLimit, __pagination, schoolId }) {
        if (__token.role === ROLES.SCHOOL_ADMIN && __token.school?.toString() !== schoolId) {
            return { error: 'forbidden', code: 403 };
        }

        const { page, limit, skip } = __pagination;
        const [classrooms, total] = await Promise.all([
            this.mongomodels.classroom.find({ school: schoolId, deletedAt: null }).skip(skip).limit(limit),
            this.mongomodels.classroom.countDocuments({ school: schoolId, deletedAt: null }),
        ]);
        return { classrooms, total, page, limit };
    }

    async getClassroom({ __token, __role, __rateLimit, classroomId }) {
        const { error, code, classroom } = await this._getClassroom({ classroomId });
        if (error) return { error, code };

        if (__token.role === ROLES.SCHOOL_ADMIN && __token.school?.toString() !== classroom.school?.toString()) {
            return { error: 'forbidden', code: 403 };
        }

        return { classroom };
    }

    async updateClassroom({ __token, __role, __rateLimit, classroomId, name, capacity, resources }) {
        const lookup = await this._getClassroom({ classroomId });
        if (lookup.error) return { error: lookup.error, code: lookup.code };

        if (__token.role === ROLES.SCHOOL_ADMIN && __token.school?.toString() !== lookup.classroom.school?.toString()) {
            return { error: 'forbidden', code: 403 };
        }

        const validationErrors = await this.classroomValidators.updateClassroom({ name, capacity, resources });
        if (validationErrors) return { errors: validationErrors, message: 'request_validation_error' };

        const updates = {};
        if (name      !== undefined) updates.name      = name;
        if (capacity  !== undefined) updates.capacity  = capacity;
        if (resources !== undefined) updates.resources = resources;

        const updated = await this.mongomodels.classroom.findByIdAndUpdate(classroomId, updates, { new: true });
        await this.auditLog.log({ actor: __token.userId, action: AUDIT_ACTIONS.UPDATE, resource: AUDIT_RESOURCES.CLASSROOM, resourceId: classroomId, changes: { before: lookup.classroom, after: updated } });
        return { classroom: updated };
    }

    async deleteClassroom({ __token, __role, __rateLimit, classroomId }) {
        const lookup = await this._getClassroom({ classroomId });
        if (lookup.error) return { error: lookup.error, code: lookup.code };

        if (__token.role === ROLES.SCHOOL_ADMIN && __token.school?.toString() !== lookup.classroom.school?.toString()) {
            return { error: 'forbidden', code: 403 };
        }

        const hasStudents = await this.mongomodels.student.exists({ classroom: classroomId, deletedAt: null });
        if (hasStudents) return { error: 'classroom_has_students', code: 409 };

        await this.mongomodels.classroom.findByIdAndUpdate(classroomId, { deletedAt: new Date() });
        await this.auditLog.log({ actor: __token.userId, action: AUDIT_ACTIONS.DELETE, resource: AUDIT_RESOURCES.CLASSROOM, resourceId: classroomId, changes: { before: lookup.classroom, after: null } });
        return { success: true };
    }

}
