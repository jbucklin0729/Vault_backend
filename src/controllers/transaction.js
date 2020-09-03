/* eslint-disable no-restricted-syntax */
/* eslint-disable no-undef */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-empty */
/* eslint-disable eol-last */
/* eslint-disable indent */

const Boom = require('boom');
const { of } = require('await-of');
const Ajv = require('ajv');
const moment = require('moment');
const lodashFilter = require('lodash/filter');
const lodashIncludes = require('lodash/includes');
const lodashUniqueBy = require('lodash/uniqBy');
const TransactionModel = require('../models/transaction');
const UserModel = require('../models/user');
const VaultModel = require('../models/vault');
const Action = require('../constants/actions');
const message = require('../constants/messages');
const code = require('../constants/codes');
const schema = require('../utils/validators/vaultValidators');
const logger = require('../config/winston');
const responseFormat = require('../utils/responseFormat');
const { tokenSymbol } = require('../utils/allTokens');


const {
    getTransactionInfo,
    getEvents,
} = require('../utils/vaultLib');

const VaultController = require('../controllers/vault');

const ajv = Ajv({ allErrors: true, $data: true });
require('ajv-errors')(ajv);

class Transaction {
    /**
     *
     *
     * @static
     * @param {object} res Response object
     * @param {number} vaultId
     * @returns {boolean} true or false
     * @memberof Vault
     */
    static async verifyVault(res, vaultId) {
        const validate_params = ajv.compile(schema.vaultIdParams);

        // Validate the value passed
        const valid_schema_params = validate_params(vaultId);
        if (!valid_schema_params) {
            logger.error('Ajv Validation Error: %o', ajv.errorsText(validate_params.errors));
            const { output } = Boom.badRequest(ajv.errorsText(validate_params.errors));
            return responseFormat.handleError(res, output);
        }

        // Check the DB
        const exists = await VaultModel.findById(vaultId);
        if (exists) return true;
        return false;
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
        const exists = await Transaction.verifyVault(res, vaultId);
        if (!exists) {
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
            transactions = await TransactionModel.find({ vault: vaultId, user: userId }, '-__v').sort('timestamp').populate('vault', 'name type').skip(skip).limit(size);
            count = await TransactionModel.find({ vault: vaultId }).countDocuments();
            const deposit_transactions = lodashFilter(transactions, (transaction) => !lodashIncludes(['withdraw'], transaction.transaction_type));
            const withdrawal_transactions = lodashFilter(transactions, (transaction) => !lodashIncludes(['deposit'], transaction.transaction_type));
            content = { deposits: deposit_transactions, withdrawals: withdrawal_transactions };
        } else if (action === Action.WITHDRAW) {
            transactions = await TransactionModel.find({ vault: vaultId, user: userId, transaction_type: Action.WITHDRAW }).populate('vault', 'name type').sort('-timestamp').skip(skip).limit(size);
            count = await TransactionModel.find({ vault: vaultId, transaction_type: Action.WITHDRAW }).countDocuments();
            content = { withdrawals: transactions };
        } else if (action === Action.DEPOSIT) {
            transactions = await TransactionModel.find({ vault: vaultId, user: userId, transaction_type: Action.DEPOSIT }, '-__v').populate('vault', 'name type').sort('-timestamp').skip(skip).limit(size);
            count = await TransactionModel.find({ vault: vaultId, transaction_type: Action.DEPOSIT }).countDocuments();
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

    /**
     * @description Get all vaults history of transactions
     * @static
     * @param {*} req
     * @param {*} res
     * @returns
     * @memberof Vault
     */
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
                transactions = await TransactionModel.find({ user: userId }).populate({ path: 'vault', select: '_id name type' }).sort('-timestamp').skip(skip).limit(size);
                count = await TransactionModel.find({ user: userId }).populate({ path: 'vault' }).countDocuments();
                const deposit_transactions = lodashFilter(transactions, (transaction) => !lodashIncludes(['withdraw'], transaction.transaction_type));
                const withdrawal_transactions = lodashFilter(transactions, (transaction) => !lodashIncludes(['deposit'], transaction.transaction_type));
                content = { deposits: deposit_transactions, withdrawals: withdrawal_transactions };
            } else if (action === Action.WITHDRAW) {
                transactions = await TransactionModel.find({ transaction_type: Action.WITHDRAW, user: userId }).populate({ path: 'vault', select: '_id name type' }).sort('-timestamp').skip(skip).limit(size);
                count = await TransactionModel.find({ transaction_type: Action.WITHDRAW, user: userId }).populate({ path: 'vault', match: { email: userEmail } }).countDocuments();
                content = { withdrawals: transactions };
            } else if (action === Action.DEPOSIT) {
                transactions = await TransactionModel.find({ transaction_type: Action.DEPOSIT, user: userId }).populate({ path: 'vault', select: '_id name type' }).sort('-timestamp').skip(skip).limit(size);
                count = await TransactionModel.find({ transaction_type: Action.DEPOSIT, user: userId }, '-vault').populate({ path: 'vault' }).countDocuments();
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
            logger.error('All Transaction History Error : %o', err);
            const { output } = Boom.badImplementation();
            output.payload.message = err.message;
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
            const [transactions] = await of(TransactionModel.find({ status: 'pending' }).select('transaction_hash').lean().exec());
            if (transactions) {
                for (const tx of transactions) {
                    if (tx && tx.transaction_hash) {
                        const txHash = tx.transaction_hash;
                        const txInfo = await getTransactionInfo(txHash);
                        // if blockhash, blocknumber, txIndex is not empty, it means it is completed and no more null
                        // (equivalent to pending in the database)
                        if (txInfo.blockHash !== null && txInfo.blockNumber !== null) {
                            await TransactionModel.updateMany({ transaction_hash: txHash }, {
                                "$set": { status: 'completed' }
                            })
                            logger.info('Updated a record');
                        }
                    }
                }
            }
        } catch (err) {
            logger.info('An Error occured while update record status : %o', err);
        }
    }

    /**
     *
     * @description Get TransferSuccessful event from the contract to track deposit transactions
     * @static
     * @memberof Transaction
     */
    static async getDepositEvent() {
        try {
            const vaultAddresses = await VaultModel.find({}, 'address');
            let events = [];
            for (let vaultAddress of vaultAddresses) {
                events = await getEvents(vaultAddress.address);
                if (Array.isArray(events) && events.length) {
                    // loop the events array
                    for (let event of events) {
                        let recipientId = null;
                        let vaultId = null;
                        const { transactionHash, returnValues: { token, sender, recipient, amount } } = event;
                        const findRecipient = await VaultModel.findOne({ address: recipient }).lean().exec();
                        //check if recipient exist in our platform
                        if (findRecipient) {
                            recipientId = findRecipient.user;
                            vaultId = findRecipient._id;
                        }
                        // check if the hash exists in the db (to prevent duplicates)
                        const checkIfExists = await TransactionModel.find({ transaction_type: 'deposit', transaction_hash: transactionHash }).lean();
                        if (!checkIfExists.length) {
                            await TransactionModel.create({
                                //vault: foundVaultAddress._id,
                                vault: vaultId,
                                user: recipientId,
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
            logger.error('Get Deposits Transaction Error : %o', err);
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
                // startOf: moment().startOf('week').toISOString(),
                // endOf: moment().endOf('week').toISOString(),
                startOf: moment().subtract(7, 'd').toISOString(),
                endOf: moment().toISOString(),
            },
            month: {
                // startOf: moment().startOf('month').toISOString(),
                // endOf: moment().endOf('month').toISOString(),
                startOf: moment().subtract(30, 'd').toISOString(),
                endOf: moment().toISOString(),
            },
            year: {
                // startOf: moment().startOf('year').toISOString(),
                // endOf: moment().endOf('year').toISOString(),
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
            const exists = await Transaction.verifyVault(res, vaultId);
            if (!exists) {
                logger.error(message.ID_NOT_FOUND);
                const { output } = Boom.badRequest();
                output.payload.message = message.ID_NOT_FOUND;
                return responseFormat.handleError(res, output);
            }
            const graphData = await TransactionModel.find({
                vault: vaultId,
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
            logger.error('Graph Data Error: %o', err);
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
                // startOf: moment().startOf('week').toISOString(),
                // endOf: moment().endOf('week').toISOString(),
                startOf: moment().subtract(7, 'd').toISOString(),
                endOf: moment().toISOString(),
            },
            month: {
                // startOf: moment().startOf('month').toISOString(),
                // endOf: moment().endOf('month').toISOString(),
                startOf: moment().subtract(30, 'd').toISOString(),
                endOf: moment().toISOString(),
            },
            year: {
                // startOf: moment().startOf('year').toISOString(),
                // endOf: moment().endOf('year').toISOString(),
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
            const graphData = await TransactionModel.find({
                    user: userId,
                    timestamp: {
                        "$gte": filteredDates[filter].startOf,
                        "$lt": filteredDates[filter].endOf,
                    }
                }, 'transaction_type amount timestamp status')
                .populate('vault', 'name currency')
                .lean().exec();
            data = {
                res,
                status: message.SUCCESS,
                statusCode: code.OK,
                data: graphData,
            };
            return responseFormat.handleSuccess(res, data);
        } catch (err) {
            logger.error('All Graph Data Error: %o', err);
            const { output } = Boom.badImplementation();
            output.payload.message = err.message;
            return responseFormat.handleError(res, output);
        }
    }
}


module.exports = Transaction;