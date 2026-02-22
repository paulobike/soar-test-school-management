'use strict';

const AuditLog = require('../managers/entities/auditLog/AuditLog.manager');
const { AUDIT_ACTIONS, AUDIT_RESOURCES } = require('../managers/_common/enums');

describe('AuditLog.manager', () => {

    let auditLog;
    let mockMongomodels;

    beforeEach(() => {
        mockMongomodels = {
            auditLog: {
                create: jest.fn(),
            },
        };

        auditLog = new AuditLog({ mongomodels: mockMongomodels });
    });

    describe('log()', () => {

        it('should call mongomodels.auditLog.create with provided fields', async () => {
            mockMongomodels.auditLog.create.mockResolvedValue({});

            await auditLog.log({
                actor:      'uid1',
                action:     AUDIT_ACTIONS.CREATE,
                resource:   AUDIT_RESOURCES.SCHOOL,
                resourceId: 'sid1',
                changes:    { before: null, after: { name: 'Test School' } },
            });

            expect(mockMongomodels.auditLog.create).toHaveBeenCalledWith({
                actor:      'uid1',
                action:     AUDIT_ACTIONS.CREATE,
                resource:   AUDIT_RESOURCES.SCHOOL,
                resourceId: 'sid1',
                changes:    { before: null, after: { name: 'Test School' } },
            });
        });

        it('should default changes to empty object when not provided', async () => {
            mockMongomodels.auditLog.create.mockResolvedValue({});

            await auditLog.log({
                actor:      'uid1',
                action:     AUDIT_ACTIONS.DELETE,
                resource:   AUDIT_RESOURCES.CLASSROOM,
                resourceId: 'cid1',
            });

            expect(mockMongomodels.auditLog.create).toHaveBeenCalledWith(
                expect.objectContaining({ changes: {} })
            );
        });

        it('should not throw if mongomodels.auditLog.create fails', async () => {
            mockMongomodels.auditLog.create.mockRejectedValue(new Error('DB error'));

            await expect(
                auditLog.log({
                    actor:      'uid1',
                    action:     AUDIT_ACTIONS.UPDATE,
                    resource:   AUDIT_RESOURCES.STUDENT,
                    resourceId: 'stid1',
                })
            ).resolves.not.toThrow();
        });

        it('should support all defined audit actions', async () => {
            mockMongomodels.auditLog.create.mockResolvedValue({});

            for (const action of Object.values(AUDIT_ACTIONS)) {
                await auditLog.log({
                    actor:      'uid1',
                    action,
                    resource:   AUDIT_RESOURCES.TRANSFER_REQUEST,
                    resourceId: 'rid1',
                });
            }

            expect(mockMongomodels.auditLog.create).toHaveBeenCalledTimes(
                Object.values(AUDIT_ACTIONS).length
            );
        });

        it('should support all defined audit resources', async () => {
            mockMongomodels.auditLog.create.mockResolvedValue({});

            for (const resource of Object.values(AUDIT_RESOURCES)) {
                await auditLog.log({
                    actor:      'uid1',
                    action:     AUDIT_ACTIONS.CREATE,
                    resource,
                    resourceId: 'rid1',
                });
            }

            expect(mockMongomodels.auditLog.create).toHaveBeenCalledTimes(
                Object.values(AUDIT_RESOURCES).length
            );
        });

    });

});
