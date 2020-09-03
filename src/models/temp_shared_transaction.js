/* eslint-disable indent */
const mongoose = require('mongoose');

const tempSharedTransactionSchema = new mongoose.Schema({
    signers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Signer'
    }],
    vault: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vault',
    },
    transaction_type: {
        type: String,
        enum: ['deposit', 'withdraw'],
    },
    transaction_hash: {
        type: String,
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
    signers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Signer'
    }],
}, {
    versionKey: false,
});

// define compound indexes in the schema
tempSharedTransactionSchema.index({
    vault: 1,
});


const TempSharedTransaction = mongoose.model('TempSharedTransaction', tempSharedTransactionSchema);

module.exports = TempSharedTransaction;