const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
    email: {
        type: String,
        unique: true,
    },
    password: String,
}, {
    // toJSON: true,
    timestamps: true,
    versionKey: false,
});

// define compound indexes in the schema
adminSchema.index({
    email: 1,
});


const Admin = mongoose.model('Admin', adminSchema);

module.exports = Admin;