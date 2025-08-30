// handlers/stats.js
module.exports = (bot, db) => {
  // 📌 Bot start date (change this to your bot launch date)
  const BOT_START_DATE = new Date("2025-08-30"); 

  // Helper: Show stats
  const showStats = async (chatId) => {
    try {
      const [[{ totalUsers }]] = await db.query(`SELECT COUNT(*) AS totalUsers FROM users`);
      const [[{ totalWithdrawn }]] = await db.query(
        `SELECT IFNULL(SUM(withdrawn), 0) AS totalWithdrawn FROM users`
      );

      // Days running
      const today = new Date();
      const diffTime = today - BOT_START_DATE;
      const runningDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      const statsMsg =
        `📊 <b>TronBee🐝 Global Stats</b>\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `👥 <b>Total Users:</b> <code>${totalUsers.toLocaleString()}</code>\n` +
        `💸 <b>Total Withdrawn:</b> <code>${parseFloat(totalWithdrawn).toFixed(8)}</code> TRX\n` +
        `⏳ <b>Running For:</b> <code>${runningDays} days</code>\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `🚀 Keep mining, converting & earning with <b>TronBee🐝</b>!`;

      bot.sendMessage(chatId, statsMsg, { parse_mode: "HTML" });
    } catch (err) {
      console.error("Error fetching stats:", err);
      bot.sendMessage(chatId, "⚠️ Something went wrong while fetching stats.");
    }
  };

  // Command trigger
  bot.onText(/\/stats/, async (msg) => {
    showStats(msg.chat.id);
  });

  // Plain text trigger (with emojis)
  bot.on("message", async (msg) => {
    if (!msg.text) return;
    const text = msg.text.trim();

    const triggers = ["📊 Stats", "stats", "Stats", "📊 Statistics"];
    if (triggers.includes(text)) {
      showStats(msg.chat.id);
    }
  });
};
