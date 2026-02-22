const mwFactory = require('../mws/__role.mw');

describe('__role middleware', () => {
    let mw;
    let mockDispatch;
    let mockManagers;
    let next;
    let res;

    beforeEach(() => {
        jest.clearAllMocks();

        mockDispatch = jest.fn();
        next         = jest.fn();
        res          = {};

        mockManagers = {
            responseDispatcher: { dispatch: mockDispatch },
            school: {
                roles: {
                    createSchool: ['superadmin'],
                    getSchool:    ['superadmin', 'schoolAdmin'],
                },
            },
        };

        mw = mwFactory({ managers: mockManagers });
    });

    // No roles config — pass through

    describe('when no roles are configured for the target function', () => {
        it('should call next if the manager has no roles map', async () => {
            await mw({
                req:     { params: { moduleName: 'auth', fnName: 'login' } },
                res,
                results: {},
                next,
            });

            expect(next).toHaveBeenCalled();
            expect(mockDispatch).not.toHaveBeenCalled();
        });

        it('should call next if fnName is not listed in the roles map', async () => {
            await mw({
                req:     { params: { moduleName: 'school', fnName: 'someUnlistedFn' } },
                res,
                results: { __token: { userId: 'uid1', role: 'schoolAdmin' } },
                next,
            });

            expect(next).toHaveBeenCalled();
            expect(mockDispatch).not.toHaveBeenCalled();
        });
    });

    // Roles config present — enforce access

    describe('when roles are configured for the target function', () => {
        it('should dispatch 401 if __token is absent from results', async () => {
            await mw({
                req:     { params: { moduleName: 'school', fnName: 'createSchool' } },
                res,
                results: {},
                next,
            });

            expect(mockDispatch).toHaveBeenCalledWith(res, { ok: false, code: 401, errors: 'unauthorized' });
            expect(next).not.toHaveBeenCalled();
        });

        it('should dispatch 403 if the user role is not in the allowed list', async () => {
            await mw({
                req:     { params: { moduleName: 'school', fnName: 'createSchool' } },
                res,
                results: { __token: { userId: 'uid1', role: 'schoolAdmin' } },
                next,
            });

            expect(mockDispatch).toHaveBeenCalledWith(res, { ok: false, code: 403, errors: 'forbidden' });
            expect(next).not.toHaveBeenCalled();
        });

        it('should call next with the validated role if it matches the single allowed role', async () => {
            await mw({
                req:     { params: { moduleName: 'school', fnName: 'createSchool' } },
                res,
                results: { __token: { userId: 'uid1', role: 'superadmin' } },
                next,
            });

            expect(next).toHaveBeenCalledWith('superadmin');
            expect(mockDispatch).not.toHaveBeenCalled();
        });

        it('should call next with the validated role if it is one of multiple allowed roles', async () => {
            await mw({
                req:     { params: { moduleName: 'school', fnName: 'getSchool' } },
                res,
                results: { __token: { userId: 'uid1', role: 'schoolAdmin' } },
                next,
            });

            expect(next).toHaveBeenCalledWith('schoolAdmin');
            expect(mockDispatch).not.toHaveBeenCalled();
        });
    });
});
