'use strict';

const rateLimitFactory = require('../mws/__rateLimit.mw');

describe('__rateLimit middleware', () => {
    let rateLimitMw;
    let mockManagers;
    let mockCache;
    let mockReq;
    let mockRes;
    let mockNext;

    const moduleName  = 'school';
    const fnName      = 'createSchool';
    const windowSec   = 60;
    const max         = 10;
    const fixedNow    = 1_700_000_000_000;
    const windowMs    = windowSec * 1000;
    const windowSlot  = Math.floor(fixedNow / windowMs);
    const resetTime   = Math.floor(((windowSlot + 1) * windowMs) / 1000);

    const authedResults = {
        __token:  { userId: 'uid1', role: 'superadmin' },
        __device: { ip: '1.2.3.4' },
    };

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(Date, 'now').mockReturnValue(fixedNow);

        mockCache = {
            hash: { incrby: jest.fn().mockResolvedValue(1) },
            key:  { expire: jest.fn().mockResolvedValue(undefined) },
        };

        mockManagers = {
            school: {
                rateLimits: {
                    createSchool: { window: windowSec, max },
                },
            },
            responseDispatcher: { dispatch: jest.fn() },
        };

        mockReq  = { params: { moduleName, fnName } };
        mockRes  = { set: jest.fn() };
        mockNext = jest.fn();

        rateLimitMw = rateLimitFactory({ managers: mockManagers, cache: mockCache });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    // No config

    describe('when no rate limit config is defined', () => {
        it('should call next() without limiting when module has no rateLimits property', async () => {
            delete mockManagers.school.rateLimits;

            await rateLimitMw({ req: mockReq, res: mockRes, results: authedResults, next: mockNext });

            expect(mockCache.hash.incrby).not.toHaveBeenCalled();
            expect(mockNext).toHaveBeenCalled();
        });

        it('should call next() without limiting when function has no entry in rateLimits', async () => {
            mockReq.params.fnName = 'getSchools';

            await rateLimitMw({ req: mockReq, res: mockRes, results: authedResults, next: mockNext });

            expect(mockCache.hash.incrby).not.toHaveBeenCalled();
            expect(mockNext).toHaveBeenCalled();
        });
    });

    // Identifier selection

    describe('identifier selection', () => {
        it('should use userId from __token for authenticated requests', async () => {
            await rateLimitMw({ req: mockReq, res: mockRes, results: authedResults, next: mockNext });

            expect(mockCache.hash.incrby).toHaveBeenCalledWith(
                expect.objectContaining({ key: expect.stringContaining('uid1') })
            );
        });

        it('should fall back to IP from __device for unauthenticated requests', async () => {
            const unauthResults = { __device: { ip: '5.6.7.8' } };

            await rateLimitMw({ req: mockReq, res: mockRes, results: unauthResults, next: mockNext });

            expect(mockCache.hash.incrby).toHaveBeenCalledWith(
                expect.objectContaining({ key: expect.stringContaining('5.6.7.8') })
            );
        });
    });

    // Cache key format

    describe('cache key', () => {
        it('should scope the key to identifier, module, function, and window slot', async () => {
            const expectedKey = `rl:uid1:${moduleName}:${fnName}:${windowSlot}`;

            await rateLimitMw({ req: mockReq, res: mockRes, results: authedResults, next: mockNext });

            expect(mockCache.hash.incrby).toHaveBeenCalledWith(
                expect.objectContaining({ key: expectedKey })
            );
        });
    });

    // TTL management

    describe('TTL management', () => {
        it('should set expire on the first request in a window', async () => {
            mockCache.hash.incrby.mockResolvedValue(1);

            await rateLimitMw({ req: mockReq, res: mockRes, results: authedResults, next: mockNext });

            expect(mockCache.key.expire).toHaveBeenCalledWith(
                expect.objectContaining({ expire: windowSec + 1 })
            );
        });

        it('should not set expire on subsequent requests within the same window', async () => {
            mockCache.hash.incrby.mockResolvedValue(5);

            await rateLimitMw({ req: mockReq, res: mockRes, results: authedResults, next: mockNext });

            expect(mockCache.key.expire).not.toHaveBeenCalled();
        });
    });

    // Limit enforcement

    describe('limit enforcement', () => {
        it('should call next() when count is within the limit', async () => {
            mockCache.hash.incrby.mockResolvedValue(max);

            await rateLimitMw({ req: mockReq, res: mockRes, results: authedResults, next: mockNext });

            expect(mockNext).toHaveBeenCalled();
            expect(mockManagers.responseDispatcher.dispatch).not.toHaveBeenCalled();
        });

        it('should dispatch 429 when count exceeds the limit', async () => {
            mockCache.hash.incrby.mockResolvedValue(max + 1);

            await rateLimitMw({ req: mockReq, res: mockRes, results: authedResults, next: mockNext });

            expect(mockManagers.responseDispatcher.dispatch).toHaveBeenCalledWith(
                mockRes,
                expect.objectContaining({ ok: false, code: 429 })
            );
            expect(mockNext).not.toHaveBeenCalled();
        });
    });

    // Response headers

    describe('response headers', () => {
        it('should set X-RateLimit-Limit header to the configured max', async () => {
            await rateLimitMw({ req: mockReq, res: mockRes, results: authedResults, next: mockNext });

            expect(mockRes.set).toHaveBeenCalledWith('X-RateLimit-Limit', max);
        });

        it('should set X-RateLimit-Remaining header to max minus current count', async () => {
            mockCache.hash.incrby.mockResolvedValue(3);

            await rateLimitMw({ req: mockReq, res: mockRes, results: authedResults, next: mockNext });

            expect(mockRes.set).toHaveBeenCalledWith('X-RateLimit-Remaining', max - 3);
        });

        it('should clamp X-RateLimit-Remaining to 0 when count exceeds max', async () => {
            mockCache.hash.incrby.mockResolvedValue(max + 5);

            await rateLimitMw({ req: mockReq, res: mockRes, results: authedResults, next: mockNext });

            expect(mockRes.set).toHaveBeenCalledWith('X-RateLimit-Remaining', 0);
        });

        it('should set X-RateLimit-Reset to the Unix timestamp of the next window boundary', async () => {
            await rateLimitMw({ req: mockReq, res: mockRes, results: authedResults, next: mockNext });

            expect(mockRes.set).toHaveBeenCalledWith('X-RateLimit-Reset', resetTime);
        });
    });

    // Error handling

    describe('error handling', () => {
        it('should fail open (call next()) when the cache throws', async () => {
            mockCache.hash.incrby.mockRejectedValue(new Error('Redis down'));

            await rateLimitMw({ req: mockReq, res: mockRes, results: authedResults, next: mockNext });

            expect(mockNext).toHaveBeenCalled();
            expect(mockManagers.responseDispatcher.dispatch).not.toHaveBeenCalled();
        });
    });
});
