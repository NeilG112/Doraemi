// Core Node Modules
const path = require("path");

// Load environment variables from .env file. This should be as high as possible.
require("dotenv").config({ path: path.resolve(__dirname, '../', '.env') });

// NPM Packages
const express = require("express");
const session = require("express-session");
const pgSession = require('connect-pg-simple')(session);
const flash = require("express-flash");
const passport = require("passport");
const helmet = require("helmet"); // Recommended for security


// Local Imports
const { pool } = require("./src/config/dbConfig"); // Assumes dbConfig.js exports your pg Pool
const initializePassport = require("./src/config/passportConfig");
const app = express();
initializePassport(passport);
const PORT = process.env.PORT || 3000;

const isProduction = process.env.NODE_ENV === 'production';

// Middleware

// Set security-related HTTP headers
const cspDirectives = {
    // Allow scripts/styles/connect to jsdelivr CDN for Chart.js and Bootstrap
    "script-src": [
        "'self'",
        "https://cdn.jsdelivr.net",
        "'unsafe-eval'" // Required by Chart.js for some functionality
    ],
    // Allow loading external stylesheets (Bootstrap CDN and Google Fonts)
    "style-src": [
        "'self'",
        "https://cdn.jsdelivr.net",
        "https://fonts.googleapis.com",
        "https://cdnjs.cloudflare.com", // Allow Skeleton CSS
        "'unsafe-inline'"
    ],
    // Separate directive for style elements (fallbacks covered by style-src)
    "style-src-elem": [
        "'self'",
        "https://cdn.jsdelivr.net",
        "https://fonts.googleapis.com",
        "https://cdnjs.cloudflare.com", // Allow Skeleton CSS
        "'unsafe-inline'"
    ],
    // Allow browser to fetch source maps and other resources from the CDN
    "connect-src": [
        "'self'",
        "https://cdn.jsdelivr.net"
    ],
    // Fonts must be allowed from Google's font CDN
    "font-src": [
        "'self'",
        "https://fonts.gstatic.com",
        "https://cdn.jsdelivr.net"
    ],
};

// In development, relax the CSP for things like hot-reloading and devtools.
if (!isProduction) {
    // This allows connections from localhost for devtools and hot-reloading (WebSocket).
    cspDirectives['connect-src'].push('http://localhost:3000', 'ws://localhost:3000');
}

app.use(
    helmet({
        contentSecurityPolicy: {
            directives: cspDirectives,
        },
    })
);

const sessionStore = new pgSession({
    pool: pool, // Connection pool
    tableName: 'user_sessions' // Optional: Use a custom table name
});

app.use(session({
    store: sessionStore,
    // This secret should be a long, random string stored in your .env file
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true, // Reset the session maxAge on every request
    cookie: {
        maxAge: 1000 * 60 * 15, // 15 minutes. A secure choice for financial apps.
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production (requires HTTPS)
        httpOnly: true // Prevents client-side JS from accessing the cookie
    }
}));

app.use(flash());
app.use(express.json()); // Middleware to parse JSON bodies

app.use(passport.initialize());
app.use(passport.session());


// Parses details from a form
app.set("views", path.join(__dirname, "src/views"));
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: false }));

// Serve static files (CSS, JS, images) from the 'public' directory
app.use(express.static(path.join(__dirname, "public")));


// In your main app file, after you initialize express-session and connect-flash

app.use(function (req, res, next) {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error'); // Passport.js uses this one
    next();
});


// Import routes
const authRoutes = require('./src/routes/auth.routes');
const dashboardRoutes = require('./src/routes/dashboard.routes');

// Redirect the site root to the login page so visiting the host opens the login UI
app.get("/", (req, res) => {
    return res.redirect('/login');
});

// Use routes
app.use('/', authRoutes);
app.use('/dashboard', dashboardRoutes);



app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
