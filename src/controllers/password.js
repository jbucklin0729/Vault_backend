/* eslint-disable indent */
/* eslint-disable camelcase */
/* eslint-disable consistent-return */
require('dotenv').config();

const bcrypt = require('bcrypt');
const cryptoRandomString = require('crypto-random-string');
const Boom = require('boom');
const Ajv = require('ajv');
const logger = require('../config/winston');
const code = require('../constants/codes');
const message = require('../constants/messages');
const schema = require('../utils/validators/userValidators');
const responseFormat = require('../utils/responseFormat');
const sendEmail = require('../utils/sendEmail');

const UserModel = require('../models/user');

const saltRounds = bcrypt.genSaltSync(10);

const { FRONTEND_LINK } = process.env;

const ajv = Ajv({ allErrors: true, $data: true });
require('ajv-errors')(ajv);

class Password {
    /**
     * @link https://medium.com/@RistaSB/use-expressjs-to-send-mails-with-gmail-oauth-2-0-and-nodemailer-d585bba71343
     * @link https://github.com/AnupKumarPanwar/Rest-Emailing-API
     * @description Forgot password
     * @static
     * @param {*} req object containing user email
     * @param {*} res
     * @returns {object}
     * @memberof Password
     */
    static async forgotPassword(req, res) {
        const { email } = req.body;
        try {
            const validate = ajv.compile(schema.userForgotPassword);
            let data = {};

            // Validate the request or query params
            const valid_schema = validate(req.body);
            if (!valid_schema) {
                logger.error('Ajv Validation Error: %o', ajv.errorsText(validate.errors));
                const { output } = Boom.badRequest(ajv.errorsText(validate.errors));
                return responseFormat.handleError(res, output);
            }
            const foundUser = await UserModel.findOne({ email }).lean();
            if (foundUser) {
                const reset_key = cryptoRandomString({ length: 10 });
                const updatedUser = await UserModel.updateOne({ email }, {
                    reset_key,
                    reset_key_expires: Date.now() + 3600000, // 1 hour
                });

                if (updatedUser) {
                    const mailOptions = {
                        to: foundUser.email,
                        subject: 'Password Request - Hydro Vault',
                        text: 'Reset Password',
                        html: `<p>Hi ${foundUser.first_name}, <br />
                        We’ve received a request to reset your account password.</p>
                        <p>If you didn’t make the request, just ignore this message. Otherwise, you can reset your password using this link:
                        Click <a href="${FRONTEND_LINK}/reset_password/${reset_key}">here</a> to reset your password </p>
                        <p>Thanks, <br />
                        The HydroVault Team<p>`,
                    };
                    const info = await sendEmail(mailOptions);
                    if (info) {
                        data = {
                            res,
                            status: message.SUCCESS,
                            statusCode: code.OK,
                            data: {
                                message: 'Email successfully sent. Please check your email for further instructions.',
                            },
                        };
                        return responseFormat.handleSuccess(res, data);
                    }
                }
            } else {
                logger.error(message.EMAIL_NOT_FOUND);
                const { output } = Boom.badRequest();
                output.payload.message = message.EMAIL_NOT_FOUND;
                return responseFormat.handleError(res, output);
            }
        } catch (err) {
            logger.error('Forgot password error: %o', err);
            const { output } = Boom.badImplementation(err.message);
            output.payload.message = err.message;
            return responseFormat.handleError(res, output);
        }
    }

    /**
     *
     * @description Reset user password
     * @static
     * @param {object} req object containing reset key, new password and confirm password
     * @param {*} User
     * @returns {object} password update email or otherwise
     * @memberof Password
     */
    static async resetPassword(req, res) {
        const { reset_key, new_password, confirm_password } = req.body;
        try {
            let data = {};
            const validate = ajv.compile(schema.userResetPassword);
            // Validate the request or query params
            const valid_schema = validate(req.body);
            if (!valid_schema) {
                logger.error('Ajv Validation Error: %o', ajv.errorsText(validate.errors));
                const { output } = Boom.badRequest(ajv.errorsText(validate.errors));
                return responseFormat.handleError(res, output);
            }
            const user = await UserModel.findOne({
                reset_key,
            }).lean();
            // if reset key is valid
            if (user) {
                const current_date = new Date();
                const reset_key_expires_date = new Date(user.reset_key_expires);
                // if the key is within the time frame and hasn't expired
                if (reset_key_expires_date.getTime() > current_date.getTime()) {
                    const new_hash = await bcrypt.hash(new_password, saltRounds);
                    const reset_pass = await UserModel.updateOne({ reset_key }, {
                        password: new_hash,
                        reset_key: null,
                        reset_key_expires: null,
                    });

                    if (reset_pass) {
                        data = {
                            res,
                            status: message.SUCCESS,
                            statusCode: code.OK,
                            data: {
                                message: message.PASSWORD_UPDATE_SUCCESS,
                            },
                        };
                        return responseFormat.handleSuccess(res, data);
                    }
                } else {
                    logger.error(message.KEY_EXPIRED);
                    const { output } = Boom.badRequest();
                    output.payload.message = message.KEY_EXPIRED;
                    return responseFormat.handleError(res, output);
                }
            } else {
                logger.error(message.KEY_INVALID);
                const { output } = Boom.badRequest();
                output.payload.message = message.KEY_INVALID;
                return responseFormat.handleError(res, output);
            }
        } catch (err) {
            logger.error('Reset password error: %o', err);
            const { output } = Boom.badRequest(err.message);
            output.payload.message = err.message;
            return responseFormat.handleError(res, output);
        }
    }

    /**
     *
     * @description Change user password
     * @static
     * @param {object} req object containing old password, new password and confirm password
     * @param {*} res object
     * @returns {object} a password update email or otherwise
     * @memberof User
     */
    static async changePassword(req, res) {
        // user email from the auth
        const _id = req.user.id;
        const { old_password, new_password } = req.body;
        const validate = ajv.compile(schema.userChangePassword);
        let data = {};

        // Validate the request or query params
        const valid_schema = validate(req.body);
        if (!valid_schema) {
            logger.error('Ajv Validation Error: %o', ajv.errorsText(validate.errors));
            const { output } = Boom.badRequest(ajv.errorsText(validate.errors));
            return responseFormat.handleError(res, output);
        }

        try {
            // check the old password
            const checkOldPassword = await UserModel.findOne({ _id }).lean();
            const match = await bcrypt.compare(old_password, checkOldPassword.password);
            if (!match) {
                logger.error(message.OLD_PASSWORD_NOT_CORRECT);
                const { output } = Boom.badRequest(message.OLD_PASSWORD_NOT_CORRECT);
                return responseFormat.handleError(res, output);
            }

            // generate a new hash and update the user's account
            const newHash = await bcrypt.hash(new_password, saltRounds);
            const updated = await UserModel.findOneAndUpdate({ _id }, { password: newHash }, { new: true }).lean();
            if (updated) {
                const mailOptions = {
                    to: updated.email,
                    subject: 'Password Changed Successfully - Hydro Vault',
                    text: `Visit the homepage via http://${req.headers.host}`,
                };
                await sendEmail(mailOptions);
                data = {
                    res,
                    status: message.SUCCESS,
                    statusCode: code.OK,
                    data: {
                        message: message.PASSWORD_UPDATE_SUCCESS,
                    },
                };
                return responseFormat.handleSuccess(res, data);
            }
            logger.error(updated);
            logger.error(message.PASSWORD_UPDATE_FAILURE);
            const { output } = Boom.badRequest(message.PASSWORD_UPDATE_FAILURE);
            return responseFormat.handleError(res, output);
        } catch (err) {
            logger.error('Change password error: %o', err);
            const { output } = Boom.badImplementation(err.message);
            return responseFormat.handleError(res, output);
        }
    }
}

module.exports = Password;
