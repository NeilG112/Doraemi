const express = require('express');
const router = express.Router();
const { pool } = require('../config/dbConfig');
const { checkBalance } = require('../wallet_actions/check_balance');
const { sendTransaction } = require('../wallet_actions/send_crypto');
const { decrypt } = require('../utils/cryption');

// Middleware to protect this route
function checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect("/login");
}

// Middleware to load wallet data for the authenticated user
async function loadWalletData(req, res, next) {
    try {
        const walletResult = await pool.query('SELECT wallet_address FROM custodial_wallet WHERE user_email = $1', [req.user.email]);

        if (walletResult.rows.length === 0) {
            req.flash('error_msg', 'Could not find a wallet for your account. Please contact support.');
            return res.redirect('/login');
        }

        const walletAddress = walletResult.rows[0].wallet_address;
        const balance = await checkBalance(walletAddress);

        // Attach data to res.locals to make it available in templates
        res.locals.full_name = req.user.full_name;
        res.locals.wallet_address = walletAddress;
        res.locals.balance = balance;

        return next();
    } catch (err) {
        console.error("Error loading wallet data:", err);
        req.flash('error_msg', 'An error occurred while loading your account data. Please try again.');
        res.redirect('/login');
    }
}

router.get("/", checkAuthenticated, loadWalletData, async (req, res) => {
    res.render("dashboard", { path: req.path });
});

router.get("/settings", checkAuthenticated, loadWalletData, async (req, res) => {
    // The wallet data is also available here thanks to the middleware.
    res.render("settings", { path: req.path });
});

// API: return last N rows of price history
router.get('/api/price/history', checkAuthenticated, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 500;
        const resolution = req.query.resolution || '1h_ohlc'; // e.g., '1m_ohlc', '5m_ohlc', '1h_ohlc', '1d_ohlc'

        let q;
        const params = [limit];
        let timeBucket;

        switch (resolution) {
            case '5m_ohlc':
                // Group by 5-minute intervals
                timeBucket = `(date_trunc('hour', timestamp) + floor(extract(minute from timestamp) / 5) * interval '5 minute')`;
                break;
            case '1h_ohlc':
                timeBucket = `date_trunc('hour', timestamp)`;
                break;
            case '1d_ohlc':
                timeBucket = `date_trunc('day', timestamp)`;
                break;
            case '1m_ohlc':
            default:
                timeBucket = `date_trunc('minute', timestamp)`;
                break;
        }

        // Generic OHLC query.
        q = `
            SELECT * FROM (
                SELECT
                    ${timeBucket} as time,
                    (array_agg(price ORDER BY timestamp ASC))[1] as open,
                    MAX(price) as high,
                    MIN(price) as low,
                    (array_agg(price ORDER BY timestamp DESC))[1] as close,
                    MAX(id) as last_id
                FROM dora_price
                GROUP BY time
                ORDER BY time DESC
                LIMIT $1
            ) as ohlc
            ORDER BY time ASC;
        `;

        const { rows } = await pool.query(q, params);
        return res.json(rows);
    } catch (err) {
        console.error('Error fetching price history:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// API: return rows after given id (efficient polling)
router.get('/api/price/latest', checkAuthenticated, async (req, res) => {
    try {
        const after = parseInt(req.query.after, 10) || 0;
        if (!after) return res.status(400).json([]);
    const q = 'SELECT id, price, timestamp FROM dora_price WHERE id > $1 ORDER BY id ASC';
        const { rows } = await pool.query(q, [after]);
        return res.json(rows);
    } catch (err) {
        console.error('Error fetching latest price rows:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/send", checkAuthenticated, async (req, res) => {
    const { receiver_address, amount } = req.body;

    if (!receiver_address || !amount) {
        req.flash('error_msg', 'Please provide a receiver address and an amount.');
        return res.redirect('/dashboard');
    }

    try {
        // Fetch the ENCRYPTED private key from the database.
        const privateKeyResult = await pool.query(
            'SELECT wallet_private_key FROM custodial_wallet WHERE user_email = $1',
            [req.user.email]
        );

        if (privateKeyResult.rows.length === 0 || !privateKeyResult.rows[0].wallet_private_key) {
            req.flash('error_msg', 'Could not find a private key for your account.');
            return res.redirect('/dashboard');
        }

        // Decrypt the private key in memory just before using it.
        const encryptedPrivateKey = privateKeyResult.rows[0].wallet_private_key;
        const senderPrivateKey = decrypt(encryptedPrivateKey);

        // Call the sendTransaction function and wait for it to be sent
        const transaction = await sendTransaction(senderPrivateKey, receiver_address, amount);

        console.log(`Transaction sent with hash: ${transaction.hash}`);

        // Redirect immediately after submission. Do NOT wait for confirmation here.
        // The user can track the transaction on a block explorer.
        req.flash('success_msg', `Transaction submitted! Amount: ${amount} ETH. <a href="https://sepolia.etherscan.io/tx/${transaction.hash}" target="_blank" class="alert-link">View on Etherscan</a>`);
        res.redirect('/dashboard');

    } catch (err) {
        console.error("Error sending transaction:", err.message);
        // Give the user a generic, helpful error message without leaking implementation details.
        req.flash('error_msg', `Transaction failed. Please check the address and ensure you have sufficient funds.`);
        res.redirect('/dashboard');
    }
});

module.exports = router;