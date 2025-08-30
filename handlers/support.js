// handlers/support.js
module.exports = (bot) => {
  // Helper: Show support menu
  const showSupport = (chatId) => {
    const supportMsg =
      `🛠 <b>Support & Resources</b>\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `📢 Stay updated, learn how things work, or get help from our community.\n\n` +
      `Choose an option below:`;

    const inlineKeyboard = {
      inline_keyboard: [
        [{ text: "📢 Official Channel", url: "https://t.me/YourChannelHere" }],
        [{ text: "📖 Manual", url: "https://t.me/YourManualHere" }],
        [{ text: "💬 Help Chat", url: "https://t.me/YourHelpChatHere" }],
      ],
    };

    bot.sendMessage(chatId, supportMsg, {
      parse_mode: "HTML",
      reply_markup: inlineKeyboard,
    });
  };

  // Command trigger
  bot.onText(/\/support/, async (msg) => {
    showSupport(msg.chat.id);
  });

  // Plain text trigger
  bot.on("message", async (msg) => {
    if (!msg.text) return;
    const text = msg.text.trim();

    const triggers = ["🛠 Support", "❓support", "Support", "🛠Support"];
    if (triggers.includes(text)) {
      showSupport(msg.chat.id);
    }
  });
};
