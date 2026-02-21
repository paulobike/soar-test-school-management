const bcrypt = require('bcrypt');

module.exports = class Auth {

    constructor({ managers, mongomodels, validators } = {}) {
        this.mongomodels  = mongomodels;
        this.tokenManager = managers.token;
        this.userManager  = managers.user;
        this.authValidators   = validators.auth;
        this.httpExposed  = ['login', 'logout', 'get=me', 'refreshShortToken'];
    }

    async login({ email, password, device, ip }) {
        const validationErrors = await this.authValidators.login({ email, password });
        if (validationErrors) return { errors: validationErrors, message: "request_validation_error" };

        const user = await this.mongomodels.user.findOne({ email });
        if (!user) return { error: 'invalid_credentials' };

        const match = await bcrypt.compare(password, user.password);
        if (!match) return { error: 'invalid_credentials' };

        const longTokenResult = await this.tokenManager.createLongToken({ userId: user._id, device, ip });
        if (longTokenResult.error) return longTokenResult;

        const shortTokenResult = await this.tokenManager.createShortToken({ userId: user._id });

        const { password: _, ...sanitizedUser } = user.toObject ? user.toObject() : user;
        return { longToken: longTokenResult.token, shortToken: shortTokenResult.token, user: sanitizedUser };
    }

    async logout({ longToken }) {
        const validationErrors = await this.authValidators.logout({ longToken });
        if (validationErrors) return { errors: validationErrors, message: 'request_validation_error' };

        return this.tokenManager.revokeLongToken({ token: longToken });
    }

    async me({ userId }) {
        return this.userManager.getUser({ userId });
    }

    async refreshShortToken({ longToken }) {
        const validationErrors = await this.authValidators.refreshShortToken({ longToken });
        if (validationErrors) return { errors: validationErrors, message: 'request_validation_error' };

        const result = await this.tokenManager.validateLongToken({ token: longToken });
        if (result.error) return result;

        const { token: shortToken } = await this.tokenManager.createShortToken({ userId: result.userId });
        return { shortToken };
    }

}
