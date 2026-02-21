module.exports = class TokenManager {

    constructor({ config, mongomodels } = {}) {
        this.config              = config;
        this.mongomodels         = mongomodels;
        this.longTokenExpiresIn  = config.dotEnv.LONG_TOKEN_EXPIRES_IN  || '30d';
        this.shortTokenExpiresIn = config.dotEnv.SHORT_TOKEN_EXPIRES_IN || '1h';
        this.httpExposed         = [];
    }

    async createLongToken({ userId, device, ip }) {}

    async createShortToken({ userId }) {}

    async revokeLongToken({ token }) {}

    async validateLongToken({ token }) {}

}
