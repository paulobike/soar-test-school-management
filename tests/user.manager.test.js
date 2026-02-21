const User = require('../managers/entities/user/User.manager');

describe('User.manager', () => {
    let userManager;
    let mockMongomodels;

    beforeEach(() => {
        jest.clearAllMocks();

        mockMongomodels = {
            user: {
                findById: jest.fn(),
            },
        };

        userManager = new User({
            managers:    { token: {} },
            mongomodels: mockMongomodels,
        });
    });

    // Get User

    describe('getUser', () => {
        it('should return error if user not found', async () => {
            mockMongomodels.user.findById.mockResolvedValue(null);

            const result = await userManager.getUser({ userId: 'uid1' });

            expect(result).toEqual({ error: 'user_not_found' });
        });

        it('should return user on success', async () => {
            const mockUser = { _id: 'uid1', email: 'admin@school.com', role: 'schoolAdmin' };
            mockMongomodels.user.findById.mockResolvedValue(mockUser);

            const result = await userManager.getUser({ userId: 'uid1' });

            expect(result).toEqual({ user: mockUser });
        });

        it('should call findById with the correct userId', async () => {
            mockMongomodels.user.findById.mockResolvedValue(null);

            await userManager.getUser({ userId: 'uid1' });

            expect(mockMongomodels.user.findById).toHaveBeenCalledWith('uid1');
        });
    });
});
