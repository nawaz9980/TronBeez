// handlers/converter.js
module.exports = (bot, db) => {
  const RATE = 1000; // 100000 Gems = 1 balance

  // Helper function to show converter
  const showConverter = async (chatId, tgId, username) => {
    try {
      const [rows] = await db.query(
        "SELECT gems, balance FROM users WHERE tg_id = ?",
        [tgId]
      );

      if (rows.length === 0) {
        return bot.sendMessage(chatId, "⚠️ You are not registered.");
      }

      const user = rows[0];

      let text =
        `👋 Hello <b>${username}</b>!\n\n` +
        `✨ <b>Welcome to the Converter</b>\nHere you can exchange your 💎 <b>Gems</b> into 💰 <b>Balance</b>!\n\n` +
        `📊 <b>Current Rate:</b>\n${RATE.toLocaleString()} 💎 = <b>0.01</b> TRX 💰\n\n` +
        `───────────────\n` +
        `📦 <b>Your Wallet</b>\n` +
        `💎 Gems: <b>${user.gems.toLocaleString()}</b>\n` +
        `💰 Balance: <b>${parseFloat(user.balance).toFixed(8)}</b>`;

      await bot.sendMessage(chatId, text, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔄 Convert Now", callback_data: "convert_now" }],
          ],
        },
      });
    } catch (err) {
      console.error("Converter error:", err);
      bot.sendMessage(chatId, "❌ Error loading converter.");
    }
  };

  // /converter command
  bot.onText(/\/converter/, async (msg) => {
    const tgId = msg.from.id;
    const username = msg.from.first_name || msg.from.username || "friend";
    showConverter(msg.chat.id, tgId, username);
  });

  // Plain text trigger (🔄 Converter)
  bot.on("message", async (msg) => {
    if (!msg.text) return;
    const chatId = msg.chat.id;
    const tgId = msg.from.id;
    const username = msg.from.first_name || msg.from.username || "friend";

    const triggers = ["🔄 Converter", "converter", "Converter"];
    if (triggers.includes(msg.text.trim())) {
      showConverter(chatId, tgId, username);
    }
  });

  // Handle button click
  bot.on("callback_query", async (query) => {
    if (query.data !== "convert_now") return;

    const tgId = query.from.id;
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;

    try {
      const [rows] = await db.query(
        "SELECT gems, balance FROM users WHERE tg_id = ?",
        [tgId]
      );

      if (rows.length === 0) {
        return bot.answerCallbackQuery(query.id, {
          text: "⚠️ You are not registered.",
          show_alert: true,
        });
      }

      const user = rows[0];

      if (user.gems < RATE) {
        return bot.answerCallbackQuery(query.id, {
          text: `❌ You need at least ${RATE} 💎 Gems to convert.`,
          show_alert: true,
        });
      }

      // Calculate conversion
      const convertUnits = Math.floor(user.gems / RATE);
      const convertBalance = convertUnits * 0.01; // 1 balance per 100k gems
      const gemsUsed = convertUnits * RATE;

      const newGems = user.gems - gemsUsed;
      const newBalance = parseFloat(user.balance) + convertBalance;

      // Update DB
      await db.query(
        "UPDATE users SET gems = ?, balance = ? WHERE tg_id = ?",
        [newGems, newBalance, tgId]
      );

      // Delete old message with button
      await bot.deleteMessage(chatId, messageId);

      // Success styled message
      const successText =
        `✅ <b>Conversion Successful!</b>\n\n` +
        `➖ <b>Used:</b> ${gemsUsed.toLocaleString()} 💎\n` +
        `➕ <b>Added:</b> ${convertBalance.toFixed(8)} TRX 💰\n\n` +
        `📊 <b>Updated Wallet</b>\n` +
        `💰 Balance: <b>${newBalance.toFixed(8)}</b>\n` +
        `💎 Gems: <b>${newGems.toLocaleString()}</b>\n\n` +
        `🎯 Keep collecting and convert more!`;

      bot.sendMessage(chatId, successText, { parse_mode: "HTML" });
    } catch (err) {
      console.error("Conversion error:", err);
      bot.answerCallbackQuery(query.id, {
        text: "❌ Error during conversion.",
        show_alert: true,
      });
    }
  });
};
