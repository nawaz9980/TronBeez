const moment = require("moment-timezone");

// Random bonus between 0.1 and 0.9
function getRandomBonus() {
  return parseFloat((Math.random() * (0.9 - 0.1) + 0.1).toFixed(1));
}

module.exports = (bot, db) => {
  // 🔹 Helper: show bonus button
  const showBonusButton = (chatId) => {
    bot.sendMessage(chatId, "🎁 You can claim your daily bonus here:", {
      reply_markup: {
        inline_keyboard: [[{ text: "🎁 Claim Bonus", callback_data: "claim_bonus" }]],
      },
    });
  };

  // Handle /bonus command
  bot.onText(/\/bonus/, async (msg) => {
    const chatId = msg.chat.id;
    showBonusButton(chatId);
  });

  // Handle plain text triggers (keyboard or typed)
  bot.on("message", async (msg) => {
    if (!msg.text) return;
    const chatId = msg.chat.id;
    const text = msg.text.trim().toLowerCase();

    if (text === "🎁 bonus" || text === "bonus") {
      return showBonusButton(chatId);
    }
  });

  // Handle inline button click
  bot.on("callback_query", async (query) => {
    const tgId = query.from.id;
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;

    if (query.data !== "claim_bonus") return;

    try {
      // Fetch user data
      const [rows] = await db.query(
        "SELECT gold, claimed_at FROM users WHERE tg_id = ?",
        [tgId]
      );

      if (rows.length === 0) {
        return bot.answerCallbackQuery(query.id, {
          text: "⚠️ You are not registered in the system.",
          show_alert: true,
        });
      }

      const user = rows[0];
      const now = moment().tz("Asia/Kolkata");
      const lastClaimed = user.claimed_at
        ? moment(user.claimed_at).tz("Asia/Kolkata")
        : null;

      // Check 24-hour cooldown
      if (lastClaimed && now.diff(lastClaimed, "hours") < 24) {
        const nextAvailable = lastClaimed.add(24, "hours");
        return bot.answerCallbackQuery(query.id, {
          text: `⏳ You already claimed!\nNext bonus at ${nextAvailable.format(
            "YYYY-MM-DD HH:mm:ss"
          )}`,
          show_alert: true,
        });
      }

      // 🎲 Random bonus between 0.1–0.9
      const DAILY_BONUS = getRandomBonus();

      // 👉 Ensure numbers; round balance to 1 decimal
      const currentGold = Number(user.gold ?? 0);
      const newGold = parseFloat((currentGold + Number(DAILY_BONUS)).toFixed(1));

      // Grant bonus
      await db.query(
        "UPDATE users SET gold = ?, claimed_at = ? WHERE tg_id = ?",
        [newGold, now.format("YYYY-MM-DD HH:mm:ss"), tgId]
      );

      // Try deleting original button message (non-blocking)
      try {
        await bot.deleteMessage(chatId, messageId);
      } catch (e) {
        // ignore delete errors
      }

      // ✅ Always send confirmation
      await bot.sendMessage(
        chatId,
        `🎉 Bonus claimed!\nYou received ${DAILY_BONUS.toFixed(
          1
        )} 🪙 Gold.\n\n💰 Balance: ${newGold.toFixed(
          1
        )} Gold\n🕒 Claimed at: ${now.format("YYYY-MM-DD HH:mm:ss")}`
      );

      // Stop the spinner
      await bot.answerCallbackQuery(query.id);
    } catch (err) {
      console.error("Bonus claim error:", err);
      bot.answerCallbackQuery(query.id, {
        text: "❌ Error while claiming bonus. Try again later.",
        show_alert: true,
      });
    }
  });
};
