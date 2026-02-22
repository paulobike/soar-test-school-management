const { AUDIT_ACTIONS, AUDIT_RESOURCES } = require('../../_common/enums');

module.exports = class AuditLog {

    constructor({ mongomodels } = {}) {
        this.mongomodels = mongomodels;
    }

    async log({ actor, action, resource, resourceId, changes = {} }) {
        try {
            await this.mongomodels.auditLog.create({ actor, action, resource, resourceId, changes });
        } catch (err) {
            console.error('Audit log failed:', err);
        }
    }

}
