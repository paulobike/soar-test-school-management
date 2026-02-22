const mongoose = require('mongoose');
const { STUDENT, SCHOOL, CLASSROOM } = require('../../_common/model.names');


const studentSchema = new mongoose.Schema({
    studentNumber: { type: String, unique: true },
    firstname:     { type: String, required: true, minlength: 2, maxlength: 50 },
    lastname:   { type: String, required: true, minlength: 2, maxlength: 50 },
    email:      { type: String, required: true, unique: true },
    school:     { type: mongoose.Schema.Types.ObjectId, ref: SCHOOL,     required: true },
    classroom:  { type: mongoose.Schema.Types.ObjectId, ref: CLASSROOM,  default: null },
    deletedAt:  { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model(STUDENT, studentSchema);
