/* eslint-disable indent */
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    userId: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    email: {
        type: String,
    },
    type: {
        type: String,
        enum: ['single', 'shared'],
    },
    isRead: {
        type: Boolean,
        default: false,
    },
    message: {
        type: String,
    }
}, {
    timestamps: true,
});

// define compound indexes in the schema
notificationSchema.index({
    userId: 1,
    email: 1,
    isRead: 1
});


const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;