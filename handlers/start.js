module.exports = (bot, db, keyboards, withAccess) => {
  bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const firstName = msg.from.first_name || "";
    const lastName = msg.from.last_name || "";
    const username = msg.from.username || "";
    const payload = match && match[1] ? match[1].trim() : null;
    const rawReferrerId = payload && !isNaN(payload) ? parseInt(payload, 10) : null;

    try {
      // ✅ Check if user exists
      const [rows] = await db.query("SELECT * FROM users WHERE tg_id = ? LIMIT 1", [telegramId]);

      let referrerToSet = null;
      if (rows.length === 0) {
        if (rawReferrerId && rawReferrerId !== telegramId) {
          const [refRows] = await db.query("SELECT tg_id FROM users WHERE tg_id = ? LIMIT 1", [rawReferrerId]);
          if (refRows.length > 0) referrerToSet = rawReferrerId;
        }

        // Insert user (but don’t reward referrer yet)
        await db.query(
          `INSERT INTO users (tg_id, username, first_name, last_name, balance, withdrawn, gems, gold, referrer, reward_given)
           VALUES (?, ?, ?, ?, 0, 0, 0, 5, ?, 0)`,
          [telegramId, username, firstName, lastName, referrerToSet]
        );
      } else {
        // Update profile if exists
        await db.query(
          `UPDATE users SET username=?, first_name=?, last_name=? WHERE tg_id=?`,
          [username, firstName, lastName, telegramId]
        );
        referrerToSet = rows[0].referrer;
      }

      // ✅ Check channel join
      if (process.env.FORCE_CHANNEL) {
        try {
          const member = await bot.getChatMember(process.env.FORCE_CHANNEL, telegramId);
          if (member.status === "left" || member.status === "kicked") {
            return bot.sendMessage(
              chatId,
              `⚠️ Please join our channel first:\n👉 ${process.env.FORCE_CHANNEL}`,
              {
                reply_markup: {
                  inline_keyboard: [[{ text: "✅ Joined", callback_data: "check_joined" }]]
                }
              }
            );
          }
        } catch (err) {
          console.error("Join check error:", err.message);
          return bot.sendMessage(chatId, "⚠️ Could not verify channel membership, try again later.");
        }
      }

      // If already joined, go directly to menu
      bot.sendMessage(
        chatId,
        `🚀 *Earn with TronBee🐝 Mining™*\n
1️⃣ *Buy Robots* with 🟡 Gold.\n
2️⃣ *Collect Gems* ⛽️\n every hour in your 🗃 Warehouse.\n
3️⃣ *Convert Gems💎 → TRX*  \n🔀 (100K 💎 = 1 TRX).\n
4️⃣ *Withdraw Instantly* ➖ to your wallet.\n
\n📘 Learn more in the [Manual](https://telegra.ph/Handybot-Mining--Manual-04-14).`,
        {
          ...keyboards.mainMenu,
          parse_mode: "Markdown",
          disable_web_page_preview: true,
        }
      );


    } catch (err) {
      console.error("❌ Error in /start:", err);
      bot.sendMessage(chatId, "⚠️ Something went wrong, please try again later.");
    }
  });

  // ✅ Handle "Joined" button
  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const telegramId = query.from.id;

    if (query.data === "check_joined") {
      try {
        const member = await bot.getChatMember(process.env.FORCE_CHANNEL, telegramId);
        if (member.status !== "left" && member.status !== "kicked") {
          // 🧹 Delete the "please join" message
          try {
            await bot.deleteMessage(chatId, query.message.message_id);
          } catch (e) {
            console.warn("⚠️ Could not delete join message:", e.message);
          }

          // Mark reward if not given
          const [rows] = await db.query("SELECT referrer, reward_given FROM users WHERE tg_id=? LIMIT 1", [telegramId]);
          if (rows.length > 0 && rows[0].referrer && rows[0].reward_given === 0) {
            await db.query("UPDATE users SET reward_given=1 WHERE tg_id=?", [telegramId]);
            await db.query("UPDATE users SET gold = gold + 1 WHERE tg_id=?", [rows[0].referrer]);
            bot.sendMessage(rows[0].referrer, "🎉 You earned +1 🟡 Gold! Your friend joined");
          }

          bot.sendMessage(chatId, "✅ Thank you for joining! Welcome to the bot.", keyboards.mainMenu);
        } else {
          // ❌ Show as alert instead of normal message
          await bot.answerCallbackQuery(query.id, {
            text: "❌ You still need to join the channel.",
            show_alert: true
          });
        }
      } catch (err) {
        console.error("Joined check error:", err.message);
        bot.sendMessage(chatId, "⚠️ Could not verify channel membership, try again later.");
      }
    }
  });
};
