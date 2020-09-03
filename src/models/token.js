/* eslint-disable indent */
const mongoose = require('mongoose');

const tokenSchema = new mongoose.Schema({
    name: {
        type: String,
        unique: true,
    },
    symbol: {
        type: String,
        unique: true
    },
    image: {
        type: String,
        default: null
    },
}, {
    versionKey: false,
});

// define compound indexes in the schema
tokenSchema.index({
    symbol: 1
});


const Token = mongoose.model('Token', tokenSchema);

module.exports = Token;