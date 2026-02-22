const { ROLES, TRANSFER_STATUSES } = require('../../_common/enums');

module.exports = class TransferRequest {

    constructor({ utils, cache, config, cortex, managers, validators, mongomodels } = {}) {
        this.config                     = config;
        this.cortex                     = cortex;
        this.mongomodels                = mongomodels;
        this.transferRequestValidators  = validators.transferRequest;
        this.httpExposed                = [
            'post=createTransferRequest',
            'get=getTransferRequests',
            'get=getTransferRequest',
            'post=approveTransferRequest',
            'post=rejectTransferRequest',
        ];
        this.roles = {
            createTransferRequest:  [ROLES.SUPERADMIN, ROLES.SCHOOL_ADMIN],
            getTransferRequests:    [ROLES.SUPERADMIN, ROLES.SCHOOL_ADMIN],
            getTransferRequest:     [ROLES.SUPERADMIN, ROLES.SCHOOL_ADMIN],
            approveTransferRequest: [ROLES.SUPERADMIN, ROLES.SCHOOL_ADMIN],
            rejectTransferRequest:  [ROLES.SUPERADMIN, ROLES.SCHOOL_ADMIN],
        };
    }

    async _getTransferRequest({ requestId }) {
        const req = await this.mongomodels.transferRequest.findById(requestId);
        if (!req) return { error: 'transfer_request_not_found', code: 404 };
        return { transferRequest: req };
    }

    async createTransferRequest({ __token, __role, studentId, toSchoolId, toClassroomId }) {
        const student = await this.mongomodels.student.findById(studentId);
        if (!student || student.deletedAt) return { error: 'student_not_found', code: 404 };

        if (__token.role === ROLES.SCHOOL_ADMIN && __token.school?.toString() !== student.school?.toString()) {
            return { error: 'forbidden', code: 403 };
        }

        const toSchool = await this.mongomodels.school.findById(toSchoolId);
        if (!toSchool || toSchool.deletedAt) return { error: 'school_not_found', code: 404 };

        const validationErrors = await this.transferRequestValidators.createTransferRequest({ studentId, toSchoolId, toClassroomId });
        if (validationErrors) return { errors: validationErrors, message: 'request_validation_error' };

        const existing = await this.mongomodels.transferRequest.findOne({ student: studentId, status: TRANSFER_STATUSES.PENDING });
        if (existing) return { error: 'transfer_request_already_pending', code: 409 };

        const classroom = student.classroom
            ? await this.mongomodels.classroom.findById(student.classroom)
            : null;

        const snapshot = {
            firstname:     student.firstname,
            lastname:      student.lastname,
            email:         student.email,
            studentNumber: student.studentNumber,
            classroom:     classroom?.name || null,
        };

        const created = await this.mongomodels.transferRequest.create({
            student:     studentId,
            fromSchool:  student.school,
            toSchool:    toSchoolId,
            toClassroom: toClassroomId,
            requestedBy: __token.userId,
            status:      TRANSFER_STATUSES.PENDING,
            snapshot,
        });
        return { transferRequest: created };
    }

    async getTransferRequests({ __token, __role, __pagination }) {
        const { page, limit, skip } = __pagination;
        const filter = __token.role === ROLES.SCHOOL_ADMIN
            ? { $or: [{ fromSchool: __token.school }, { toSchool: __token.school }] }
            : {};

        const [transferRequests, total] = await Promise.all([
            this.mongomodels.transferRequest.find(filter).skip(skip).limit(limit),
            this.mongomodels.transferRequest.countDocuments(filter),
        ]);
        return { transferRequests, total, page, limit };
    }

    async getTransferRequest({ __token, __role, requestId }) {
        const { error, code, transferRequest } = await this._getTransferRequest({ requestId });
        if (error) return { error, code };

        if (__token.role === ROLES.SCHOOL_ADMIN) {
            const school = __token.school?.toString();
            if (transferRequest.fromSchool?.toString() !== school && transferRequest.toSchool?.toString() !== school) {
                return { error: 'forbidden', code: 403 };
            }
        }

        return { transferRequest };
    }

    async approveTransferRequest({ __token, __role, requestId }) {
        const { error, code, transferRequest } = await this._getTransferRequest({ requestId });
        if (error) return { error, code };

        if (__token.role === ROLES.SCHOOL_ADMIN && __token.school?.toString() !== transferRequest.toSchool?.toString()) {
            return { error: 'forbidden', code: 403 };
        }

        if (transferRequest.status !== TRANSFER_STATUSES.PENDING) {
            return { error: 'transfer_request_not_pending', code: 409 };
        }

        await this.mongomodels.student.findByIdAndUpdate(
            transferRequest.student,
            { school: transferRequest.toSchool, classroom: transferRequest.toClassroom },
        );

        const updated = await this.mongomodels.transferRequest.findByIdAndUpdate(
            requestId,
            { status: TRANSFER_STATUSES.APPROVED, respondedBy: __token.userId, respondedAt: new Date() },
            { new: true },
        );
        return { transferRequest: updated };
    }

    async rejectTransferRequest({ __token, __role, requestId }) {
        const { error, code, transferRequest } = await this._getTransferRequest({ requestId });
        if (error) return { error, code };

        if (__token.role === ROLES.SCHOOL_ADMIN && __token.school?.toString() !== transferRequest.toSchool?.toString()) {
            return { error: 'forbidden', code: 403 };
        }

        if (transferRequest.status !== TRANSFER_STATUSES.PENDING) {
            return { error: 'transfer_request_not_pending', code: 409 };
        }

        const updated = await this.mongomodels.transferRequest.findByIdAndUpdate(
            requestId,
            { status: TRANSFER_STATUSES.REJECTED, respondedBy: __token.userId, respondedAt: new Date() },
            { new: true },
        );
        return { transferRequest: updated };
    }

}
