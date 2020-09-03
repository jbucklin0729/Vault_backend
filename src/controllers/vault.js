/* eslint-disable eol-last */
/* eslint-disable space-before-function-paren */
/* eslint-disable indent */
const Boom = require('boom');
const Ajv = require('ajv');
const cryptoRandomString = require('crypto-random-string');
const { of } = require('await-of');
const CoinGecko = require('coingecko-api');
const logger = require('../config/winston');
const code = require('../constants/codes');
const message = require('../constants/messages');
const Status = require('../constants/statuses');
const schema = require('../utils/validators/vaultValidators');
const responseFormat = require('../utils/responseFormat');
const sendEmail = require('../utils/sendEmail');
const {
    forTest,
    getBal,
    printTransaction,
    getTransactionsByAccount,
    getBalance,
    generateWallet,
    create: createVault,
    withdraw,
    getTransactionInfo,
    approveContract,
    getAllBalance,
    getWalletBalance
} = require('../utils/vaultLib');

const {
    w,
    getTransactionReceipt,
    create: testCreate,
    perToken,
} = require('../utils/testLib');

const VaultModel = require('../models/vault');
const sharedVaultModel = require('../models/shared_vault');
const sharedVaultTransaction = require('../models/shared_transaction');
const signersModel = require('../models/signers');
const UserModel = require('../models/user');
const TransactionModel = require('../models/transaction');
const Transaction = require('../controllers/transaction');
const TokenModel = require('../models/token');
const NotificationModel = require('../models/notifications');

const allDefaultTokens = require('../utils/allTokens');



const ajv = Ajv({ allErrors: true, $data: true });
require('ajv-errors')(ajv);



const checkToken = async(symbol) => {
    const [tokens] = await of(TokenModel.find({}).lean());
    if (tokens.some((s) => s.symbol === symbol)) {
        return true;
    }
    return false;
}

class Vault {
    static async forTest(req, res) {
        const v = await forTest();
        res.json({
            v,
        });
        // console.log(v.Wallet)
    }

    /**
     *
     * @description verifies if the vaultId exists
     * @static
     * @param {number} vaultId
     * @returns {boolean} true or false
     * @memberof Vault
     */
    static async verifyVault(vaultId) {
        const exists = await VaultModel.findById(vaultId, '_id address private_key countMaxDailyTx countTxHour currDailyAmount').lean();
        if (exists) return {
            _id: exists._id,
            isExists: true,
            address: exists.address,
            private_key: exists.private_key,
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
        const check = await VaultModel.findOne({ _id: vaultId }, 'maxDailyTx countMaxDailyTx').lean()
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
        const check = await VaultModel.findOne({ _id: vaultId }, 'maxTxHour countTxHour').lean()
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
        const check = await VaultModel.findOne({ _id: vaultId }, 'maxDailyAmount currDailyAmount').lean()
        if (check.currDailyAmount !== 0 && check.maxDailyAmount == check.currDailyAmount) {
            return true;
        }
        return false;
    }


    /**
     *
     * @description Create a new vault (internal function)
     * @static
     * @param {*} req
     * @param {*} res
     * @returns
     * @memberof Vault
     */
    static async createNew(newVaultData) {
        let data = {};
        const {
            user,
            currency,
        } = newVaultData;
        const wallet = await generateWallet();
        // when address is created, send the address and private key to the user's email address
        const mailOptions = {
            to: user.email,
            subject: 'New Account Private Key - Hydro Vault',
            text: `Thank you for creating an account with us. Your digital currency is in safe heaven :)
                    This is your Private Key ${wallet.privateKey}, Public key ${wallet.publicKey}`,
        };
        await sendEmail(mailOptions);
        const random_string = cryptoRandomString({ length: 5 });
        const vault_name = user.vault_name ? user.vault_name : `Vault_${random_string}`;
        const vault_type = user.vault_type ? user.vault_type : 'single';
        try {
            // save vault basic config
            const vaultData = await VaultModel.create({
                user: user._id,
                email: user.email,
                private_key: wallet.privateKey,
                currency,
                name: vault_name,
                type: vault_type,
                address: wallet.address,
            });
            //logger.debug('Vault Data', vaultData);
            await UserModel.updateOne({ _id: user._id }, {
                $push: { vaults: vaultData._id },
            });
            // save the basic vault config to the blockchain
            // const newVault = await (createVault(vaultAddress, vaultPrivateKey, user.email, vaultData._id));
            data = {
                status: message.SUCCESS,
                statusCode: code.OK,
                data: {
                    message: message.SUCCESS,
                    walletAddress: wallet.address,
                    _id: vaultData._id,
                    // currency: vaultData.currency,
                    // mnemonic: wallet.mnemonic,
                    // publicKey: wallet.publicKey,
                    // transactionHash: newVault.transactionHash,
                },
            };
            return {
                metadata: data.data,
            };
        } catch (error) {
            logger.error('Vault Creation Error: ', error);
            const { output } = Boom.badRequest();
            return {
                status: message.FAILED,
                statusCode: output.statusCode,
                data: {
                    message: error.message,
                },
            };
        }
    }


    /**
     *
     * @description Creates a new vault from inside a vault
     * @static
     * @param {*} req
     * @param {*} res
     * @returns
     * @memberof Vault
     */
    static async new(req, res) {
        let data = {};
        let result;
        const validate = ajv.compile(schema.newVault);
        // Validate the request or query params
        const valid_schema = validate(req.body);
        if (!valid_schema) {
            logger.error('Ajv Validation Error: %o', ajv.errorsText(validate.errors));
            const { output } = Boom.badRequest(ajv.errorsText(validate.errors));
            return responseFormat.handleError(res, output);
        }
        const {
            type,
            email,
            name,
            currency,
        } = req.body;
        try {
            let foundUser = await UserModel.findOne({ email }).lean();
            if (foundUser) {
                foundUser.vault_type = type;
                foundUser.vault_name = name;
                const newVaultData = {
                    user: foundUser,
                    currency,
                };
                // create a vault in the DB and on the Blockchain
                result = await Vault.createNew(newVaultData);
                if (result.status === message.FAILED) {
                    const { output } = Boom.badRequest();
                    output.payload.message = result.data.message;
                    return responseFormat.handleError(res, output);
                }
            } else {
                logger.error(message.ACCOUNT_NOT_FOUND);
                const { output } = Boom.badRequest();
                output.payload.message = message.ACCOUNT_NOT_FOUND;
                return responseFormat.handleError(res, output);
            }
            result.metadata.message = 'New Vault Created';
            data = {
                res,
                status: message.SUCCESS,
                statusCode: code.CREATED,
                data: result.metadata,
            };
            return responseFormat.handleSuccess(res, data);
        } catch (error) {
            logger.error('Vault Create Error ', error);
            const { output } = Boom.badRequest();
            output.payload.message = error.message;
            return responseFormat.handleError(res, output);
        }
    }

    /**
     *
     * @description Withdraw funds from vault
     * @static
     * @param {*} req
     * @param {*} res
     * @returns
     * @memberof Vault
     */
    static async withdraw(req, res) {
        let data = {};
        let arrayOfUserId = [];
        const validate = ajv.compile(schema.vaultWithdraw);
        const validate_params = ajv.compile(schema.vaultIdParams);
        const userEmail = req.user.email;
        const userId = req.user.id;
        const { receiver, amount, symbol } = req.body;
        const { vaultId } = req.params;
        let countMaxDailyTx = 0;
        let countMaxDailyTxHour = 0;
        let currDailyAmount = 0;

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
        const exists = await Vault.verifyVault(vaultId);
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
            const dailyTxComplete = await Vault.checkDailyTx(vaultId);
            if (dailyTxComplete) {
                //the number of daily transactipon is complete
                logger.error(message.DAILY_TX_EXCEED);
                const { output } = Boom.badRequest();
                output.payload.message = message.DAILY_TX_EXCEED;
                return responseFormat.handleError(res, output);
            }
            const dailyTxHourComplete = await Vault.checkDailyTxHour(vaultId);
            if (dailyTxHourComplete) {
                //the number of daily transaction per hour is complete
                logger.error(message.DAILY_TX_HOUR_EXCEED);
                const { output } = Boom.badRequest();
                output.payload.message = message.DAILY_TX_HOUR_EXCEED;
                return responseFormat.handleError(res, output);
            }
            const dailyAmountComplete = await Vault.checkDailyAmount(vaultId);
            if (dailyAmountComplete) {
                //the number of daily amount is complete
                logger.error(message.DAILY_AMOUNT_EXCEED);
                const { output } = Boom.badRequest();
                output.payload.message = message.DAILY_AMOUNT_EXCEED;
                return responseFormat.handleError(res, output);
            }

            const withdrawObj = {
                sender: exists.address,
                privateKey: exists.private_key,
                sendEmail: userEmail,
                receiver,
                amount,
                symbol,
            };
            // const withdrawFunds = await withdraw(receiver, userEmail, vaultId, amount);
            //await approveContract(withdrawObj.sender, withdrawObj.privateKey, withdrawObj.symbol, amount);
            const withdrawFunds = await withdraw(withdrawObj);
            console.log({ withdrawFunds })
            data = {
                res,
                status: message.SUCCESS,
                statusCode: code.OK,
                data: {
                    message: message.SUCCESS,
                    link: `https://rinkeby.etherscan.io/tx/${withdrawFunds.transactionHash}`,
                    //link: `https://rinkeby.etherscan.io/tx/${withdrawFunds}`
                },
            };

            //update the vault config settings  
            await VaultModel.findOneAndUpdate({ _id: vaultId }, {
                countMaxDailyTx: `${exists.countMaxDailyTx + 1}`,
                countTxHour: `${exists.countMaxDailyTxHour + 1}`,
                currDailyAmount: `${exists.currDailyAmount + withdrawObj.amount}`,
            }).lean();

            //save in the notification model
            await NotificationModel.create({
                userId,
                email: userEmail,
                type: 'single',
                message: `Your Withdraw transaction of ${amount} to ${withdrawObj.receiver} was successful.`,
            });
            let recipientId = null;
            let depositVaultId = null;
            let depositVaultIdShared = null;
            let getSigners = null;
            //these two checks are checking if the receiver is a user in our platform
            const findRecipient = await VaultModel.findOne({ address: withdrawObj.receiver }, 'user').lean().exec();
            const findRecipientShared = await sharedVaultModel.findOne({ address: withdrawObj.receiver }, 'signers _id').lean().exec();
            //check if recipient exist in our platform
            if (findRecipient) {
                recipientId = findRecipient.user;
                depositVaultId = findRecipient._id;
                const depositObject = {
                    vault: depositVaultId,
                    user: recipientId,
                    transaction_type: 'deposit',
                    transaction_hash: withdrawFunds.transactionHash,
                    status: 'pending',
                    to: withdrawObj.receiver,
                    from: withdrawObj.sender,
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
            } else if (findRecipientShared) {
                depositVaultIdShared = findRecipientShared._id;
                getSigners = findRecipientShared.signers;
                const getUsers = await signersModel.find({ _id: { $in: getSigners } }, 'userId').lean();
                for (let arr of getUsers) {
                    arrayOfUserId.push(arr.userId)
                }
                const DepositTxObject = {
                    sharedVault: depositVaultIdShared,
                    users: arrayOfUserId,
                    transaction_type: 'deposit',
                    transaction_hash: withdrawFunds.transactionHash,
                    status: 'pending',
                    to: withdrawObj.receiver,
                    from: withdrawObj.sender,
                    token: withdrawObj.symbol,
                    amount,
                    timestamp: Date.now(),
                };
                await sharedVaultTransaction.create(DepositTxObject);

                //add to notification model
                await NotificationModel.create({
                    userId: recipientId,
                    email: userEmail,
                    type: 'shared',
                    message: `Deposit transaction of ${amount} from ${withdrawObj.sender} is successful.`,
                });
            }
            // save to transaction model
            const withdrawObject = {
                vault: exists._id,
                user: userId,
                transaction_type: 'withdraw',
                transaction_hash: withdrawFunds.transactionHash,
                status: 'pending',
                to: withdrawObj.receiver,
                from: withdrawObj.sender,
                token: symbol,
                amount,
                timestamp: Date.now(),
            };
            await TransactionModel.create(withdrawObject);
            return responseFormat.handleSuccess(res, data);
        } catch (error) {
            logger.error('Vault Withdraw Error ', error);
            const { output } = Boom.badRequest();
            output.payload.message = error.message;
            return responseFormat.handleError(res, output);
        }
    }

    /**
     *
     * @description Deposit funds into a vault
     * @static
     * @param {*} req
     * @param {*} res
     * @returns
     * @memberof Vault
     */
    static async deposit(req, res) {
        const { vaultId } = req.params;
        let data = {};
        const validate_params = ajv.compile(schema.vaultIdParams);

        // Validate the value passed
        const valid_schema_params = validate_params(vaultId);
        if (!valid_schema_params) {
            logger.error('Ajv Validation Error: %o', ajv.errorsText(validate_params.errors));
            const { output } = Boom.badRequest(ajv.errorsText(validate_params.errors));
            return responseFormat.handleError(res, output);
        }

        try {
            const exists = await Vault.verifyVault(vaultId);
            if (!exists.isExists) {
                logger.error(message.ACCOUNT_NOT_FOUND);
                const { output } = Boom.badRequest();
                output.payload.message = message.ACCOUNT_NOT_FOUND;
                return responseFormat.handleError(res, output);
            }
            // const vault = await VaultModel.findById(vaultId);
            data = {
                res,
                status: message.SUCCESS,
                statusCode: code.OK,
                data: {
                    message: message.SUCCESS,
                    address: exists.address,
                },
            };
            return responseFormat.handleSuccess(res, data);
        } catch (error) {
            logger.error('Vault Deposit Error: ', error);
            const { output } = Boom.badRequest();
            output.payload.message = error.message;
            return responseFormat.handleError(res, output);
        }
    }

    /**
     *
     * @description Get balance of vault
     * @static
     * @param {*} req
     * @param {*} res
     * @returns
     * @memberof Vault
     */
    static async getBalance(req, res) {
        let data = {};
        const validate_params = ajv.compile(schema.vaultIdParams);
        const validate_query = ajv.compile(schema.tokenSymbol);
        const userEmail = req.user.email;
        // const userEmail = 'oluwafemiakinde@gmail.com';
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
        const exists = await Vault.verifyVault(vaultId);
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
            // const getVault = await VaultModel.findById(vaultId).lean();
            const balance = await getBalance(symbol, exists.address);
            // const balance = await getBalance(userEmail, vaultId);
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
            logger.error('Get Balance Error: ', error);
            const { output } = Boom.badRequest();
            output.payload.message = error.message;
            return responseFormat.handleError(res, output);
        }
    }

    /**
     *
     * @description Generate a new topup wallet for vault
     * @static
     * @param {*} req
     * @param {*} res
     * @returns
     * @memberof Vault
     */
    static async generateWallet(req, res) {
        let data = {};
        try {
            const wallet = await generateWallet();
            data = {
                res,
                status: message.SUCCESS,
                statusCode: code.OK,
                data: {
                    message: message.SUCCESS,
                    wallet: {
                        address: wallet.address,
                        privateKey: wallet.privateKey,
                    },
                },
            };
            return responseFormat.handleSuccess(res, data);
        } catch (error) {
            logger.error('Generate Wallet Error: ', error);
            const { output } = Boom.badImplementation();
            output.payload.message = error.message;
            return responseFormat.handleError(res, output);
        }
    }

    static async getTransactionInfo(req, res) {
        let data = {};
        const validate_param = ajv.compile(schema.vaultTxHash);
        const { txHash } = req.params;

        if (!validate_param) {
            logger.error('Ajv Validation Error: %o', ajv.errorsText(validate_param.errors));
            const { output } = Boom.badRequest(ajv.errorsText(validate_param.errors));
            return responseFormat.handleError(res, output);
        }
        try {
            const txInfo = await getTransactionInfo(txHash);
            data = {
                res,
                status: message.SUCCESS,
                statusCode: code.OK,
                data: {
                    message: message.SUCCESS,
                    txInfo,
                },
            };
            return responseFormat.handleSuccess(res, data);
        } catch (error) {
            logger.error('Get Tx Info ', error);
            const { output } = Boom.badRequest();
            output.payload.message = error.message;
            return responseFormat.handleError(res, output);
        }
    }

    static async getBal(req, res) {
        // const bal = await getBal();
        // const tx = await printTransaction();
        const acc = await getTransactionsByAccount('0xD0d0Ea682fc13E4c718cE88d1F40FadC548E6Edb');
        console.log({ bal });
    }

    static async perToken(req, res) {
        const p = await perToken();
        console.log({ p });
    }

    /**
     *
     * @description - get all wallet token balance
     * @static
     * @param {*} req
     * @param {*} res
     * @returns
     * @memberof Vault
     */
    static async getAllTokenBalance(req, res) {
        let data = {};
        const { vaultId } = req.params;
        const validate_params = ajv.compile(schema.vaultIdParams);
        const valid_schema_params = validate_params(vaultId);
        if (!valid_schema_params) {
            logger.error('Ajv Validation Error: %o', ajv.errorsText(validate_params.errors));
            const { output } = Boom.badRequest(ajv.errorsText(validate_params.errors));
            return responseFormat.handleError(res, output);
        }

        const vault = await VaultModel.findById(vaultId);
        const [results, error] = await of(getAllBalance(vault.address));
        if (error) {
            logger.error('Get All Token Balances Error: ', error);
            const { output } = Boom.badRequest();
            output.payload.message = error.message;
            return responseFormat.handleError(res, output);
        }
        data = {
            res,
            status: message.SUCCESS,
            statusCode: code.OK,
            data: {
                results,
            },
        };
        return responseFormat.handleSuccess(res, data);
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
        const exists = await Vault.verifyVault(vaultId);
        if (!exists.isExists) {
            logger.error(message.ID_NOT_FOUND);
            const { output } = Boom.badRequest();
            output.payload.message = message.ID_NOT_FOUND;
            return responseFormat.handleError(res, output);
        }

        try {
            await VaultModel.findOneAndUpdate({ _id: vaultId }, {
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

    static async getTransactionReceipt(req, res) {
        const receipt = await getTransactionReceipt('7da5f25e30e8ecdd69f846a8c2660f335489a518b84e1f0aab653a54d7ecac81');
        console.log({ receipt });
    }

    static async walletBalance(req, res) {
        const { address } = req.query;
        let data = {};
        const validate = ajv.compile(schema.walletAddress);
        // Validate the value passed
        const validate_schema_query = validate(req.query);
        if (!validate_schema_query) {
            logger.error('Ajv Validation Error: %o', ajv.errorsText(validate.errors));
            const { output } = Boom.badRequest(ajv.errorsText(validate.errors));
            return responseFormat.handleError(res, output);
        }
        const balance = await getWalletBalance(address);
        data = {
            res,
            status: message.SUCCESS,
            statusCode: code.OK,
            data: {
                balance: balance.toFixed(3),
            },
        };
        return responseFormat.handleSuccess(res, data);

    }

    static async testCoinGecko(crypto, value, type) {
        const data = await CoinGeckoClient.simple.fetchTokenPrice({
            // ids: ['bitcoin', 'hydro'],
            // vs_currencies: ['usd'],
            contract_addresses: '0xebbdf302c940c6bfd49c6b165f457fdb324649bc',
            vs_currencies: 'usd',
        });
        let g = data.data['hydro']['usd'];
        console.log({ g })
    }

}


module.exports = Vault;