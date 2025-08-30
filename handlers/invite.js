module.exports = (bot, db) => {
  // Handler function for invite info
  async function showInvite(msg) {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    try {
      // Fetch user from DB
      const [users] = await db.query(
        "SELECT * FROM users WHERE tg_id = ?",
        [telegramId]
      );

      if (users.length === 0) {
        return bot.sendMessage(chatId, "❌ You are not registered yet. Please /start first.");
      }

      const user = users[0];

      // Count invited users (people where referrer = this user's telegram_id)
      const [invitedUsers] = await db.query(
        "SELECT COUNT(*) as total FROM users WHERE referrer = ?",
        [telegramId]
      );

      const totalInvited = invitedUsers[0].total;

      // Create referral link
      const botUsername = (await bot.getMe()).username;
      const referralLink = `https://t.me/${botUsername}?start=${telegramId}`;

      // Message text
      const message = `
👥 *Referral Program*

🔗 Your Invite Link:
${referralLink}

📊 Total Invited: *${totalInvited}*
`;

      // Inline buttons for sharing
      const inlineKeyboard = {
        inline_keyboard: [
          [
            {
              text: "📩 Share on Telegram",
              url: `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=Join%20this%20amazing%20bot!`,
            },
          ],
          [
            {
              text: "📲 Share on WhatsApp",
              url: `https://api.whatsapp.com/send?text=Join%20this%20amazing%20bot!%20${encodeURIComponent(
                referralLink
              )}`,
            },
          ],
        ],
      };

      await bot.sendMessage(chatId, message, {
        parse_mode: "Markdown",
        reply_markup: inlineKeyboard,
      });
    } catch (err) {
      console.error("Error in invite handler:", err);
      bot.sendMessage(chatId, "⚠️ Something went wrong, please try again later.");
    }
  }

  // /invite slash command
  bot.onText(/\/invite/, showInvite);

  // Plain emoji + word message trigger (case insensitive)
  bot.on("message", (msg) => {
    if (!msg.text) return;
    const text = msg.text.trim().toLowerCase();
    if (text === "👥 invite") {
      showInvite(msg);
    }
  });
};
