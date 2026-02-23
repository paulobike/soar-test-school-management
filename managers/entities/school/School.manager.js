const { ROLES, AUDIT_ACTIONS, AUDIT_RESOURCES } = require('../../_common/enums');

module.exports = class School {

    constructor({ utils, cache, config, cortex, managers, validators, mongomodels } = {}) {
        this.config           = config;
        this.cortex           = cortex;
        this.mongomodels      = mongomodels;
        this.auditLog         = managers.auditLog;
        this.schoolValidators = validators.school;
        this.httpExposed      = [
            'post=createSchool',
            'get=getSchools',
            'get=getSchool:schoolId',
            'put=updateSchool',
            'delete=deleteSchool',
            'post=createSchoolAdmin',
        ];
        this.roles = {
            createSchool:      [ROLES.SUPERADMIN],
            getSchools:        [ROLES.SUPERADMIN],
            getSchool:         [ROLES.SUPERADMIN, ROLES.SCHOOL_ADMIN],
            updateSchool:      [ROLES.SUPERADMIN, ROLES.SCHOOL_ADMIN],
            deleteSchool:      [ROLES.SUPERADMIN],
            createSchoolAdmin: [ROLES.SUPERADMIN],
        };
        this.rateLimits = {
            createSchool:      { window: 60, max: 20 },
            getSchools:        { window: 60, max: 60 },
            getSchool:         { window: 60, max: 60 },
            updateSchool:      { window: 60, max: 20 },
            deleteSchool:      { window: 60, max: 10 },
            createSchoolAdmin: { window: 60, max: 10 },
        };
    }

    async _getSchool({ schoolId }) {
        const school = await this.mongomodels.school.findById(schoolId);
        if (!school || school.deletedAt) return { error: 'school_not_found', code: 404 };
        return { school };
    }

    async getSchools({ __token, __role, __rateLimit, __pagination }) {
        const { page, limit, skip } = __pagination;
        const [schools, total] = await Promise.all([
            this.mongomodels.school.find({ deletedAt: null }).skip(skip).limit(limit),
            this.mongomodels.school.countDocuments({ deletedAt: null }),
        ]);
        return { schools, total, page, limit };
    }

    async createSchool({ __token, __role, __rateLimit, name, code, address, phone, email, maxCapacity }) {
        const validationErrors = await this.schoolValidators.createSchool({ name, code, address, phone, email, maxCapacity });
        if (validationErrors) return { errors: validationErrors, message: 'request_validation_error' };

        const created = await this.mongomodels.school.create({ name, code, address, phone, email, maxCapacity, createdBy: __token.userId });
        await this.auditLog.log({ actor: __token.userId, action: AUDIT_ACTIONS.CREATE, resource: AUDIT_RESOURCES.SCHOOL, resourceId: created._id, changes: { before: null, after: created } });
        return { school: created };
    }

    async getSchool({ __token, __role, __rateLimit, schoolId }) {
        const { error, code, school } = await this._getSchool({ schoolId });
        if (error) return { error, code };

        if (__token.role === ROLES.SCHOOL_ADMIN && __token.school?.toString() !== schoolId) {
            return { error: 'forbidden', code: 403 };
        }

        return { school };
    }

    async updateSchool({ __token, __role, __rateLimit, schoolId, name, code, address, phone, email, maxCapacity }) {
        const lookup = await this._getSchool({ schoolId });
        if (lookup.error) return { error: lookup.error, code: lookup.code };

        if (__token.role === ROLES.SCHOOL_ADMIN && __token.school?.toString() !== schoolId) {
            return { error: 'forbidden', code: 403 };
        }

        const validationErrors = await this.schoolValidators.updateSchool({ name, code, address, phone, email, maxCapacity });
        if (validationErrors) return { errors: validationErrors, message: 'request_validation_error' };

        const updates = {};
        if (name        !== undefined) updates.name        = name;
        if (code        !== undefined) updates.code        = code;
        if (address     !== undefined) updates.address     = address;
        if (phone       !== undefined) updates.phone       = phone;
        if (email       !== undefined) updates.email       = email;
        if (maxCapacity !== undefined) updates.maxCapacity = maxCapacity;

        const updated = await this.mongomodels.school.findByIdAndUpdate(schoolId, updates, { new: true });
        await this.auditLog.log({ actor: __token.userId, action: AUDIT_ACTIONS.UPDATE, resource: AUDIT_RESOURCES.SCHOOL, resourceId: schoolId, changes: { before: lookup.school, after: updated } });
        return { school: updated };
    }

    async deleteSchool({ __token, __role, __rateLimit, schoolId }) {
        const lookup = await this._getSchool({ schoolId });
        if (lookup.error) return { error: lookup.error, code: lookup.code };

        const hasStudents = await this.mongomodels.student.exists({ school: schoolId, deletedAt: null });
        if (hasStudents) return { error: 'school_has_students', code: 409 };

        const now = new Date();
        await this.mongomodels.classroom.updateMany({ school: schoolId, deletedAt: null }, { deletedAt: now });
        await this.mongomodels.school.findByIdAndUpdate(schoolId, { deletedAt: now });
        await this.auditLog.log({ actor: __token.userId, action: AUDIT_ACTIONS.DELETE, resource: AUDIT_RESOURCES.SCHOOL, resourceId: schoolId, changes: { before: lookup.school, after: null } });
        return { success: true };
    }

    async createSchoolAdmin({ __token, __role, __rateLimit, schoolId, firstname, lastname, email, password }) {
        const lookup = await this._getSchool({ schoolId });
        if (lookup.error) return { error: lookup.error, code: lookup.code };

        const validationErrors = await this.schoolValidators.createSchoolAdmin({ firstname, lastname, email, password });
        if (validationErrors) return { errors: validationErrors, message: 'request_validation_error' };

        const created = await this.mongomodels.user.create({ firstname, lastname, email, password, role: ROLES.SCHOOL_ADMIN, school: schoolId });
        const { password: _, ...sanitizedUser } = created.toObject ? created.toObject() : created;
        await this.auditLog.log({ actor: __token.userId, action: AUDIT_ACTIONS.CREATE, resource: AUDIT_RESOURCES.USER, resourceId: created._id, changes: { before: null, after: sanitizedUser } });
        return { user: sanitizedUser };
    }

}
