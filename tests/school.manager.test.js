const School = require('../managers/entities/school/School.manager');

describe('School.manager', () => {
    let school;
    let mockMongomodels;
    let mockValidators;

    const superadminToken = { userId: 'admin1', role: 'superadmin' };

    beforeEach(() => {
        jest.clearAllMocks();

        mockMongomodels = {
            school: {
                findById:          jest.fn(),
                create:            jest.fn(),
                findByIdAndUpdate: jest.fn(),
                findByIdAndDelete: jest.fn(),
            },
            user: {
                findOne: jest.fn(),
                create:  jest.fn(),
            },
        };

        mockValidators = {
            school: {
                createSchool:      jest.fn().mockResolvedValue(null),
                updateSchool:      jest.fn().mockResolvedValue(null),
                createSchoolAdmin: jest.fn().mockResolvedValue(null),
            },
        };

        school = new School({
            mongomodels: mockMongomodels,
            validators:  mockValidators,
        });
    });

    // _getSchool

    describe('_getSchool', () => {
        it('should return 404 error if school does not exist', async () => {
            mockMongomodels.school.findById.mockResolvedValue(null);

            const result = await school._getSchool({ schoolId: 'sid1' });

            expect(result).toEqual({ error: 'school_not_found', code: 404 });
        });

        it('should return school if found', async () => {
            const mockSchool = { _id: 'sid1', name: 'Test School' };
            mockMongomodels.school.findById.mockResolvedValue(mockSchool);

            const result = await school._getSchool({ schoolId: 'sid1' });

            expect(result).toEqual({ school: mockSchool });
        });
    });

    // createSchool

    describe('createSchool', () => {
        const payload = {
            __token:  superadminToken,
            __role:   'superadmin',
            name:     'Greenwood High',
            code:     'GWH',
            address:  '123 Main St',
            phone:    '0700000000',
            email:    'info@greenwood.edu',
            maxCapacity: 500,
        };

        it('should return validation errors if validation fails', async () => {
            mockValidators.school.createSchool.mockResolvedValue([{ field: 'name', message: 'required' }]);

            const result = await school.createSchool(payload);

            expect(result.errors).toBeDefined();
            expect(result.message).toBe('request_validation_error');
            expect(mockMongomodels.school.create).not.toHaveBeenCalled();
        });

        it('should create school with correct fields including createdBy', async () => {
            const created = { _id: 'sid1', ...payload, createdBy: superadminToken.userId };
            mockMongomodels.school.create.mockResolvedValue(created);

            await school.createSchool(payload);

            expect(mockMongomodels.school.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    name:        payload.name,
                    code:        payload.code,
                    address:     payload.address,
                    phone:       payload.phone,
                    email:       payload.email,
                    maxCapacity: payload.maxCapacity,
                    createdBy:   superadminToken.userId,
                })
            );
        });

        it('should return the created school on success', async () => {
            const created = { _id: 'sid1', name: payload.name, code: payload.code };
            mockMongomodels.school.create.mockResolvedValue(created);

            const result = await school.createSchool(payload);

            expect(result).toEqual({ school: created });
        });
    });

    // getSchool

    describe('getSchool', () => {
        it('should return 404 error if school does not exist', async () => {
            mockMongomodels.school.findById.mockResolvedValue(null);

            const result = await school.getSchool({ __token: superadminToken, __role: 'superadmin', schoolId: 'sid1' });

            expect(result).toEqual({ error: 'school_not_found', code: 404 });
        });

        it('should return school if found', async () => {
            const mockSchool = { _id: 'sid1', name: 'Greenwood High', code: 'GWH' };
            mockMongomodels.school.findById.mockResolvedValue(mockSchool);

            const result = await school.getSchool({ __token: superadminToken, __role: 'superadmin', schoolId: 'sid1' });

            expect(result).toEqual({ school: mockSchool });
        });
    });

    // updateSchool

    describe('updateSchool', () => {
        const payload = {
            __token:  superadminToken,
            __role:   'superadmin',
            schoolId: 'sid1',
            name:     'Greenwood High Updated',
            address:  '456 New St',
        };

        it('should return 404 error if school does not exist', async () => {
            mockMongomodels.school.findById.mockResolvedValue(null);

            const result = await school.updateSchool(payload);

            expect(result).toEqual({ error: 'school_not_found', code: 404 });
            expect(mockMongomodels.school.findByIdAndUpdate).not.toHaveBeenCalled();
        });

        it('should return validation errors if validation fails', async () => {
            mockMongomodels.school.findById.mockResolvedValue({ _id: 'sid1' });
            mockValidators.school.updateSchool.mockResolvedValue([{ field: 'name', message: 'too short' }]);

            const result = await school.updateSchool(payload);

            expect(result.errors).toBeDefined();
            expect(result.message).toBe('request_validation_error');
            expect(mockMongomodels.school.findByIdAndUpdate).not.toHaveBeenCalled();
        });

        it('should call findByIdAndUpdate with the correct fields', async () => {
            mockMongomodels.school.findById.mockResolvedValue({ _id: 'sid1' });
            mockMongomodels.school.findByIdAndUpdate.mockResolvedValue({ _id: 'sid1', ...payload });

            await school.updateSchool(payload);

            expect(mockMongomodels.school.findByIdAndUpdate).toHaveBeenCalledWith(
                'sid1',
                expect.objectContaining({ name: payload.name, address: payload.address }),
                expect.objectContaining({ new: true }),
            );
        });

        it('should return the updated school on success', async () => {
            const updated = { _id: 'sid1', name: payload.name };
            mockMongomodels.school.findById.mockResolvedValue({ _id: 'sid1' });
            mockMongomodels.school.findByIdAndUpdate.mockResolvedValue(updated);

            const result = await school.updateSchool(payload);

            expect(result).toEqual({ school: updated });
        });
    });

    // deleteSchool

    describe('deleteSchool', () => {
        it('should return 404 error if school does not exist', async () => {
            mockMongomodels.school.findById.mockResolvedValue(null);

            const result = await school.deleteSchool({ __token: superadminToken, __role: 'superadmin', schoolId: 'sid1' });

            expect(result).toEqual({ error: 'school_not_found', code: 404 });
            expect(mockMongomodels.school.findByIdAndDelete).not.toHaveBeenCalled();
        });

        it('should delete the school by id', async () => {
            mockMongomodels.school.findById.mockResolvedValue({ _id: 'sid1' });
            mockMongomodels.school.findByIdAndDelete.mockResolvedValue({});

            await school.deleteSchool({ __token: superadminToken, __role: 'superadmin', schoolId: 'sid1' });

            expect(mockMongomodels.school.findByIdAndDelete).toHaveBeenCalledWith('sid1');
        });

        it('should return success on deletion', async () => {
            mockMongomodels.school.findById.mockResolvedValue({ _id: 'sid1' });
            mockMongomodels.school.findByIdAndDelete.mockResolvedValue({});

            const result = await school.deleteSchool({ __token: superadminToken, __role: 'superadmin', schoolId: 'sid1' });

            expect(result).toEqual({ success: true });
        });
    });

    // createSchoolAdmin

    describe('createSchoolAdmin', () => {
        const payload = {
            __token:   superadminToken,
            __role:    'superadmin',
            schoolId:  'sid1',
            firstname: 'Jane',
            lastname:  'Doe',
            email:     'jane@greenwood.edu',
            password:  'secret123',
        };

        it('should return 404 error if school does not exist', async () => {
            mockMongomodels.school.findById.mockResolvedValue(null);

            const result = await school.createSchoolAdmin(payload);

            expect(result).toEqual({ error: 'school_not_found', code: 404 });
            expect(mockMongomodels.user.create).not.toHaveBeenCalled();
        });

        it('should return validation errors if validation fails', async () => {
            mockMongomodels.school.findById.mockResolvedValue({ _id: 'sid1' });
            mockValidators.school.createSchoolAdmin.mockResolvedValue([{ field: 'email', message: 'invalid' }]);

            const result = await school.createSchoolAdmin(payload);

            expect(result.errors).toBeDefined();
            expect(result.message).toBe('request_validation_error');
            expect(mockMongomodels.user.create).not.toHaveBeenCalled();
        });

        it('should create user with schoolAdmin role and correct schoolId', async () => {
            mockMongomodels.school.findById.mockResolvedValue({ _id: 'sid1' });
            mockMongomodels.user.create.mockResolvedValue({
                _id: 'uid1', firstname: payload.firstname, lastname: payload.lastname,
                email: payload.email, role: 'schoolAdmin', school: 'sid1', password: 'hashed',
            });

            await school.createSchoolAdmin(payload);

            expect(mockMongomodels.user.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    firstname: payload.firstname,
                    lastname:  payload.lastname,
                    email:     payload.email,
                    password:  payload.password,
                    role:      'schoolAdmin',
                    school:    payload.schoolId,
                })
            );
        });

        it('should return the created user without password', async () => {
            const created = {
                _id: 'uid1', firstname: payload.firstname, lastname: payload.lastname,
                email: payload.email, role: 'schoolAdmin', school: 'sid1', password: 'hashed',
            };
            mockMongomodels.school.findById.mockResolvedValue({ _id: 'sid1' });
            mockMongomodels.user.create.mockResolvedValue(created);

            const result = await school.createSchoolAdmin(payload);

            expect(result.user.password).toBeUndefined();
            expect(result.user.email).toBe(payload.email);
            expect(result.user.role).toBe('schoolAdmin');
        });
    });
});
