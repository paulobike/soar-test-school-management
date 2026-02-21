module.exports = class Auth {

    constructor({ managers, mongomodels } = {}) {
        this.mongomodels  = mongomodels;
        this.tokenManager = managers.token;
        this.userManager  = managers.user;
        this.httpExposed  = ['login', 'logout', 'me', 'refreshShortToken'];
    }

    async login({ email, password, device, ip }) {}

    async logout({ token }) {}

    async me({ userId }) {}

    async refreshShortToken({ token }) {}

}
