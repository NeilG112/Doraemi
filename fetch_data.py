from pycoingecko import CoinGeckoAPI
import time
import psycopg2
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")



def save_to_db(price, timestamp):
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        cur.execute("INSERT INTO dora_price (price, timestamp) VALUES (%s, %s)", (price, timestamp))
        conn.commit()
        cur.close()
        conn.close()
        print(f"Saved to dora DB at {timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
    except Exception as e:
        print("DB Error:", e)

def fetch_prices_and_dora(tick_time):
    cg = CoinGeckoAPI()

    # assets basket
    coins = ["bitcoin", "ethereum", "dogecoin", "cardano", "binancecoin"]

    # fetch live prices in USD
    prices = cg.get_price(ids=coins, vs_currencies="usd")

    # print individual prices
    print("\nLive Prices:")
    for coin in coins:
        print(f"{coin.capitalize():<12}: ${prices[coin]['usd']:,}")

    # calculate DORA price (20% weightage each)
    weights = {coin: 0.20 for coin in coins}
    dora_price = sum(prices[coin]['usd'] * weights[coin] for coin in coins) / 100000

    print("\nSynthetic DORA Price:")
    print(f"DORA = ${dora_price:,.18f}\n")

    # save to database
    save_to_db(dora_price, tick_time)

    return dora_price, prices


if __name__ == "__main__":
    interval = 15  # seconds
    print(f"Starting DORA price feed... (fetching every {interval} seconds on the clock)")
    try:
        while True:
            # Calculate the time to wait until the next interval tick on the clock.
            # This ensures that fetches happen at :00, :15, :30, :45, etc.
            now = datetime.now()
            # We include microseconds for a more precise wait time.
            current_second_fractional = now.second + now.microsecond / 1_000_000
            wait_seconds = interval - (current_second_fractional % interval)

            # Sleep until the next tick.
            time.sleep(wait_seconds)

            # Fetch and save the price with the aligned timestamp.
            fetch_prices_and_dora(datetime.now())
    except KeyboardInterrupt:
        print("\nFeed stopped by user.")

