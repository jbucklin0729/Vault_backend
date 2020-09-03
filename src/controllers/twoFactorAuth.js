const tfa = require('node-2fa');
const { of } = require('await-of');
const Boom = require('boom');
const logger = require('../config/winston');
const code = require('../constants/codes');
const message = require('../constants/messages');
const responseFormat = require('../utils/responseFormat');

const UserModel = require('../models/user');


class TwoFactorAuth {
  /**
     *
     * @description Generate secret, uri and QR code to be shown to the user
     * @static
     * @param {*} req
     * @param {*} res
     * @returns object containing secret, uri and qr code
     * @memberof TwoFactorAuth
     */
  static async generateSecret(req, res) {
    const email = req.user.email;
    let data = {};
    const options = {
      name: 'HydroVault',
      account: email,
    };
    const qrImage = tfa.generateSecret(options);
    const [, saveError] = await of(UserModel.updateOne({ email }, { $set: { secret: qrImage.secret } }));
    if (saveError) {
      logger.error(saveError);
      const { output } = Boom.badRequest();
      output.payload.message = saveError.message;
      return responseFormat.handleError(res, output);
    }
    data = {
      res,
      status: message.SUCCESS,
      statusCode: code.OK,
      data: {
        secret: qrImage.secret,
        uri: qrImage.uri,
        qr: qrImage.qr,
      },
    };
    return responseFormat.handleSuccess(res, data);
  }

  /**
     *
     * @description Verifies the token supplied if valid/expired or not
     * @static
     * @param {object} req Request object containing the token to be checked
     * @param {*} res
     * @returns a message indicating if valid or otherwise
     * @memberof TwoFactorAuth
     */
  static async verifyToken(req, res) {
    let data = {};
    const { token } = req.body;
    if (!token) {
      logger.error(message.KEY_REQUIRED);
      const { output } = Boom.preconditionRequired();
      output.payload.message = message.KEY_REQUIRED;
      return responseFormat.handleError(res, output);
    }
    const email = req.user.email;
    const [key] = await of(UserModel.findOne({ email }));
    const isValid = tfa.verifyToken(key.secret, token);
    if (isValid) {
      // update user's TFA type here
      await key.updateOne({
        tfa_type: 'GAuthy',
      });
      data = {
        res,
        status: message.SUCCESS,
        statusCode: code.OK,
        data: {
          message: message.KEY_VALID,
        },
      };
      return responseFormat.handleSuccess(res, data);
    }
    logger.error(message.KEY_INVALID);
    const { output } = Boom.badRequest();
    output.payload.message = message.KEY_INVALID;
    return responseFormat.handleError(res, output);
  }

  /**
     *
     * @description A standalone function to 'manually' generate a token to the user (might not be used)
     * @static
     * @param {*} req
     * @param {*} res
     * @returns
     * @memberof TwoFactorAuth
     */
  static async generateToken(req, res) {
    let data = {};
    const newToken = tfa.generateToken();
    data = {
      res,
      status: message.SUCCESS,
      statusCode: code.OK,
      data: {
        token: newToken,
      },
    };
    return responseFormat.handleSuccess(res, data);
  }
}

module.exports = TwoFactorAuth;
