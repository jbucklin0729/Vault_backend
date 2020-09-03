/* eslint-disable eol-last */
/* eslint-disable indent */
const express = require('express');
const Boom = require('boom');
const passport = require('passport');
const logger = require('../config/winston');
const responseFormat = require('../utils/responseFormat');
const {
    Vault,
    Transaction,
    SharedVault,
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


router.get('/generate_wallet', authenticate(), Vault.generateWallet);
router.get('/get_balance', authenticate(), Vault.getBalance);
// router.get('/verify', Vault.verify);
// router.post('/create', Vault.createNew);
router.post('/new', authenticate(), Vault.new);
router.get('/:vaultId/balance', authenticate(), Vault.getBalance);
router.get('/:vaultId/allTokenBalance', authenticate(), Vault.getAllTokenBalance);
router.post('/:vaultId/withdraw', authenticate(), Vault.withdraw);
router.get('/:vaultId/deposit', authenticate(), Vault.deposit);
router.get('/:vaultId/history', authenticate(), Transaction.history);
router.get('/transaction/:txHash', authenticate(), Vault.getTransactionInfo);
router.get('/walletBalance', authenticate(), Vault.walletBalance);
router.put('/:vaultId/updateConfig', authenticate(), Vault.updateConfig);

router.get('/allHistory', authenticate(), Transaction.allHistory);
router.get('/:vaultId/graph', authenticate(), Transaction.graph);
router.get('/graph', authenticate(), Transaction.allGraph);

router.get('/bal', Vault.getBal);
router.get('/fortest', Vault.forTest);
router.get('/perToken', Vault.perToken);
router.get('/testHash', Vault.getTransactionReceipt);

router.get("/testCoinGecko", Vault.testCoinGecko);
// router.get('/userVaults', Vault.getVaults);
router.get('/test', Transaction.getDepositEvent);

router.post('/shared/create', authenticate(), SharedVault.create);
router.post('/shared/acceptInvitation', SharedVault.acceptInvitation);
router.post('/shared/:vaultId/initiateRequest', authenticate(), SharedVault.initiateWithdrawRequest);
router.post('/shared/:vaultId/approveRequest', authenticate(), SharedVault.approveRequest);
router.get('/shared/:vaultId/balance', authenticate(), SharedVault.getBalance);
router.get('/shared/:vaultId/history', authenticate(), SharedVault.history);
router.get('/shared/allHistory', authenticate(), SharedVault.allHistory);
router.get('/shared/:vaultId/graph', authenticate(), SharedVault.graph);
router.get('/shared/allgraph', authenticate(), SharedVault.allGraph);
router.get('/shared/:vaultId/signers', authenticate(), SharedVault.getSigners);
router.get('/shared/all', authenticate(), SharedVault.sharedVaults)
router.put('/shared/:vaultId/updateConfig', authenticate(), SharedVault.updateConfig);

// router.get('/check', SharedVault.checkS);

module.exports = router;