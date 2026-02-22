const Student = require('../managers/entities/student/Student.manager');

describe('Student.manager', () => {
    let student;
    let mockMongomodels;
    let mockValidators;

    const superadminToken  = { userId: 'admin1', role: 'superadmin' };
    const schoolAdminToken = { userId: 'admin2', role: 'schoolAdmin', school: 'sid1' };

    beforeEach(() => {
        jest.clearAllMocks();

        mockMongomodels = {
            student: {
                findById:          jest.fn(),
                find:              jest.fn(),
                countDocuments:    jest.fn(),
                create:            jest.fn(),
                findByIdAndUpdate: jest.fn().mockResolvedValue({}),
            },
            school: {
                findById: jest.fn(),
            },
            counter: {
                findOneAndUpdate: jest.fn(),
            },
        };

        mockValidators = {
            student: {
                createStudent: jest.fn().mockResolvedValue(null),
                updateStudent: jest.fn().mockResolvedValue(null),
            },
        };

        student = new Student({
            mongomodels: mockMongomodels,
            validators:  mockValidators,
        });
    });

    // _getStudent

    describe('_getStudent', () => {
        it('should return 404 if student does not exist', async () => {
            mockMongomodels.student.findById.mockResolvedValue(null);

            const result = await student._getStudent({ studentId: 'stud1' });

            expect(result).toEqual({ error: 'student_not_found', code: 404 });
        });

        it('should return 404 if student is soft deleted', async () => {
            mockMongomodels.student.findById.mockResolvedValue({ _id: 'stud1', deletedAt: new Date() });

            const result = await student._getStudent({ studentId: 'stud1' });

            expect(result).toEqual({ error: 'student_not_found', code: 404 });
        });

        it('should return student if found and not deleted', async () => {
            const mockStudent = { _id: 'stud1', firstname: 'Alice', deletedAt: null };
            mockMongomodels.student.findById.mockResolvedValue(mockStudent);

            const result = await student._getStudent({ studentId: 'stud1' });

            expect(result).toEqual({ student: mockStudent });
        });
    });

    // _nextStudentNumber

    describe('_nextStudentNumber', () => {
        it('should call counter with entity "student", the school code as key, and current year', async () => {
            const year = new Date().getFullYear();
            mockMongomodels.counter.findOneAndUpdate.mockResolvedValue({ seq: 1 });

            await student._nextStudentNumber({ schoolCode: 'GWH' });

            expect(mockMongomodels.counter.findOneAndUpdate).toHaveBeenCalledWith(
                { entity: 'student', key: 'GWH', year },
                { $inc: { seq: 1 } },
                { upsert: true, new: true },
            );
        });

        it('should return a student number formatted as schoolCode-year-paddedSeq', async () => {
            const year = new Date().getFullYear();
            mockMongomodels.counter.findOneAndUpdate.mockResolvedValue({ seq: 7 });

            const result = await student._nextStudentNumber({ schoolCode: 'GWH' });

            expect(result).toBe(`GWH-${year}-0007`);
        });

        it('should pad sequence numbers beyond 4 digits without truncation', async () => {
            const year = new Date().getFullYear();
            mockMongomodels.counter.findOneAndUpdate.mockResolvedValue({ seq: 10000 });

            const result = await student._nextStudentNumber({ schoolCode: 'GWH' });

            expect(result).toBe(`GWH-${year}-10000`);
        });
    });

    // createStudent

    describe('createStudent', () => {
        const payload = {
            __token:     superadminToken,
            __role:      'superadmin',
            schoolId:    'sid1',
            classroomId: 'cid1',
            firstname:   'Alice',
            lastname:    'Smith',
            email:       'alice@school.com',
        };

        beforeEach(() => {
            mockMongomodels.school.findById.mockResolvedValue({ _id: 'sid1', code: 'GWH' });
            mockMongomodels.counter.findOneAndUpdate.mockResolvedValue({ seq: 1 });
        });

        it('should return 403 if school admin tries to create a student in a school they do not own', async () => {
            const result = await student.createStudent({
                ...payload,
                __token: { userId: 'admin2', role: 'schoolAdmin', school: 'sid2' },
                __role:  'schoolAdmin',
            });

            expect(result).toEqual({ error: 'forbidden', code: 403 });
            expect(mockMongomodels.student.create).not.toHaveBeenCalled();
        });

        it('should return validation errors if validation fails', async () => {
            mockValidators.student.createStudent.mockResolvedValue([{ field: 'email', message: 'invalid' }]);

            const result = await student.createStudent(payload);

            expect(result.errors).toBeDefined();
            expect(result.message).toBe('request_validation_error');
            expect(mockMongomodels.student.create).not.toHaveBeenCalled();
        });

        it('should look up the school to get its code for the student number', async () => {
            mockMongomodels.student.create.mockResolvedValue({ _id: 'stud1' });

            await student.createStudent(payload);

            expect(mockMongomodels.school.findById).toHaveBeenCalledWith(payload.schoolId);
        });

        it('should create student with generated studentNumber in schoolCode-year-seq format', async () => {
            const year = new Date().getFullYear();
            mockMongomodels.student.create.mockResolvedValue({ _id: 'stud1', ...payload });

            await student.createStudent(payload);

            expect(mockMongomodels.student.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    studentNumber: `GWH-${year}-0001`,
                    firstname:     payload.firstname,
                    lastname:      payload.lastname,
                    email:         payload.email,
                    school:        payload.schoolId,
                    classroom:     payload.classroomId,
                })
            );
        });

        it('should return the created student on success', async () => {
            const created = { _id: 'stud1', firstname: payload.firstname, email: payload.email };
            mockMongomodels.student.create.mockResolvedValue(created);

            const result = await student.createStudent(payload);

            expect(result).toEqual({ student: created });
        });
    });

    // getStudents

    describe('getStudents', () => {
        const pagination = { page: 1, limit: 20, skip: 0 };

        beforeEach(() => {
            mockMongomodels.student.find.mockReturnValue({
                skip:  jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([]),
            });
            mockMongomodels.student.countDocuments.mockResolvedValue(0);
        });

        it('should return 403 if school admin requests students for a school they do not own', async () => {
            const result = await student.getStudents({
                __token:      { userId: 'admin2', role: 'schoolAdmin', school: 'sid2' },
                __role:       'schoolAdmin',
                __pagination: pagination,
                schoolId:     'sid1',
            });

            expect(result).toEqual({ error: 'forbidden', code: 403 });
            expect(mockMongomodels.student.find).not.toHaveBeenCalled();
        });

        it('should query only non-soft-deleted students for the given school', async () => {
            await student.getStudents({
                __token: superadminToken, __role: 'superadmin', __pagination: pagination, schoolId: 'sid1',
            });

            expect(mockMongomodels.student.find).toHaveBeenCalledWith({ school: 'sid1', deletedAt: null });
        });

        it('should apply skip and limit from __pagination', async () => {
            const chainMock = { skip: jest.fn().mockReturnThis(), limit: jest.fn().mockResolvedValue([]) };
            mockMongomodels.student.find.mockReturnValue(chainMock);

            await student.getStudents({
                __token: superadminToken, __role: 'superadmin',
                __pagination: { page: 2, limit: 10, skip: 10 },
                schoolId: 'sid1',
            });

            expect(chainMock.skip).toHaveBeenCalledWith(10);
            expect(chainMock.limit).toHaveBeenCalledWith(10);
        });

        it('should return students, total, page, and limit', async () => {
            const mockStudents = [{ _id: 'stud1', firstname: 'Alice' }];
            mockMongomodels.student.find.mockReturnValue({
                skip:  jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue(mockStudents),
            });
            mockMongomodels.student.countDocuments.mockResolvedValue(1);

            const result = await student.getStudents({
                __token: superadminToken, __role: 'superadmin', __pagination: pagination, schoolId: 'sid1',
            });

            expect(result).toEqual({ students: mockStudents, total: 1, page: 1, limit: 20 });
        });
    });

    // getStudent

    describe('getStudent', () => {
        it('should return 404 if student does not exist', async () => {
            mockMongomodels.student.findById.mockResolvedValue(null);

            const result = await student.getStudent({
                __token: superadminToken, __role: 'superadmin', studentId: 'stud1',
            });

            expect(result).toEqual({ error: 'student_not_found', code: 404 });
        });

        it('should return 403 if school admin requests a student from another school', async () => {
            mockMongomodels.student.findById.mockResolvedValue({ _id: 'stud1', school: 'sid2', deletedAt: null });

            const result = await student.getStudent({
                __token: schoolAdminToken, __role: 'schoolAdmin', studentId: 'stud1',
            });

            expect(result).toEqual({ error: 'forbidden', code: 403 });
        });

        it('should return student if school admin requests one from their own school', async () => {
            const mockStudent = { _id: 'stud1', firstname: 'Alice', school: 'sid1', deletedAt: null };
            mockMongomodels.student.findById.mockResolvedValue(mockStudent);

            const result = await student.getStudent({
                __token: schoolAdminToken, __role: 'schoolAdmin', studentId: 'stud1',
            });

            expect(result).toEqual({ student: mockStudent });
        });

        it('should return student for superadmin regardless of school', async () => {
            const mockStudent = { _id: 'stud1', firstname: 'Alice', school: 'sid1', deletedAt: null };
            mockMongomodels.student.findById.mockResolvedValue(mockStudent);

            const result = await student.getStudent({
                __token: superadminToken, __role: 'superadmin', studentId: 'stud1',
            });

            expect(result).toEqual({ student: mockStudent });
        });
    });

    // updateStudent

    describe('updateStudent', () => {
        const payload = {
            __token:     superadminToken,
            __role:      'superadmin',
            studentId:   'stud1',
            firstname:   'Alice Updated',
            classroomId: 'cid2',
        };

        it('should return 404 if student does not exist', async () => {
            mockMongomodels.student.findById.mockResolvedValue(null);

            const result = await student.updateStudent(payload);

            expect(result).toEqual({ error: 'student_not_found', code: 404 });
            expect(mockMongomodels.student.findByIdAndUpdate).not.toHaveBeenCalled();
        });

        it('should return 403 if school admin tries to update a student from another school', async () => {
            mockMongomodels.student.findById.mockResolvedValue({ _id: 'stud1', school: 'sid2', deletedAt: null });

            const result = await student.updateStudent({
                ...payload,
                __token: schoolAdminToken,
                __role:  'schoolAdmin',
            });

            expect(result).toEqual({ error: 'forbidden', code: 403 });
            expect(mockMongomodels.student.findByIdAndUpdate).not.toHaveBeenCalled();
        });

        it('should return validation errors if validation fails', async () => {
            mockMongomodels.student.findById.mockResolvedValue({ _id: 'stud1', school: 'sid1', deletedAt: null });
            mockValidators.student.updateStudent.mockResolvedValue([{ field: 'email', message: 'invalid' }]);

            const result = await student.updateStudent(payload);

            expect(result.errors).toBeDefined();
            expect(result.message).toBe('request_validation_error');
            expect(mockMongomodels.student.findByIdAndUpdate).not.toHaveBeenCalled();
        });

        it('should call findByIdAndUpdate with only the provided fields', async () => {
            mockMongomodels.student.findById.mockResolvedValue({ _id: 'stud1', school: 'sid1', deletedAt: null });
            mockMongomodels.student.findByIdAndUpdate.mockResolvedValue({ _id: 'stud1', ...payload });

            await student.updateStudent(payload);

            expect(mockMongomodels.student.findByIdAndUpdate).toHaveBeenCalledWith(
                'stud1',
                expect.objectContaining({ firstname: payload.firstname, classroom: payload.classroomId }),
                expect.objectContaining({ new: true }),
            );
        });

        it('should return the updated student on success', async () => {
            const updated = { _id: 'stud1', firstname: payload.firstname };
            mockMongomodels.student.findById.mockResolvedValue({ _id: 'stud1', school: 'sid1', deletedAt: null });
            mockMongomodels.student.findByIdAndUpdate.mockResolvedValue(updated);

            const result = await student.updateStudent(payload);

            expect(result).toEqual({ student: updated });
        });
    });

    // deleteStudent

    describe('deleteStudent', () => {
        it('should return 404 if student does not exist', async () => {
            mockMongomodels.student.findById.mockResolvedValue(null);

            const result = await student.deleteStudent({
                __token: superadminToken, __role: 'superadmin', studentId: 'stud1',
            });

            expect(result).toEqual({ error: 'student_not_found', code: 404 });
            expect(mockMongomodels.student.findByIdAndUpdate).not.toHaveBeenCalled();
        });

        it('should return 403 if school admin tries to delete a student from another school', async () => {
            mockMongomodels.student.findById.mockResolvedValue({ _id: 'stud1', school: 'sid2', deletedAt: null });

            const result = await student.deleteStudent({
                __token: schoolAdminToken, __role: 'schoolAdmin', studentId: 'stud1',
            });

            expect(result).toEqual({ error: 'forbidden', code: 403 });
            expect(mockMongomodels.student.findByIdAndUpdate).not.toHaveBeenCalled();
        });

        it('should soft delete the student', async () => {
            mockMongomodels.student.findById.mockResolvedValue({ _id: 'stud1', school: 'sid1', deletedAt: null });

            await student.deleteStudent({
                __token: superadminToken, __role: 'superadmin', studentId: 'stud1',
            });

            expect(mockMongomodels.student.findByIdAndUpdate).toHaveBeenCalledWith(
                'stud1',
                expect.objectContaining({ deletedAt: expect.any(Date) }),
            );
        });

        it('should return success on deletion', async () => {
            mockMongomodels.student.findById.mockResolvedValue({ _id: 'stud1', school: 'sid1', deletedAt: null });

            const result = await student.deleteStudent({
                __token: superadminToken, __role: 'superadmin', studentId: 'stud1',
            });

            expect(result).toEqual({ success: true });
        });
    });
});
