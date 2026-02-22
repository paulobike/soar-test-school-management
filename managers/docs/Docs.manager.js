const loader       = require('../../loaders/_common/fileLoader');
const schemaModels = require('../_common/schema.models');

const AUTH_MIDDLEWARES = {
    '__shortToken': 'bearerAuth',
    '__token':      'bearerAuth',
};

const QUERY_PARAM_MIDDLEWARES = {
    '__pagination': [
        { name: 'page',  schema: { type: 'integer', default: 1,  minimum: 1 } },
        { name: 'limit', schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 } },
    ],
};

module.exports = class DocsManager {

    constructor({ config, managers, responses }) {
        this.config    = config;
        this.userApi   = managers.userApi;
        this.responses = responses || {};
        this.spec      = this._generate();
    }

    _loadSchemas() {
        return loader('./managers/**/*.schema.js');
    }

    _modelToProperty(modelDef) {
        if (!modelDef) return { type: 'string' };

        const type = (modelDef.type || 'string').toLowerCase();
        const prop = {};

        if (type === 'array') {
            prop.type  = 'array';
            prop.items = modelDef.items ? this._modelToProperty(modelDef.items) : { type: 'string' };
        } else if (type === 'object') {
            prop.type = 'object';
        } else if (type === 'boolean') {
            prop.type = 'boolean';
        } else if (type === 'number') {
            prop.type = 'number';
        } else {
            prop.type = 'string';
        }

        if (modelDef.length) {
            if (typeof modelDef.length === 'number') {
                prop.maxLength = modelDef.length;
            } else {
                if (modelDef.length.min !== undefined) prop.minLength = modelDef.length.min;
                if (modelDef.length.max !== undefined) prop.maxLength = modelDef.length.max;
            }
        }

        if (modelDef.regex) prop.pattern = modelDef.regex.source;
        if (modelDef.oneOf) prop.enum    = modelDef.oneOf;
        if (modelDef.description) prop.description = modelDef.description;

        const examples = { string: 'string', number: 0, boolean: true, array: [] };
        prop.example = examples[prop.type] ?? 'string';


        return prop;
    }

    /** Converts a *.res.js field definition to an OpenAPI property */
    _resFieldToProperty(fieldDef) {
        // { model: 'x' } — reference schema.models.js
        if (fieldDef.model) {
            return this._modelToProperty(schemaModels[fieldDef.model]);
        }

        // { type: 'string' | 'number' | 'boolean' | 'array' } — inline primitive
        if (fieldDef.type) {
            const type = fieldDef.type.toLowerCase();
            if (type === 'array') {
                return {
                    type:  'array',
                    items: fieldDef.items ? this._resFieldToProperty(fieldDef.items) : { type: 'string' },
                };
            }
            return { type };
        }

        // plain object — nested response model
        const properties = {};
        Object.keys(fieldDef).forEach(key => {
            properties[key] = this._resFieldToProperty(fieldDef[key]);
        });
        return { type: 'object', properties };
    }

    /** Builds the OpenAPI schema for the `data` envelope field from a response model */
    _buildDataSchema(moduleName, fnName) {
        const moduleRes = this.responses[moduleName];
        if (!moduleRes || !moduleRes[fnName]) return { type: 'object' };

        const properties = {};
        Object.keys(moduleRes[fnName]).forEach(key => {
            properties[key] = this._resFieldToProperty(moduleRes[fnName][key]);
        });

        return { type: 'object', properties };
    }

    _buildRequestBody(moduleName, fnName, schemas) {
        const moduleSchema = schemas[moduleName];
        if (!moduleSchema || !moduleSchema[fnName]) return null;

        const properties = {};
        const required   = [];

        moduleSchema[fnName].forEach(field => {
            const modelDef  = schemaModels[field.model];
            const fieldName = (modelDef && modelDef.path) ? modelDef.path : field.model;
            properties[fieldName] = this._modelToProperty(modelDef);
            if (field.required) required.push(fieldName);
        });

        return {
            required: true,
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        properties,
                        ...(required.length ? { required } : {}),
                    }
                }
            }
        };
    }

    _getSecurityReqs(mwStack) {
        const seen = new Set();
        return (mwStack || []).reduce((acc, mw) => {
            const scheme = AUTH_MIDDLEWARES[mw];
            if (scheme && !seen.has(scheme)) {
                seen.add(scheme);
                acc.push({ [scheme]: [] });
            }
            return acc;
        }, []);
    }

    _buildQueryParams(moduleName, fnName, schemas, mwStack) {
        const params = [];

        // middleware-contributed params (e.g. __pagination)
        (mwStack || []).forEach(mw => {
            const mwParams = QUERY_PARAM_MIDDLEWARES[mw];
            if (mwParams) {
                mwParams.forEach(p => params.push({ in: 'query', name: p.name, schema: p.schema }));
            }
        });

        // schema-defined params
        const moduleSchema = schemas[moduleName];
        if (moduleSchema && moduleSchema[fnName]) {
            moduleSchema[fnName].forEach(field => {
                const modelDef  = schemaModels[field.model];
                const fieldName = (modelDef && modelDef.path) ? modelDef.path : field.model;
                params.push({
                    in:       'query',
                    name:     fieldName,
                    required: field.required || false,
                    schema:   this._modelToProperty(modelDef),
                });
            });
        }

        return params;
    }

    _generate() {
        const { methodMatrix, mwsStack } = this.userApi;
        const schemas = this._loadSchemas();
        const paths   = {};

        Object.keys(methodMatrix).forEach(moduleName => {
            Object.keys(methodMatrix[moduleName]).forEach(httpMethod => {
                methodMatrix[moduleName][httpMethod].forEach(fnName => {
                    const pathKey    = `/api/${moduleName}/${fnName}`;
                    const stackKey   = `${moduleName}.${fnName}`;
                    const security   = this._getSecurityReqs(mwsStack[stackKey]);
                    const requestBody = httpMethod !== 'get'
                        ? this._buildRequestBody(moduleName, fnName, schemas)
                        : undefined;
                    const parameters = httpMethod === 'get'
                        ? this._buildQueryParams(moduleName, fnName, schemas, mwsStack[stackKey])
                        : undefined;

                    if (!paths[pathKey]) paths[pathKey] = {};

                    paths[pathKey][httpMethod] = {
                        tags:    [moduleName],
                        summary: fnName,
                        ...(security.length ? { security }    : {}),
                        ...(requestBody     ? { requestBody } : {}),
                        ...(parameters && parameters.length ? { parameters } : {}),
                        responses: {
                            '200': {
                                description: 'Success',
                                content: {
                                    'application/json': {
                                        schema: {
                                            type: 'object',
                                            properties: {
                                                ok:      { type: 'boolean', example: true },
                                                data:    this._buildDataSchema(moduleName, fnName),
                                                errors:  { type: 'array', items: { type: 'string' } },
                                                message: { type: 'string' },
                                            }
                                        }
                                    }
                                }
                            },
                            '400': { description: 'Bad Request' },
                            '401': { description: 'Unauthorized' },
                        }
                    };
                });
            });
        });

        return {
            openapi: '3.0.0',
            info: {
                title:       this.config.dotEnv.SERVICE_NAME,
                version:     '1.0.0',
                description: `Auto-generated API docs for ${this.config.dotEnv.SERVICE_NAME}`,
            },
            servers: [
                { url: this.config.dotEnv.SERVICE_URL }
            ],
            components: {
                securitySchemes: {
                    bearerAuth: {
                        type:         'http',
                        scheme:       'bearer',
                        bearerFormat: 'JWT',
                        description:  'Short-lived JWT — obtain via POST /api/auth/login',
                    },
                }
            },
            paths,
        };
    }
}
