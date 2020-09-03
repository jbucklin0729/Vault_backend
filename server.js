/* eslint-disable space-before-function-paren */
/* eslint-disable eol-last */
/* eslint-disable indent */
require('dotenv').config();
const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');
const bugsnag = require('@bugsnag/js');
const bugsnagExpress = require('@bugsnag/plugin-express');
const cors = require('cors');
const { errorHandler } = require('./src/utils/middleware/error');
const logger = require('./src/config/winston');
const code = require('./src/constants/codes');
const message = require('./src/constants/messages');
const agendaStart = require('./src/jobs/agenda');
const routes = require('./src/routes');
const vaultRoutes = require('./src/routes/vaultRoutes');
const accountRoutes = require('./src/routes/accountRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const TransactionController = require('./src/controllers/transaction');
const SharedVaultController = require('./src/controllers/sharedVault');
const CronController = require('./src/controllers/cron');
const CronJob = require('cron').CronJob;

require('./src/utils/database');

const bugsnagClient = bugsnag(process.env.BUGSNAG_API_KEY);
bugsnagClient.use(bugsnagExpress);

const middleware = bugsnagClient.getPlugin('express');


// const apiLimiter = rateLimit({
//     windowMs: 15 * 60 * 1000, // 15 minutes
//     max: 100, // start blocking after 100 requests
//     message: 'Too many accounts created from this IP, please try again after 15 minutes',
// });

const app = express();

// It can only capture errors in downstream middleware
app.use(middleware.requestHandler);

// This handles any errors that Express catches
app.use(middleware.errorHandler);

app.use(cors());
app.options('*', cors());
app.use(helmet());
// app.use(apiLimiter);
app.use(morgan('combined', { stream: logger.stream }));
app.use(express.json({ limit: '300kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(compression());

/** Application Routes */
app.use('/v1/user', routes);
app.use('/v1/vault', vaultRoutes);
app.use('/v1/account', accountRoutes);
app.use('/v1/admin', adminRoutes);

app.use('/', (req, res) => {
    res.status(code.NOT_FOUND).json({
        message: 'Hey my friend, you are not to check here :)',
    });
});

/** Catch errors handler */
app.use(errorHandler);

// catch 404 and forward to error handler
app.use((req, res, next) => {
    const errorObj = {
        statusCode: code.NOT_FOUND,
        status: message.ERROR,
        message: message.ROUTE_NOT_FOUND,
    };
    res.status(errorObj.statusCode).json(errorObj);
});

process.on('SIGINT', () => {
    logger.debug('\nGracefully shutting down from SIGINT (Ctrl-C)');
    // some other closing procedures go here
    process.exit(1);
});

// const intervalID = setInterval(() => {
//     console.log('running every second')
//     console.log('another one running')
// }, 1000);
//clearInterval(intervalID);

// link:https://stackoverflow.com/questions/7188145/call-a-javascript-function-every-5-seconds-continuously
// using setInterval can cause a memory leak. By using setTimeout you ensure that the next function 
// call won't get triggered until the previous function call has finished
// async function statusIntervalFunction() {
//     //console.log('running 1')
//     logger.info('status check is running')
//     await TransactionController.statusCheck();
//     setTimeout(statusIntervalFunction, 1000);
// }

// async function depositIntervalFunction() {
//     //console.log('running 2')
//     logger.info('deposit event check is running')
//     await TransactionController.getDepositEvent();
//     setTimeout(depositIntervalFunction, 1000);
// }

// (async() => {
//     await statusIntervalFunction();
//     await depositIntervalFunction()
// })();

// (async() => {
//     await agendaStart();
// })();

// every 2 seconds
const statusJob = new CronJob('*/2 * * * * *', async function() {
    // logger.info('You will see this message every second');
    await TransactionController.statusCheck();
    await SharedVaultController.statusCheck();
});

// for every 10 seconds
// const depositJob = new CronJob('*/10 * * * * *', async function() {
//     // logger.info('You will see this message 10 seconds');
//     await TransactionController.getDepositEvent();
//     await SharedVaultController.getDepositEvent();
// });

// https://cron.help/

// run every midnight at 12am
const runDaily = new CronJob("0 0 * * *", async function() {
    logger.debug('i am running daily')
    await CronController.vaultDailyTx();
    await CronController.vaultDailyAmount();
});

//run every hour
const runHour = new CronJob("*/60 * * * *", async function() {
    logger.debug('i am running hourly')
    await CronController.vaultDailyTxHour();
});

statusJob.start();
runDaily.start();
runHour.start();

// depositJob.start();

module.exports = app;