module.exports = ({ managers, cache }) => {
    return async ({ req, res, results, next }) => {
        const { moduleName, fnName } = req.params;

        const limitConfig = managers[moduleName]?.rateLimits?.[fnName];
        if (!limitConfig) return next();

        const { window: windowSec, max } = limitConfig;
        const windowMs   = windowSec * 1000;
        const now        = Date.now();
        const windowSlot = Math.floor(now / windowMs);
        const resetTime  = Math.floor(((windowSlot + 1) * windowMs) / 1000);

        const identifier = results.__token?.userId || results.__device?.ip;
        const key        = `rl:${identifier}:${moduleName}:${fnName}:${windowSlot}`;

        try {
            const count = await cache.hash.incrby({ key, field: 'c', incr: 1 });

            if (count === 1) {
                await cache.key.expire({ key, expire: windowSec + 1 });
            }

            res.set('X-RateLimit-Limit',     max);
            res.set('X-RateLimit-Remaining', Math.max(0, max - count));
            res.set('X-RateLimit-Reset',     resetTime);

            if (count > max) {
                return managers.responseDispatcher.dispatch(res, {
                    ok: false, code: 429, errors: 'rate_limit_exceeded',
                });
            }

            next();
        } catch (err) {
            console.error('Rate limit check failed:', err);
            next();
        }
    };
};
