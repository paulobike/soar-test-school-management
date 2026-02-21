const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const { TOKEN_STATUSES } = require('../../_common/enums');

module.exports = class TokenManager {

    constructor({ config, mongomodels } = {}) {
        this.config              = config;
        this.mongomodels         = mongomodels;
        this.longTokenExpiresIn  = config.dotEnv.LONG_TOKEN_EXPIRES_IN  || '30d';
        this.shortTokenExpiresIn = config.dotEnv.SHORT_TOKEN_EXPIRES_IN || '1h';
        this.httpExposed         = [];
    }

    _parseDuration(str) {
        const units = { m: 60000, h: 3600000, d: 86400000 };
        const match = str.match(/^(\d+)([mhd])$/);
        return match ? parseInt(match[1]) * units[match[2]] : 86400000;
    }

    async createLongToken({ userId, device, ip }) {
        const expiresAt = new Date(Date.now() + this._parseDuration(this.longTokenExpiresIn));
        const doc       = await this.mongomodels.longToken.create({ user: userId, device, ip, expiresAt });
        return { token: doc.token };
    }

    async createShortToken({ userId }) {
        const token = jwt.sign(
            { userId, jti: crypto.randomBytes(8).toString('hex') },
            this.config.dotEnv.SHORT_TOKEN_SECRET,
            { expiresIn: this.shortTokenExpiresIn }
        );
        return { token };
    }

    async revokeLongToken({ token }) {
        const doc = await this.mongomodels.longToken.findOne({ token });
        if (!doc) return { error: 'token_not_found' };
        if (doc.status === TOKEN_STATUSES.REVOKED) return { success: true };
        doc.status = TOKEN_STATUSES.REVOKED;
        await doc.save();
        return { success: true };
    }

    async validateLongToken({ token }) {
        const doc = await this.mongomodels.longToken.findOne({ token });
        if (!doc)                                    return { error: 'invalid_token' };
        if (doc.status !== TOKEN_STATUSES.ACTIVE)    return { error: 'invalid_token' };
        if (doc.expiresAt < new Date())              return { error: 'token_expired' };
        return { userId: doc.user };
    }

}
