const { ROLES, AUDIT_ACTIONS, AUDIT_RESOURCES } = require('../../_common/enums');

module.exports = class Student {

    constructor({ utils, cache, config, cortex, managers, validators, mongomodels } = {}) {
        this.config             = config;
        this.cortex             = cortex;
        this.mongomodels        = mongomodels;
        this.auditLog           = managers.auditLog;
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
        this.rateLimits = {
            createStudent: { window: 60, max: 30 },
            getStudents:   { window: 60, max: 60 },
            getStudent:    { window: 60, max: 60 },
            updateStudent: { window: 60, max: 30 },
            deleteStudent: { window: 60, max: 10 },
        };
    }

    async _getStudent({ studentId }) {
        const student = await this.mongomodels.student.findById(studentId);
        if (!student || student.deletedAt) return { error: 'student_not_found', code: 404 };
        return { student };
    }

    async _nextStudentNumber({ schoolCode }) {
        const year    = new Date().getFullYear();
        const counter = await this.mongomodels.counter.findOneAndUpdate(
            { entity: 'student', key: schoolCode, year },
            { $inc: { seq: 1 } },
            { upsert: true, new: true },
        );
        return `${schoolCode}-${year}-${String(counter.seq).padStart(4, '0')}`;
    }

    async createStudent({ __token, __role, __rateLimit, schoolId, classroomId, firstname, lastname, email }) {
        if (__token.role === ROLES.SCHOOL_ADMIN && __token.school?.toString() !== schoolId) {
            return { error: 'forbidden', code: 403 };
        }

        const validationErrors = await this.studentValidators.createStudent({ firstname, lastname, email });
        if (validationErrors) return { errors: validationErrors, message: 'request_validation_error' };

        const school         = await this.mongomodels.school.findById(schoolId);
        const studentNumber  = await this._nextStudentNumber({ schoolCode: school.code });

        const created = await this.mongomodels.student.create({
            studentNumber, firstname, lastname, email,
            school:    schoolId,
            classroom: classroomId,
        });
        await this.auditLog.log({ actor: __token.userId, action: AUDIT_ACTIONS.CREATE, resource: AUDIT_RESOURCES.STUDENT, resourceId: created._id, changes: { before: null, after: created } });
        return { student: created };
    }

    async getStudents({ __token, __role, __rateLimit, __pagination, schoolId }) {
        if (__token.role === ROLES.SCHOOL_ADMIN && __token.school?.toString() !== schoolId) {
            return { error: 'forbidden', code: 403 };
        }

        const { page, limit, skip } = __pagination;
        const [students, total] = await Promise.all([
            this.mongomodels.student.find({ school: schoolId, deletedAt: null }).skip(skip).limit(limit),
            this.mongomodels.student.countDocuments({ school: schoolId, deletedAt: null }),
        ]);
        return { students, total, page, limit };
    }

    async getStudent({ __token, __role, __rateLimit, studentId }) {
        const { error, code, student } = await this._getStudent({ studentId });
        if (error) return { error, code };

        if (__token.role === ROLES.SCHOOL_ADMIN && __token.school?.toString() !== student.school?.toString()) {
            return { error: 'forbidden', code: 403 };
        }

        return { student };
    }

    async updateStudent({ __token, __role, __rateLimit, studentId, firstname, lastname, email, classroomId }) {
        const lookup = await this._getStudent({ studentId });
        if (lookup.error) return { error: lookup.error, code: lookup.code };

        if (__token.role === ROLES.SCHOOL_ADMIN && __token.school?.toString() !== lookup.student.school?.toString()) {
            return { error: 'forbidden', code: 403 };
        }

        const validationErrors = await this.studentValidators.updateStudent({ firstname, lastname, email });
        if (validationErrors) return { errors: validationErrors, message: 'request_validation_error' };

        const updates = {};
        if (firstname   !== undefined) updates.firstname  = firstname;
        if (lastname    !== undefined) updates.lastname   = lastname;
        if (email       !== undefined) updates.email      = email;
        if (classroomId !== undefined) updates.classroom  = classroomId;

        const updated = await this.mongomodels.student.findByIdAndUpdate(studentId, updates, { new: true });
        await this.auditLog.log({ actor: __token.userId, action: AUDIT_ACTIONS.UPDATE, resource: AUDIT_RESOURCES.STUDENT, resourceId: studentId, changes: { before: lookup.student, after: updated } });
        return { student: updated };
    }

    async deleteStudent({ __token, __role, __rateLimit, studentId }) {
        const lookup = await this._getStudent({ studentId });
        if (lookup.error) return { error: lookup.error, code: lookup.code };

        if (__token.role === ROLES.SCHOOL_ADMIN && __token.school?.toString() !== lookup.student.school?.toString()) {
            return { error: 'forbidden', code: 403 };
        }

        await this.mongomodels.student.findByIdAndUpdate(studentId, { deletedAt: new Date() });
        await this.auditLog.log({ actor: __token.userId, action: AUDIT_ACTIONS.DELETE, resource: AUDIT_RESOURCES.STUDENT, resourceId: studentId, changes: { before: lookup.student, after: null } });
        return { success: true };
    }

}
