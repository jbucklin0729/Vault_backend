/* eslint-disable indent */
const mongoose = require('mongoose');

const vaultSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    email: {
        type: String,
    },
    private_key: String,
    name: String,
    amount: Number,
    currency: {
        type: String,
        // default: 'ETH'
        default: 'BEAR'
    },
    type: {
        type: String,
        enum: ['single', 'shared'],
        default: 'single',
    },
    address: String,
    maxDailyTx: {
        type: Number,
        default: 0
    },
    countMaxDailyTx: {
        type: Number,
        default: 0
    },
    maxTxHour: {
        type: Number,
        default: 0
    },
    countTxHour: {
        type: Number,
        default: 0
    },
    maxDailyAmount: {
        type: Number,
        default: 0,
    },
    currDailyAmount: {
        type: Number,
        default: 0
    },
}, {
    timestamps: true,
});

// define compound indexes in the schema
vaultSchema.index({
    email: 1,
    user: 1,
});


const Vault = mongoose.model('Vault', vaultSchema);

module.exports = Vault;