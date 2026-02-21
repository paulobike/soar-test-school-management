module.exports = {
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
