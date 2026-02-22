const { ROLES } = require('../../_common/enums');

module.exports = class School {

    constructor({ utils, cache, config, cortex, managers, validators, mongomodels } = {}) {
        this.config           = config;
        this.cortex           = cortex;
        this.mongomodels      = mongomodels;
        this.schoolValidators = validators.school;
        this.httpExposed      = [
            'post=createSchool',
            'get=getSchool',
            'put=updateSchool',
            'delete=deleteSchool',
            'post=createSchoolAdmin',
        ];
        this.roles = {
            createSchool:      [ROLES.SUPERADMIN],
            getSchool:         [ROLES.SUPERADMIN],
            updateSchool:      [ROLES.SUPERADMIN],
            deleteSchool:      [ROLES.SUPERADMIN],
            createSchoolAdmin: [ROLES.SUPERADMIN],
        };
    }

    async _getSchool({ schoolId }) {
        const school = await this.mongomodels.school.findById(schoolId);
        if (!school) return { error: 'school_not_found', code: 404 };
        return { school };
    }

    async createSchool({ __token, __role, name, code, address, phone, email, maxCapacity }) {
        const validationErrors = await this.schoolValidators.createSchool({ name, code, address, phone, email, maxCapacity });
        if (validationErrors) return { errors: validationErrors, message: 'request_validation_error' };

        const created = await this.mongomodels.school.create({ name, code, address, phone, email, maxCapacity, createdBy: __token.userId });
        return { school: created };
    }

    async getSchool({ __token, __role, schoolId }) {
        const { error, code, school } = await this._getSchool({ schoolId });
        if (error) return { error, code };
        return { school };
    }

    async updateSchool({ __token, __role, schoolId, name, code, address, phone, email, maxCapacity }) {
        const lookup = await this._getSchool({ schoolId });
        if (lookup.error) return { error: lookup.error, code: lookup.code };

        const validationErrors = await this.schoolValidators.updateSchool({ name, code, address, phone, email, maxCapacity });
        if (validationErrors) return { errors: validationErrors, message: 'request_validation_error' };

        const updates = {};
        if (name        !== undefined) updates.name        = name;
        if (code        !== undefined) updates.code        = code;
        if (address     !== undefined) updates.address     = address;
        if (phone       !== undefined) updates.phone       = phone;
        if (email       !== undefined) updates.email       = email;
        if (maxCapacity !== undefined) updates.maxCapacity = maxCapacity;

        const updated = await this.mongomodels.school.findByIdAndUpdate(schoolId, updates, { new: true });
        return { school: updated };
    }

    async deleteSchool({ __token, __role, schoolId }) {
        const lookup = await this._getSchool({ schoolId });
        if (lookup.error) return { error: lookup.error, code: lookup.code };

        await this.mongomodels.school.findByIdAndDelete(schoolId);
        return { success: true };
    }

    async createSchoolAdmin({ __token, __role, schoolId, firstname, lastname, email, password }) {
        const lookup = await this._getSchool({ schoolId });
        if (lookup.error) return { error: lookup.error, code: lookup.code };

        const validationErrors = await this.schoolValidators.createSchoolAdmin({ firstname, lastname, email, password });
        if (validationErrors) return { errors: validationErrors, message: 'request_validation_error' };

        const created = await this.mongomodels.user.create({ firstname, lastname, email, password, role: ROLES.SCHOOL_ADMIN, school: schoolId });
        const { password: _, ...sanitizedUser } = created.toObject ? created.toObject() : created;
        return { user: sanitizedUser };
    }

}
