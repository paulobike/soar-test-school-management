module.exports = {
    createUser: {
        user: {
            _id:      { model: 'id' },
            username: { model: 'username' },
            email:    { model: 'email' },
        },
        longToken: { type: 'string' },
    },
}
