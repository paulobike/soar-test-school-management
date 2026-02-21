const mongoose = require('mongoose');
const { SCHOOL, USER } = require('../../_common/model.names');

const schoolSchema = new mongoose.Schema({
    name:        { type: String, required: true, unique: true, minlength: 3, maxlength: 100 },
    code:        { type: String, required: true, unique: true, uppercase: true, minlength: 2, maxlength: 10 },
    address:     { type: String },
    phone:       { type: String },
    email:       { type: String },
    maxCapacity: { type: Number, default: 0 }, // 0 = unlimited
    createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: USER, required: true },
}, { timestamps: true });

module.exports = mongoose.model(SCHOOL, schoolSchema);
