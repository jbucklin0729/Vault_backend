/* eslint-disable indent */
const mongoose = require('mongoose');

const sharedVaultTransactionSchema = new mongoose.Schema({
    sharedVault: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SharedVault',
    },
    users: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    transaction_type: {
        type: String,
        enum: ['deposit', 'withdraw'],
        // enum: ['received', 'sent', 'all'],
    },
    transaction_hash: {
        type: String,
        default: null,
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
sharedVaultTransactionSchema.index({
    sharedVault: 1,
});


const sharedVaultTransaction = mongoose.model('sharedVaultTransaction', sharedVaultTransactionSchema);

module.exports = sharedVaultTransaction;