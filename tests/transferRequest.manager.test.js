const TransferRequest = require('../managers/entities/transferRequest/TransferRequest.manager');
const { TRANSFER_STATUSES } = require('../managers/_common/enums');

describe('TransferRequest.manager', () => {
    let transferRequest;
    let mockMongomodels;
    let mockValidators;

    const superadminToken       = { userId: 'admin1', role: 'superadmin' };
    const fromSchoolAdminToken  = { userId: 'admin2', role: 'schoolAdmin', school: 'sid1' };
    const toSchoolAdminToken    = { userId: 'admin3', role: 'schoolAdmin', school: 'sid2' };

    const mockStudent = {
        _id: 'stud1', firstname: 'Alice', lastname: 'Smith',
        email: 'alice@school.com', studentNumber: 'GWH-2026-0001',
        school: 'sid1', classroom: 'cid1', deletedAt: null,
    };

    const mockPendingRequest = {
        _id:         'req1',
        student:     'stud1',
        fromSchool:  'sid1',
        toSchool:    'sid2',
        toClassroom: 'cid2',
        requestedBy: 'admin2',
        status:      TRANSFER_STATUSES.PENDING,
        snapshot:    { firstname: 'Alice', lastname: 'Smith', email: 'alice@school.com', studentNumber: 'GWH-2026-0001', classroom: 'Class A' },
    };

    beforeEach(() => {
        jest.clearAllMocks();

        mockMongomodels = {
            transferRequest: {
                findById:          jest.fn(),
                findOne:           jest.fn().mockResolvedValue(null),
                find:              jest.fn(),
                countDocuments:    jest.fn(),
                create:            jest.fn(),
                findByIdAndUpdate: jest.fn().mockResolvedValue({}),
            },
            student: {
                findById:          jest.fn(),
                findByIdAndUpdate: jest.fn().mockResolvedValue({}),
            },
            classroom: {
                findById: jest.fn(),
            },
            school: {
                findById: jest.fn(),
            },
        };

        mockValidators = {
            transferRequest: {
                createTransferRequest: jest.fn().mockResolvedValue(null),
            },
        };

        transferRequest = new TransferRequest({
            mongomodels: mockMongomodels,
            validators:  mockValidators,
        });
    });

    // _getTransferRequest

    describe('_getTransferRequest', () => {
        it('should return 404 if request does not exist', async () => {
            mockMongomodels.transferRequest.findById.mockResolvedValue(null);

            const result = await transferRequest._getTransferRequest({ requestId: 'req1' });

            expect(result).toEqual({ error: 'transfer_request_not_found', code: 404 });
        });

        it('should return the request if found', async () => {
            mockMongomodels.transferRequest.findById.mockResolvedValue(mockPendingRequest);

            const result = await transferRequest._getTransferRequest({ requestId: 'req1' });

            expect(result).toEqual({ transferRequest: mockPendingRequest });
        });
    });

    // createTransferRequest

    describe('createTransferRequest', () => {
        const payload = {
            __token:      fromSchoolAdminToken,
            __role:       'schoolAdmin',
            studentId:    'stud1',
            toSchoolId:   'sid2',
            toClassroomId: 'cid2',
        };

        beforeEach(() => {
            mockMongomodels.student.findById.mockResolvedValue(mockStudent);
            mockMongomodels.school.findById.mockResolvedValue({ _id: 'sid2', deletedAt: null });
            mockMongomodels.classroom.findById.mockResolvedValue({ _id: 'cid1', name: 'Class A' });
        });

        it('should return 403 if school admin tries to transfer a student from another school', async () => {
            const result = await transferRequest.createTransferRequest({
                ...payload,
                __token: toSchoolAdminToken,
            });

            expect(result).toEqual({ error: 'forbidden', code: 403 });
            expect(mockMongomodels.transferRequest.create).not.toHaveBeenCalled();
        });

        it('should return 404 if student does not exist', async () => {
            mockMongomodels.student.findById.mockResolvedValue(null);

            const result = await transferRequest.createTransferRequest(payload);

            expect(result).toEqual({ error: 'student_not_found', code: 404 });
        });

        it('should return 404 if destination school does not exist', async () => {
            mockMongomodels.school.findById.mockResolvedValue(null);

            const result = await transferRequest.createTransferRequest(payload);

            expect(result).toEqual({ error: 'school_not_found', code: 404 });
        });

        it('should return validation errors if validation fails', async () => {
            mockValidators.transferRequest.createTransferRequest.mockResolvedValue([{ field: 'toSchoolId', message: 'required' }]);

            const result = await transferRequest.createTransferRequest(payload);

            expect(result.errors).toBeDefined();
            expect(result.message).toBe('request_validation_error');
            expect(mockMongomodels.transferRequest.create).not.toHaveBeenCalled();
        });

        it('should return 409 if student already has a pending transfer request', async () => {
            mockMongomodels.transferRequest.findOne.mockResolvedValue(mockPendingRequest);

            const result = await transferRequest.createTransferRequest(payload);

            expect(result).toEqual({ error: 'transfer_request_already_pending', code: 409 });
            expect(mockMongomodels.transferRequest.create).not.toHaveBeenCalled();
        });

        it('should check for existing pending request by studentId', async () => {
            await transferRequest.createTransferRequest(payload);

            expect(mockMongomodels.transferRequest.findOne).toHaveBeenCalledWith({
                student: payload.studentId,
                status:  TRANSFER_STATUSES.PENDING,
            });
        });

        it('should create the request with a snapshot of the student at time of transfer', async () => {
            mockMongomodels.transferRequest.create.mockResolvedValue(mockPendingRequest);

            await transferRequest.createTransferRequest(payload);

            expect(mockMongomodels.transferRequest.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    snapshot: expect.objectContaining({
                        firstname:     mockStudent.firstname,
                        lastname:      mockStudent.lastname,
                        email:         mockStudent.email,
                        studentNumber: mockStudent.studentNumber,
                        classroom:     'Class A',
                    }),
                })
            );
        });

        it('should create the request with correct fields and status PENDING', async () => {
            mockMongomodels.transferRequest.create.mockResolvedValue(mockPendingRequest);

            await transferRequest.createTransferRequest(payload);

            expect(mockMongomodels.transferRequest.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    student:      payload.studentId,
                    fromSchool:   mockStudent.school,
                    toSchool:     payload.toSchoolId,
                    toClassroom:  payload.toClassroomId,
                    requestedBy:  fromSchoolAdminToken.userId,
                    status:       TRANSFER_STATUSES.PENDING,
                })
            );
        });

        it('should return the created transfer request', async () => {
            mockMongomodels.transferRequest.create.mockResolvedValue(mockPendingRequest);

            const result = await transferRequest.createTransferRequest(payload);

            expect(result).toEqual({ transferRequest: mockPendingRequest });
        });
    });

    // getTransferRequests

    describe('getTransferRequests', () => {
        const pagination = { page: 1, limit: 20, skip: 0 };

        beforeEach(() => {
            mockMongomodels.transferRequest.find.mockReturnValue({
                skip:  jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([]),
            });
            mockMongomodels.transferRequest.countDocuments.mockResolvedValue(0);
        });

        it('should query all requests for superadmin', async () => {
            await transferRequest.getTransferRequests({
                __token: superadminToken, __role: 'superadmin', __pagination: pagination,
            });

            expect(mockMongomodels.transferRequest.find).toHaveBeenCalledWith({});
        });

        it('should filter by fromSchool or toSchool for school admin', async () => {
            await transferRequest.getTransferRequests({
                __token: fromSchoolAdminToken, __role: 'schoolAdmin', __pagination: pagination,
            });

            expect(mockMongomodels.transferRequest.find).toHaveBeenCalledWith({
                $or: [{ fromSchool: 'sid1' }, { toSchool: 'sid1' }],
            });
        });

        it('should apply skip and limit from __pagination', async () => {
            const chainMock = { skip: jest.fn().mockReturnThis(), limit: jest.fn().mockResolvedValue([]) };
            mockMongomodels.transferRequest.find.mockReturnValue(chainMock);

            await transferRequest.getTransferRequests({
                __token: superadminToken, __role: 'superadmin',
                __pagination: { page: 2, limit: 10, skip: 10 },
            });

            expect(chainMock.skip).toHaveBeenCalledWith(10);
            expect(chainMock.limit).toHaveBeenCalledWith(10);
        });

        it('should return requests, total, page, and limit', async () => {
            mockMongomodels.transferRequest.find.mockReturnValue({
                skip:  jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([mockPendingRequest]),
            });
            mockMongomodels.transferRequest.countDocuments.mockResolvedValue(1);

            const result = await transferRequest.getTransferRequests({
                __token: superadminToken, __role: 'superadmin', __pagination: pagination,
            });

            expect(result).toEqual({ transferRequests: [mockPendingRequest], total: 1, page: 1, limit: 20 });
        });
    });

    // getTransferRequest

    describe('getTransferRequest', () => {
        it('should return 404 if request does not exist', async () => {
            mockMongomodels.transferRequest.findById.mockResolvedValue(null);

            const result = await transferRequest.getTransferRequest({
                __token: superadminToken, __role: 'superadmin', requestId: 'req1',
            });

            expect(result).toEqual({ error: 'transfer_request_not_found', code: 404 });
        });

        it('should return 403 if school admin is not the fromSchool or toSchool', async () => {
            const unrelatedAdminToken = { userId: 'admin4', role: 'schoolAdmin', school: 'sid3' };
            mockMongomodels.transferRequest.findById.mockResolvedValue(mockPendingRequest);

            const result = await transferRequest.getTransferRequest({
                __token: unrelatedAdminToken, __role: 'schoolAdmin', requestId: 'req1',
            });

            expect(result).toEqual({ error: 'forbidden', code: 403 });
        });

        it('should return request if school admin is the fromSchool', async () => {
            mockMongomodels.transferRequest.findById.mockResolvedValue(mockPendingRequest);

            const result = await transferRequest.getTransferRequest({
                __token: fromSchoolAdminToken, __role: 'schoolAdmin', requestId: 'req1',
            });

            expect(result).toEqual({ transferRequest: mockPendingRequest });
        });

        it('should return request if school admin is the toSchool', async () => {
            mockMongomodels.transferRequest.findById.mockResolvedValue(mockPendingRequest);

            const result = await transferRequest.getTransferRequest({
                __token: toSchoolAdminToken, __role: 'schoolAdmin', requestId: 'req1',
            });

            expect(result).toEqual({ transferRequest: mockPendingRequest });
        });

        it('should return request for superadmin regardless of schools', async () => {
            mockMongomodels.transferRequest.findById.mockResolvedValue(mockPendingRequest);

            const result = await transferRequest.getTransferRequest({
                __token: superadminToken, __role: 'superadmin', requestId: 'req1',
            });

            expect(result).toEqual({ transferRequest: mockPendingRequest });
        });
    });

    // approveTransferRequest

    describe('approveTransferRequest', () => {
        it('should return 404 if request does not exist', async () => {
            mockMongomodels.transferRequest.findById.mockResolvedValue(null);

            const result = await transferRequest.approveTransferRequest({
                __token: superadminToken, __role: 'superadmin', requestId: 'req1',
            });

            expect(result).toEqual({ error: 'transfer_request_not_found', code: 404 });
        });

        it('should return 403 if school admin is not the toSchool', async () => {
            mockMongomodels.transferRequest.findById.mockResolvedValue(mockPendingRequest);

            const result = await transferRequest.approveTransferRequest({
                __token: fromSchoolAdminToken, __role: 'schoolAdmin', requestId: 'req1',
            });

            expect(result).toEqual({ error: 'forbidden', code: 403 });
        });

        it('should return 409 if request is not pending', async () => {
            mockMongomodels.transferRequest.findById.mockResolvedValue({
                ...mockPendingRequest, status: TRANSFER_STATUSES.APPROVED,
            });

            const result = await transferRequest.approveTransferRequest({
                __token: superadminToken, __role: 'superadmin', requestId: 'req1',
            });

            expect(result).toEqual({ error: 'transfer_request_not_pending', code: 409 });
        });

        it('should update the student school and classroom to the transfer destination', async () => {
            mockMongomodels.transferRequest.findById.mockResolvedValue(mockPendingRequest);

            await transferRequest.approveTransferRequest({
                __token: toSchoolAdminToken, __role: 'schoolAdmin', requestId: 'req1',
            });

            expect(mockMongomodels.student.findByIdAndUpdate).toHaveBeenCalledWith(
                mockPendingRequest.student,
                { school: mockPendingRequest.toSchool, classroom: mockPendingRequest.toClassroom },
            );
        });

        it('should mark the request as approved with respondedBy and respondedAt', async () => {
            mockMongomodels.transferRequest.findById.mockResolvedValue(mockPendingRequest);
            mockMongomodels.transferRequest.findByIdAndUpdate.mockResolvedValue({
                ...mockPendingRequest, status: TRANSFER_STATUSES.APPROVED,
            });

            await transferRequest.approveTransferRequest({
                __token: toSchoolAdminToken, __role: 'schoolAdmin', requestId: 'req1',
            });

            expect(mockMongomodels.transferRequest.findByIdAndUpdate).toHaveBeenCalledWith(
                'req1',
                expect.objectContaining({
                    status:      TRANSFER_STATUSES.APPROVED,
                    respondedBy: toSchoolAdminToken.userId,
                    respondedAt: expect.any(Date),
                }),
                expect.objectContaining({ new: true }),
            );
        });

        it('should return the updated transfer request', async () => {
            const approved = { ...mockPendingRequest, status: TRANSFER_STATUSES.APPROVED };
            mockMongomodels.transferRequest.findById.mockResolvedValue(mockPendingRequest);
            mockMongomodels.transferRequest.findByIdAndUpdate.mockResolvedValue(approved);

            const result = await transferRequest.approveTransferRequest({
                __token: toSchoolAdminToken, __role: 'schoolAdmin', requestId: 'req1',
            });

            expect(result).toEqual({ transferRequest: approved });
        });
    });

    // rejectTransferRequest

    describe('rejectTransferRequest', () => {
        it('should return 404 if request does not exist', async () => {
            mockMongomodels.transferRequest.findById.mockResolvedValue(null);

            const result = await transferRequest.rejectTransferRequest({
                __token: superadminToken, __role: 'superadmin', requestId: 'req1',
            });

            expect(result).toEqual({ error: 'transfer_request_not_found', code: 404 });
        });

        it('should return 403 if school admin is not the toSchool', async () => {
            mockMongomodels.transferRequest.findById.mockResolvedValue(mockPendingRequest);

            const result = await transferRequest.rejectTransferRequest({
                __token: fromSchoolAdminToken, __role: 'schoolAdmin', requestId: 'req1',
            });

            expect(result).toEqual({ error: 'forbidden', code: 403 });
        });

        it('should return 409 if request is not pending', async () => {
            mockMongomodels.transferRequest.findById.mockResolvedValue({
                ...mockPendingRequest, status: TRANSFER_STATUSES.REJECTED,
            });

            const result = await transferRequest.rejectTransferRequest({
                __token: superadminToken, __role: 'superadmin', requestId: 'req1',
            });

            expect(result).toEqual({ error: 'transfer_request_not_pending', code: 409 });
        });

        it('should mark the request as rejected with respondedBy and respondedAt', async () => {
            mockMongomodels.transferRequest.findById.mockResolvedValue(mockPendingRequest);
            mockMongomodels.transferRequest.findByIdAndUpdate.mockResolvedValue({
                ...mockPendingRequest, status: TRANSFER_STATUSES.REJECTED,
            });

            await transferRequest.rejectTransferRequest({
                __token: toSchoolAdminToken, __role: 'schoolAdmin', requestId: 'req1',
            });

            expect(mockMongomodels.transferRequest.findByIdAndUpdate).toHaveBeenCalledWith(
                'req1',
                expect.objectContaining({
                    status:      TRANSFER_STATUSES.REJECTED,
                    respondedBy: toSchoolAdminToken.userId,
                    respondedAt: expect.any(Date),
                }),
                expect.objectContaining({ new: true }),
            );
        });

        it('should return the updated transfer request', async () => {
            const rejected = { ...mockPendingRequest, status: TRANSFER_STATUSES.REJECTED };
            mockMongomodels.transferRequest.findById.mockResolvedValue(mockPendingRequest);
            mockMongomodels.transferRequest.findByIdAndUpdate.mockResolvedValue(rejected);

            const result = await transferRequest.rejectTransferRequest({
                __token: toSchoolAdminToken, __role: 'schoolAdmin', requestId: 'req1',
            });

            expect(result).toEqual({ transferRequest: rejected });
        });
    });
});
