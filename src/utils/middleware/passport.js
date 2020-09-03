/**
 * This file contains passport local strategy that will handle login and authentication
 */

const passport = require('passport');
const JWTStrategy = require('passport-jwt').Strategy;
const extractJWT = require('passport-jwt').ExtractJwt;
const dotenv = require('dotenv');
const UserModel = require('../../models/user');
const AdminModel = require('../../models/admin');

dotenv.config();

passport.use('user-jwt', new JWTStrategy({
        secretOrKey: process.env.JWT_SECRET,
        jwtFromRequest: extractJWT.fromAuthHeaderAsBearerToken(),
    },
    // eslint-disable-next-line consistent-return
    // eslint-disable-next-line camelcase
    (async(jwt_payload, done) => {
        const user = await UserModel.findOne({
            id: jwt_payload._id,
            email: jwt_payload.email,
        });
        try {
            if (user) {
                return done(null, jwt_payload);
            }
            done(null, false);
        } catch (error) {
            done(error, null);
        }
    })));

passport.use('admin-jwt', new JWTStrategy({
        secretOrKey: process.env.JWT_SECRET,
        jwtFromRequest: extractJWT.fromAuthHeaderAsBearerToken(),
    },
    // eslint-disable-next-line consistent-return
    // eslint-disable-next-line camelcase
    (async(jwt_payload, done) => {
        const admin = await AdminModel.findOne({
            id: jwt_payload._id,
            email: jwt_payload.email,
        });
        try {
            if (admin) {
                return done(null, jwt_payload);
            }
            done(null, false);
        } catch (error) {
            done(error, null);
        }
    })));