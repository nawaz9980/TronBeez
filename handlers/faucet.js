module.exports = (bot, db) => {
  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (text === "💧 Faucet") {
      await db.query("UPDATE users SET balance = balance + 0.00000001 WHERE tg_id = ?", [
        msg.from.id,
      ]);
      bot.sendMessage(chatId, "💧 You claimed 0.00000001 DOGE!");
    }

    // 
  });
};
