const VaultModel = require('../models/vault');
const SharedVaultModel = require('../models/shared_vault');

/**
 *
 * @description A simple cron class to update the config settings at the appropriate time
 * @class Cron
 */
class Cron {

    static async vaultDailyTx() {
        await VaultModel.updateMany({}, { "$set": { countMaxDailyTx: 0 } });
        await SharedVaultModel.updateMany({}, { "$set": { countMaxDailyTx: 0 } });
    }

    static async vaultDailyTxHour() {
        await VaultModel.updateMany({}, { "$set": { countTxHour: 0 } });
        await SharedVaultModel.updateMany({}, { "$set": { countTxHour: 0 } });
    }

    static async vaultDailyAmount() {
        await VaultModel.updateMany({}, { "$set": { currDailyAmount: 0 } });
        await SharedVaultModel.updateMany({}, { "$set": { currDailyAmount: 0 } });
    }
}

module.exports = Cron;