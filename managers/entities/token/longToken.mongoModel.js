const mongoose = require('mongoose');
const crypto   = require('crypto');
const { LONG_TOKEN, USER } = require('../../_common/model.names');
const { TOKEN_STATUSES }   = require('../../_common/enums');

const longTokenSchema = new mongoose.Schema({
    token:     { type: String, unique: true, index: true },
    user:      { type: mongoose.Schema.Types.ObjectId, ref: USER, required: true },
    device:    { type: String },
    ip:        { type: String },
    status:    { type: String, enum: Object.values(TOKEN_STATUSES), default: TOKEN_STATUSES.ACTIVE },
    expiresAt: { type: Date, required: true },
}, { timestamps: true });

longTokenSchema.pre('save', function() {
    if (!this.token) {
        this.token = crypto.randomBytes(32).toString('hex');
    }
});

module.exports = mongoose.model(LONG_TOKEN, longTokenSchema);
