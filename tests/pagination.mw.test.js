const mwFactory = require('../mws/__pagination.mw');

describe('__pagination middleware', () => {
    let mw;
    let next;

    beforeEach(() => {
        jest.clearAllMocks();
        next = jest.fn();
        mw   = mwFactory({ managers: {} });
    });

    it('should use default page and limit when no query params are provided', async () => {
        await mw({ req: { query: {} }, next });

        expect(next).toHaveBeenCalledWith(
            expect.objectContaining({ page: 1, limit: 20 })
        );
    });

    it('should parse page and limit from query params', async () => {
        await mw({ req: { query: { page: '3', limit: '10' } }, next });

        expect(next).toHaveBeenCalledWith(
            expect.objectContaining({ page: 3, limit: 10 })
        );
    });

    it('should cap limit at 100', async () => {
        await mw({ req: { query: { limit: '500' } }, next });

        expect(next).toHaveBeenCalledWith(
            expect.objectContaining({ limit: 100 })
        );
    });

    it('should compute the correct skip value', async () => {
        await mw({ req: { query: { page: '3', limit: '10' } }, next });

        expect(next).toHaveBeenCalledWith(
            expect.objectContaining({ skip: 20 })
        );
    });

    it('should compute skip of 0 for page 1', async () => {
        await mw({ req: { query: { page: '1', limit: '20' } }, next });

        expect(next).toHaveBeenCalledWith(
            expect.objectContaining({ skip: 0 })
        );
    });
});
