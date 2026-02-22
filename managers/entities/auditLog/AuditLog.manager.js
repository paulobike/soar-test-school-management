const { AUDIT_ACTIONS, AUDIT_RESOURCES } = require('../../_common/enums');

module.exports = class AuditLog {

    constructor({ mongomodels } = {}) {
        this.mongomodels = mongomodels;
    }

    async log({ actor, action, resource, resourceId, changes = {} }) {
        // stub
    }

}
