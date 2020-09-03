/* eslint-disable eol-last */
/* eslint-disable indent */
const express = require('express');
const Boom = require('boom');
const passport = require('passport');
const logger = require('../config/winston');
const responseFormat = require('../utils/responseFormat');
const {
    User,
    Vault,
    Raindrop,
    Password,
    TwoFactorAuth,
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

// Password
router.post('/change_password', authenticate(), Password.changePassword);

// Profile
router.get('/profile', authenticate(), User.profile);

// GAuth 2FA
router.get('/generate/secret', authenticate(), TwoFactorAuth.generateSecret);
router.post('/generate/token', authenticate(), TwoFactorAuth.generateToken);
router.post('/verify_token', authenticate(), TwoFactorAuth.verifyToken);

// Raindrop 2FA
router.post('/raindrop/register', authenticate(), Raindrop.registerUser);
router.post('/raindrop/verify', authenticate(), Raindrop.verifySignature);
router.get('/raindrop/get_message', authenticate(), Raindrop.getMessage);
router.post('/raindrop/unregister', authenticate(), Raindrop.unregisterUser);

router.get('/vaults', authenticate(), User.getAllVaults);
router.get('/sharedVaults', authenticate(), User.getAllSharedVaults);

router.get('/totalBalance', authenticate(), User.totalVaultsBalance);

module.exports = router;