const TokenManager = require('../managers/entities/token/Token.manager');
const { TOKEN_STATUSES } = require('../managers/_common/enums');

describe('Token.manager', () => {
    let tokenManager;
    let mockMongomodels;

    beforeEach(() => {
        jest.clearAllMocks();

        mockMongomodels = {
            longToken: {
                findOne: jest.fn(),
                create:  jest.fn(),
            },
        };

        tokenManager = new TokenManager({
            config: {
                dotEnv: {
                    SHORT_TOKEN_SECRET: 'test_short_secret',
                },
            },
            mongomodels: mockMongomodels,
        });
    });

    // Create Long Token

    describe('createLongToken', () => {
        const args = { userId: 'uid1', device: 'Mozilla/5.0', ip: '127.0.0.1' };

        it('should create a longToken document with correct fields', async () => {
            mockMongomodels.longToken.create.mockResolvedValue({ token: 'hex_token', user: args.userId });

            await tokenManager.createLongToken(args);

            expect(mockMongomodels.longToken.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    user:   args.userId,
                    device: args.device,
                    ip:     args.ip,
                })
            );
        });

        it('should return the created token string', async () => {
            mockMongomodels.longToken.create.mockResolvedValue({ token: 'hex_token', user: args.userId });

            const result = await tokenManager.createLongToken(args);

            expect(result).toEqual({ token: 'hex_token' });
        });

        it('should set expiresAt in the future', async () => {
            mockMongomodels.longToken.create.mockResolvedValue({ token: 'hex_token', user: args.userId });

            await tokenManager.createLongToken(args);

            const callArg = mockMongomodels.longToken.create.mock.calls[0][0];
            expect(callArg.expiresAt.getTime()).toBeGreaterThan(Date.now());
        });
    });

    // Create Short Token

    describe('createShortToken', () => {
        it('should return a non-empty token string', async () => {
            const result = await tokenManager.createShortToken({ userId: 'uid1', role: 'schoolAdmin' });

            expect(typeof result.token).toBe('string');
            expect(result.token.length).toBeGreaterThan(0);
        });

        it('should return different tokens on successive calls', async () => {
            const first  = await tokenManager.createShortToken({ userId: 'uid1', role: 'schoolAdmin' });
            const second = await tokenManager.createShortToken({ userId: 'uid1', role: 'schoolAdmin' });

            expect(first.token).not.toBe(second.token);
        });

        it('should return a JWT containing userId and role', async () => {
            const jwt = require('jsonwebtoken');

            const result  = await tokenManager.createShortToken({ userId: 'uid1', role: 'superadmin' });
            const decoded = jwt.verify(result.token, 'test_short_secret');

            expect(decoded.userId).toBe('uid1');
            expect(decoded.role).toBe('superadmin');
        });
    });

    // Revoke Long Token

    describe('revokeLongToken', () => {
        it('should return error if token not found', async () => {
            mockMongomodels.longToken.findOne.mockResolvedValue(null);

            const result = await tokenManager.revokeLongToken({ token: 'nonexistent' });

            expect(result).toEqual({ error: 'token_not_found' });
        });

        it('should set status to revoked and save', async () => {
            const mockSave     = jest.fn().mockResolvedValue(true);
            const mockTokenDoc = { status: TOKEN_STATUSES.ACTIVE, save: mockSave };
            mockMongomodels.longToken.findOne.mockResolvedValue(mockTokenDoc);

            await tokenManager.revokeLongToken({ token: 'valid_token' });

            expect(mockTokenDoc.status).toBe(TOKEN_STATUSES.REVOKED);
            expect(mockSave).toHaveBeenCalled();
        });

        it('should return success after revoking', async () => {
            const mockTokenDoc = { status: TOKEN_STATUSES.ACTIVE, save: jest.fn().mockResolvedValue(true) };
            mockMongomodels.longToken.findOne.mockResolvedValue(mockTokenDoc);

            const result = await tokenManager.revokeLongToken({ token: 'valid_token' });

            expect(result).toEqual({ success: true });
        });

        it('should be idempotent if token is already revoked', async () => {
            const mockSave     = jest.fn();
            const mockTokenDoc = { status: TOKEN_STATUSES.REVOKED, save: mockSave };
            mockMongomodels.longToken.findOne.mockResolvedValue(mockTokenDoc);

            const result = await tokenManager.revokeLongToken({ token: 'already_revoked' });

            expect(mockSave).not.toHaveBeenCalled();
            expect(result).toEqual({ success: true });
        });
    });

    // Verify Short Token

    describe('verifyShortToken', () => {
        it('should return the decoded payload for a valid token', async () => {
            const { token } = await tokenManager.createShortToken({ userId: 'uid1' });

            const decoded = tokenManager.verifyShortToken({ token });

            expect(decoded.userId).toBe('uid1');
        });

        it('should throw for an invalid token', () => {
            expect(() => tokenManager.verifyShortToken({ token: 'invalid.token.here' })).toThrow();
        });

        it('should throw for a token signed with a different secret', async () => {
            const jwt   = require('jsonwebtoken');
            const token = jwt.sign({ userId: 'uid1' }, 'wrong_secret');

            expect(() => tokenManager.verifyShortToken({ token })).toThrow();
        });
    });

    // Validate Long Token

    describe('validateLongToken', () => {
        it('should return error if token not found', async () => {
            mockMongomodels.longToken.findOne.mockResolvedValue(null);

            const result = await tokenManager.validateLongToken({ token: 'nonexistent' });

            expect(result).toEqual({ error: 'invalid_token' });
        });

        it('should return error if token is revoked', async () => {
            mockMongomodels.longToken.findOne.mockResolvedValue({
                status:    TOKEN_STATUSES.REVOKED,
                expiresAt: new Date(Date.now() + 10000),
                user:      'uid1',
            });

            const result = await tokenManager.validateLongToken({ token: 'revoked_token' });

            expect(result).toEqual({ error: 'invalid_token' });
        });

        it('should return error if token is expired', async () => {
            mockMongomodels.longToken.findOne.mockResolvedValue({
                status:    TOKEN_STATUSES.ACTIVE,
                expiresAt: new Date(Date.now() - 1000),
                user:      'uid1',
            });

            const result = await tokenManager.validateLongToken({ token: 'expired_token' });

            expect(result).toEqual({ error: 'token_expired' });
        });

        it('should return error if token status is expired', async () => {
            mockMongomodels.longToken.findOne.mockResolvedValue({
                status:    TOKEN_STATUSES.EXPIRED,
                expiresAt: new Date(Date.now() + 10000),
                user:      'uid1',
            });

            const result = await tokenManager.validateLongToken({ token: 'expired_status_token' });

            expect(result).toEqual({ error: 'invalid_token' });
        });

        it('should return userId if token is active and not expired', async () => {
            mockMongomodels.longToken.findOne.mockResolvedValue({
                status:    TOKEN_STATUSES.ACTIVE,
                expiresAt: new Date(Date.now() + 86400000),
                user:      'uid1',
            });

            const result = await tokenManager.validateLongToken({ token: 'valid_token' });

            expect(result).toEqual({ userId: 'uid1' });
        });
    });
});
