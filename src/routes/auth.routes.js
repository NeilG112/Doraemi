const express = require('express');
const router = express.Router();
const { pool } = require('../config/dbConfig');
const bcrypt = require('bcrypt');
const passport = require('passport');
const { createWallet } = require('../wallet_actions/create_wallet');
const { encrypt } = require('../utils/cryption');

const { checkBalance } = require('../wallet_actions/check_balance');
const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS) || 10;

// Middleware to protect routes
function checkNotAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return res.redirect("/dashboard");
    }
    next();
}

// --- Routes ---

router.get("/logout", (req, res, next) => {
    req.logOut(function(err) {
        if (err) { return next(err); }
        req.flash("success_msg", "You have logged out");
        res.redirect("/login");
    });
});

router.get("/register", checkNotAuthenticated, (req, res) => {
    res.render("register");
});

router.get("/login", checkNotAuthenticated, (req, res) => {
    res.render("login");
});

router.get("/registration-success", (req, res) => {
    // Retrieve the flashed data. It will be an array, so we get the first element.
    const mnemonic = req.flash('wallet_mnemonic')[0];
    const address = req.flash('wallet_address')[0];

    // If there's no mnemonic, it means the user refreshed the page or came here directly.
    // Redirect them away to prevent errors and for security.
    if (!mnemonic) {
        return res.redirect('/login');
    }

    res.render('registration-success', {
        mnemonic: mnemonic,
        address: address,
    });
});

router.post("/register", async (req, res) => {
    let { fullname, email, password, confirm_password } = req.body;

    let errors = [];

    if (!fullname || !email || !password || !confirm_password) {
        errors.push({ message: "Please enter all fields" });
    }
    if (password !== confirm_password) {
        errors.push({ message: "Passwords do not match" });
    }
    if (password.length < 10) {
        errors.push({ message: "Password should be at least 10 characters" });
    }

    if (errors.length > 0) {
        res.render('register', { errors });
    } else {
        // Use a client from the pool for transaction
        const client = await pool.connect();
        try {
            const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
            const results = await client.query(`SELECT * FROM users WHERE email = $1`, [email]);

            if (results.rows.length > 0) {
                errors.push({ message: "Email already registered" });
                return res.render('register', { errors });
            }

            // Begin transaction
            await client.query('BEGIN');

            // Insert user
            await client.query('INSERT INTO users (full_name, email, password) VALUES ($1, $2, $3)', [fullname, email, hashedPassword]);

            // Create wallet after successful registration
            const wallet = createWallet();
            // Encrypt the private key before storing it in the database
            const encryptedPrivateKey = encrypt(wallet.walletPrivateKey);

            const balance = await checkBalance(wallet.walletAddress); // Check balance of the new wallet

            // IMPORTANT: Store the ENCRYPTED private key.
            await client.query('INSERT INTO custodial_wallet (user_email, wallet_public_key, wallet_private_key, wallet_address, balance) VALUES ($1, $2, $3, $4, $5)',
                [email, wallet.walletPublicKey, encryptedPrivateKey, wallet.walletAddress, balance]);
            
            // Commit transaction
            await client.query('COMMIT');

            console.log('User and custodial wallet created successfully in a transaction.');

            // Flash the sensitive info for one-time display on the next page
            req.flash('wallet_mnemonic', wallet.mnemonic);
            req.flash('wallet_address', wallet.walletAddress);
            res.redirect('/registration-success');

        } catch (err) {
            // Rollback transaction on error
            await client.query('ROLLBACK');
            console.error(err);
            req.flash('error_msg', 'An error occurred. Please try again.');
            res.redirect('/register');
        } finally {
            // Release the client back to the pool
            client.release();
        }
    }
});

router.post("/login", passport.authenticate("local", {
    successRedirect: "/dashboard",
    failureRedirect: "/login",
    failureFlash: true
}));

module.exports = router;