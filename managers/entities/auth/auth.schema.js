module.exports = {
    setupSuperadmin: [
        { model: 'firstName', required: true },
        { model: 'lastName',  required: true },
        { model: 'email',     required: true },
        { model: 'password',  required: true },
    ],
    login: [
        { model: 'email',    required: true },
        { model: 'password', required: true },
    ],
    logout: [
        { model: 'longToken', required: true },
    ],
    me: [],
    refreshShortToken: [
        { model: 'longToken', required: true },
    ],
};
