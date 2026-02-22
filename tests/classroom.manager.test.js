const Classroom = require('../managers/entities/classroom/Classroom.manager');

describe('Classroom.manager', () => {
    let classroom;
    let mockMongomodels;
    let mockValidators;

    const superadminToken   = { userId: 'admin1', role: 'superadmin' };
    const schoolAdminToken  = { userId: 'admin2', role: 'schoolAdmin', school: 'sid1' };

    beforeEach(() => {
        jest.clearAllMocks();

        mockMongomodels = {
            classroom: {
                findById:          jest.fn(),
                find:              jest.fn(),
                countDocuments:    jest.fn(),
                create:            jest.fn(),
                findByIdAndUpdate: jest.fn().mockResolvedValue({}),
            },
            student: {
                exists: jest.fn().mockResolvedValue(null),
            },
        };

        mockValidators = {
            classroom: {
                createClassroom: jest.fn().mockResolvedValue(null),
                updateClassroom: jest.fn().mockResolvedValue(null),
            },
        };

        classroom = new Classroom({
            mongomodels: mockMongomodels,
            validators:  mockValidators,
        });
    });

    // _getClassroom

    describe('_getClassroom', () => {
        it('should return 404 error if classroom does not exist', async () => {
            mockMongomodels.classroom.findById.mockResolvedValue(null);

            const result = await classroom._getClassroom({ classroomId: 'cid1' });

            expect(result).toEqual({ error: 'classroom_not_found', code: 404 });
        });

        it('should return 404 error if classroom is soft deleted', async () => {
            mockMongomodels.classroom.findById.mockResolvedValue({ _id: 'cid1', deletedAt: new Date() });

            const result = await classroom._getClassroom({ classroomId: 'cid1' });

            expect(result).toEqual({ error: 'classroom_not_found', code: 404 });
        });

        it('should return classroom if found and not deleted', async () => {
            const mockClassroom = { _id: 'cid1', name: 'Class A', deletedAt: null };
            mockMongomodels.classroom.findById.mockResolvedValue(mockClassroom);

            const result = await classroom._getClassroom({ classroomId: 'cid1' });

            expect(result).toEqual({ classroom: mockClassroom });
        });
    });

    // createClassroom

    describe('createClassroom', () => {
        const payload = {
            __token:    superadminToken,
            __role:     'superadmin',
            schoolId:   'sid1',
            name:       'Class A',
            capacity:   30,
            resources:  ['projector', 'whiteboard'],
        };

        it('should return validation errors if validation fails', async () => {
            mockValidators.classroom.createClassroom.mockResolvedValue([{ field: 'name', message: 'required' }]);

            const result = await classroom.createClassroom(payload);

            expect(result.errors).toBeDefined();
            expect(result.message).toBe('request_validation_error');
            expect(mockMongomodels.classroom.create).not.toHaveBeenCalled();
        });

        it('should return 403 if school admin tries to create in a school they do not own', async () => {
            const result = await classroom.createClassroom({
                ...payload,
                __token: { userId: 'admin2', role: 'schoolAdmin', school: 'sid2' },
                __role:  'schoolAdmin',
            });

            expect(result).toEqual({ error: 'forbidden', code: 403 });
            expect(mockMongomodels.classroom.create).not.toHaveBeenCalled();
        });

        it('should create classroom with correct fields including createdBy and school', async () => {
            const created = { _id: 'cid1', ...payload };
            mockMongomodels.classroom.create.mockResolvedValue(created);

            await classroom.createClassroom(payload);

            expect(mockMongomodels.classroom.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    name:      payload.name,
                    school:    payload.schoolId,
                    capacity:  payload.capacity,
                    resources: payload.resources,
                    createdBy: superadminToken.userId,
                })
            );
        });

        it('should return the created classroom on success', async () => {
            const created = { _id: 'cid1', name: payload.name, school: payload.schoolId };
            mockMongomodels.classroom.create.mockResolvedValue(created);

            const result = await classroom.createClassroom(payload);

            expect(result).toEqual({ classroom: created });
        });
    });

    // getClassrooms

    describe('getClassrooms', () => {
        const pagination = { page: 1, limit: 20, skip: 0 };

        beforeEach(() => {
            mockMongomodels.classroom.find.mockReturnValue({
                skip:  jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([]),
            });
            mockMongomodels.classroom.countDocuments.mockResolvedValue(0);
        });

        it('should return 403 if school admin requests classrooms for a school they do not own', async () => {
            const result = await classroom.getClassrooms({
                __token:     { userId: 'admin2', role: 'schoolAdmin', school: 'sid2' },
                __role:      'schoolAdmin',
                __pagination: pagination,
                schoolId:    'sid1',
            });

            expect(result).toEqual({ error: 'forbidden', code: 403 });
            expect(mockMongomodels.classroom.find).not.toHaveBeenCalled();
        });

        it('should query only non-soft-deleted classrooms for the given school', async () => {
            await classroom.getClassrooms({
                __token: superadminToken, __role: 'superadmin', __pagination: pagination, schoolId: 'sid1',
            });

            expect(mockMongomodels.classroom.find).toHaveBeenCalledWith({ school: 'sid1', deletedAt: null });
        });

        it('should apply skip and limit from __pagination', async () => {
            const chainMock = { skip: jest.fn().mockReturnThis(), limit: jest.fn().mockResolvedValue([]) };
            mockMongomodels.classroom.find.mockReturnValue(chainMock);

            await classroom.getClassrooms({
                __token: superadminToken, __role: 'superadmin',
                __pagination: { page: 2, limit: 10, skip: 10 },
                schoolId: 'sid1',
            });

            expect(chainMock.skip).toHaveBeenCalledWith(10);
            expect(chainMock.limit).toHaveBeenCalledWith(10);
        });

        it('should return classrooms, total, page, and limit', async () => {
            const mockClassrooms = [{ _id: 'cid1', name: 'Class A' }];
            mockMongomodels.classroom.find.mockReturnValue({
                skip:  jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue(mockClassrooms),
            });
            mockMongomodels.classroom.countDocuments.mockResolvedValue(1);

            const result = await classroom.getClassrooms({
                __token: superadminToken, __role: 'superadmin', __pagination: pagination, schoolId: 'sid1',
            });

            expect(result).toEqual({ classrooms: mockClassrooms, total: 1, page: 1, limit: 20 });
        });
    });

    // getClassroom

    describe('getClassroom', () => {
        it('should return 404 error if classroom does not exist', async () => {
            mockMongomodels.classroom.findById.mockResolvedValue(null);

            const result = await classroom.getClassroom({
                __token: superadminToken, __role: 'superadmin', classroomId: 'cid1',
            });

            expect(result).toEqual({ error: 'classroom_not_found', code: 404 });
        });

        it('should return 403 if school admin requests a classroom from another school', async () => {
            mockMongomodels.classroom.findById.mockResolvedValue({ _id: 'cid1', school: 'sid2', deletedAt: null });

            const result = await classroom.getClassroom({
                __token: schoolAdminToken, __role: 'schoolAdmin', classroomId: 'cid1',
            });

            expect(result).toEqual({ error: 'forbidden', code: 403 });
        });

        it('should return classroom if school admin requests one from their own school', async () => {
            const mockClassroom = { _id: 'cid1', name: 'Class A', school: 'sid1', deletedAt: null };
            mockMongomodels.classroom.findById.mockResolvedValue(mockClassroom);

            const result = await classroom.getClassroom({
                __token: schoolAdminToken, __role: 'schoolAdmin', classroomId: 'cid1',
            });

            expect(result).toEqual({ classroom: mockClassroom });
        });

        it('should return classroom for superadmin regardless of school', async () => {
            const mockClassroom = { _id: 'cid1', name: 'Class A', school: 'sid1', deletedAt: null };
            mockMongomodels.classroom.findById.mockResolvedValue(mockClassroom);

            const result = await classroom.getClassroom({
                __token: superadminToken, __role: 'superadmin', classroomId: 'cid1',
            });

            expect(result).toEqual({ classroom: mockClassroom });
        });
    });

    // updateClassroom

    describe('updateClassroom', () => {
        const payload = {
            __token:      superadminToken,
            __role:       'superadmin',
            classroomId:  'cid1',
            name:         'Class A Updated',
            capacity:     40,
        };

        it('should return 404 error if classroom does not exist', async () => {
            mockMongomodels.classroom.findById.mockResolvedValue(null);

            const result = await classroom.updateClassroom(payload);

            expect(result).toEqual({ error: 'classroom_not_found', code: 404 });
            expect(mockMongomodels.classroom.findByIdAndUpdate).not.toHaveBeenCalled();
        });

        it('should return 403 if school admin tries to update a classroom from another school', async () => {
            mockMongomodels.classroom.findById.mockResolvedValue({ _id: 'cid1', school: 'sid2', deletedAt: null });

            const result = await classroom.updateClassroom({
                ...payload,
                __token: schoolAdminToken,
                __role:  'schoolAdmin',
            });

            expect(result).toEqual({ error: 'forbidden', code: 403 });
            expect(mockMongomodels.classroom.findByIdAndUpdate).not.toHaveBeenCalled();
        });

        it('should return validation errors if validation fails', async () => {
            mockMongomodels.classroom.findById.mockResolvedValue({ _id: 'cid1', school: 'sid1', deletedAt: null });
            mockValidators.classroom.updateClassroom.mockResolvedValue([{ field: 'capacity', message: 'must be positive' }]);

            const result = await classroom.updateClassroom(payload);

            expect(result.errors).toBeDefined();
            expect(result.message).toBe('request_validation_error');
            expect(mockMongomodels.classroom.findByIdAndUpdate).not.toHaveBeenCalled();
        });

        it('should call findByIdAndUpdate with only the provided fields', async () => {
            mockMongomodels.classroom.findById.mockResolvedValue({ _id: 'cid1', school: 'sid1', deletedAt: null });
            mockMongomodels.classroom.findByIdAndUpdate.mockResolvedValue({ _id: 'cid1', ...payload });

            await classroom.updateClassroom(payload);

            expect(mockMongomodels.classroom.findByIdAndUpdate).toHaveBeenCalledWith(
                'cid1',
                expect.objectContaining({ name: payload.name, capacity: payload.capacity }),
                expect.objectContaining({ new: true }),
            );
        });

        it('should return the updated classroom on success', async () => {
            const updated = { _id: 'cid1', name: payload.name, capacity: payload.capacity };
            mockMongomodels.classroom.findById.mockResolvedValue({ _id: 'cid1', school: 'sid1', deletedAt: null });
            mockMongomodels.classroom.findByIdAndUpdate.mockResolvedValue(updated);

            const result = await classroom.updateClassroom(payload);

            expect(result).toEqual({ classroom: updated });
        });
    });

    // deleteClassroom

    describe('deleteClassroom', () => {
        it('should return 404 error if classroom does not exist', async () => {
            mockMongomodels.classroom.findById.mockResolvedValue(null);

            const result = await classroom.deleteClassroom({
                __token: superadminToken, __role: 'superadmin', classroomId: 'cid1',
            });

            expect(result).toEqual({ error: 'classroom_not_found', code: 404 });
            expect(mockMongomodels.student.exists).not.toHaveBeenCalled();
        });

        it('should return 403 if school admin tries to delete a classroom from another school', async () => {
            mockMongomodels.classroom.findById.mockResolvedValue({ _id: 'cid1', school: 'sid2', deletedAt: null });

            const result = await classroom.deleteClassroom({
                __token: schoolAdminToken, __role: 'schoolAdmin', classroomId: 'cid1',
            });

            expect(result).toEqual({ error: 'forbidden', code: 403 });
            expect(mockMongomodels.student.exists).not.toHaveBeenCalled();
        });

        it('should return 409 if classroom has active students', async () => {
            mockMongomodels.classroom.findById.mockResolvedValue({ _id: 'cid1', school: 'sid1', deletedAt: null });
            mockMongomodels.student.exists.mockResolvedValue({ _id: 'stud1' });

            const result = await classroom.deleteClassroom({
                __token: superadminToken, __role: 'superadmin', classroomId: 'cid1',
            });

            expect(mockMongomodels.student.exists).toHaveBeenCalledWith({ classroom: 'cid1', deletedAt: null });
            expect(result).toEqual({ error: 'classroom_has_students', code: 409 });
            expect(mockMongomodels.classroom.findByIdAndUpdate).not.toHaveBeenCalled();
        });

        it('should soft delete the classroom', async () => {
            mockMongomodels.classroom.findById.mockResolvedValue({ _id: 'cid1', school: 'sid1', deletedAt: null });

            await classroom.deleteClassroom({
                __token: superadminToken, __role: 'superadmin', classroomId: 'cid1',
            });

            expect(mockMongomodels.classroom.findByIdAndUpdate).toHaveBeenCalledWith(
                'cid1',
                expect.objectContaining({ deletedAt: expect.any(Date) }),
            );
        });

        it('should return success on deletion', async () => {
            mockMongomodels.classroom.findById.mockResolvedValue({ _id: 'cid1', school: 'sid1', deletedAt: null });

            const result = await classroom.deleteClassroom({
                __token: superadminToken, __role: 'superadmin', classroomId: 'cid1',
            });

            expect(result).toEqual({ success: true });
        });
    });
});
