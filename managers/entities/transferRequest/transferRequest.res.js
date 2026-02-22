const transferRequest = {
    _id:         { model: 'id' },
    student:     { model: 'id' },
    fromSchool:  { model: 'id' },
    toSchool:    { model: 'id' },
    toClassroom: { model: 'id' },
    requestedBy: { model: 'id' },
    status:      { type: 'string' },
    respondedBy: { model: 'id' },
    respondedAt: { type: 'string' },
    snapshot: {
        firstname:     { type: 'string' },
        lastname:      { type: 'string' },
        email:         { type: 'string' },
        studentNumber: { type: 'string' },
        classroom:     { type: 'string' },
    },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
};

module.exports = {
    getTransferRequests: {
        transferRequests: { type: 'array', items: transferRequest },
        total:            { type: 'number' },
        page:             { type: 'number' },
        limit:            { type: 'number' },
    },
    createTransferRequest:  { transferRequest },
    getTransferRequest:     { transferRequest },
    approveTransferRequest: { transferRequest },
    rejectTransferRequest:  { transferRequest },
};
