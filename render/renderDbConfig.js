
const { Pool } = require('pg');

const isProduction = process.env.NODE_ENV === 'production';

const connectionString = `postgresql://user:Hp6BSaDQx2hkPaDiDP5GUf7SeRQwctA2@dpg-d36rdbp5pdvs73dc81kg-a.frankfurt-postgres.render.com/database_yj5z`;

const pool = new Pool({
  connectionString: isProduction ? process.env.DATABASE_URL : connectionString,
  // Add SSL configuration required for connecting to Render from outside
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = {pool};