module.exports = {
    getTransferRequests: [],
    createTransferRequest: [
        { model: 'studentNumber', required: true },
        { model: 'toSchoolId',    required: true },
        { model: 'toClassroomId' },
    ],
    getTransferRequest: [
        { model: 'requestId', required: true, in: 'path' },
    ],
    approveTransferRequest: [
        { model: 'requestId', required: true },
    ],
    rejectTransferRequest: [
        { model: 'requestId', required: true },
    ],
};
