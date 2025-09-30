const { pool } = require('./renderDbConfig.js');

const createTables = async () => {
    // Get a single client from the pool for all setup queries
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                user_id SERIAL PRIMARY KEY,
                full_name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS user_sessions (
                sid VARCHAR(255) PRIMARY KEY,
                sess JSON NOT NULL,
                expire TIMESTAMP(6) NOT NULL
            );
        `);
            await client.query(`
                CREATE TABLE IF NOT EXISTS dora_price (
                    id SERIAL PRIMARY KEY,
                    price DECIMAL(18, 8) NOT NULL,
                    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            `);

            await client.query(`
                CREATE TABLE IF NOT EXISTS custodial_wallet (
                    wallet_id SERIAL PRIMARY KEY,
                    user_email VARCHAR(255) REFERENCES users(email) ON DELETE CASCADE,
                    wallet_public_key TEXT NOT NULL,
                    wallet_private_key TEXT NOT NULL,
                    wallet_address VARCHAR(255) NOT NULL,
                    balance NUMERIC(30, 18) DEFAULT 0.0,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            `);


        console.log('Tables created successfully or already exist.');
    } catch (err) {
        console.error('Error creating tables:', err);
        process.exit(1); // Exit with an error code
    } finally {
        // Release the client back to the pool
        client.release();
        await pool.end();
    }
};

createTables();
