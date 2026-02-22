const bcrypt = require('bcrypt');
jest.mock('bcrypt');

const Auth = require('../managers/entities/auth/Auth.manager');

describe('Auth.manager', () => {
    let auth;
    let mockTokenManager;
    let mockUserManager;
    let mockMongomodels;
    let mockValidators;

    beforeEach(() => {
        jest.clearAllMocks();

        mockTokenManager = {
            createLongToken:   jest.fn(),
            createShortToken:  jest.fn(),
            revokeLongToken:   jest.fn(),
            validateLongToken: jest.fn(),
        };

        mockUserManager = {
            getUser: jest.fn(),
        };

        mockMongomodels = {
            user: {
                findOne: jest.fn(),
                create:  jest.fn(),
                findById:  jest.fn(),
            },
        };

        mockValidators = {
            auth: {
                login:              jest.fn().mockResolvedValue(null),
                logout:             jest.fn().mockResolvedValue(null),
                refreshShortToken:  jest.fn().mockResolvedValue(null),
                setupSuperadmin:    jest.fn().mockResolvedValue(null),
            },
        };

        auth = new Auth({
            managers:   { token: mockTokenManager, user: mockUserManager },
            mongomodels: mockMongomodels,
            validators:  mockValidators,
        });
    });

    // Login

    describe('login', () => {
        const credentials = {
            email:    'admin@school.com',
            password: 'secret123',
            device:   'Mozilla/5.0',
            ip:       '127.0.0.1',
        };

        it('should return error if user not found', async () => {
            mockMongomodels.user.findOne.mockResolvedValue(null);

            const result = await auth.login(credentials);

            expect(result).toEqual({ error: 'invalid_credentials' });
        });

        it('should return error if password does not match', async () => {
            mockMongomodels.user.findOne.mockResolvedValue({
                _id: 'uid1', email: credentials.email, password: 'hashed',
            });
            bcrypt.compare.mockResolvedValue(false);

            const result = await auth.login(credentials);

            expect(result).toEqual({ error: 'invalid_credentials' });
        });

        it('should call createLongToken with correct args on valid credentials', async () => {
            const mockUser = { _id: 'uid1', email: credentials.email, password: 'hashed', role: 'schoolAdmin' };
            mockMongomodels.user.findOne.mockResolvedValue(mockUser);
            bcrypt.compare.mockResolvedValue(true);
            mockTokenManager.createLongToken.mockResolvedValue({ token: 'long_tok' });
            mockTokenManager.createShortToken.mockResolvedValue({ token: 'short_tok' });

            await auth.login(credentials);

            expect(mockTokenManager.createLongToken).toHaveBeenCalledWith({
                userId: mockUser._id,
                device: credentials.device,
                ip:     credentials.ip,
            });
        });

        it('should call createShortToken with correct args on valid credentials', async () => {
            const mockUser = { _id: 'uid1', email: credentials.email, password: 'hashed', role: 'schoolAdmin', school: 'sid1' };
            mockMongomodels.user.findOne.mockResolvedValue(mockUser);
            bcrypt.compare.mockResolvedValue(true);
            mockTokenManager.createLongToken.mockResolvedValue({ token: 'long_tok' });
            mockTokenManager.createShortToken.mockResolvedValue({ token: 'short_tok' });

            await auth.login(credentials);

            expect(mockTokenManager.createShortToken).toHaveBeenCalledWith({
                userId: mockUser._id,
                role:   mockUser.role,
                school: mockUser.school,
            });
        });

        it('should return longToken, shortToken, and user (without password) on valid credentials', async () => {
            const mockUser = { _id: 'uid1', email: credentials.email, password: 'hashed', role: 'schoolAdmin' };
            mockMongomodels.user.findOne.mockResolvedValue(mockUser);
            bcrypt.compare.mockResolvedValue(true);
            mockTokenManager.createLongToken.mockResolvedValue({ token: 'long_tok' });
            mockTokenManager.createShortToken.mockResolvedValue({ token: 'short_tok' });

            const result = await auth.login(credentials);

            const { password, ...sanitizedUser } = mockUser;
            expect(result).toEqual({ longToken: 'long_tok', shortToken: 'short_tok', user: sanitizedUser });
            expect(result.user.password).toBeUndefined();
        });

        it('should propagate error if createLongToken fails', async () => {
            const mockUser = { _id: 'uid1', email: credentials.email, password: 'hashed', role: 'schoolAdmin' };
            mockMongomodels.user.findOne.mockResolvedValue(mockUser);
            bcrypt.compare.mockResolvedValue(true);
            mockTokenManager.createLongToken.mockResolvedValue({ error: 'token_creation_failed' });

            const result = await auth.login(credentials);

            expect(result).toEqual({ error: 'token_creation_failed' });
        });
    });

    // Logout

    describe('logout', () => {
        it('should propagate error if token revocation fails', async () => {
            mockTokenManager.revokeLongToken.mockResolvedValue({ error: 'token_not_found' });

            const result = await auth.logout({ longToken: 'bad_token' });

            expect(result).toEqual({ error: 'token_not_found' });
        });

        it('should return success on valid token', async () => {
            mockTokenManager.revokeLongToken.mockResolvedValue({ success: true });

            const result = await auth.logout({ longToken: 'valid_token' });

            expect(result).toEqual({ success: true });
        });

        it('should call revokeLongToken with the correct token', async () => {
            mockTokenManager.revokeLongToken.mockResolvedValue({ success: true });

            await auth.logout({ longToken: 'valid_token' });

            expect(mockTokenManager.revokeLongToken).toHaveBeenCalledWith({ token: 'valid_token' });
        });
    });

    // Refresh Short Token

    describe('refreshShortToken', () => {
        it('should return error if long token is invalid', async () => {
            mockTokenManager.validateLongToken.mockResolvedValue({ error: 'invalid_token' });

            const result = await auth.refreshShortToken({ longToken: 'bad_long_token' });

            expect(result).toEqual({ error: 'invalid_token' });
        });

        it('should return error if long token is expired', async () => {
            mockTokenManager.validateLongToken.mockResolvedValue({ error: 'token_expired' });

            const result = await auth.refreshShortToken({ longToken: 'expired_long_token' });

            expect(result).toEqual({ error: 'token_expired' });
        });

        it('should return a new shortToken on valid long token', async () => {
            mockTokenManager.validateLongToken.mockResolvedValue({ userId: 'uid1' });
            mockTokenManager.createShortToken.mockResolvedValue({ token: 'new_short_tok' });
            mockMongomodels.user.findById.mockResolvedValue({ _id: 'uid1', role: 'superadmin', school: 'sid1' });

            const result = await auth.refreshShortToken({ longToken: 'valid_long_token' });

            expect(mockTokenManager.createShortToken).toHaveBeenCalledWith({ userId: 'uid1', role: 'superadmin', school: 'sid1' });
            expect(result).toEqual({ shortToken: 'new_short_tok' });
        });
    });

    // Setup Superadmin

    describe('setupSuperadmin', () => {
        const payload = {
            firstname: 'Super',
            lastname:  'Admin',
            email:     'superadmin@school.com',
            password:  'secret123',
        };

        it('should return error if a superadmin already exists', async () => {
            mockMongomodels.user.findOne.mockResolvedValue({ _id: 'uid1', role: 'superadmin' });

            const result = await auth.setupSuperadmin(payload);

            expect(result).toEqual({ error: 'not_found', code: 404 });
        });

        it('should call findOne with superadmin role to check for existing superadmin', async () => {
            mockMongomodels.user.findOne.mockResolvedValue(null);
            mockMongomodels.user.create.mockResolvedValue({ ...payload, _id: 'uid1' });

            await auth.setupSuperadmin(payload);

            expect(mockMongomodels.user.findOne).toHaveBeenCalledWith({ role: 'superadmin' });
        });

        it('should create user with superadmin role', async () => {
            mockMongomodels.user.findOne.mockResolvedValue(null);
            mockMongomodels.user.create.mockResolvedValue({ ...payload, _id: 'uid1' });

            await auth.setupSuperadmin(payload);

            expect(mockMongomodels.user.create).toHaveBeenCalledWith({
                firstname: payload.firstname,
                lastname:  payload.lastname,
                email:     payload.email,
                password:  payload.password,
                role:      'superadmin',
            });
        });

        it('should return user without password on success', async () => {
            const created = { _id: 'uid1', firstname: payload.firstname, lastname: payload.lastname, email: payload.email, password: 'hashed', role: 'superadmin' };
            mockMongomodels.user.findOne.mockResolvedValue(null);
            mockMongomodels.user.create.mockResolvedValue(created);

            const result = await auth.setupSuperadmin(payload);

            expect(result.user.password).toBeUndefined();
            expect(result.user.email).toBe(payload.email);
        });
    });

    // Me

    describe('me', () => {
        it('should return error if user not found', async () => {
            mockUserManager.getUser.mockResolvedValue({ error: 'user_not_found' });

            const result = await auth.me({ __token: { userId: 'uid1' } });

            expect(result).toEqual({ error: 'user_not_found' });
        });

        it('should return user on valid userId', async () => {
            const mockUser = { _id: 'uid1', email: 'admin@school.com', role: 'schoolAdmin' };
            mockUserManager.getUser.mockResolvedValue({ user: mockUser });

            const result = await auth.me({ __token: { userId: 'uid1' } });

            expect(result).toEqual({ user: mockUser });
        });

        it('should call getUser with the correct userId from token', async () => {
            mockUserManager.getUser.mockResolvedValue({ user: {} });

            await auth.me({ __token: { userId: 'uid1' } });

            expect(mockUserManager.getUser).toHaveBeenCalledWith({ userId: 'uid1' });
        });
    });
});
