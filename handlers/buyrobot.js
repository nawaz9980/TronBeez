const keyboards = require("../keyboards.js"); // import main menu

module.exports = (bot, db) => {
  // Robot profit rates
  const ROBOTS = {
    1: 22,
    2: 116,
    3: 480,
    4: 1500,
    5: 2550,
    6: 5249,
    7: 6749,
    8: 8624,
    9: 12749,
  };

  // Robot costs (used internally + in selected msg)
  const COSTS = {
    1: 5,
    2: 25,
    3: 100,
    4: 300,
    5: 500,
    6: 1000,
    7: 1250,
    8: 1500,
    9: 2000,
  };

  // Handler function for buyrobot menu
  async function showBuyRobotMenu(msg) {
    const chatId = msg.chat.id;

    let text =
      "📊 *Buy Extractors*\n\n" +
      "The higher level extractors will allow you to produce more gems per hour.\n\n" +
      "➕ *Estimated Profit Per Hour:*\n\n";

    for (const [robot, profit] of Object.entries(ROBOTS)) {
      text += `📌 Robot ${robot}: ${profit} 💎 \n`;
    }

    text += "\nChoose the best extractor for you ⬇️";

    const replyKeyboard = {
      keyboard: [
        ["🤖 Robot 1", "🤖 Robot 2", "🤖 Robot 3"],
        ["🤖 Robot 4", "🤖 Robot 5", "🤖 Robot 6"],
        ["🤖 Robot 7", "🤖 Robot 8", "🤖 Robot 9"],
        ["⬅️ Back"],
      ],
      resize_keyboard: true,
      one_time_keyboard: false,
    };

    bot.sendMessage(chatId, text, {
      parse_mode: "Markdown",
      reply_markup: replyKeyboard,
    });
  }

  // Command trigger: /buyrobot
  bot.onText(/\/buyrobot/, showBuyRobotMenu);

  // Emoji + word plain text trigger: 🤖 BuyRobot (case insensitive)
  bot.on('message', (msg) => {
    if (!msg.text) return;
    if (msg.text.trim().toLowerCase() === "🤖 buyrobot") {
      showBuyRobotMenu(msg);
      return;
    }

    const chatId = msg.chat.id;
    const text = msg.text;

    if (text && text.startsWith("🤖 Robot")) {
      const parts = text.split(" ");
      const robotId = parts[parts.length - 1];
      const profit = ROBOTS[robotId];
      const cost = COSTS[robotId];

      if (!profit) return;

      const inlineKeyboard = {
        inline_keyboard: [
          [
            { text: "✅ Buy", callback_data: `confirm_buy_${robotId}` },
            { text: "❌ Cancel", callback_data: "cancel_buy" },
          ],
        ],
      };

      bot.sendMessage(
        chatId,
        `🤖 *Robot ${robotId} Selected*\n\n📈 Estimated Profit: *${profit} 💎Hour*\n💰 Cost: *${cost} 🟡*\n\nDo you want to buy this extractor?`,
        { parse_mode: "Markdown", reply_markup: inlineKeyboard }
      );
    }

    if (text === "⬅️ Back") {
      bot.sendMessage(chatId, "🔙 Back to main menu.", {
        reply_markup: keyboards.mainMenu.reply_markup,
      });
    }
  });

  // Handle Buy / Cancel confirmation
  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const tgId = query.from.id;
    const msgId = query.message.message_id;

    if (query.data.startsWith("confirm_buy_")) {
      const robotId = query.data.split("_")[2];
      const cost = COSTS[robotId];
      const profit = ROBOTS[robotId];

      try {
        const [rows] = await db.query(`SELECT gold FROM users WHERE tg_id = ?`, [tgId]);
        const user = rows[0];

        if (!user || user.gold < cost) {
          await bot.answerCallbackQuery(query.id, {
            text: `❌ Not enough balance! 🟡`,
            show_alert: true,
          });
          return;
        }

        await db.query(`UPDATE users SET gold = gold - ? WHERE tg_id = ?`, [cost, tgId]);
        await db.query(
          `INSERT INTO robots (tg_id) VALUES (?) ON DUPLICATE KEY UPDATE tg_id = tg_id`,
          [tgId]
        );
        await db.query(
          `UPDATE robots SET robot${robotId} = robot${robotId} + 1 WHERE tg_id = ?`,
          [tgId]
        );

        await bot.answerCallbackQuery(query.id, {
          text: `✅ Robot ${robotId} purchased!\nGenerates ${profit} 💎Hour.`,
          show_alert: true,
        });

        bot.deleteMessage(chatId, msgId).catch(() => {});
      } catch (err) {
        console.error("Error buying robot:", err);
        await bot.answerCallbackQuery(query.id, {
          text: "❌ Error processing purchase.",
          show_alert: true,
        });
      }
    }

    if (query.data === "cancel_buy") {
      await bot.answerCallbackQuery(query.id, {
        text: "❌ Purchase cancelled.",
        show_alert: true,
      });

      bot.deleteMessage(chatId, msgId).catch(() => {});
      bot.sendMessage(chatId, "🔙 Back to main menu.", {
        reply_markup: keyboards.mainMenu.reply_markup,
      });
    }
  });
};
