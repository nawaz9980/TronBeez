// handlers/wallet.js
const axios = require("axios"); // npm install axios
const keyboards = require("../keyboards.js");

module.exports = (bot, db) => {
  // Helper: Show wallet
  const showWallet = async (chatId, tgId) => {
    try {
      const [users] = await db.query(`SELECT wallet_address FROM users WHERE tg_id = ?`, [tgId]);
      const wallet = users[0]?.wallet_address || "not set";

      const inlineKeyboard = {
        inline_keyboard:
          wallet === "not set"
            ? [[{ text: "💳 Set Wallet", callback_data: "set_wallet" }]]
            : [],
      };

      bot.sendMessage(
        chatId,
        `🖇 *Your FaucetPay Wallet Address is required to receive payments from this bot.*\n\n` +
          `Your currently set FaucetPay Wallet Address is: *${wallet}*`,
        { parse_mode: "Markdown", reply_markup: inlineKeyboard }
      );
    } catch (err) {
      console.error("Error fetching wallet:", err);
      bot.sendMessage(chatId, "⚠️ Something went wrong. Please try again later.");
    }
  };

  // /wallet command
  bot.onText(/\/wallet/, async (msg) => {
    const chatId = msg.chat.id;
    const tgId = msg.from.id;
    showWallet(chatId, tgId);
  });

  // Plain text trigger (👛 Wallet)
  bot.on("message", async (msg) => {
    if (!msg.text) return;
    const text = msg.text.trim();
    const chatId = msg.chat.id;
    const tgId = msg.from.id;

    const triggers = ["👛 Wallet", "wallet", "Wallet"];
    if (triggers.includes(text)) {
      showWallet(chatId, tgId);
    }
  });

  // Set Wallet (only if not set)
  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const tgId = query.from.id;
    const msgId = query.message.message_id;

    if (query.data === "set_wallet") {
      await bot.answerCallbackQuery(query.id);

      // Check if already set
      const [users] = await db.query(
        `SELECT wallet_address FROM users WHERE tg_id = ?`,
        [tgId]
      );
      if (users[0]?.wallet_address) {
        return bot.sendMessage(
          chatId,
          `⚠️ You have already set your FaucetPay wallet: *${users[0].wallet_address}*`,
          { parse_mode: "Markdown" }
        );
      }

      bot.sendMessage(chatId, "💡 Please enter your FaucetPay wallet address:").then(() => {
        bot.once("message", async (msg) => {
          const walletAddress = msg.text.trim();

          try {
            const apiKey = "234f93dea46ead9b5ad92b3fcc521d8920dfbb7e95b97859ec2c4749442078d2"; // replace with your FaucetPay API key

            // POST request to validate wallet
            const response = await axios.post(
              "https://faucetpay.io/api/v1/checkaddress",
              new URLSearchParams({ api_key: apiKey, address: walletAddress }),
              { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
            );

            const data = response.data;

            if (data.status !== 200 || !data.payout_user_hash) {
              return bot.sendMessage(chatId, `❌ Invalid FaucetPay wallet.\nMessage: ${data.message}`);
            }

            const payoutHash = data.payout_user_hash;

            // Save in database
            await db.query(
              `UPDATE users SET wallet_address = ?, payout_user_hash = ? WHERE tg_id = ?`,
              [walletAddress, payoutHash, tgId]
            );

            bot.sendMessage(
              chatId,
              `✅ FaucetPay Wallet set successfully!\n\nWallet: *${walletAddress}*`,
              { parse_mode: "Markdown" }
            );
          } catch (err) {
            console.error("Error validating wallet:", err.response?.data || err);
            bot.sendMessage(chatId, "⚠️ Error verifying wallet. Make sure the address is correct.");
          }
        });
      });

      // Delete old inline message
      bot.deleteMessage(chatId, msgId).catch(() => {});
    }
  });
};
