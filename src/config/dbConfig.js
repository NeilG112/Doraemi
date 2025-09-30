const { Pool } = require('pg');

// dotenv is configured in server.js, so process.env variables are already available here.

const isProduction = process.env.NODE_ENV === 'production';

// Use the DATABASE_URL directly. No need for an intermediate variable.
const connectionString = process.env.DATABASE_URL; 

const pool = new Pool({
  connectionString: isProduction ? process.env.DATABASE_URL : connectionString,
  // Add SSL configuration required for connecting to Render from outside
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = {pool};