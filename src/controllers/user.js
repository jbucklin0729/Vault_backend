/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
/* eslint-disable eol-last */
/* eslint-disable indent */
const cryptoRandomString = require('crypto-random-string');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const Boom = require('boom');
const Ajv = require('ajv');
const BN = require('bignumber.js');
const code = require('http-status-codes');
const nodemailer = require('nodemailer');
const hbs = require('nodemailer-express-handlebars');
const path = require('path');
const logger = require('../config/winston');
const message = require('../constants/messages');
const schema = require('../utils/validators/userValidators');
const responseFormat = require('../utils/responseFormat');
const sendEmail = require('../utils/sendEmail');
const VaultController = require('./vault');

const { getBalance } = require('../utils/vaultLib');


const UserModel = require('../models/user');
const VaultModel = require('../models/vault');
const SharedVaultModel = require('../models/shared_vault');
const signersModel = require('../models/signers');


const saltRounds = bcrypt.genSaltSync(10);
dotenv.config();

const { JWT_SECRET: secret, FRONTEND_LINK } = process.env;


const ajv = Ajv({ allErrors: true, $data: true });
require('ajv-errors')(ajv);


class User {
    /**
     *
     * @description Delete all documents in the User collection. It's just for testing purposes :)
     * @static
     * @param {*} req
     * @param {*} res
     * @returns
     * @memberof User
     */
    static async blowAllAway(req, res) {
        try {
            let data = {};
            const deleteUser = await UserModel.deleteMany({});
            if (deleteUser) {
                data = {
                    res,
                    status: message.SUCCESS,
                    statusCode: code.OK,
                    data: {
                        message: 'deleted successfully',
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
     * @description Register a user
     * @static
     * @param {object} req Request object
     * @param {object} res REsponse object
     * @returns {object} An object that contains a successful message
     * @memberof User
     */
    static async register(req, res) {
        const validate = ajv.compile(schema.userRegistration);
        let data = {};

        // Validate the request or query params
        const valid_schema = validate(req.body);
        if (!valid_schema) {
            logger.error('Ajv Validation Error: %o', ajv.errorsText(validate.errors));
            const { output } = Boom.badRequest(ajv.errorsText(validate.errors));
            return responseFormat.handleError(res, output);
        }

        const {
            first_name,
            last_name,
            email,
            secondary_email,
            password,
        } = req.body;
        const hash = await bcrypt.hash(password, saltRounds);

        try {
            const foundUser = await UserModel.findOne({ email }).lean();

            if (foundUser) {
                // check if the user's email is verified
                if (foundUser.is_verified) {
                    // const newVault = await VaultModel.create({
                    //     user: foundUser._id,
                    //     email: foundUser.email,
                    //     address: 'ook',
                    //     currency: 'okok',
                    // });
                    // await foundUser.updateOne({
                    //     $push: { vaults: newVault._id },
                    // });
                    const newVaultData = {
                        user: foundUser,
                        verification_token: null,
                    };
                    // logger.info(newVaultData)
                    const result = await VaultController.createNew(newVaultData);
                    result.metadata.message = 'New Vault Created';
                    data = {
                        res,
                        status: message.SUCCESS,
                        statusCode: code.CREATED,
                        data: result.metadata,
                    };
                    return responseFormat.handleSuccess(res, data);
                }
                logger.error(message.USER_NOT_VERIFIED);
                const { output } = Boom.preconditionFailed();
                output.payload.message = message.USER_NOT_VERIFIED;
                return responseFormat.handleError(res, output);
            }
            const newUser = await UserModel.create({
                first_name,
                last_name,
                email,
                secondary_email,
                password: hash,
            });
            // update the account for the email token
            const verification_token = cryptoRandomString({ length: 10 });
            await UserModel.updateOne({ email: newUser.email }, {
                verification_token,
                verification_token_expires: Date.now() + 3600000, // 1 hour
            });
            // send account successful email
            const mailOptions = {
                to: newUser.email,
                subject: 'New Account - Hydro Vault',
                text: 'New Account',
                html: `<p>Hi ${newUser.first_name}, </p>
                    <p>Thank you for creating an account with us. Your digital currency is in safe heaven :)</p>
                    <p>Kindly click <a href="${FRONTEND_LINK}/confirmUser/${verification_token}?email=${newUser.email}">here</a> to verify your email address.</p>
                    <p>The HydroVault Team</p>`,
            };
            const info = await sendEmail(mailOptions);
            if (info) {
                data = {
                    res,
                    status: message.SUCCESS,
                    statusCode: code.CREATED,
                    data: {
                        message: 'Account created successfully. Please check your email address for verification.',
                    },
                };
                return responseFormat.handleSuccess(res, data);
            }
        } catch (err) {
            logger.error(err);
            const { output } = Boom.badImplementation();
            output.payload.message = err.message;
            return responseFormat.handleError(res, output);
        }
    }

    /**
     *
     * @description Login user
     * @static
     * @param {*} req Request object
     * @param {*} res Response object
     * @returns {object} An object with a message and signed token
     * @memberof User
     */
    static async login(req, res) {
        const { email, password } = req.body;
        const validate = ajv.compile(schema.userLogin);
        let data = {};

        // Validate the request or query params
        const valid_schema = validate(req.body);
        if (!valid_schema) {
            logger.error('Ajv Validation Error: %o', ajv.errorsText(validate.errors));
            const { output } = Boom.badRequest(ajv.errorsText(validate.errors));
            return responseFormat.handleError(res, output);
        }
        try {
            const user = await UserModel.findOne({ email }).lean();
            if (user) {
                // if user is not verified
                if (!user.is_verified) {
                    logger.error(message.USER_NOT_VERIFIED);
                    const { output } = Boom.preconditionRequired();
                    output.payload.message = message.USER_NOT_VERIFIED;
                    return responseFormat.handleError(res, output);
                }
                const match = await bcrypt.compare(password, user.password);
                if (match) {
                    const token = jwt.sign({
                            id: user._id,
                            email: user.email,
                        },
                        secret, { expiresIn: '1h' });
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
            logger.error('User Login Error: %o', err);
            const { output } = Boom.badImplementation();
            output.payload.message = err.message;
            return responseFormat.handleError(res, output);
        }
    }


    /**
     *
     * @description Verify user's token and update status
     * @static
     * @param {*} req Request object
     * @param {*} res Response object
     * @returns {object} An object with a successful message
     * @memberof User
     */
    static async verifyUser(req, res) {
        const { verification_token, email } = req.body;
        const validate = ajv.compile(schema.userVerify);
        let data = {};

        // Validate the request or query params
        const valid_schema = validate(req.body);
        if (!valid_schema) {
            logger.error('Ajv Validation Error: %o', ajv.errorsText(validate.errors));
            const { output } = Boom.badRequest(ajv.errorsText(validate.errors));
            return responseFormat.handleError(res, output);
        }
        try {
            const user = await UserModel.findOne({
                email,
                verification_token,
            }).lean();
            if (user) {
                const current_date = new Date();
                const verification_token_expires_date = new Date(user.verification_token_expires);
                if (verification_token_expires_date.getTime() > current_date.getTime()) {
                    // create a new vault upon successful verification
                    const newVaultData = {
                        user,
                        verification_token,
                        currency: 'BEAR' //ETH
                    };
                    await VaultController.createNew(newVaultData);
                    // update user model
                    await UserModel.updateOne({ email: user.email }, {
                        is_verified: true,
                        verification_token: null,
                        verification_token_expires: null,
                    });
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
                logger.error(message.KEY_EXPIRED);
                const { output } = Boom.badRequest();
                output.payload.message = message.KEY_EXPIRED;
                return responseFormat.handleError(res, output);
            }
            logger.error(message.KEY_INVALID);
            const { output } = Boom.badRequest();
            output.payload.message = message.KEY_INVALID;
            return responseFormat.handleError(res, output);
        } catch (err) {
            logger.error('User verification error: %o', err);
            const { output } = Boom.badImplementation();
            output.payload.message = err.message;
            return responseFormat.handleError(res, output);
        }
    }


    /**
     *
     * @description Check a user's verification token
     * @static
     * @param {*} req Request object
     * @param {*} res Response object
     * @returns {object} An object with a successful message
     * @memberof User
     */
    static async checkToken(req, res) {
        const { verification_token } = req.body;
        const validate = ajv.compile(schema.userVerify);
        let data = {};

        // Validate the request or query params
        const valid_schema = validate(req.body);
        if (!valid_schema) {
            logger.error('Ajv Validation Error: %o', ajv.errorsText(validate.errors));
            const { output } = Boom.badRequest(ajv.errorsText(validate.errors));
            return responseFormat.handleError(res, output);
        }
        try {
            const user = await UserModel.findOne({
                verification_token,
            }).lean();
            if (user) {
                const current_date = new Date();
                const verification_token_expires_date = new Date(user.verification_token_expires);
                if (verification_token_expires_date.getTime() > current_date.getTime()) {
                    data = {
                        res,
                        status: message.SUCCESS,
                        statusCode: code.OK,
                        data: {
                            message: message.SUCCESS,
                        },
                    };
                    return responseFormat.handleSuccess(res, data);
                }
                logger.error(message.KEY_EXPIRED);
                const { output } = Boom.badRequest();
                output.payload.message = message.KEY_EXPIRED;
                return responseFormat.handleError(res, output);
            }
            logger.error(message.KEY_INVALID);
            const { output } = Boom.badRequest();
            output.payload.message = message.KEY_INVALID;
            return responseFormat.handleError(res, output);
        } catch (err) {
            logger.error('User verification error: %o', err);
            const { output } = Boom.badImplementation(err.message);
            output.payload.message = err.message;
            return responseFormat.handleError(res, output);
        }
    }

    /**
     *
     *@description Get logged in user's profile details
     * @static
     * @param {*} req
     * @param {*} res
     * @returns
     * @memberof User
     */
    static async profile(req, res) {
        const _id = req.user.id;
        try {
            let data = {};
            const profile = await UserModel.findOne({ _id }).populate('vaults', '_id name address currency amount').lean();
            data = {
                res,
                status: message.SUCCESS,
                statusCode: code.OK,
                data: {
                    profile: {
                        _id: profile._id,
                        first_name: profile.first_name,
                        last_name: profile.last_name,
                        email: profile.email,
                        secondary_email: profile.secondary_email,
                        tfa_type: profile.tfa_type,
                    },
                },
            };
            return responseFormat.handleSuccess(res, data);
        } catch (err) {
            logger.error('User profile error: %o', err);
            const { output } = Boom.badImplementation();
            output.payload.message = 'User profile error';
            return responseFormat.handleError(res, output);
        }
    }

    static async


    /**
     *
     * @description Resend a user's verification token
     * @static
     * @param {*} req Request object
     * @param {*} res Response object
     * @returns {object} An object with a successful message
     * @memberof User
     */
    static async resendToken(req, res) {
        const { email } = req.body;
        try {
            const validate = ajv.compile(schema.userResendEmailToken);
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
                // update the account for the email token
                const verification_token = cryptoRandomString({ length: 10 });
                await UserModel.updateOne({ email: foundUser.email }, {
                    verification_token,
                    verification_token_expires: Date.now() + 3600000, // 1 hour
                });
                // send account successful email
                const mailOptions = {
                    to: foundUser.email,
                    subject: 'New Verification Link - Hydro Vault',
                    text: 'Thank you',
                    html: `<p>Hi ${foundUser.first_name}, </p>
                        <p>Thank you for creating an account with us. Your digital currency is in safe heaven :)</p>
                        <p>Kindly click <a href="${FRONTEND_LINK}/confirmUser/${verification_token}">here</a> to verify your email address.</p>
                        <p>The HydroVault Team</p>`,
                };
                const info = await sendEmail(mailOptions);
                if (info) {
                    data = {
                        res,
                        status: message.SUCCESS,
                        statusCode: code.CREATED,
                        data: {
                            message: 'Email successfully sent. Please check your email for further instructions.',
                        },
                    };
                    return responseFormat.handleSuccess(res, data);
                }
            } else {
                logger.error(message.EMAIL_NOT_FOUND);
                const { output } = Boom.badRequest();
                output.payload.message = message.EMAIL_NOT_FOUND;
                return responseFormat.handleError(res, output);
            }
        } catch (err) {
            logger.error('Resend Reset key error: %o', err);
            const { output } = Boom.badImplementation(err.message);
            output.payload.message = err.message;
            return responseFormat.handleError(res, output);
        }
    }


    static async emailTest(req, res) {
        const GmailTransport = nodemailer.createTransport({
            service: process.env.GMAIL_SERVICE_NAME,
            host: process.env.GMAIL_SERVICE_HOST,
            secure: process.env.GMAIL_SERVICE_SECURE,
            port: process.env.GMAIL_SERVICE_PORT,
            auth: {
                user: process.env.GMAIL_USER_NAME,
                pass: process.env.GMAIL_USER_PASSWORD,
            },
        });
        // const ViewOption = (transport, _hbs) => {
        //     transport.use('compile', _hbs({
        //         viewPath: 'views/email',
        //         extName: '.hbs',
        //     }));
        // };
        // ViewOption(GmailTransport, hbs);
        // console.log(path.resolve('src/views'));
        const handlebarOptions = {
            viewEngine: {
                extName: '.hbs',
                partialsDir: path.resolve('src/views/email'),
                layoutsDir: path.resolve('src/views/email'),
                defaultLayout: 'test.hbs',
                // defaultLayout: 'email.body.hbs',
            },
            viewPath: path.resolve('src/views/email/'),
            extName: '.hbs',
        };
        // GmailTransport.use('compile', handlebarOptions);
        const HelperOptions = {
            from: 'hydro@gmail.com',
            to: 'oluwafemiakinde@gmail.com',
            subject: 'Hellow world!',
            //   template: 'test',
            //   context: {
            //     name: 'tariqul_islam',
            //     email: 'tariqul.islam.rony@gmail.com',
            //     address: '52, Kadamtola Shubag dhaka',
            //   },
        };
        GmailTransport.sendMail(HelperOptions, (error, info) => {
            if (error) {
                console.log(error);
                return res.json(error);
            }
            console.log('email is send');
            console.log(info);
            res.json(info);
        });
    }

    /**
     *
     * @description Return the 2FA type of the user
     * @static
     * @param {*} req
     * @param {*} res
     * @returns
     * @memberof User
     */
    static async getTfaType(req, res) {
        const _id = req.user.id;
        // const email = "k1424sap@gmail.com";
        let data = {};
        const tfa = await UserModel.findOne({ _id }).select('tfa_type -_id').lean();
        data = {
            res,
            status: message.SUCCESS,
            statusCode: code.OK,
            data: {
                tfa_type: tfa.tfa_type,
            },
        };
        return responseFormat.handleSuccess(res, data);
    }

    static async getAllVaults(req, res) {
        const _id = req.user.id;
        let data = {};
        const vaults = [];
        let balances = {};
        try {
            const userVaults = await UserModel.findOne({ _id }).populate('vaults');
            for (const userV of userVaults.vaults) {
                balances = await getBalance(userV.currency, userV.address);
                vaults.push({
                    _id: userV._id,
                    balances,
                    currency: userV.currency,
                    name: userV.name,
                    type: userV.type,
                    address: userV.address,
                });
            }
            data = {
                res,
                status: message.SUCCESS,
                statusCode: code.OK,
                data: {
                    vaults,
                },
            };
            return responseFormat.handleSuccess(res, data);
        } catch (error) {
            logger.error('Get vaults and balances: %o', error);
            const { output } = Boom.badImplementation(error.message);
            output.payload.message = error.message;
            return responseFormat.handleError(res, output);
        }
    }

    /**
     *
     * @description Get all shared vaults information and their balances
     * @static
     * @param {*} req
     * @param {*} res
     * @returns
     * @memberof User
     */
    static async getAllSharedVaults(req, res) {
        const _id = req.user.id;
        let data = {};
        const vaults = [];
        let balances = {};
        try {
            const signers = await signersModel.find({ userId: _id }).lean();
            let signersId = [];
            for (let s of signers) {
                signersId.push(s._id);
            }
            let userSharedVaults = await SharedVaultModel.find({ signers: { $in: signersId } }, 'name allAccepted type currency address').lean();
            //filter out falsey values
            // let filteredUserSharedVaults = userSharedVaults.filter(uV => uV.address !== '' && uV.address !== null);
            for (const userV of userSharedVaults) {
                if (userV.address == '' || userV.address == null) {
                    vaults.push({
                        _id: userV._id,
                        balances: 0,
                        currency: userV.currency,
                        name: userV.name,
                        type: userV.type,
                        address: null,
                        allAccepted: userV.allAccepted,
                    });
                } else {
                    balances = await getBalance(userV.currency, userV.address);
                    vaults.push({
                        _id: userV._id,
                        balances: new BN(balances).toFixed(3),
                        currency: userV.currency,
                        name: userV.name,
                        type: userV.type,
                        address: userV.address,
                        allAccepted: userV.allAccepted,
                    });
                }
            }
            data = {
                res,
                status: message.SUCCESS,
                statusCode: code.OK,
                data: {
                    vaults,
                },
            };
            return responseFormat.handleSuccess(res, data);
        } catch (error) {
            logger.error('Get vaults and balances: %o', error);
            const { output } = Boom.badImplementation(error.message);
            output.payload.message = error.message;
            return responseFormat.handleError(res, output);
        }
    }

    /**
     *
     * @description get total balance of all user vaults
     * @static
     * @param {*} req
     * @param {*} res
     * @memberof Vault
     */
    static async totalVaultsBalance(req, res) {
        const userEmail = req.user.email;
        const _id = req.user.id;
        const type = req.query.type;
        let data = {};
        let signersId = [];
        let balance = [];
        let result = 0;
        let userVaults;
        let userSharedVaults;
        let filteredUserSharedVaults;
        let signers;
        const validate_query = ajv.compile(schema.balanceTypes);
        const valid_schema_query = validate_query(req.query);
        if (!valid_schema_query) {
            logger.error('Ajv Validation Error: %o', ajv.errorsText(validate_query.errors));
            const { output } = Boom.badRequest(ajv.errorsText(validate_query.errors));
            return responseFormat.handleError(res, output);
        }
        try {
            switch (type) {

                case 'single':
                    //userVaults = await VaultModel.find({ user: _id, currency: { $ne: 'ETH' } }).lean();
                    userVaults = await VaultModel.find({ user: _id }, 'currency address').lean();
                    for (const userV of userVaults) {
                        userV.currency = userV.currency ? userV.currency : 'BEAR';
                        let balances = await getBalance(userV.currency, userV.address);
                        balance.push(balances);
                    }
                    balance.forEach(number => {
                        result += number;
                    })
                    break;

                case 'shared':
                    signers = await signersModel.find({ userId: _id }).lean();
                    for (let s of signers) {
                        signersId.push(s._id);
                    }
                    userSharedVaults = await SharedVaultModel.find({ signers: { $in: signersId } }, 'currency address').lean();
                    //filteredUserSharedVaults = userSharedVaults.filter(uV => uV.address !== '' && uV.address !== null);
                    for (const userV of userSharedVaults) {
                        userV.currency = userV.currency ? userV.currency : 'BEAR';
                        let balances = await getBalance(userV.currency, userV.address);
                        balance.push(balances);
                    }
                    balance.forEach(number => {
                        result += number;
                    })
                    console.log({ result })
                    break;

                case 'all':
                    //const userVaults = await VaultModel.find({ user: _id, currency: { $ne: 'ETH' } }).lean();
                    userVaults = await VaultModel.find({ user: _id }, 'currency address').lean();
                    signers = await signersModel.find({ userId: _id }).lean();
                    for (let s of signers) {
                        signersId.push(s._id);
                    }
                    userSharedVaults = await SharedVaultModel.find({ signers: { $in: signersId } }, 'currency address').lean();
                    filteredUserSharedVaults = userSharedVaults.filter(uV => uV.address !== '' && uV.address !== null);
                    for (const userV of userVaults) {
                        userV.currency = userV.currency ? userV.currency : 'BEAR';
                        let balances = await getBalance(userV.currency, userV.address);
                        balance.push(balances);
                    }
                    for (const userV of filteredUserSharedVaults) {
                        userV.currency = userV.currency ? userV.currency : 'BEAR';
                        let balances = await getBalance(userV.currency, userV.address);
                        balance.push(balances);
                    }
                    balance.forEach(number => {
                        // result = new BN(result).plus(number);
                        result += number;
                    })
                    break;
            }
            data = {
                res,
                status: message.SUCCESS,
                statusCode: code.OK,
                data: {
                    balance: new BN(result).toFixed(3),
                },
            };
            return responseFormat.handleSuccess(res, data);
        } catch (error) {
            logger.error('Get all vaults balances: %o', error);
            const { output } = Boom.badImplementation(error.message);
            output.payload.message = error.message;
            return responseFormat.handleError(res, output);
        }
    }

}

module.exports = User;