const mongoose = require('mongoose');
const { CLASSROOM, SCHOOL, USER } = require('../../_common/model.names');

const classroomSchema = new mongoose.Schema({
    name:      { type: String, required: true, minlength: 2, maxlength: 100 },
    school:    { type: mongoose.Schema.Types.ObjectId, ref: SCHOOL, required: true },
    capacity:  { type: Number, required: true },
    resources: [{ type: String }],
    createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: USER, required: true },
    deletedAt:  { type: Date, default: null },
}, { timestamps: true });

// name must be unique within a school
classroomSchema.index({ name: 1, school: 1 }, { unique: true });

module.exports = mongoose.model(CLASSROOM, classroomSchema);
