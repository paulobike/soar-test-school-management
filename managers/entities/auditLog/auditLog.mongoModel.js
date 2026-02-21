const mongoose = require('mongoose');
const { AUDIT_LOG, USER } = require('../../_common/model.names');
const { AUDIT_ACTIONS, AUDIT_RESOURCES } = require('../../_common/enums');

const auditLogSchema = new mongoose.Schema({
    actor:      { type: mongoose.Schema.Types.ObjectId, ref: USER, required: true },
    action:     { type: String, enum: Object.values(AUDIT_ACTIONS),   required: true },
    resource:   { type: String, enum: Object.values(AUDIT_RESOURCES), required: true },
    resourceId: { type: mongoose.Schema.Types.ObjectId, required: true },
    changes: {
        before: { type: mongoose.Schema.Types.Mixed, default: null },
        after:  { type: mongoose.Schema.Types.Mixed, default: null },
    },
    ip:        { type: String },
    userAgent: { type: String },
    createdAt: { type: Date, default: Date.now },
}, { timestamps: false });

module.exports = mongoose.model(AUDIT_LOG, auditLogSchema);
