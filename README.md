# Doraemi App — Server


[![Demo Video](img.youtube.com)](https://youtu.be/w1CJNxkn6yA)


Small custodial-wallet dashboard + price feed built with Node/Express, PostgreSQL and EJS.

## Quick summary
- Server: [server.js](server.js)  
- Routes: authentication and dashboard at [src/routes/auth.routes.js](src/routes/auth.routes.js) and [src/routes/dashboard.routes.js](src/routes/dashboard.routes.js)  
- DB pool config: [`pool`](src/config/dbConfig.js) ([src/config/dbConfig.js](src/config/dbConfig.js))  
- Auth: passport local configured in [`initialize`](src/config/passportConfig.js) ([src/config/passportConfig.js](src/config/passportConfig.js))  
- Wallet helpers: [`createWallet`](src/wallet_actions/create_wallet.js), [`checkBalance`](src/wallet_actions/check_balance.js), [`sendTransaction`](src/wallet_actions/send_crypto.js), [recover script](src/wallet_actions/recover_account.js)  
  - Links: [`createWallet`](src/wallet_actions/create_wallet.js), [`checkBalance`](src/wallet_actions/check_balance.js), [`sendTransaction`](src/wallet_actions/send_crypto.js), [recover_account.js](src/wallet_actions/recover_account.js)  
- Encryption helper used to store private keys: [`encrypt` / `decrypt`](src/utils/cryption.js) ([src/utils/cryption.js](src/utils/cryption.js))  
- Views: EJS templates under [src/views](src/views) — dashboard, login, register, registration-success and partials (header/footer/wallet popup/messages)  
  - Examples: [src/views/dashboard.ejs](src/views/dashboard.ejs), [src/views/registration-success.ejs](src/views/registration-success.ejs), [src/views/partials/wallet_popup.ejs](src/views/partials/wallet_popup.ejs)  
- Frontend assets: [public/js/main.js](public/js/main.js) and [public/css/style.css](public/css/style.css)  
- DB table creation script (Render helper): [render/create_table.js](render/create_table.js)  
- Price feed (Python): [fetch_data.py](fetch_data.py) — collects CoinGecko prices and writes to `dora_price`

## Environment variables
Required:
- DATABASE_URL — Postgres connection string
- SESSION_SECRET — express-session secret
- ENCRYPTION_KEY — 64-character hex string used by [`encrypt`](src/utils/cryption.js)
- INFURA_API_KEY — used by [`checkBalance`](src/wallet_actions/check_balance.js) and [`send_crypto`](src/wallet_actions/send_crypto.js)
Optional:
- SALT_ROUNDS — bcrypt rounds (default set in [src/routes/auth.routes.js](src/routes/auth.routes.js))

## Installation & run
1. Install deps:
   ```sh
   npm install
   ```
2. Create `.env` with the variables above.
3. Create DB tables (one-off):
   ```sh
   node render/create_table.js
   ```
   See [render/create_table.js](render/create_table.js).
4. Start dev server:
   ```sh
   npm run dev
   ```
   Production:
   ```sh
   npm start
   ```

## Important flows & files
- Registration and wallet creation:
  - Route: POST `/register` in [src/routes/auth.routes.js](src/routes/auth.routes.js). It calls [`createWallet`](src/wallet_actions/create_wallet.js), encrypts the private key via [`encrypt`](src/utils/cryption.js), stores a custodial wallet row and flashes one-time mnemonic to [registration-success.ejs](src/views/registration-success.ejs).
- Login:
  - Passport configured in [src/config/passportConfig.js](src/config/passportConfig.js) — serializes `user.user_id` and deserializes from DB.
- Dashboard:
  - Protected by `checkAuthenticated` and `loadWalletData` in [src/routes/dashboard.routes.js](src/routes/dashboard.routes.js). Wallet address and balance are provided to templates (the wallet popup HTML is in [src/views/partials/wallet_popup.ejs](src/views/partials/wallet_popup.ejs)).
- Sending ETH:
  - POST `/dashboard/send` in [src/routes/dashboard.routes.js](src/routes/dashboard.routes.js) decrypts stored private key with [`decrypt`](src/utils/cryption.js) and calls [`sendTransaction`](src/wallet_actions/send_crypto.js). The send function uses the Infura provider and estimates gas before sending.
- Price storage & UI:
  - Price rows are saved to the `dora_price` table (schema in [render/create_table.js](render/create_table.js)). Frontend chart uses Chart.js and polls `/dashboard/api/price/latest` implemented in [src/routes/dashboard.routes.js](src/routes/dashboard.routes.js). Frontend logic is in [public/js/main.js](public/js/main.js).

## Security notes & recommendations
- ENCRYPTION_KEY must be a 64-char hex value (see [src/utils/cryption.js](src/utils/cryption.js)). Never commit this to git.
- MNEMONIC is shown one-time on registration via flash and then should be discarded. The code currently flashes the mnemonic for a one-time view in [src/routes/auth.routes.js](src/routes/auth.routes.js) and renders [src/views/registration-success.ejs](src/views/registration-success.ejs).
- Private keys are stored encrypted in `custodial_wallet.wallet_private_key` (see [src/routes/auth.routes.js](src/routes/auth.routes.js) insertion and [src/utils/cryption.js](src/utils/cryption.js)).
- Session cookie is configured in [server.js](server.js) with rolling expiry and httpOnly; ensure HTTPS in production so `cookie.secure` is effective.

## Database schema overview
Defined in [render/create_table.js](render/create_table.js):
- users(user_id, full_name, email, password, created_at)
- user_sessions (used by connect-pg-simple)
- dora_price(id, price, timestamp)
- custodial_wallet(wallet_id, user_email, wallet_public_key, wallet_private_key, wallet_address, balance, created_at)

## Python price feed
- [fetch_data.py](fetch_data.py) uses pycoingecko & psycopg2 to write synthetic DORA prices into `dora_price`. Run separately (Python venv) and ensure same DATABASE_URL.

## Useful entry points & files (links)
- [server.js](server.js) — app entry
- [package.json](package.json) — scripts & deps
- [`pool`](src/config/dbConfig.js) — [src/config/dbConfig.js](src/config/dbConfig.js)
- [`initialize`](src/config/passportConfig.js) — [src/config/passportConfig.js](src/config/passportConfig.js)
- [`createWallet`](src/wallet_actions/create_wallet.js) — [src/wallet_actions/create_wallet.js](src/wallet_actions/create_wallet.js)
- [`sendTransaction`](src/wallet_actions/send_crypto.js) — [src/wallet_actions/send_crypto.js](src/wallet_actions/send_crypto.js)
- [`checkBalance`](src/wallet_actions/check_balance.js) — [src/wallet_actions/check_balance.js](src/wallet_actions/check_balance.js)
- [src/utils/cryption.js](src/utils/cryption.js) — encrypt/decrypt helpers
- [render/create_table.js](render/create_table.js) — DB setup
- [fetch_data.py](fetch_data.py) — external price feed
- [public/js/main.js](public/js/main.js) and [public/css/style.css](public/css/style.css)
- Views: [src/views/dashboard.ejs](src/views/dashboard.ejs), [src/views/registration-success.ejs](src/views/registration-success.ejs), [src/views/partials/wallet_popup.ejs](src/views/partials/wallet_popup.ejs), [src/views/partials/header.ejs](src/views/partials/header.ejs), [src/views/partials/footer.ejs](src/views/partials/footer.ejs)

## Next steps you may want to take
- Add integration tests for routes and wallet flows.
- Add unit tests for [`cryption`](src/utils/cryption.js) and wallet actions.
- Implement rate-limiting / stronger CSP as needed.
- Consider non-custodial option or HSM for private key storage in production.

---
For code reference see the files linked above (all paths are relative to the project root).
