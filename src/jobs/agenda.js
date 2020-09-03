/* eslint-disable eol-last */
/* eslint-disable space-before-function-paren */
/* eslint-disable indent */
const Agenda = require('agenda');
const dotenv = require('dotenv');
const logger = require('../config/winston');
const TransactionInfoJob = require('../controllers/transaction');

dotenv.config();

const agenda = new Agenda({ db: { address: process.env.MONGO_URL } });

agenda.define('Transaction Status Check', {}, async(job, done) => {
    try {
        await TransactionInfoJob.statusCheck();
        done();
    } catch (e) {
        logger.error('Status Check', e);
    }
});

agenda.define('Transaction Deposit Watch', {}, async(job, done) => {
    try {
        await TransactionInfoJob.getDepositEvent();
        done();
    } catch (e) {
        logger.error('Deposit Error', e);
    }
});

async function start() {
    await agenda.start();
    logger.info('agenda is running');
    await agenda.every('1 second', 'Transaction Status Check');
    await agenda.every('1 second', 'Transaction Deposit Watch');
}

function graceful() {
    logger.debug('Something is gonna blow up.');
    agenda.stop(() => {
        process.exit(0);
    });
}

process.on('SIGTERM', graceful);
process.on('SIGINT', graceful);

module.exports = start;