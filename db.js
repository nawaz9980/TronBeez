// db.js
const mysql = require('mysql2/promise');
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });

// Replace with your own Telegram ID
const ADMIN_ID = process.env.ADMIN_ID || "1913794746";

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  waitForConnections: true,
  connectionLimit: 10,
  enableKeepAlive: true
});

// Listen for DB errors globally
pool.on('error', async (err) => {
  console.error('❌ MySQL Pool Error:', err);

  try {
    await bot.sendMessage(ADMIN_ID, `⚠️ DB Error: ${err.code || err.message}`);
  } catch (notifyErr) {
    console.error('❌ Failed to notify admin about DB error:', notifyErr);
  }
});

module.exports = pool;
