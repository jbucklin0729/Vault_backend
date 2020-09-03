const dotenv = require('dotenv');
const cryptoJS = require('crypto-js');
const Boom = require('boom');
const { Topup: TopupModel } = require('../models/topup');
const { generateEthWallet, encryptPk, verifySnowFlakeID } = require('../utils/walletLib');
const logger = require('../config/winston');
const code = require('../constants/codes');
const message = require('../constants/messages');
const responseFormat = require('../utils/responseFormat');


dotenv.config();
const serverSeed = process.env.SERVER_SEED;
const API_KEY = process.env.API_KEY;

class Topup {
  static async generateWallet(req, res) {
    const { apiKey } = req.body;
    const { snowFlakeID } = req.query;
    let data = {};

    // check if the apikey matches with the static one
    if (apiKey !== API_KEY) {
      logger.error('Unauthorized error');
      const { output } = Boom.unauthorized(message.UNAUTHORIZED);
      return responseFormat.handleError(res, output);
    }
    try {
      const wallet = await TopupModel.findOne({ snowflake_id: snowFlakeID });

      // if wallet snowflakeID exist
      if (wallet) {
        // if topup wallet is found
        if (wallet.topup_wallet) {
          data = {
            res,
            status: message.SUCCESS,
            statusCode: code.OK,
            data: {
              topupWallet: wallet.topup_wallet,
            },
          };
          return responseFormat.handleSuccess(data);
        }
        const ethereumAddress = await generateEthWallet();
        const seed = `${serverSeed}_${snowFlakeID}`;
        // encrypt private key
        const cipherPrivateKey = cryptoJS.AES.encrypt(ethereumAddress.privateKey, seed).toString();
        // update  user
        const user = await TopupModel.updateOne({ snowflake_id: snowFlakeID }, {
          topup_wallet: ethereumAddress.address, // also the public key
          topup_pk: cipherPrivateKey,
          last_checked: Date.now(),
        });
        data = {
          res,
          status: message.SUCCESS,
          statusCode: code.CREATED,
          data: {
            topupWallet: ethereumAddress.address,
          },
        };
        return responseFormat.handleSuccess(data);
      }
      // if snowFlakeID is not found

      // check if snowFlakeID does exist in the ERC-1484 contract
      const snowFlakeIDExistInContract = await verifySnowFlakeID(snowFlakeID);
      if (snowFlakeIDExistInContract) {
        const ethereumAddress = await generateEthWallet();
        const seed = `${serverSeed}_${snowFlakeID}`;
        // encrypt private key
        const cipherPrivateKey = cryptoJS.AES.encrypt(ethereumAddress.privateKey, seed).toString();
        const user_ = new TopupModel({
          snowflake_id: snowFlakeID,
          topup_wallet: ethereumAddress.address, // also the public key
          topup_pk: cipherPrivateKey,
          last_checked: Date.now(),
        });
        // save user
        const user = await user_.save();
        data = {
          res,
          status: message.SUCCESS,
          statusCode: code.CREATED,
          data: {
            topupWallet: ethereumAddress.address,
          },
        };
        return responseFormat.handleSuccess(data);
      }
      // snowFlakeID does not exist

      const { output } = Boom.notFound(message.ID_NOT_FOUND);
      return responseFormat.handleError(res, output);
    } catch (error) {
      logger.error(error);
      const { output } = Boom.badRequest(error.message);
      return responseFormat.handleError(res, output);
    }
  }
}


module.exports = Topup;
