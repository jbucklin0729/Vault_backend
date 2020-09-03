/* eslint-disable indent */
const express = require('express');
const Boom = require('boom');
const passport = require('passport');
const logger = require('../config/winston');
const responseFormat = require('../utils/responseFormat');
const {
    User,
    Topup,
    Admin,
    Password,
} = require('../controllers');

require('../utils/middleware/passport');

function authenticate() {
    return (req, res, next) => {
        passport.authenticate('user-jwt', { session: false }, (err, data, info) => {
            if (err || info) {
                logger.error(err || info);
                const { output } = Boom.unauthorized(err || info);
                output.payload.message = info.message;
                return responseFormat.handleError(res, output);
            }
            req.user = data;
            next();
        })(req, res, next);
    };
}

const router = express.Router();

// Basic
router.post('/register', User.register);
router.post('/login', User.login);
router.delete('/blowallaway', User.blowAllAway);

router.get('/te', User.emailTest);


// Email verficiation
router.post('/verify', User.verifyUser);
router.get('/check_token', User.checkToken);

router.get('/tfa_type', authenticate(), User.getTfaType);
// Transactions
// router.get('/transaction/history', authenticate(), Transaction.history);

// Password
router.post('/forgot_password', Password.forgotPassword);
router.post('/reset_password', Password.resetPassword);
router.post('/resend_token', User.resendToken);

router.get('/listTokens', Admin.listTokens);



module.exports = router;