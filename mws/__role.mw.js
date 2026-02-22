module.exports = ({ managers }) => {
    return async ({ req, res, results, next }) => {
        const { moduleName, fnName } = req.params;

        const allowedRoles = managers[moduleName]?.roles?.[fnName];
        if (!allowedRoles) return next();

        const tokenData = results.__token;
        if (!tokenData) {
            return managers.responseDispatcher.dispatch(res, { ok: false, code: 401, errors: 'unauthorized' });
        }

        if (!allowedRoles.includes(tokenData.role)) {
            return managers.responseDispatcher.dispatch(res, { ok: false, code: 403, errors: 'forbidden' });
        }

        next(tokenData.role);
    };
};
