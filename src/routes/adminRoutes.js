/* eslint-disable indent */
const express = require('express');
const Boom = require('boom');
const passport = require('passport');
const logger = require('../config/winston');
const responseFormat = require('../utils/responseFormat');
const {
    Admin,
} = require('../controllers');

require('../utils/middleware/passport');

function authenticate() {
    return (req, res, next) => {
        passport.authenticate('admin-jwt', { session: false }, (err, data, info) => {
            if (err || info) {
                logger.error(err || info);
                const { output } = Boom.unauthorized(err || info);
                output.payload.message = info.message;
                return responseFormat.handleError(res, output);
            }
            req.admin = data;
            next();
        })(req, res, next);
    };
}

const router = express.Router();

router.post('/login', Admin.login);
router.post('/register', Admin.register);
router.post('/addToken', authenticate(), Admin.addToken);
router.delete('/removeToken/:token_id', authenticate(), Admin.removeToken);
router.put('/updateToken/:token_id', authenticate(), Admin.updateToken);

module.exports = router;