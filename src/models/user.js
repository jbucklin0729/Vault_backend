const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        unique: true,
    },
    secondary_email: String,
    first_name: String,
    last_name: String,
    password: String,
    tfa_type: {
        type: String,
        default: null,
    },
    is_verified: {
        type: Boolean,
        default: false,
    },
    verification_token: {
        type: String,
        default: null,
    },
    verification_token_expires: {
        type: Date,
        default: null,
    },
    secret: {
        type: String,
        default: null,
    },
    reset_key: {
        type: String,
        default: null,
    },
    reset_key_expires: {
        type: Date,
        default: null,
    },
    vaults: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vault',
    }],
}, {
    // toJSON: true,
    timestamps: true,
    versionKey: false,
});

// define compound indexes in the schema
userSchema.index({
    email: 1,
});


const User = mongoose.model('User', userSchema);

module.exports = User;