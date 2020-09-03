/* eslint-disable eol-last */
/* eslint-disable space-before-function-paren */
/* eslint-disable indent */
const Boom = require('boom');
const Ajv = require('ajv');
const cryptoRandomString = require('crypto-random-string');
const { of } = require('await-of');
const logger = require('../config/winston');
const code = require('../constants/codes');
const message = require('../constants/messages');
const moment = require('moment');
const lodashFilter = require('lodash/filter');
const lodashIncludes = require('lodash/includes');
const Action = require('../constants/actions');
const Status = require('../constants/statuses');
const schema = require('../utils/validators/vaultValidators');
const responseFormat = require('../utils/responseFormat');
const sendEmail = require('../utils/sendEmail');
const sharedVaultModel = require('../models/shared_vault');
const signersModel = require('../models/signers');
const TokenModel = require('../models/token');
const VaultModel = require('../models/vault');
const TransactionModel = require('../models/transaction')
const NotificationModel = require('../models/notifications');

const { addSigners, approveContract, multiSig, getBalance, verifySignature, checkSigner } = require('../utils/sharedVaultLib');

const {
    generateWallet,
    create: createVault,
    getTransactionInfo,
    getEvents,
} = require('../utils/vaultLib');

const UserModel = require('../models/user');
const SharedVaultTransaction = require('../models/shared_transaction');

const allDefaultTokens = require('../utils/allTokens');

const { FRONTEND_LINK } = process.env;


const ajv = Ajv({ allErrors: true, $data: true });
require('ajv-errors')(ajv);

const checkToken = async(symbol) => {
    const [tokens] = await of(TokenModel.find({}).lean());
    if (tokens.some((s) => s.symbol === symbol)) return true;
    return false;
}

class SharedVault {

    /**
     * @description verifies if the passed email exists
     * @static
     * @param {object} res Response object
     * @param {string} email
     * @returns {boolean} true or false
     * @memberof SharedVault
     */
    static async verifyEmail(email) {
        const exists = await UserModel.findOne({ email });
        if (exists) return { isExists: true, _id: exists._id };
        return { isExists: false };
    }

    /**
     *
     * @description verifies if the sharedVaultId exists
     * @static
     * @param {number} sharedVaultId
     * @returns {boolean} true or false
     * @memberof SharedVault
     */
    static async verifySharedVault(sharedVaultId) {
        const exists = await sharedVaultModel.findById(sharedVaultId, 'signers address countMaxDailyTx countTxHour currDailyAmount').lean();
        if (exists) return {
            isExists: true,
            signers: exists.signers,
            _id: exists._id,
            address: exists.address,
            countMaxDailyTx: exists.countMaxDailyTx,
            countMaxDailyTxHour: exists.countTxHour,
            currDailyAmount: exists.currDailyAmount,
        };
        return {
            isExists: false,
        };
    }

    /**
     *
     * @description Check if total daily transaction has been met
     * @static
     * @param {*} vaultId
     * @param {*} countMaxDailyTx
     * @returns bool
     * @memberof Vault
     */
    static async checkDailyTx(vaultId) {
        const check = await sharedVaultModel.findOne({ _id: vaultId }, 'maxDailyTx countMaxDailyTx').lean()
        if (check.countMaxDailyTx !== 0 && check.maxDailyTx == check.countMaxDailyTx) {
            return true;
        }
        return false;
    }

    /**
     *
     * @description Check if daily transaction per hour has been met
     * @static
     * @param {*} vaultId
     * @param {*} countMaxDailyTxHour
     * @returns bool
     * @memberof Vault
     */
    static async checkDailyTxHour(vaultId) {
        const check = await sharedVaultModel.findOne({ _id: vaultId }, 'maxTxHour countTxHour').lean()
        if (check.countTxHour !== 0 && check.maxTxHour == check.countTxHour) {
            return true;
        }
        return false;
    }

    /**
     *
     * @description Check if daily amount has been met
     * @static
     * @param {*} vaultId
     * @param {*} currDailyAmount
     * @returns bool
     * @memberof Vault
     */
    static async checkDailyAmount(vaultId) {
        const check = await sharedVaultModel.findOne({ _id: vaultId }, 'maxDailyAmount currDailyAmount').lean()
        if (check.maxDailyAmount !== 0 && check.maxDailyAmount == check.currDailyAmount) {
            return true;
        }
        return false;
    }

    /**
     *
     * @description checks the signature status of the signer
     * @static
     * @param {*} signerID
     * @returns
     * @memberof SharedVault
     */
    static async checkSignature(signerID) {
        const signed = await signersModel.findById(signerID).lean();
        return signed.hasSigned;
    }

    /**
     *
     * @description attempt to create a new vault and send emails for invitation
     * @static
     * @param {*} req
     * @param {*} res
     * @returns
     * @memberof SharedVault
     */
    static async create(req, res) {
        const userEmail = req.user.email;
        const userId = req.user.id;
        let data = {};
        let result;
        const validate = ajv.compile(schema.newSharedVault);
        // Validate the request or query params
        const valid_schema = validate(req.body);
        if (!valid_schema) {
            logger.error('Ajv Validation Error: %o', ajv.errorsText(validate.errors));
            const { output } = Boom.badRequest(ajv.errorsText(validate.errors));
            return responseFormat.handleError(res, output);
        }
        const {
            name,
            currency,
            signers,
            numberOfSigners,
            numberOfSignatures,

        } = req.body;

        const random_string = cryptoRandomString({ length: 5 });
        const vault_name = name ? name : `Vault_${random_string}`;

        try {
            //shared vault name does not exit
            const checkNameExists = await sharedVaultModel.findOne({ name: vault_name }).lean();
            if (checkNameExists) {
                logger.error(message.VAULT_DUP_EXIST);
                const { output } = Boom.badRequest();
                output.payload.message = message.VAULT_DUP_EXIST;
                return responseFormat.handleError(res, output);
            }

            const sharedVaultData = await sharedVaultModel.create({
                private_key: '',
                name: vault_name,
                currency,
                address: '',
                numberOfSignatures,
                numberOfSigners,
                timestamp: Date.now(),
            });
            const filteredSigners = signers.filter(obj => obj !== userEmail);
            //check if any of the signer's email does not exist
            for (let signerEmail of filteredSigners) {
                const exists = await SharedVault.verifyEmail(signerEmail);
                if (!exists.isExists) {
                    //rollback
                    await signersModel.deleteMany({ vault_name }).lean();
                    await sharedVaultModel.deleteMany({ name: vault_name }).lean();
                    logger.error(message.SIGNER_NOT_EXIST);
                    const { output } = Boom.badRequest();
                    output.payload.message = `${signerEmail} does not exist in Vault`;
                    return responseFormat.handleError(res, output);
                }
                const mailOptions = {
                    to: signerEmail,
                    subject: 'A Co-signer to a shared vault',
                    text: `Co-signer, Yeah!`,
                    html: `<p>Hi, ${signerEmail}, please accept the invitation from ${userEmail} <br /> <a href="${FRONTEND_LINK}/co-signer-verification?email=${signerEmail}&vault=${vault_name}&sharedVaultId=${sharedVaultData._id}"><b>HERE</b></a></p> <br />
                    <p>You are now a co-signer to a shared vault "${vault_name}" on hydrovault.io</p>
                    <p>In case you could not click the link above, copy and paste the link below in your browser</p>
                    <p>${FRONTEND_LINK}/co-signer-verification?email=${signerEmail}&vault=${vault_name}&sharedVaultId=${sharedVaultData._id}</p>
                    <p>The HydroVault Team</p>`,
                };
                // // TODO: vault name must be unique
                await sendEmail(mailOptions);
                //add signers of the vault
                await signersModel.create({
                    userId: exists._id,
                    email: signerEmail,
                    vault_name,
                });
            }
            //the creator of the shared vault has already accepted the invitation
            const wallet = await generateWallet();
            const newSignerData = await signersModel.create({
                    userId,
                    email: userEmail,
                    vault_name,
                    isAccepted: true,
                    address: wallet.address,
                    private_key: wallet.privateKey
                })
                // add the creator to the shared vault
            await sharedVaultModel.updateOne({ _id: sharedVaultData._id }, {
                $push: { signers: newSignerData._id, signersAddresses: newSignerData.address },
            });

            data = {
                res,
                status: message.SUCCESS,
                statusCode: code.CREATED,
                data: {
                    message: 'A shared vault will be created when all your co-signers accept the invitation.'
                },
            };
            return responseFormat.handleSuccess(res, data);
        } catch (error) {
            logger.error('Shared Vault Create Error ', error);
            const { output } = Boom.badRequest();
            output.payload.message = error.message;
            return responseFormat.handleError(res, output);
        }
    }


    /**
     *
     * @description accept invitation to be a co-signer
     * @static
     * @param {*} req
     * @param {*} res
     * @memberof SharedVault
     */
    static async acceptInvitation(req, res) {
        const { email, vault_name, accept, shared_vault_id } = req.body;
        let data = {};
        let getInitiatorInfo = null;
        const validate = ajv.compile(schema.acceptInvitation);
        // Validate the request or query params
        const valid_schema = validate(req.body);
        if (!valid_schema) {
            logger.error('Ajv Validation Error: %o', ajv.errorsText(validate.errors));
            const { output } = Boom.badRequest(ajv.errorsText(validate.errors));
            return responseFormat.handleError(res, output);
        }
        try {
            // check that shared vault exist
            const checkSharedVault = await sharedVaultModel.findOne({ _id: shared_vault_id }).lean();
            if (!checkSharedVault) {
                logger.error(message.VAULT_NOT_EXIST);
                const { output } = Boom.badRequest();
                output.payload.message = message.VAULT_NOT_EXIST;
                return responseFormat.handleError(res, output);
            }
            if (!accept) {
                data = {
                    res,
                    status: message.SUCCESS,
                    statusCode: code.OK,
                    data: {
                        message: 'Invitation declined.'
                    },
                };
                return responseFormat.handleSuccess(res, data);
            }
            // check that the signer exists with the associated vault name
            const checkSigner = await signersModel.findOne({
                vault_name,
                email,
                isAccepted: false
            }).lean();
            if (!checkSigner) {
                logger.error('You seem to have accepted this invitation before.');
                const { output } = Boom.badRequest();
                output.payload.message = 'Signer is not authorized or you seem to have accepted this invitation before.';
                return responseFormat.handleError(res, output);
            }
            const wallet = await generateWallet();
            const newSignerData = await signersModel.findOneAndUpdate({ vault_name, email }, {
                isAccepted: true,
                address: wallet.address,
                private_key: wallet.privateKey
            }, { new: true }).lean();
            await sharedVaultModel.updateOne({ _id: shared_vault_id }, {
                $push: { signers: newSignerData._id, signersAddresses: newSignerData.address },
            });
            // check if all signers have accepted the invitation
            // before adding the signers to the chain
            const checkAllAccepted = await signersModel.find({
                vault_name,
                isAccepted: false
            }).lean();
            if (!checkAllAccepted.length) {
                // generate a wallet
                const wallet = await generateWallet();
                const newSharedVaultData = await sharedVaultModel.findOneAndUpdate({ _id: shared_vault_id }, {
                    allAccepted: true,
                    address: wallet.address,
                    private_key: wallet.privateKey

                    // address: "0xD0d0Ea682fc13E4c718cE88d1F40FadC548E6Edb",
                    // private_key: "0x8eab813abd0ba4d2cf4bae369979701435d63f907518a5fe369698f69018a152",

                    // address: "0x0cfC16DBBd960d5F0C312C339906080aEc5E0939",
                    // private_key: "0xB493823E0098A0DE2C6A31FC970C2BC7A90C98F3C35E7F74F89D7DC9E3623B72"

                    // address: "0x876775E54d5bF67e9873F8b8525B66097819a4dF",
                    // private_key: "0x995192b831d42bf8a6592bb1242d89abc50b50ed7ca72fb660a75312ac6476fb",

                    // address: "0x46ca04cA7249e62366822A9267a42f715a8AB266",
                    // private_key: "0x8e5179da8cb7b447421a920a00fa6b3852f74ed432217dded809d1f697baab43",
                }, { new: true }).lean();

                // get address and private key of the initiator
                // getInitiatorInfo = await VaultModel.findOne({ address: i_a }).lean();
                // if (!getInitiatorInfo) {
                //     getInitiatorInfo = await sharedVaultModel.findOne({ address: i_a }).lean();
                // }
                // if (getInitiatorInfo == null || !getInitiatorInfo) {
                //     logger.error(message.UNAUTHORIZED_INITIATOR);
                //     const { output } = Boom.unauthorized();
                //     output.payload.message = message.UNAUTHORIZED_INITIATOR;
                //     return responseFormat.handleError(res, output);
                // }
                // const getInfo = await sharedVaultModel.findById(shared_vault_id).lean();
                // const getInitiatorAddress = getInfo.signersAddresses[0];
                const loadedAccount = {
                    address: "0x0cfC16DBBd960d5F0C312C339906080aEc5E0939",
                    private_key: "0xB493823E0098A0DE2C6A31FC970C2BC7A90C98F3C35E7F74F89D7DC9E3623B72",
                };
                await addSigners(
                    loadedAccount.address,
                    newSharedVaultData.address,
                    newSharedVaultData.signersAddresses,
                    newSharedVaultData.numberOfSignatures,
                    loadedAccount.private_key);
            }
            data = {
                res,
                status: message.SUCCESS,
                statusCode: code.OK,
                data: { message: 'Invitation accepted.' },
            };
            return responseFormat.handleSuccess(res, data);
        } catch (error) {
            logger.error('Shared Vault Invitation Error ', error);
            const { output } = Boom.badRequest();
            output.payload.message = error.message;
            return responseFormat.handleError(res, output);
        }
    }


    /**
     *
     * @description Initiates a withdraw request (first signer)
     * @static
     * @param {*} req
     * @param {*} res
     * @returns
     * @memberof SharedVault
     */
    static async initiateWithdrawRequest(req, res) {
        let data = {};
        const validate = ajv.compile(schema.initiateWithdraw);
        const validate_params = ajv.compile(schema.vaultIdParams);
        const userEmail = req.user.email;
        const userId = req.user.id;
        const { receiver, amount, symbol, vault_name } = req.body;
        const { vaultId } = req.params;
        let countSignatures = 0;

        // Validate the request body
        const valid_schema = validate(req.body);
        if (!valid_schema) {
            logger.error('Ajv Validation Error: %o', ajv.errorsText(validate.errors));
            const { output } = Boom.badRequest(ajv.errorsText(validate.errors));
            return responseFormat.handleError(res, output);
        }

        // Validate the request params
        const valid_schema_params = validate_params(req.params);
        if (!valid_schema_params) {
            logger.error('Ajv Validation Error: %o', ajv.errorsText(validate_params.errors));
            const { output } = Boom.badRequest(ajv.errorsText(validate_params.errors));
            return responseFormat.handleError(res, output);
        }

        // Check if VaultId exists before even doing anything
        const exists = await SharedVault.verifySharedVault(vaultId);
        if (!exists.isExists) {
            logger.error(message.ID_NOT_FOUND);
            const { output } = Boom.badRequest();
            output.payload.message = message.ID_NOT_FOUND;
            return responseFormat.handleError(res, output);
        }

        // check if the token symbol exist
        const tokenExist = await checkToken(symbol);
        if (!tokenExist) {
            logger.error(message.TOKEN_NOT_FOUND);
            const { output } = Boom.badRequest();
            output.payload.message = message.TOKEN_NOT_FOUND;
            return responseFormat.handleError(res, output);
        }


        try {

            //check the number of daily withdrawal transaction
            const dailyTxComplete = await SharedVault.checkDailyTx(vaultId);
            if (dailyTxComplete) {
                //the number of daily transactipon is complete
                logger.error(message.DAILY_TX_EXCEED);
                const { output } = Boom.badRequest();
                output.payload.message = message.DAILY_TX_EXCEED;
                return responseFormat.handleError(res, output);
            }
            const dailyTxHourComplete = await SharedVault.checkDailyTxHour(vaultId);
            if (dailyTxHourComplete) {
                //the number of daily transaction per hour is complete
                logger.error(message.DAILY_TX_HOUR_EXCEED);
                const { output } = Boom.badRequest();
                output.payload.message = message.DAILY_TX_HOUR_EXCEED;
                return responseFormat.handleError(res, output);
            }
            const dailyAmountComplete = await SharedVault.checkDailyAmount(vaultId);
            if (dailyAmountComplete) {
                //the number of daily amount is complete
                logger.error(message.DAILY_AMOUNT_EXCEED);
                const { output } = Boom.badRequest();
                output.payload.message = message.DAILY_AMOUNT_EXCEED;
                return responseFormat.handleError(res, output);
            }

            const signer = await signersModel.findOne({ userId, vault_name }).lean();
            if (!signer) {
                logger.error(message.SIGNER_NOT_EXIST);
                const { output } = Boom.badRequest();
                output.payload.message = message.SIGNER_NOT_EXIST;
                return responseFormat.handleError(res, output);
            }
            //verify the signature if correct or not
            const isSigned = await verifySignature(signer.address, signer.private_key, exists.address);
            if (!isSigned) {
                logger.error(message.NOT_SIGNED);
                const { output } = Boom.preconditionRequired();
                output.payload.message = message.NOT_SIGNED;
                return responseFormat.handleError(res, output);
            }
            countSignatures++;
            //return if signer has signed previously
            const signed = await signersModel.findOne({ userId, hasSigned: true, vault_name }).lean();
            if (signed) {
                logger.error(message.ALREADY_SIGNED);
                const { output } = Boom.badRequest();
                output.payload.message = message.ALREADY_SIGNED;
                return responseFormat.handleError(res, output);
            }
            //update shared vault countSignatures
            await sharedVaultModel.findOneAndUpdate({ name: vault_name }, {
                countSignatures: countSignatures,
            });
            //update the signedStatus of signer
            await signersModel.findOneAndUpdate({ userId, vault_name }, {
                hasSigned: true,
            });

            // save to transaction model for references
            const transactionObject = {
                sharedVault: exists._id,
                users: userId,
                transaction_type: 'withdraw',
                status: 'pending',
                to: receiver,
                from: exists.address,
                token: symbol,
                amount,
                timestamp: Date.now(),
            };
            const txData = await SharedVaultTransaction.create(transactionObject);
            const signerEmails = await signersModel.find({ vault_name }).lean();
            const filteredSignerEmails = signerEmails.filter(obj => obj.email !== userEmail);
            //send a mail to all co-signers for approval
            for (let signer of filteredSignerEmails) {
                const signerEmail = signer.email;
                const mailOptions = {
                    to: signerEmail,
                    subject: 'Approve withdraw request',
                    text: `Co-signer, Yeah!`,
                    html: `<p>Hi, ${signerEmail}, please approve this request of withdrawal by ${userEmail} <a href="${FRONTEND_LINK}/coSignerTxnVerification?init=${userEmail}&signerEmail=${signerEmail}&vault_name=${vault_name}&shared_vault_id=${vaultId}&shared_transaction_id=${txData._id}"><b>HERE</b></a></p><br />
                <p>In case you could not click the link above, copy and paste the link below in your browser</p><br />
                <p>${FRONTEND_LINK}/coSignerTxnVerification?init=${userEmail}&signerEmail=${signerEmail}&vault_name=${vault_name}&shared_vault_id=${vaultId}&shared_transaction_id=${txData._id}</p>
                <p>Token: ${symbol} <br /> 
                Receiver of the funds: ${receiver} <br />
                Amount: ${amount} <br /> 
                // SharedVaultTxId: ${txData._id} <br /> 
                // ShareVaultId: ${vaultId}</p>
                <p>The HydroVault Team</p>`,
                };
                await sendEmail(mailOptions);
            }
            data = {
                res,
                status: message.SUCCESS,
                statusCode: code.CREATED,
                data: { message: 'Successfully initiated a withdraw transaction. Co-signers will be notified.' },
            };
            return responseFormat.handleSuccess(res, data);
        } catch (error) {
            logger.error('Initiate Shared Vault Withdraw Transaction Error ', error);
            const { output } = Boom.badRequest();
            output.payload.message = error.message;
            return responseFormat.handleError(res, output);
        }
    }

    static async checkSigner(signerAddresses, vaultAddress) {
        const check = await checkSigner(signerAddresses, vaultAddress);
        if (check) return true;
        return false;
    }

    /**
     *
     * @description approve request to be a co-signer
     * @static
     * @param {*} req
     * @param {*} res
     * @memberof SharedVault
     */
    static async approveRequest(req, res) {
        var userEmail = req.user.email;
        var userId = req.user.id;
        var {
            approve,
            shared_transaction_id
        } = req.body;
        const { vaultId } = req.params;
        const validate = ajv.compile(schema.approveRequest);
        const validate_params = ajv.compile(schema.vaultIdParams);
        let data = {};
        var countSignatures = 0;

        // Validate the request body
        const valid_schema = validate(req.body);
        if (!valid_schema) {
            logger.error('Ajv Validation Error: %o', ajv.errorsText(validate.errors));
            const { output } = Boom.badRequest(ajv.errorsText(validate.errors));
            return responseFormat.handleError(res, output);
        }

        // Validate the request params
        const valid_schema_params = validate_params(req.params);
        if (!valid_schema_params) {
            logger.error('Ajv Validation Error: %o', ajv.errorsText(validate_params.errors));
            const { output } = Boom.badRequest(ajv.errorsText(validate_params.errors));
            return responseFormat.handleError(res, output);
        }

        try {
            // Check if VaultId exists before even doing anything
            const exists = await SharedVault.verifySharedVault(vaultId);
            if (!exists.isExists) {
                logger.error(message.VAULT_NOT_EXIST);
                const { output } = Boom.badRequest();
                output.payload.message = message.VAULT_NOT_EXIST;
                return responseFormat.handleError(res, output);
            }

            const sharedTransactionDetails = await SharedVaultTransaction.findById(shared_transaction_id).populate('sharedVault', 'name').lean();

            if (!sharedTransactionDetails) {
                logger.error(message.ID_NOT_FOUND);
                const { output } = Boom.badRequest();
                output.payload.message = message.ID_NOT_FOUND;
                return responseFormat.handleError(res, output);
            }
            var { sharedVault: { name: vault_name }, amount, token: symbol, to: receiver, from: sender } = sharedTransactionDetails;
            // check if the token symbol exist
            const tokenExist = await checkToken(symbol);
            if (!tokenExist) {
                logger.error(message.TOKEN_NOT_FOUND);
                const { output } = Boom.badRequest();
                output.payload.message = message.TOKEN_NOT_FOUND;
                return responseFormat.handleError(res, output);
            }

            if (!approve) {
                data = {
                    res,
                    status: message.SUCCESS,
                    statusCode: code.OK,
                    data: {
                        message: 'Withdraw Operation declined.'
                    },
                };
                return responseFormat.handleSuccess(res, data);
            }

            const signer = await signersModel.findOne({ email: userEmail, vault_name }).lean();
            const isSigned = await verifySignature(signer.address, signer.private_key, exists.address);
            if (!isSigned) {
                logger.error(message.NOT_SIGNED);
                const { output } = Boom.preconditionRequired();
                output.payload.message = message.NOT_SIGNED;
                return responseFormat.handleError(res, output);
            }
            countSignatures++;
            const signed = await signersModel.findOne({ userId, hasSigned: true, vault_name }).lean();
            if (signed) {
                logger.error(message.ALREADY_SIGNED);
                const { output } = Boom.badRequest();
                output.payload.message = message.ALREADY_SIGNED;
                return responseFormat.handleError(res, output);
            }
            await sharedVaultModel.findOneAndUpdate({ name: vault_name }, {
                countSignatures: countSignatures + 1,
            });
            //update the signedStatus of signer
            await signersModel.findOneAndUpdate({ userId, vault_name }, {
                hasSigned: true,
            });
            await SharedVaultTransaction.findOneAndUpdate({ _id: shared_transaction_id }, {
                $push: { users: userId },
            }).lean();

            // check if all signers have accepted the invitation
            // before performing the withdraw operation
            const checkAllSignatures = await sharedVaultModel.findOne({
                _id: vaultId,
                name: vault_name,
                numberOfSignatures: countSignatures + 1,
            }).lean();
            countSignatures = countSignatures + 1;
            if (checkAllSignatures) {
                logger.info('making the withdrawl request');
                const loadedAccount = {
                    address: "0x0cfC16DBBd960d5F0C312C339906080aEc5E0939",
                    private_key: "0xB493823E0098A0DE2C6A31FC970C2BC7A90C98F3C35E7F74F89D7DC9E3623B72",
                };
                const withdrawObj = {
                    metaPayer: loadedAccount.address,
                    metaPayerPK: loadedAccount.private_key,
                    vaultAddress: checkAllSignatures.address,
                    privateKey: checkAllSignatures.private_key,
                    receiver,
                    amount,
                    symbol,
                    countSignatures,
                };
                await approveContract(withdrawObj.metaPayer, withdrawObj.vaultAddress, withdrawObj.privateKey, withdrawObj.symbol, amount);
                const withdrawFunds = await multiSig(withdrawObj);
                console.log({ withdrawFunds });

                //update the vault config settings  
                await sharedVaultModel.findOneAndUpdate({ _id: vaultId }, {
                    countMaxDailyTx: `${exists.countMaxDailyTx + 1}`,
                    countTxHour: `${exists.countMaxDailyTxHour + 1}`,
                    currDailyAmount: `${exists.currDailyAmount + withdrawObj.amount}`,
                }).lean();
                //save to notifications table
                await NotificationModel.create({
                    userId,
                    email: userEmail,
                    type: 'shared',
                    message: `Your Withdraw transaction of ${amount} to ${withdrawObj.receiver} was successful`,
                });
                await SharedVaultTransaction.findOneAndUpdate({ _id: shared_transaction_id }, {
                    transaction_hash: withdrawFunds.transactionHash,
                    to: withdrawObj.receiver,
                    from: withdrawObj.vaultAddress,
                }).lean();
                let recipientId = null;
                let depositVaultId = null;
                let getSigners = null;
                let arrayOfUserId = [];
                const findRecipient = await sharedVaultModel.findOne({ address: withdrawObj.receiver }, 'signers').lean().exec();
                const findRecipientSingle = await VaultModel.findOne({ address: withdrawObj.receiver }, 'user').lean().exec();
                if (findRecipient) {
                    depositVaultId = findRecipient._id;
                    getSigners = findRecipient.signers;
                    const getUsers = await signersModel.find({ _id: { $in: getSigners } }, 'userId').lean();
                    for (let arr of getUsers) {
                        arrayOfUserId.push(arr.userId)
                    }
                    const DepositTxObject = {
                        sharedVault: vaultId,
                        users: arrayOfUserId,
                        transaction_type: 'deposit',
                        transaction_hash: withdrawFunds.transactionHash,
                        status: 'pending',
                        to: withdrawObj.receiver,
                        from: withdrawObj.vaultAddress,
                        token: withdrawObj.symbol,
                        amount,
                        timestamp: Date.now(),
                    };
                    await SharedVaultTransaction.create(DepositTxObject);
                    await NotificationModel.create({
                        userId: arrayOfUserId,
                        email: userEmail,
                        type: 'single',
                        message: `Deposit transaction of ${amount} from ${withdrawObj.sender} is successful.`,
                    });
                } else if (findRecipientSingle) {
                    recipientId = findRecipientSingle.user;
                    depositVaultId = findRecipientSingle._id;
                    const depositObject = {
                        vault: depositVaultId,
                        user: recipientId,
                        transaction_type: 'deposit',
                        transaction_hash: withdrawFunds.transactionHash,
                        status: 'pending',
                        to: withdrawObj.receiver,
                        from: withdrawObj.vaultAddress,
                        token: symbol,
                        amount,
                        timestamp: Date.now(),
                    };
                    await TransactionModel.create(depositObject);
                    await NotificationModel.create({
                        userId: recipientId,
                        email: userEmail,
                        type: 'single',
                        message: `Deposit transaction of ${amount} from ${withdrawObj.sender} is successful.`,
                    });
                }
                // const txArr = [WithdrawTxObject, DepositTxObject];
                // await SharedVaultTransaction.insertMany(txArr);
                // hasSigned should be false for all signers here
                await signersModel.updateMany({ vault_name }, { hasSigned: false });
                await sharedVaultModel.updateMany({ name: vault_name }, { countSignatures: 0 });
                data = {
                    res,
                    status: message.SUCCESS,
                    statusCode: code.OK,
                    data: {
                        message: 'Withdraw operation succeeded.'
                    },
                };
                return responseFormat.handleSuccess(res, data);
            } else {
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
        } catch (error) {
            //revert the signature counter and signature checker
            await sharedVaultModel.findOneAndUpdate({ name: vault_name }, {
                countSignatures: countSignatures - 1,
            });
            //update the signedStatus of signer
            await signersModel.findOneAndUpdate({ userId, vault_name }, {
                hasSigned: false,
            });
            await SharedVaultTransaction.findOneAndUpdate({ _id: shared_transaction_id }, {
                $pull: { users: userId },
            }).lean();
            logger.error('Multig withdraw Error: ', error);
            console.log(error)
            const { output } = Boom.badRequest();
            output.payload.message = error.message;
            return responseFormat.handleError(res, output);
        }

    }

    /**
     *
     * @description Get balance of shared vault
     * @static
     * @param {*} req
     * @param {*} res
     * @returns
     * @memberof SharedVault
     */
    static async getBalance(req, res) {
        let data = {};
        const validate_params = ajv.compile(schema.vaultIdParams);
        const validate_query = ajv.compile(schema.tokenSymbol);
        const userEmail = req.user.email;
        const { vaultId } = req.params;
        const { symbol } = req.query;

        // Validate the request params
        const valid_schema_params = validate_params(req.params);
        const validate_schema_query = validate_query(req.query);
        if (!valid_schema_params) {
            logger.error('Ajv Validation Error: %o', ajv.errorsText(validate_params.errors));
            const { output } = Boom.badRequest(ajv.errorsText(validate_params.errors));
            return responseFormat.handleError(res, output);
        }
        if (!validate_schema_query) {
            logger.error('Ajv Validation Error: %o', ajv.errorsText(validate_query.errors));
            const { output } = Boom.badRequest(ajv.errorsText(validate_query.errors));
            return responseFormat.handleError(res, output);
        }

        // Check if VaultId exists before even doing anything
        const exists = await SharedVault.verifySharedVault(vaultId);
        if (!exists.isExists) {
            logger.error(message.VAULT_NOT_EXIST);
            const { output } = Boom.badRequest();
            output.payload.message = message.VAULT_NOT_EXIST;
            return responseFormat.handleError(res, output);
        }

        // check if the token symbol exist
        const tokenExist = await checkToken(symbol);
        if (!tokenExist) {
            logger.error(message.TOKEN_NOT_FOUND);
            const { output } = Boom.badRequest();
            output.payload.message = message.TOKEN_NOT_FOUND;
            return responseFormat.handleError(res, output);
        }

        try {
            const balance = await getBalance(symbol, exists.address);
            data = {
                res,
                status: message.SUCCESS,
                statusCode: code.OK,
                data: {
                    message: message.SUCCESS,
                    balance,
                },
            };
            return responseFormat.handleSuccess(res, data);
        } catch (error) {
            logger.error('Get Shared Vault Balance Error: ', error);
            const { output } = Boom.badRequest();
            output.payload.message = error.message;
            return responseFormat.handleError(res, output);
        }
    }

    static async sharedVaults(req, res) {
        const _id = req.user.id;
        let data = {};
        const vaults = [];
        try {
            const signers = await signersModel.find({ userId: _id }).lean();
            let signersId = [];
            for (let s of signers) {
                signersId.push(s._id);
            }
            let userSharedVaults = await sharedVaultModel.find({ signers: { $in: signersId } }, 'currency signers address name numberOfSigners allAccepted').lean();
            //filter out falsey values
            // let filteredUserSharedVaults = userSharedVaults.filter(uV => uV.address !== '' && uV.address !== null);
            for (const userV of userSharedVaults) {
                vaults.push({
                    _id: userV._id,
                    currency: userV.currency,
                    signers: userV.signers,
                    name: userV.name,
                    address: userV.address,
                    numberOfSigners: userV.numberOfSigners,
                    allAccepted: userV.allAccepted,
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
            logger.error('Get all shared vaults: %o', error);
            const { output } = Boom.badImplementation(error.message);
            output.payload.message = error.message;
            return responseFormat.handleError(res, output);
        }
    }

    static async getSigners(req, res) {
        let data = {};
        const validate_params = ajv.compile(schema.vaultIdParams);
        const valid_schema_params = validate_params(req.params);
        if (!valid_schema_params) {
            logger.error('Ajv Validation Error: %o', ajv.errorsText(validate_params.errors));
            const { output } = Boom.badRequest(ajv.errorsText(validate_params.errors));
            return responseFormat.handleError(res, output);
        }
        const { vaultId: sharedVaultId } = req.params;
        // Check if VaultId exists before even doing anything
        const exists = await SharedVault.verifySharedVault(sharedVaultId);
        if (!exists.isExists) {
            logger.error(message.ID_NOT_FOUND);
            const { output } = Boom.badRequest();
            output.payload.message = message.ID_NOT_FOUND;
            return responseFormat.handleError(res, output);
        }
        try {
            const signers = await sharedVaultModel.find({ _id: sharedVaultId }, 'name address currency').populate('signers', 'email address');
            data = {
                res,
                status: message.SUCCESS,
                statusCode: code.OK,
                data: signers,
            };
            return responseFormat.handleSuccess(res, data);
        } catch (err) {
            logger.error('Shared Vault signers data Error: %o', err);
            const { output } = Boom.badImplementation();
            output.payload.message = err.message;
            return responseFormat.handleError(res, output);
        }

    }

    /**
     * @description Get single vault history of transactions
     * @static
     * @param {*} req
     * @param {*} res
     * @returns
     * @memberof Vault
     */
    static async history(req, res) {
        const userEmail = req.user.email;
        const userId = req.user.id;
        const validate = ajv.compile(schema.vaultHistory);
        const validate_params = ajv.compile(schema.vaultIdParams);
        const {
            action,
        } = req.query;
        let { page, size } = req.query;
        const { vaultId } = req.params;
        let data = {};

        page = parseInt(page, 10);
        size = parseInt(size, 10);

        req.query.page = page;
        req.query.size = size;

        // Validate the request or query params
        const valid_schema = validate(req.query);
        if (!valid_schema) {
            logger.error(ajv.errorsText(validate.errors));
            const { output } = Boom.badData(ajv.errorsText(validate.errors));
            return responseFormat.handleError(res, output);
        }

        // Validate the request params
        const valid_schema_params = validate_params(req.params);
        if (!valid_schema_params) {
            logger.error('Ajv Validation Error: %o', ajv.errorsText(validate_params.errors));
            const { output } = Boom.badRequest(ajv.errorsText(validate_params.errors));
            return responseFormat.handleError(res, output);
        }

        // Check if VaultId exists before even doing anything
        const exists = await SharedVault.verifySharedVault(vaultId);
        if (!exists.isExists) {
            logger.error(message.ID_NOT_FOUND);
            const { output } = Boom.badRequest();
            output.payload.message = message.ID_NOT_FOUND;
            return responseFormat.handleError(res, output);
        }

        const skip = size * page - size;
        let transactions;
        let count;
        let content;

        if (action === Action.ALL) {
            transactions = await SharedVaultTransaction.find({ sharedVault: vaultId, users: userId }, '-users').populate('sharedVault', 'name type').sort('timestamp').skip(skip).limit(size);
            count = await SharedVaultTransaction.find({ sharedVault: vaultId }).countDocuments();
            const deposit_transactions = lodashFilter(transactions, (transaction) => !lodashIncludes(['withdraw'], transaction.transaction_type));
            const withdrawal_transactions = lodashFilter(transactions, (transaction) => !lodashIncludes(['deposit'], transaction.transaction_type));
            content = { deposits: deposit_transactions, withdrawals: withdrawal_transactions };
        } else if (action === Action.WITHDRAW) {
            transactions = await SharedVaultTransaction.find({ sharedVault: vaultId, users: userId, transaction_type: Action.WITHDRAW }, '-users').populate('sharedVault', 'name type').sort('-timestamp').skip(skip).limit(size);
            count = await SharedVaultTransaction.find({ sharedVault: vaultId, transaction_type: Action.WITHDRAW }).countDocuments();
            content = { withdrawals: transactions };
        } else if (action === Action.DEPOSIT) {
            transactions = await SharedVaultTransaction.find({ sharedVault: vaultId, users: userId, transaction_type: Action.DEPOSIT }, '-users').populate('sharedVault', 'name type').sort('-timestamp').skip(skip).limit(size);
            count = await SharedVaultTransaction.find({ sharedVault: vaultId, transaction_type: Action.DEPOSIT }).countDocuments();
            content = { deposits: transactions };
        }

        data = {
            res,
            status: message.SUCCESS,
            statusCode: code.OK,
            historyData: {
                metadata: {
                    per_page: size,
                    page,
                    page_count: transactions.length ? Math.ceil(count / size) : 0,
                    total_count: count,
                    first: (page === 1),
                    last: (page * size >= count),
                },
                transactions: content,
            },
        };
        return responseFormat.handleSuccess(res, data);
    }

    static async allHistory(req, res) {
        const userEmail = req.user.email;
        const userId = req.user.id;
        const validate = ajv.compile(schema.vaultHistory);
        const {
            action,
        } = req.query;
        let { page, size } = req.query;
        let data = {};

        page = parseInt(page, 10);
        size = parseInt(size, 10);

        req.query.page = page;
        req.query.size = size;

        // Validate the request or query params
        const valid_schema = validate(req.query);
        if (!valid_schema) {
            logger.error(ajv.errorsText(validate.errors));
            const { output } = Boom.badData(ajv.errorsText(validate.errors));
            return responseFormat.handleError(res, output);
        }

        const skip = size * page - size;
        let transactions;
        let count;
        let content;

        try {
            if (action === Action.ALL) {
                transactions = await SharedVaultTransaction.find({ users: userId }, '-users').populate({ path: 'sharedVault', select: '_id name type' }).sort('-timestamp').skip(skip).limit(size);
                count = await SharedVaultTransaction.find({ users: userId }).populate({ path: 'sharedVault' }).countDocuments();
                const deposit_transactions = lodashFilter(transactions, (transaction) => !lodashIncludes(['withdraw'], transaction.transaction_type));
                const withdrawal_transactions = lodashFilter(transactions, (transaction) => !lodashIncludes(['deposit'], transaction.transaction_type));
                content = { deposits: deposit_transactions, withdrawals: withdrawal_transactions };
            } else if (action === Action.WITHDRAW) {
                transactions = await SharedVaultTransaction.find({ transaction_type: Action.WITHDRAW, users: userId }, '-users').populate({ path: 'sharedVault', select: '_id name type' }).sort('-timestamp').skip(skip).limit(size);
                count = await SharedVaultTransaction.find({ transaction_type: Action.WITHDRAW, users: userId }).populate({ path: 'sharedVault', match: { email: userEmail } }).countDocuments();
                content = { withdrawals: transactions };
            } else if (action === Action.DEPOSIT) {
                transactions = await SharedVaultTransaction.find({ transaction_type: Action.DEPOSIT, users: userId }, '-users').populate({ path: 'sharedVault', select: '_id name type' }).sort('-timestamp').skip(skip).limit(size);
                count = await SharedVaultTransaction.find({ transaction_type: Action.DEPOSIT, users: userId }, '-sharedVault').populate({ path: 'sharedVault' }).countDocuments();
                content = { deposits: transactions };
            }

            data = {
                res,
                status: message.SUCCESS,
                statusCode: code.OK,
                historyData: {
                    metadata: {
                        per_page: size,
                        page,
                        page_count: transactions.length ? Math.ceil(count / size) : 0,
                        total_count: count,
                        first: (page === 1),
                        last: (page * size >= count),
                    },
                    transactions: content,
                },
            };
            return responseFormat.handleSuccess(res, data);
        } catch (err) {
            logger.error('All Shared Transaction History Error : %o', err);
            const { output } = Boom.badImplementation();
            output.payload.message = err.message;
            return responseFormat.handleError(res, output);
        }
    }

    static async graph(req, res) {
        const validate_params = ajv.compile(schema.vaultIdParams);
        const validate_query = ajv.compile(schema.filterQuery);
        const { vaultId } = req.params;
        const { filter } = req.query;
        let data = {};
        const filteredDates = {
            week: {
                startOf: moment().subtract(7, 'd').toISOString(),
                endOf: moment().toISOString(),
            },
            month: {
                startOf: moment().subtract(30, 'd').toISOString(),
                endOf: moment().toISOString(),
            },
            year: {
                startOf: moment().subtract(365, 'd').toISOString(),
                endOf: moment().toISOString(),
            },
        };
        // Validate the request params
        const valid_schema_params = validate_params(req.params);
        if (!valid_schema_params) {
            logger.error('Ajv Validation Error: %o', ajv.errorsText(validate_params.errors));
            const { output } = Boom.badRequest(ajv.errorsText(validate_params.errors));
            return responseFormat.handleError(res, output);
        }

        // Validate the request query
        const valid_schema_query = validate_query(req.query);
        if (!valid_schema_query) {
            logger.error('Ajv Validation Error: %o', ajv.errorsText(validate_query.errors));
            const { output } = Boom.badRequest(ajv.errorsText(validate_query.errors));
            return responseFormat.handleError(res, output);
        }

        try {
            // Check if VaultId exists before even doing anything
            const exists = await SharedVault.verifySharedVault(vaultId);
            if (!exists.isExists) {
                logger.error(message.ID_NOT_FOUND);
                const { output } = Boom.badRequest();
                output.payload.message = message.ID_NOT_FOUND;
                return responseFormat.handleError(res, output);
            }
            const graphData = await SharedVaultTransaction.find({
                sharedVault: vaultId,
                timestamp: {
                    "$gte": filteredDates[filter].startOf,
                    "$lt": filteredDates[filter].endOf,
                }
            }, 'transaction_type amount timestamp status').lean().exec();
            data = {
                res,
                status: message.SUCCESS,
                statusCode: code.OK,
                data: graphData,
            };
            return responseFormat.handleSuccess(res, data);
        } catch (err) {
            logger.error('Shared Vault Graph Data Error: %o', err);
            const { output } = Boom.badImplementation();
            output.payload.message = err.message;
            return responseFormat.handleError(res, output);
        }
    }

    static async allGraph(req, res) {
        const userId = req.user.id;
        const validate_query = ajv.compile(schema.filterQuery);
        const { filter } = req.query;
        let data = {};
        const filteredDates = {
            week: {
                startOf: moment().subtract(7, 'd').toISOString(),
                endOf: moment().toISOString(),
            },
            month: {
                startOf: moment().subtract(30, 'd').toISOString(),
                endOf: moment().toISOString(),
            },
            year: {
                startOf: moment().subtract(365, 'd').toISOString(),
                endOf: moment().toISOString(),
            },
        };
        // Validate the request query
        const valid_schema_query = validate_query(req.query);
        if (!valid_schema_query) {
            logger.error('Ajv Validation Error: %o', ajv.errorsText(validate_query.errors));
            const { output } = Boom.badRequest(ajv.errorsText(validate_query.errors));
            return responseFormat.handleError(res, output);
        }
        try {
            const graphData = await SharedVaultTransaction.find({
                    users: userId,
                    timestamp: {
                        "$gte": filteredDates[filter].startOf,
                        "$lt": filteredDates[filter].endOf,
                    }
                }, 'transaction_type amount timestamp status')
                .populate('sharedVault', 'name currency')
                .lean().exec();
            data = {
                res,
                status: message.SUCCESS,
                statusCode: code.OK,
                data: graphData,
            };
            return responseFormat.handleSuccess(res, data);
        } catch (err) {
            logger.error('Shared Vault All Graph Data Error: %o', err);
            const { output } = Boom.badImplementation();
            output.payload.message = err.message;
            return responseFormat.handleError(res, output);
        }
    }

    /**
     *
     * @description Update config settings for vault
     * @static
     * @param {*} req
     * @param {*} res
     * @memberof Vault
     */
    static async updateConfig(req, res) {
        let data = {};
        const { vaultId } = req.params;
        const validate_params = ajv.compile(schema.vaultIdParams);
        const valid_schema_params = validate_params(req.params);
        const validate = ajv.compile(schema.updateConfig);
        const { maxDailyTx, maxDailyAmount, maxTxHour } = req.body;

        // Validate the request body
        const valid_schema = validate(req.body);
        if (!valid_schema) {
            logger.error('Ajv Validation Error: %o', ajv.errorsText(validate.errors));
            const { output } = Boom.badRequest(ajv.errorsText(validate.errors));
            return responseFormat.handleError(res, output);
        }

        // Validate the request params
        if (!valid_schema_params) {
            logger.error('Ajv Validation Error: %o', ajv.errorsText(validate_params.errors));
            const { output } = Boom.badRequest(ajv.errorsText(validate_params.errors));
            return responseFormat.handleError(res, output);
        }

        // Check if VaultId exists before even doing anything
        const exists = await SharedVault.verifySharedVault(vaultId);
        if (!exists.isExists) {
            logger.error(message.ID_NOT_FOUND);
            const { output } = Boom.badRequest();
            output.payload.message = message.ID_NOT_FOUND;
            return responseFormat.handleError(res, output);
        }

        try {
            await sharedVaultModel.findOneAndUpdate({ _id: vaultId }, {
                maxDailyTx,
                maxDailyAmount,
                maxTxHour,
            }).lean();
            data = {
                res,
                status: message.SUCCESS,
                statusCode: code.OK,
                data: {
                    message: message.OPERATION_SUCCESS,
                },
            };
            return responseFormat.handleSuccess(res, data);
        } catch (error) {
            logger.error('Update Config Error: ', error);
            console.log(error)
            const { output } = Boom.badRequest();
            output.payload.message = error.message;
            return responseFormat.handleError(res, output);
        }
    }

    /**
     *
     * @description Checks the status of a transaction hash and updates the db accordingly
     * @static
     * @memberof Transaction
     */
    static async statusCheck() {
        try {
            const [transactions] = await of(SharedVaultTransaction.find({ status: 'pending' }).select('transaction_hash').lean().exec());
            if (transactions) {
                for (const tx of transactions) {
                    if (tx && tx.transaction_hash) {
                        const txHash = tx.transaction_hash;
                        const txInfo = await getTransactionInfo(txHash);
                        // if blockhash, blocknumber, txIndex is not empty, it means it is completed and no more null
                        // (equivalent to pending in the database)
                        if (txInfo.blockHash !== null && txInfo.blockNumber !== null) {
                            await SharedVaultTransaction.updateMany({ transaction_hash: txHash }, {
                                "$set": { status: 'completed' }
                            })
                            logger.info('Updated a record');
                        }
                    }
                }
            }
        } catch (err) {
            logger.info('An Error occured while update shared vault record status : %o', err);
        }
    }

    /**
     *
     * @description Get TransferSuccessful event from the contract to track deposit transactions
     * @static
     * @memberof SharedVault
     */
    static async getDepositEvent() {
        try {
            const vaultAddresses = await sharedVaultModel.find({}, 'address').lean();
            let events = [];
            for (let vaultAddress of vaultAddresses) {
                events = await getEvents(vaultAddress.address);
                if (Array.isArray(events) && events.length) {
                    // loop the events array
                    for (let event of events) {
                        let recipientId = null;
                        let vaultId = null;
                        const { transactionHash, returnValues: { token, sender, recipient, amount } } = event;
                        const findRecipient = await sharedVaultModel.findOne({ address: recipient }).lean().exec();
                        const signers = await signersModel.find({ vault_name: findRecipient.name }).lean().exec();
                        //check if recipient exist in our platform
                        if (findRecipient) {
                            recipientId = findRecipient.user;
                            vaultId = findRecipient._id;
                        }
                        // check if the hash exists in the db (to prevent duplicates)
                        const checkIfExists = await SharedVaultTransaction.find({ transaction_type: 'deposit', transaction_hash: transactionHash }).lean();
                        if (!checkIfExists.length) {
                            let userIds = [];
                            for (let signer of signers) {
                                userIds.push(signer.userId);
                            }
                            await SharedVaultTransaction.create({
                                sharedVault: vaultId,
                                users: userIds,
                                transaction_type: 'deposit',
                                transaction_hash: transactionHash,
                                status: 'pending',
                                to: recipient,
                                from: sender,
                                token: tokenSymbol[token],
                                amount,
                                timestamp: Date.now(),
                            });
                        }
                    }
                }
            }
        } catch (err) {
            logger.error('Get shared vault Deposits Transaction Error : %o', err);
        }
    }

}

module.exports = SharedVault;