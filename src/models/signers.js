/* eslint-disable indent */
const mongoose = require('mongoose');

const signersSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    email: {
        type: String,
    },
    vault_name: {
        type: String
    },
    isAccepted: {
        type: Boolean,
        default: false,
    },
    hasSigned: {
        type: Boolean,
        default: false,
    },
    address: String,
    private_key: String,
}, {
    timestamps: true,
});

// define compound indexes in the schema
signersSchema.index({
    userId: 1,
    email: 1,
});


const Signer = mongoose.model('Signer', signersSchema);

module.exports = Signer;