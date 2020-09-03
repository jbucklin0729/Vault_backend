/* eslint-disable indent */
const { of } = require('await-of');
const dotenv = require('dotenv');
const Boom = require('boom');
const raindrop = require('@hydrogenplatform/raindrop');
const logger = require('../config/winston');
const code = require('../constants/codes');
const message = require('../constants/messages');
const responseFormat = require('../utils/responseFormat');
const schema = require('../utils/validators/userValidators');

const RaindropModel = require('../models/raindrop');
const UserModel = require('../models/user');

dotenv.config();

const {
    HYDRO_ENV,
    RAINDROP_CLIENT_ID,
    RAINDROP_CLIENT_SECRET,
    RAINDROP_APPLICATION_ID,
} = process.env;

const Ajv = require('ajv');

const ajv = Ajv({ allErrors: true });

// Raindrop config
const clientRaindropPartner = new raindrop.client.RaindropPartner({
    environment: HYDRO_ENV,
    clientId: RAINDROP_CLIENT_ID,
    clientSecret: RAINDROP_CLIENT_SECRET,
    applicationId: RAINDROP_APPLICATION_ID,
});

class Raindrop {
    /**
     *
     * @description Get the Hydro Information of the logged user
     * @static
     * @param {*} req object that contains logged in username
     * @param {*} res
     * @returns {object} Object with the Hydro Information
     * @memberof Raindrop
     */
    static async getHydroId(req, res) {
        const username = req.user.email;
        let data = {};
        const [hyroInfo] = await of(RaindropModel.findOne({ internal_username: username }).lean());
        if (hyroInfo) {
            data = {
                res,
                status: message.SUCCESS,
                statusCode: code.OK,
                data: {
                    hydroID: hyroInfo.hydro_id,
                    confirmed: hyroInfo.confirmed,
                },
            };
            return responseFormat.handleSuccess(res, data);
        }
    }

    /**
     *
     * @description Generate a random message for the user to sign in
     * @static
     * @param {*} req
     * @param {*} res
     * @returns {object} Object with the Random Message
     * @memberof Raindrop
     */
    static async getMessage(req, res) {
        const randomMessage = raindrop.client.generateMessage();
        const data = {
            res,
            status: message.SUCCESS,
            statusCode: code.OK,
            data: {
                message: randomMessage,
            },
        };
        return responseFormat.handleSuccess(res, data);
    }

    /**
     *
     * @description Check if a username exists in the database
     * @static
     * @param {string} username
     * @returns {boolean} True/False
     * @memberof Raindrop
     */
    static async checkUserExists(username) {
        const [exists] = await of(RaindropModel.findOne({ internal_username: username }).lean());
        if (exists) {
            return true;
        }
        return false;
    }

    /**
     *
     * @description Register an internal user if the Hydro API call with their username succeeds
     * @static
     * @param {*} req
     * @param {*} res
     * @returns {object}
     * @memberof Raindrop
     */
    static async registerUser(req, res) {
        const { hydroID } = req.body;
        const username = req.user.email;
        let data = {};

        const validate = ajv.compile(schema.userHydroID);
        // Validate the request or query params
        const valid_schema = validate(req.body);
        if (!valid_schema) {
            logger.error('Ajv Validation Error: %o', ajv.errorsText(validate.errors));
            const { output } = Boom.badRequest(ajv.errorsText(validate.errors));
            return responseFormat.handleError(res, output);
        }

        const checkUsername = await Raindrop.checkUserExists(username);
        /** If the username is linked with an HydroID already, then don't register the HydroID */
        if (checkUsername) {
            const { output } = Boom.conflict(message.ALREADY_LINKED);
            return responseFormat.handleError(res, output);
        }
        const [registered] = await of(clientRaindropPartner.registerUser(hydroID));
        /** If registration is successful, save it to the database */
        if (registered) {
            const [, DbError] = await of(RaindropModel.create({
                internal_username: username,
                hydro_id: hydroID,
                confirmed: false,
            }));
            /** If there was a DB error, unregister the HydroID. We don't want to that possibility */
            if (DbError) {
                logger.error('DbError: %o', DbError);
                await clientRaindropPartner.unregisterUser(hydroID);
                const { output } = Boom.badImplementation(message.DB_ERROR);
                return responseFormat.handleError(res, output);
            }

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
        logger.error(message.HYDRO_ID_NOT_FOUND);
        const { output } = Boom.badRequest(message.HYDRO_ID_NOT_FOUND);
        return responseFormat.handleError(res, output);
    }

    /**
     *
     * @description Unregister an internal user
     * @static
     * @param {*} req
     * @param {*} res
     * @returns
     * @memberof Raindrop
     */
    static async unregisterUser(req, res) {
        const { hydroID } = req.body;
        const username = req.user.email;
        let data = {};

        const validate = ajv.compile(schema.userHydroID);
        // Validate the request or query params
        const valid_schema = validate(req.body);
        if (!valid_schema) {
            logger.error('Ajv Validation Error: %o', ajv.errorsText(validate.errors));
            const { output } = Boom.badRequest(ajv.errorsText(validate.errors));
            return responseFormat.handleError(res, output);
        }

        /** Check if the HydroID exists in the database first */
        const checkUsername = await Raindrop.checkUserExists(username);
        if (!checkUsername) {
            logger.error(message.USERNAME_NOT_FOUND);
            const { output } = Boom.badRequest(message.USERNAME_NOT_FOUND);
            return responseFormat.handleError(res, output);
        }

        /** Go ahead to unregister the user */
        const [Unregistered] = await of(clientRaindropPartner.unregisterUser(hydroID));
        if (Unregistered) {
            /** Delete a user entry in the raindrop table */
            const [, userDeletedError] = await of(RaindropModel.deleteOne({ hydro_id: hydroID }));
            if (userDeletedError) {
                logger.error('userDeletedError: %o', userDeletedError);
                const { output } = Boom.badImplementation(`${message.OPERATION_FAILURE} Manual deletion might be required`);
                output.unregistered = true;
                return responseFormat.handleError(res, output);
            }

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
    }

    /**
     *
     * @description Verify the randomly generated message
     * @static
     * @param {*} req
     * @param {*} res
     * @returns
     * @memberof Raindrop
     */
    static async verifySignature(req, res) {
        const { randomMessage } = req.body;
        const username = req.user.email;
        let data = {};

        const validate = ajv.compile(schema.userHydroID);
        // Validate the request or query params
        const valid_schema = validate(req.body);
        if (!valid_schema) {
            logger.error('Ajv Validation Error: %o', ajv.errorsText(validate.errors));
            const { output } = Boom.badRequest(ajv.errorsText(validate.errors));
            return responseFormat.handleError(res, output);
        }

        /** Check if the HydroID exists in the database first */
        const getUserInformation = await RaindropModel.findOne({ username }).lean();
        if (!getUserInformation) {
            logger.error(message.USERNAME_NOT_FOUND);
            const { output } = Boom.notFound(message.USERNAME_NOT_FOUND);
            return responseFormat.handleError(res, output);
        }
        const [verifySig] = await of(clientRaindropPartner.verifySignature(getUserInformation.hydro_id, randomMessage));
        if (!verifySig.verified) {
            logger.error(message.INCORRECT_MESSAGE);
            const { output } = Boom.badData(message.INCORRECT_MESSAGE);
            output.verified = false;
            return responseFormat.handleError(res, output);
        }

        /** If this is the first time user verifies a message, record it in the DB */
        if (!getUserInformation.confirmed) {
            const [, updateError] = await of(RaindropModel.updateOne({
                internal_username: getUserInformation.internal_username,
            }, { $set: { confirmed: true } }));

            if (updateError) {
                logger.error(message.HYDRO_AUTH_USER_ERROR);
                const { output } = Boom.badData(message.HYDRO_AUTH_USER_ERROR);
                output.verified = false;
                return responseFormat.handleError(res, output);
            }
            // update user's TFA type here
            await UserModel.findOneAndUpdate({ email: username }, {
                tfa_type: 'raindrop',
            }).lean();
            data = {
                res,
                status: message.SUCCESS,
                statusCode: code.OK,
                data: {
                    verified: true,
                },
            };
            return responseFormat.handleSuccess(res, data);
        }
    }
}

module.exports = Raindrop;
