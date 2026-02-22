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

    async _getTransferRequest({ requestId }) {}

    async createTransferRequest({ __token, __role, studentId, toSchoolId, toClassroomId }) {}

    async getTransferRequests({ __token, __role, __pagination }) {}

    async getTransferRequest({ __token, __role, requestId }) {}

    async approveTransferRequest({ __token, __role, requestId }) {}

    async rejectTransferRequest({ __token, __role, requestId }) {}

}
