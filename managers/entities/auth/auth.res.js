module.exports = {
    login: {
        longToken:  { type: 'string' },
        shortToken: { type: 'string' },
        user: {
            _id:       { model: 'id' },
            firstname: { model: 'firstName' },
            lastname:  { model: 'lastName' },
            email:     { model: 'email' },
            role:      { model: 'role' },
        },
    },
    logout: {
        success: { type: 'boolean' },
    },
    me: {
        user: {
            _id:       { model: 'id' },
            firstname: { model: 'firstName' },
            lastname:  { model: 'lastName' },
            email:     { model: 'email' },
            role:      { model: 'role' },
        },
    },
    refreshShortToken: {
        shortToken: { type: 'string' },
    },
};
