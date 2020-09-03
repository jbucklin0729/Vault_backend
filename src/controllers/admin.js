/* eslint-disable indent */
const cryptoRandomString = require('crypto-random-string');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const Boom = require('boom');
const Ajv = require('ajv');
const code = require('http-status-codes');
const path = require('path');
const logger = require('../config/winston');
const message = require('../constants/messages');
const schema = require('../utils/validators/adminValidator');
const responseFormat = require('../utils/responseFormat');


const AdminModel = require('../models/admin');
const TokenModel = require('../models/token');

const saltRounds = bcrypt.genSaltSync(10);
dotenv.config();

const { JWT_SECRET: secret } = process.env;


const ajv = Ajv({ allErrors: true, $data: true });
require('ajv-errors')(ajv);


class Admin {
    /**
     *
     * @description Delete all documents in the Admin collection. It's just for testing purposes :)
     * @static
     * @param {*} req
     * @param {*} res
     * @returns
     * @memberof User
     */
    static async blowAllAway(req, res) {
        try {
            let data = {};
            const deleteAdmin = await AdminModel.deleteMany({});
            if (deleteAdmin) {
                data = {
                    res,
                    status: message.SUCCESS,
                    statusCode: code.OK,
                    data: {
                        message: message.OPERATION_SUCCESS,
                    },
                };
                return responseFormat.handleSuccess(res, data);
            }
        } catch (err) {
            // logger.error(err);
            const { output } = Boom.badImplementation();
            output.payload.message = err.message;
            return responseFormat.handleError(res, output);
        }
    }

    /**
     *
     * @description Register an admin
     * @static
     * @param {object} req Request object
     * @param {object} res REsponse object
     * @returns {object} An object that contains a successful message
     * @memberof Admin
     */
    static async register(req, res) {
        const validate = ajv.compile(schema.adminRegistration);
        let data = {};

        // Validate the request or query params
        const valid_schema = validate(req.body);
        if (!valid_schema) {
            logger.error('Ajv Validation Error: %o', ajv.errorsText(validate.errors));
            const { output } = Boom.badRequest(ajv.errorsText(validate.errors));
            return responseFormat.handleError(res, output);
        }

        const {
            email,
            password,
        } = req.body;
        const hash = await bcrypt.hash(password, saltRounds);

        try {
            const foundAdmin = await AdminModel.findOne({ email }).lean();

            if (foundAdmin) {
                // check if admin aleady exist
                logger.error(message.EMAIL_EXIST);
                const { output } = Boom.conflict();
                output.payload.message = message.EMAIL_EXIST;
                return responseFormat.handleError(res, output);
            }
            const newUser = await AdminModel.create({
                email,
                password: hash,
            });
            data = {
                res,
                status: message.SUCCESS,
                statusCode: code.CREATED,
                data: {
                    message: message.OPERATION_SUCCESS,
                },
            };
            return responseFormat.handleSuccess(res, data);
        } catch (err) {
            logger.error(err);
            const { output } = Boom.badImplementation();
            output.payload.message = err.message;
            return responseFormat.handleError(res, output);
        }
    }

    /**
     *
     * @description Login admin
     * @static
     * @param {*} req Request object
     * @param {*} res Response object
     * @returns {object} An object with a message and signed token
     * @memberof User
     */
    static async login(req, res) {
        const { email, password } = req.body;
        const validate = ajv.compile(schema.adminLogin);
        let data = {};

        // Validate the request or query params
        const valid_schema = validate(req.body);
        if (!valid_schema) {
            logger.error('Ajv Validation Error: %o', ajv.errorsText(validate.errors));
            const { output } = Boom.badRequest(ajv.errorsText(validate.errors));
            return responseFormat.handleError(res, output);
        }
        try {
            const admin = await AdminModel.findOne({ email }).lean();
            if (admin) {
                const match = await bcrypt.compare(password, admin.password);
                if (match) {
                    const token = jwt.sign({
                            id: admin._id,
                            email: admin.email,
                        },
                        secret, { expiresIn: '24h' });
                    data = {
                        res,
                        status: message.SUCCESS,
                        statusCode: code.OK,
                        data: {
                            message: 'You are logged in',
                            token,
                        },
                    };
                    return responseFormat.handleSuccess(res, data);
                }
                logger.error(message.WRONG_USERNAME_PASSWORD);
                const { output } = Boom.preconditionFailed();
                output.payload.message = message.WRONG_USERNAME_PASSWORD;
                return responseFormat.handleError(res, output);
            }
            logger.error(message.ACCOUNT_NOT_FOUND);
            const { output } = Boom.badRequest();
            output.payload.message = message.ACCOUNT_NOT_FOUND;
            return responseFormat.handleError(res, output);
        } catch (err) {
            logger.error('Admin Login Error: %o', err);
            const { output } = Boom.badImplementation();
            output.payload.message = err.message;
            return responseFormat.handleError(res, output);
        }
    }


    /**
     *
     *@description Get admin's profile details
     * @static
     * @param {*} req
     * @param {*} res
     * @returns
     * @memberof User
     */
    static async profile(req, res) {
        const _id = req.admin.id;
        try {
            let data = {};
            const profile = await AdminModel.findOne({ _id }).lean();
            data = {
                res,
                status: message.SUCCESS,
                statusCode: code.OK,
                data: {
                    profile: {
                        _id: profile._id,
                        email: profile.email,
                    },
                },
            };
            return responseFormat.handleSuccess(res, data);
        } catch (err) {
            logger.error('Admin profile error: %o', err);
            const { output } = Boom.badImplementation();
            output.payload.message = 'Admin profile error';
            return responseFormat.handleError(res, output);
        }
    }

    /**
     *
     * @description Add a token
     * @static
     * @param {object} req Request object
     * @param {object} res REsponse object
     * @returns {object} An object that contains a successful message
     * @memberof Admin
     */
    static async addToken(req, res) {
        const validate = ajv.compile(schema.addToken);
        let data = {};

        // Validate the request or query params
        const valid_schema = validate(req.body);
        if (!valid_schema) {
            logger.error('Ajv Validation Error: %o', ajv.errorsText(validate.errors));
            const { output } = Boom.badRequest(ajv.errorsText(validate.errors));
            return responseFormat.handleError(res, output);
        }

        const {
            name,
            symbol,
        } = req.body;

        try {
            const foundToken = await TokenModel.findOne({ name }).lean();

            if (foundToken) {
                // check if admin aleady exist
                logger.error(message.TOKEN_EXIST);
                const { output } = Boom.conflict();
                output.payload.message = message.TOKEN_EXIST;
                return responseFormat.handleError(res, output);
            }
            const newToken = await TokenModel.create({
                name,
                symbol
            });
            data = {
                res,
                status: message.SUCCESS,
                statusCode: code.CREATED,
                data: {
                    message: message.OPERATION_SUCCESS,
                },
            };
            return responseFormat.handleSuccess(res, data);
        } catch (err) {
            logger.error(err);
            const { output } = Boom.badImplementation();
            output.payload.message = err.message;
            return responseFormat.handleError(res, output);
        }
    }


    /**
     *
     *@description Get list of added tokens
     * @static
     * @param {*} req
     * @param {*} res
     * @returns
     * @memberof Admin
     */
    static async listTokens(req, res) {
        try {
            let data = {};
            const tokens = await TokenModel.find({}).lean();
            data = {
                res,
                status: message.SUCCESS,
                statusCode: code.OK,
                data: {
                    tokens
                },
            };
            return responseFormat.handleSuccess(res, data);
        } catch (err) {
            logger.error('List tokens error: %o', err);
            const { output } = Boom.badImplementation();
            output.payload.message = 'List tokens error';
            return responseFormat.handleError(res, output);
        }
    }

    /**
     *
     *@description Remove token
     * @static
     * @param {*} req
     * @param {*} res
     * @returns
     * @memberof Admin
     */
    static async removeToken(req, res) {
        const token_id = req.params.token_id;
        try {
            let data = {};
            const findToken = await TokenModel.findById(token_id).lean();
            if (findToken) {
                await TokenModel.deleteOne({ _id: token_id });
                data = {
                    res,
                    status: message.SUCCESS,
                    statusCode: code.OK,
                    data: {
                        message: message.OPERATION_SUCCESS
                    },
                };
                return responseFormat.handleSuccess(res, data);
            }
            logger.error(message.TOKEN_NOT_FOUND);
            const { output } = Boom.badRequest();
            output.payload.message = message.TOKEN_NOT_FOUND;
            return responseFormat.handleError(res, output);
        } catch (err) {
            logger.error('Remove token error: %o', err);
            const { output } = Boom.badImplementation();
            output.payload.message = 'Remove token error';
            return responseFormat.handleError(res, output);
        }
    }

    /**
     *
     *@description Update token
     * @static
     * @param {*} req
     * @param {*} res
     * @returns
     * @memberof Admin
     */
    static async updateToken(req, res) {
        const token_id = req.params.token_id;
        const validate = ajv.compile(schema.updateToken);
        let data = {};

        // Validate the request or query params
        const valid_schema = validate(req.body);
        if (!valid_schema) {
            logger.error('Ajv Validation Error: %o', ajv.errorsText(validate.errors));
            const { output } = Boom.badRequest(ajv.errorsText(validate.errors));
            return responseFormat.handleError(res, output);
        }

        try {
            const { name, symbol } = req.body;
            const findToken = await TokenModel.findById(token_id).lean();
            if (findToken) {
                await TokenModel.updateOne({ _id: token_id }, { name, symbol });
                data = {
                    res,
                    status: message.SUCCESS,
                    statusCode: code.OK,
                    data: {
                        message: message.OPERATION_SUCCESS
                    },
                };
                return responseFormat.handleSuccess(res, data);
            }
            logger.error(message.TOKEN_NOT_FOUND);
            const { output } = Boom.badRequest();
            output.payload.message = message.TOKEN_NOT_FOUND;
            return responseFormat.handleError(res, output);
        } catch (err) {
            logger.error('Update token error: %o', err);
            const { output } = Boom.badImplementation();
            output.payload.message = 'Update token error';
            return responseFormat.handleError(res, output);
        }
    }
}

module.exports = Admin;