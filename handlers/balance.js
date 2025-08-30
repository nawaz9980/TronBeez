// handlers/balance.js
module.exports = (bot, db) => {
  // Helper: send balance summary
  const sendBalance = async (chatId, tgId) => {
    try {
      const [users] = await db.query(
        `SELECT balance, withdrawn, gold, gems, wallet_address 
         FROM users WHERE tg_id = ? LIMIT 1`,
        [tgId]
      );
      const user = users[0];

      if (!user) {
        return bot.sendMessage(chatId, "⚠️ User not found in the database. Please use /start first.");
      }

      const withdrawable = parseFloat(user.balance || 0).toFixed(8);
      const withdrawn   = parseFloat(user.withdrawn || 0).toFixed(8);
      const gold        = parseFloat(user.gold || 0).toFixed(2);
      const gems        = user.gems || 0;
      const wallet      = user.wallet_address || "🚫 Not set";

      const balanceMessage = `
🏦 *Your TronBee🐝 Account*
━━━━━━━━━━━━━━
💰 *Balance:* \`${withdrawable}\` TRX  
📤 *Withdrawn:* \`${withdrawn}\` TRX  

💎 *Gems:* ${gems}  
🟡 *Gold:* ${gold}  

👛 *Wallet:* \`${wallet}\`  
━━━━━━━━━━━━━━
✨ Keep collecting & growing your earnings!
`;


      await bot.sendMessage(chatId, balanceMessage, { parse_mode: "Markdown" });
    } catch (err) {
      console.error("❌ Error fetching balance:", err);
      await bot.sendMessage(chatId, "⚠️ Something went wrong. Please try again later.");
    }
  };

  // Handle plain-text menu taps (💰 Balance, 👛 Wallet) and /balance command
  bot.on("message", async (msg) => {
    if (!msg.text) return;
    const chatId = msg.chat.id;
    const tgId = msg.from.id;
    const text = msg.text.trim();

    const triggers = [
      "/balance",
      "💰 Balance",
      "💰Balance",
      // "wallet",
      "balance",
    ];

    if (triggers.some(t => t.toLowerCase() === text.toLowerCase())) {
      return sendBalance(chatId, tgId);
    }
  });

  // (Optional) also support `/balance 💰Balance`
  
};
