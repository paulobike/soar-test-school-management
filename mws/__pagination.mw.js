const MAX_LIMIT     = 100;
const DEFAULT_PAGE  = 1;
const DEFAULT_LIMIT = 20;

module.exports = ({ managers }) => {
    return async ({ req, next }) => {
        const page  = Math.max(1, parseInt(req.query.page)  || DEFAULT_PAGE);
        const limit = Math.min(MAX_LIMIT, parseInt(req.query.limit) || DEFAULT_LIMIT);
        const skip  = (page - 1) * limit;

        next({ page, limit, skip });
    };
};
