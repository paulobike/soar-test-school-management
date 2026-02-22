const School = require('../managers/entities/school/School.manager');

describe('School.manager', () => {
    let school;
    let mockMongomodels;
    let mockValidators;
    let mockManagers;

    const superadminToken = { userId: 'admin1', role: 'superadmin' };

    beforeEach(() => {
        jest.clearAllMocks();

        mockManagers = {
            auditLog: { log: jest.fn().mockResolvedValue(undefined) },
        };

        mockMongomodels = {
            school: {
                findById:          jest.fn(),
                find:              jest.fn(),
                countDocuments:    jest.fn(),
                create:            jest.fn(),
                findByIdAndUpdate: jest.fn().mockResolvedValue({}),
            },
            classroom: {
                updateMany: jest.fn().mockResolvedValue({}),
            },
            student: {
                exists: jest.fn().mockResolvedValue(null),
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
            managers:    mockManagers,
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

        it('should return 404 error if school is soft deleted', async () => {
            mockMongomodels.school.findById.mockResolvedValue({ _id: 'sid1', deletedAt: new Date() });

            const result = await school._getSchool({ schoolId: 'sid1' });

            expect(result).toEqual({ error: 'school_not_found', code: 404 });
        });

        it('should return school if found', async () => {
            const mockSchool = { _id: 'sid1', name: 'Test School', deletedAt: null };
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

    // getSchools

    describe('getSchools', () => {
        const pagination = { page: 1, limit: 20, skip: 0 };

        beforeEach(() => {
            mockMongomodels.school.find.mockReturnValue({
                skip:  jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([]),
            });
            mockMongomodels.school.countDocuments.mockResolvedValue(0);
        });

        it('should query only non-soft-deleted schools', async () => {
            await school.getSchools({ __token: superadminToken, __role: 'superadmin', __pagination: pagination });

            expect(mockMongomodels.school.find).toHaveBeenCalledWith({ deletedAt: null });
        });

        it('should apply skip and limit from __pagination', async () => {
            const chainMock = { skip: jest.fn().mockReturnThis(), limit: jest.fn().mockResolvedValue([]) };
            mockMongomodels.school.find.mockReturnValue(chainMock);

            await school.getSchools({ __token: superadminToken, __role: 'superadmin', __pagination: { page: 2, limit: 10, skip: 10 } });

            expect(chainMock.skip).toHaveBeenCalledWith(10);
            expect(chainMock.limit).toHaveBeenCalledWith(10);
        });

        it('should return schools, total, page, and limit', async () => {
            const mockSchools = [{ _id: 'sid1', name: 'Greenwood High' }];
            mockMongomodels.school.find.mockReturnValue({
                skip:  jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue(mockSchools),
            });
            mockMongomodels.school.countDocuments.mockResolvedValue(1);

            const result = await school.getSchools({ __token: superadminToken, __role: 'superadmin', __pagination: pagination });

            expect(result).toEqual({ schools: mockSchools, total: 1, page: 1, limit: 20 });
        });

        it('should return an empty array if no schools exist', async () => {
            const result = await school.getSchools({ __token: superadminToken, __role: 'superadmin', __pagination: pagination });

            expect(result).toEqual({ schools: [], total: 0, page: 1, limit: 20 });
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

        it('should return 403 if school admin requests a school they do not own', async () => {
            const schoolAdminToken = { userId: 'uid2', role: 'schoolAdmin', school: 'sid2' };
            mockMongomodels.school.findById.mockResolvedValue({ _id: 'sid1', deletedAt: null });

            const result = await school.getSchool({ __token: schoolAdminToken, __role: 'schoolAdmin', schoolId: 'sid1' });

            expect(result).toEqual({ error: 'forbidden', code: 403 });
        });

        it('should return school if school admin requests their own school', async () => {
            const schoolAdminToken = { userId: 'uid2', role: 'schoolAdmin', school: 'sid1' };
            const mockSchool = { _id: 'sid1', name: 'Greenwood High', deletedAt: null };
            mockMongomodels.school.findById.mockResolvedValue(mockSchool);

            const result = await school.getSchool({ __token: schoolAdminToken, __role: 'schoolAdmin', schoolId: 'sid1' });

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
            const existing = { _id: 'sid1' };
            const updated  = { _id: 'sid1', name: payload.name };
            mockMongomodels.school.findById.mockResolvedValue(existing);
            mockMongomodels.school.findByIdAndUpdate.mockResolvedValue(updated);

            const result = await school.updateSchool(payload);

            expect(result).toEqual({ school: updated });
        });

        it('should return 403 if school admin tries to update a school they do not own', async () => {
            const schoolAdminToken = { userId: 'uid2', role: 'schoolAdmin', school: 'sid2' };
            mockMongomodels.school.findById.mockResolvedValue({ _id: 'sid1', deletedAt: null });

            const result = await school.updateSchool({ ...payload, __token: schoolAdminToken, __role: 'schoolAdmin' });

            expect(result).toEqual({ error: 'forbidden', code: 403 });
            expect(mockMongomodels.school.findByIdAndUpdate).not.toHaveBeenCalled();
        });

        it('should allow school admin to update their own school', async () => {
            const schoolAdminToken = { userId: 'uid2', role: 'schoolAdmin', school: 'sid1' };
            const updated = { _id: 'sid1', name: payload.name };
            mockMongomodels.school.findById.mockResolvedValue({ _id: 'sid1', deletedAt: null });
            mockMongomodels.school.findByIdAndUpdate.mockResolvedValue(updated);

            const result = await school.updateSchool({ ...payload, __token: schoolAdminToken, __role: 'schoolAdmin' });

            expect(result).toEqual({ school: updated });
        });
    });

    // deleteSchool

    describe('deleteSchool', () => {
        it('should return 404 error if school does not exist', async () => {
            mockMongomodels.school.findById.mockResolvedValue(null);

            const result = await school.deleteSchool({ __token: superadminToken, __role: 'superadmin', schoolId: 'sid1' });

            expect(result).toEqual({ error: 'school_not_found', code: 404 });
            expect(mockMongomodels.student.exists).not.toHaveBeenCalled();
        });

        it('should return 409 error if school has active students, ignoring soft deleted ones', async () => {
            mockMongomodels.school.findById.mockResolvedValue({ _id: 'sid1', deletedAt: null });
            mockMongomodels.student.exists.mockResolvedValue({ _id: 'stud1' });

            const result = await school.deleteSchool({ __token: superadminToken, __role: 'superadmin', schoolId: 'sid1' });

            expect(mockMongomodels.student.exists).toHaveBeenCalledWith({ school: 'sid1', deletedAt: null });
            expect(result).toEqual({ error: 'school_has_students', code: 409 });
            expect(mockMongomodels.classroom.updateMany).not.toHaveBeenCalled();
        });

        it('should soft delete all classrooms in the school', async () => {
            mockMongomodels.school.findById.mockResolvedValue({ _id: 'sid1', deletedAt: null });

            await school.deleteSchool({ __token: superadminToken, __role: 'superadmin', schoolId: 'sid1' });

            expect(mockMongomodels.classroom.updateMany).toHaveBeenCalledWith(
                { school: 'sid1', deletedAt: null },
                expect.objectContaining({ deletedAt: expect.any(Date) }),
            );
        });

        it('should soft delete the school', async () => {
            mockMongomodels.school.findById.mockResolvedValue({ _id: 'sid1', deletedAt: null });

            await school.deleteSchool({ __token: superadminToken, __role: 'superadmin', schoolId: 'sid1' });

            expect(mockMongomodels.school.findByIdAndUpdate).toHaveBeenCalledWith(
                'sid1',
                expect.objectContaining({ deletedAt: expect.any(Date) }),
            );
        });

        it('should return success on deletion', async () => {
            mockMongomodels.school.findById.mockResolvedValue({ _id: 'sid1', deletedAt: null });

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
