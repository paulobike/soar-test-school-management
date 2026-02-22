const bcrypt        = require('bcrypt');
const { ROLES }     = require('../../../managers/_common/enums');

module.exports = class Auth {

    constructor({ managers, mongomodels, validators } = {}) {
        this.mongomodels  = mongomodels;
        this.tokenManager = managers.token;
        this.userManager  = managers.user;
        this.authValidators   = validators.auth;
        this.httpExposed  = ['setupSuperadmin', 'login', 'logout', 'get=me', 'refreshShortToken'];
    }

    async setupSuperadmin({ firstname, lastname, email, password }) {
        const validationErrors = await this.authValidators.setupSuperadmin({ firstname, lastname, email, password });
        if (validationErrors) return { errors: validationErrors, message: 'request_validation_error' };

        const existing = await this.mongomodels.user.findOne({ role: ROLES.SUPERADMIN });
        if (existing) return { error: 'not_found', code: 404 };

        const created = await this.mongomodels.user.create({ firstname, lastname, email, password, role: ROLES.SUPERADMIN });
        const { password: _, ...sanitizedUser } = created.toObject ? created.toObject() : created;
        return { user: sanitizedUser };
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

        const shortTokenResult = await this.tokenManager.createShortToken({ userId: user._id, role: user.role });

        const { password: _, ...sanitizedUser } = user.toObject ? user.toObject() : user;
        return { longToken: longTokenResult.token, shortToken: shortTokenResult.token, user: sanitizedUser };
    }

    async logout({ longToken }) {
        const validationErrors = await this.authValidators.logout({ longToken });
        if (validationErrors) return { errors: validationErrors, message: 'request_validation_error' };

        return this.tokenManager.revokeLongToken({ token: longToken });
    }

    async me({ __token }) {
        return this.userManager.getUser({ userId: __token.userId });
    }

    async refreshShortToken({ longToken }) {
        const validationErrors = await this.authValidators.refreshShortToken({ longToken });
        if (validationErrors) return { errors: validationErrors, message: 'request_validation_error' };

        const result = await this.tokenManager.validateLongToken({ token: longToken });
        if (result.error) return result;

        const user = await this.mongomodels.user.findById(result.userId);
        if (!user) return { error: 'invalid_user' }

        const { token: shortToken } = await this.tokenManager.createShortToken({ userId: user._id, role: user.role });
        return { shortToken };
    }

}
