/* eslint-disable eol-last */
/* eslint-disable indent */
const mongoose = require('mongoose');
const logger = require('../config/winston');

require('dotenv').config();

// mongoose.connection.on('open', () => {
//     mongoose.connection.db.collection('agendaJobs', (err, collection) => {
//         collection.update({ lockedAt: { $exists: true }, lastFinishedAt: { $exists: false } }, {
//             $unset: {
//                 lockedAt: undefined,
//                 lastModifiedBy: undefined,
//                 lastRunAt: undefined,
//             },
//             $set: { nextRunAt: new Date() },
//         }, { multi: true }, (e, numUnlocked) => {
//             if (e) { logger.error(e); }
//             logger.debug(`Unlocked #{${numUnlocked}} jobs.`);
//         });
//     });
// });

mongoose.promise = global.promise;
mongoose.connect(process.env.MONGO_URL, {
        keepAlive: true,
        reconnectTries: 10,
        socketTimeoutMS: 0,
        useNewUrlParser: true,
        useCreateIndex: true,
        useUnifiedTopology: true,
        useFindAndModify: false,
    })
    .then(() => {
        logger.debug('MongoDB is connected');
    })
    .catch((err) => {
        logger.error(err);
        logger.debug('MongoDB connection unsuccessful.');
    });