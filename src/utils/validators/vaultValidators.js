/* eslint-disable eol-last */
/* eslint-disable indent */

const Action = require('../../constants/actions');

exports.approveRequest = {
    properties: {
        approve: {
            type: 'boolean',
        },
        shared_transaction_id: {
            type: 'string'
        },
    },
    errorMessage: {
        properties: {
            approve: 'is required and should be boolean',
            shared_transaction_id: 'is required and should be a string',
        }
    },
    required: ['approve', 'shared_transaction_id'],
};

exports.vaultCreate = {
    properties: {
        user: {
            type: 'string',
        },
        userEmail: {
            type: 'string',
        },
        // vaultId: {
        //     type: 'string',
        // },
        // address: {
        //     type: 'string',
        // },
    },
    errorMessage: {
        properties: {
            // vaultId: 'is required and should be a string (may be you should put it in a single/double quotes)',
            // address: 'is required and should be a string',
            user: 'is required and should be a MongoDB ObjectID',
            userEmail: 'is requuired and should be string',
        },
    },
    required: ['vaultId', 'address'],
};

exports.updateConfig = {
    properties: {
        maxDailyTx: {
            type: 'integer',
        },
        maxDailyAmount: {
            type: 'integer',
        },
        maxTxHour: {
            type: 'integer'
        }
    },
    errorMessage: {
        properties: {
            maxDailyTx: 'is required and should be an integer',
            maxDailyAmount: 'is required and should be an integer',
            maxTxHour: 'is required and should be an integer',
        }
    },
    required: ['maxDailyTx', 'maxDailyAmount', 'maxTxHour']
};

exports.newVault = {
    properties: {
        type: {
            enum: [
                'single',
                'shared',
            ],
        },
        email: {
            type: 'string',
            format: 'email',
        },
        name: {
            type: 'string',
        },
        currency: {
            type: 'string',
        },
    },
    errorMessage: {
        properties: {
            type: 'is required and should either be "single" or "shared"',
            name: 'is required and should be a string',
            email: 'is required and should be string',
            currency: 'is required and should be a string',
        },
    },
    required: ['type', 'name', 'email'],
};

exports.walletAddress = {
    properties: {
        address: {
            type: 'string'
        },
    },
    errorMessage: {
        properties: {
            type: 'is required and should be a string'
        }
    },
    required: ['address']
};

exports.newSharedVault = {
    properties: {
        name: {
            type: 'string',
        },
        currency: {
            type: 'string',
        },
        signers: {
            type: 'array',
        },
        numberOfSignatures: {
            type: 'integer',
        },
        numberOfSigners: {
            type: 'integer'
        },
    },
    errorMessage: {
        properties: {
            name: 'is required and should be a string',
            currency: 'is required and should be a number',
            signers: 'is required and should be an array',
            numberOfSignatures: 'is required and should be an integer',
            numberOfSigners: 'is required and should be an integer',
        },
    },
    required: ['name', 'currency', 'signers', 'numberOfSigners', 'numberOfSignatures'],
};

exports.initiateWithdraw = {
    properties: {
        receiver: {
            type: 'string',
        },
        amount: {
            type: 'integer',
        },
        symbol: {
            type: 'string',
        },
        vault_name: {
            type: 'string'
        },
    },
    errorMessage: {
        properties: {
            receiver: 'is required and should be a string',
            amount: 'is required and should be an integer',
            symbol: 'is required and should be a string',
            vault_name: 'is required and should be a string',
        },
    },
    required: ['receiver', 'amount', 'symbol', 'vault_name'],
};

exports.acceptInvitation = {
    properties: {
        email: {
            type: 'string',
            format: 'email',
        },
        vault_name: {
            type: 'string',
        },
        accept: {
            type: 'boolean'
        },
        shared_vault_id: {
            type: 'string'
        }
    },
    errorMessage: {
        properties: {
            email: 'is required and should be a valid email format',
            vault_name: 'is required and should be a string',
            accept: 'is required and should be a boolean',
            shared_vault_id: 'is required and should be a string',
        },
    },
    required: ['email', 'vault_name', 'accept', 'shared_vault_id'],
};

exports.vaultWithdraw = {
    properties: {
        receiver: {
            type: 'string',
        },
        amount: {
            type: 'number',
        },
        symbol: {
            type: 'string',
        },
        action: {
            enum: [
                Action.ALL,
                Action.WITHDRAW,
                Action.DEPOSIT,
            ],
        },
    },
    errorMessage: {
        properties: {
            receiver: 'is required and should be a string',
            amount: 'is required and should be a number',
            symbol: 'is required and should be a string',
        },
    },
    required: ['receiver', 'amount', 'symbol'],
};

exports.vaultIdParams = {
    properties: {
        vaultId: {
            type: 'string',
        },
    },
    errorMessage: {
        properties: {
            vaultId: 'is required and should be a string',
        },
    },
    required: ['vaultId'],
};

exports.filterQuery = {
    properties: {
        filter: {
            enum: [
                'week',
                'month',
                'year'
            ],
        },
    },
    errorMessage: {
        properties: {
            filter: 'is required, should be a string and should either be "week", "month" or "year"',
        },
    },
    required: ['filter'],
};

exports.tokenSymbol = {
    properties: {
        symbol: {
            type: 'string',
        },
    },
    errorMessage: {
        properties: {
            symbol: 'is required and should be a string',
        },
    },
    required: ['symbol'],
};

exports.vaultDeposit = {
    properties: {
        amount: {
            type: 'number',
        },
    },
    errorMessage: {
        properties: {
            amount: 'is required and should be a number',
        },
    },
    required: ['amount'],
};

exports.vaultHistory = {
    properties: {
        action: {
            enum: [
                Action.ALL,
                Action.WITHDRAW,
                Action.DEPOSIT,
            ],
        },
        // page: { type: 'number', minimum: 1 },
        // size: { type: 'number', maximum: 15 },
        page: { type: 'number' },
        size: { type: 'number' },
    },
    errorMessage: {
        properties: {
            action: 'should be equal to one or the allowed values [all, withdraw, deposit]',
            page: 'should be a number is required by default. You can put 1 there. Minum page number is 1',
            size: 'should be a number is required by default. Maximum size number is 15',
        },
    },
    required: ['action', 'page', 'size'],
};

exports.vaultTxHash = {
    properties: {
        txHash: {
            type: 'string',
        },
    },
    errorMessage: {
        properties: {
            txHash: 'is required and should be a string',
        },
    },
    required: ['txHash'],
};