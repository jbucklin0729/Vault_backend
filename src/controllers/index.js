const userController = require('./user');
const topupController = require('./topup');
const transactionController = require('./transaction');
const raindropController = require('./raindrop');
const passwordController = require('./password');
const twofactorauthController = require('./twoFactorAuth');
const vaultController = require('./vault');
const adminController = require('./admin');
const sharedVaultController = require('./sharedVault');


module.exports = {
    User: userController,
    Topup: topupController,
    Transaction: transactionController,
    Raindrop: raindropController,
    Password: passwordController,
    TwoFactorAuth: twofactorauthController,
    Vault: vaultController,
    Admin: adminController,
    SharedVault: sharedVaultController,
};