const axios = require("axios"); // npm install axios
const keyboards = require("../keyboards.js");

module.exports = (bot, db) => {
  const handleWithdraw = async (chatId, tgId) => {
    try {
      const [users] = await db.query(
        `SELECT wallet_address, balance, withdrawn, max_withdrawals FROM users WHERE tg_id = ?`,
        [tgId]
      );
      const user = users[0];

      if (!user?.wallet_address) {
        return bot.sendMessage(
          chatId,
          "⚠️ You need to set your FaucetPay wallet first. Use /wallet to set it."
        );
      }

      const totalBalance = parseFloat(user.balance) || 0;

      const promptMsg = await bot.sendMessage(
        chatId,
        `📤 *Withdraw your earnings*\n\n` +
          `💰 *Total Balance:* \`${totalBalance.toFixed(8)}\` TRX\n` +
          `🏦 *Wallet:* \`${user.wallet_address}\`\n\n` +
          `💡 Enter amount to withdraw (min 0.001 TRX):`,
        { parse_mode: "Markdown" }
      );

      const listener = async (resp) => {
        try {
          if (!resp || !resp.from || !resp.chat) return;
          if (resp.chat.id !== chatId || resp.from.id !== tgId) return;

          if (!resp.text) {
            await bot.sendMessage(chatId, "⚠️ Please enter a numeric amount (e.g., 0.001).");
            return;
          }

          if (resp.text.trim().startsWith("/")) {
            await bot.sendMessage(chatId, "⚠️ Please enter the withdrawal amount (not a command).");
            return;
          }

          const [[fresh]] = await db.query(
            `SELECT wallet_address, balance, max_withdrawals FROM users WHERE tg_id = ? LIMIT 1`,
            [tgId]
          );
          const freshBalance = parseFloat(fresh?.balance || 0);

          const amount = parseFloat(resp.text.trim());
          if (isNaN(amount) || amount < 0.001) {
            await bot.sendMessage(chatId, "⚠️ Invalid amount. Minimum withdrawal is 0.001 TRX.");
            bot.removeListener("message", listener);
            clearTimeout(timeoutId);
            return;
          }

          if (amount > freshBalance) {
            await bot.sendMessage(
              chatId,
              `⚠️ You cannot withdraw more than your balance (${freshBalance.toFixed(8)} TRX).`
            );
            bot.removeListener("message", listener);
            clearTimeout(timeoutId);
            return;
          }

          // FaucetPay API key
          const apiKey =
            "234f93dea46ead9b5ad92b3fcc521d8920dfbb7e95b97859ec2c4749442078d2";

          const satoshis = Math.floor(amount * 1e8);

          const response = await axios.post(
            "https://faucetpay.io/api/v1/send",
            new URLSearchParams({
              api_key: apiKey,
              amount: satoshis,
              to: fresh.wallet_address,
              currency: "TRX",
            }),
            { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
          );

          const data = response.data;

          if (data.status !== 200) {
            await bot.sendMessage(chatId, `❌ Withdrawal failed.\nMessage: ${data.message || "Unknown error"}`);
            bot.removeListener("message", listener);
            clearTimeout(timeoutId);
            return;
          }

          // Deduct balance & increment withdrawn (no more showing max_withdrawals to user)
          await db.query(
            `UPDATE users 
             SET balance = balance - ?, 
                 withdrawn = withdrawn + ?,
                 max_withdrawals = max_withdrawals - 1
             WHERE tg_id = ?`,
            [amount, amount, tgId]
          );

          // If withdrawal limit hits 0, reset robots + limit back silently
          const [[updated]] = await db.query(
            `SELECT max_withdrawals FROM users WHERE tg_id = ? LIMIT 1`,
            [tgId]
          );

          if ((updated?.max_withdrawals || 0) <= 0) {
            await db.query(`DELETE FROM robots WHERE tg_id = ?`, [tgId]);
            await db.query(`UPDATE users SET max_withdrawals = 3 WHERE tg_id = ?`, [tgId]);
          }

          await bot.sendMessage(
            chatId,
            `✅ *Withdrawal Successful!*\n\n` +
              `💸 Amount: *${amount.toFixed(8)} TRX*\n` +
              `🏦 Sent to: *${fresh.wallet_address}*`,
            { parse_mode: "Markdown" }
          );

          bot.removeListener("message", listener);
          clearTimeout(timeoutId);
        } catch (innerErr) {
          console.error("Error during withdrawal listener:", innerErr);
          try {
            await bot.sendMessage(chatId, "⚠️ Error processing withdrawal. Please try again later.");
          } catch (e) {}
          bot.removeListener("message", listener);
          clearTimeout(timeoutId);
        }
      };

      bot.on("message", listener);

      const timeoutId = setTimeout(() => {
        try {
          bot.removeListener("message", listener);
          bot.sendMessage(chatId, "⏳ Withdraw timed out. Please run /withdraw again when ready.");
        } catch (e) {}
      }, 2 * 60 * 1000);
    } catch (err) {
      console.error("Error in withdraw flow:", err);
      bot.sendMessage(chatId, "⚠️ Something went wrong. Please try again later.");
    }
  };

  bot.onText(/\/withdraw/, async (msg) => {
    handleWithdraw(msg.chat.id, msg.from.id);
  });

  bot.on("message", async (msg) => {
    if (!msg.text) return;
    const text = msg.text.trim();

    const triggers = ["💸 Withdraw", "withdraw", "Withdraw", "💸Withdraw"];
    if (triggers.includes(text)) {
      handleWithdraw(msg.chat.id, msg.from.id);
    }
  });
};
