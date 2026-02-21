const mongoose = require('mongoose');
const { TRANSFER_REQUEST, STUDENT, SCHOOL, CLASSROOM, USER } = require('../../_common/model.names');
const { TRANSFER_STATUSES } = require('../../_common/enums');

const transferRequestSchema = new mongoose.Schema({
    student:      { type: mongoose.Schema.Types.ObjectId, ref: STUDENT,   required: true },
    fromSchool:   { type: mongoose.Schema.Types.ObjectId, ref: SCHOOL,    required: true },
    toSchool:     { type: mongoose.Schema.Types.ObjectId, ref: SCHOOL,    required: true },
    toClassroom:  { type: mongoose.Schema.Types.ObjectId, ref: CLASSROOM,  default: null },
    requestedBy:  { type: mongoose.Schema.Types.ObjectId, ref: USER,      required: true },
    status:       { type: String, enum: Object.values(TRANSFER_STATUSES), default: TRANSFER_STATUSES.PENDING },
    respondedBy:  { type: mongoose.Schema.Types.ObjectId, ref: USER,     default: null },
    respondedAt:  { type: Date, default: null },
    snapshot:     {
        firstname:     { type: String },
        lastname:      { type: String },
        email:         { type: String },
        studentNumber: { type: String },
        classroom:     { type: String }, // classroom name at time of transfer
    },
}, { timestamps: true });

module.exports = mongoose.model(TRANSFER_REQUEST, transferRequestSchema);
