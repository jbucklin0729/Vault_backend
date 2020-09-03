/* eslint-disable indent */
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    vault: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vault',
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    transaction_type: {
        type: String,
        enum: ['deposit', 'withdraw'],
        // enum: ['received', 'sent', 'all'],
    },
    transaction_hash: {
        type: String,
        // unique: true,
    },
    status: String,
    from: {
        type: String,
        default: null,
    },
    to: {
        type: String,
        default: null,
    },
    token: String,
    amount: {
        type: Number,
        default: 0,
    },
    timestamp: Date,
}, {
    versionKey: false,
});

// define compound indexes in the schema
transactionSchema.index({
    vault: 1,
    transaction_hash: 1,
    transaction_type: 1,
    status: 1,
});


const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;