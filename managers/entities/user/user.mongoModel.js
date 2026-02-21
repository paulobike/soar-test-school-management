const mongoose  = require('mongoose');
const bcrypt    = require('bcrypt');
const { USER, SCHOOL } = require('../../_common/model.names');
const { ROLES }        = require('../../_common/enums');

const userSchema = new mongoose.Schema({
    firstname: { type: String },
    lastname:  { type: String },
    email:     { type: String, required: true, unique: true },
    password:  { type: String, required: true },
    role:      { type: String, enum: Object.values(ROLES), default: ROLES.SCHOOL_ADMIN },
    school:    { type: mongoose.Schema.Types.ObjectId, ref: SCHOOL, default: null },
    // null for superadmin, required for schoolAdmin (enforced at manager level)
}, { timestamps: true });

userSchema.pre('save', async function() {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
});

module.exports = mongoose.model(USER, userSchema);
