const ROLES = {
    SUPERADMIN:   'superadmin',
    SCHOOL_ADMIN: 'schoolAdmin',
};

const TOKEN_STATUSES = {
    ACTIVE:  'active',
    REVOKED: 'revoked',
    EXPIRED: 'expired',
};

const TRANSFER_STATUSES = {
    PENDING:  'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
};

const AUDIT_ACTIONS = {
    CREATE:   'create',
    UPDATE:   'update',
    DELETE:   'delete',
    APPROVE:  'approve',
    REJECT:   'reject',
    TRANSFER: 'transfer',
};

const AUDIT_RESOURCES = {
    SCHOOL:           'school',
    CLASSROOM:        'classroom',
    STUDENT:          'student',
    TRANSFER_REQUEST: 'transferRequest',
    USER:             'user',
};

module.exports = {
    ROLES,
    TOKEN_STATUSES,
    TRANSFER_STATUSES,
    AUDIT_ACTIONS,
    AUDIT_RESOURCES,
};
