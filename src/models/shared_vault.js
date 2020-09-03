/* eslint-disable indent */
const mongoose = require('mongoose');

const sharedVaultSchema = new mongoose.Schema({
    private_key: String,
    name: String,
    currency: {
        type: String,
        // default: 'ETH'
        default: 'BEAR'
    },
    signers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Signer'
    }],
    type: {
        type: String,
        default: 'shared'
    },
    signersAddresses: [String],
    numberOfSigners: { //number of all co-signers
        type: Number
    },
    numberOfSignatures: { //number of signatures needed
        type: Number,
    },
    allAccepted: {
        type: Boolean,
        default: false,
    },
    countSignatures: {
        type: Number,
        default: null,
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
    timestamp: Date,
}, {
    versionKey: false,
});

// define compound indexes in the schema
sharedVaultSchema.index({
    vault: 1,
});


const SharedVault = mongoose.model('SharedVault', sharedVaultSchema);

module.exports = SharedVault;