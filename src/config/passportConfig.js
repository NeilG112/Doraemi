const LocalStrategy = require('passport-local').Strategy;
const { pool } = require('./dbConfig');
const bcrypt = require('bcrypt');

function initialize(passport) {
    const authenticateUser = async (email, password, done) => {
        try {
            const results = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

            if (results.rows.length === 0) {
                return done(null, false, { message: 'No user with that email' });
            }

            const user = results.rows[0];

            bcrypt.compare(password, user.password, (err, isMatch) => {
                if (err) {
                    return done(err);
                }
                if (isMatch) {
                    return done(null, user);
                } else {
                    return done(null, false, { message: 'Password is not correct' });
                }
            });
        } catch (err) {
            return done(err);
        }
    };

    passport.use(new LocalStrategy({
        usernameField: 'email',
        passwordField: 'password'
    }, authenticateUser));

    // This function is called to store the user's ID in the session cookie.
    // The "Failed to serialize user" error happens if this function fails.
    passport.serializeUser((user, done) => done(null, user.user_id));

    // This function is called on every request to retrieve the user's data from the session ID.
    passport.deserializeUser(async (id, done) => {
        try {
            const results = await pool.query('SELECT * FROM users WHERE user_id = $1', [id]);
            return done(null, results.rows[0]);
        } catch (err) {
            return done(err);
        }
    });
}

module.exports = initialize;
