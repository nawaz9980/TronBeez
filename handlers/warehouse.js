const ROBOTS = {
  1: { profit: 22 },
  2: { profit: 116 },
  3: { profit: 480 },
  4: { profit: 1500 },
  5: { profit: 2550 },
  6: { profit: 5249 },
  7: { profit: 6749 },
  8: { profit: 8624 },
  9: { profit: 12749 },
};

const moment = require("moment-timezone"); // npm install moment-timezone

module.exports = (bot, db) => {
  // Handler function for warehouse logic
  async function showWarehouse(msg) {
    const chatId = msg.chat.id;
    const tgId = msg.from.id;
    
    try {
      // Ensure user has a robots row
      await db.query(
        `INSERT INTO robots (tg_id) VALUES (?) 
         ON DUPLICATE KEY UPDATE tg_id = tg_id`,
        [tgId]
      );
      
      // Fetch user robots
      const [rows] = await db.query(`SELECT * FROM robots WHERE tg_id = ?`, [tgId]);
      const userRobots = rows[0];
      
      if (!userRobots) {
        return bot.sendMessage(chatId, "❌ You don't own any robots yet. Use /buyrobot first.");
      }
      
      // Fetch last collection
      const [users] = await db.query(`SELECT last_collected FROM users WHERE tg_id = ?`, [tgId]);
      let now = moment().tz("Asia/Kolkata").unix();
      
      let lastCollected = users[0]?.last_collected ?
        moment.tz(users[0].last_collected, "Asia/Kolkata").unix() :
        now;
      
      if (!users[0]?.last_collected) {
        await db.query(`UPDATE users SET last_collected = ? WHERE tg_id = ?`, [
          moment().tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss"),
          tgId,
        ]);
      }
      
      // Time difference
      let elapsed = Math.max(0, now - lastCollected);
      if (elapsed > 7200) elapsed = 7200; // cap at 2h
      
      // Calculate gems earned
      const gemsEarned = {};
      let totalGems = 0;
      for (let i = 1; i <= 9; i++) {
        const count = parseInt(userRobots[`robot${i}`] ?? 0, 10) || 0;
        const profitPerHour = ROBOTS[i].profit;
        const perSecond = profitPerHour / 3600;
        gemsEarned[i] = Math.floor(count * perSecond * elapsed);
        totalGems += gemsEarned[i];
      }
      
      // Build warehouse message
      let message = `🏭 *Your Warehouse*\n\nYour robots are mining gems in the warehouse.\nThey stop extracting after *two hour(s)*.\nCollect regularly to maximize your profits.\n\n⸻\n\n`;
      
      for (let i = 1; i <= 9; i++) {
        const count = parseInt(userRobots[`robot${i}`] ?? 0, 10) || 0;
        message += ` • Robot ${i} (${count}): ${gemsEarned[i]} 💎\n`;
      }
      
      // Inline button to collect gems
      const inlineKeyboard = {
        inline_keyboard: [
          [{ text: `💎 Collect Gems (${totalGems})`, callback_data: `collect_gems` }]
        ]
      };
      
      bot.sendMessage(chatId, message, { parse_mode: "Markdown", reply_markup: inlineKeyboard });
    } catch (err) {
      console.error("Error in /warehouse:", err);
      bot.sendMessage(chatId, "⚠️ Something went wrong. Please try again later.");
    }
  }
  
  // 1. /warehouse slash command
  bot.onText(/\/warehouse/, showWarehouse);
  
  // 2. 🗃 emoji as a stand-alone message (no slash)
  bot.on('message', (msg) => {
    if (msg.text && msg.text.trim() === "🗃 Warehouse") {
      showWarehouse(msg);
    }
  });
  
  // Handle Collect Gems button
  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const tgId = query.from.id;
    const msgId = query.message.message_id;
    
    if (query.data === "collect_gems") {
      try {
        const [robotRows] = await db.query(`SELECT * FROM robots WHERE tg_id = ?`, [tgId]);
        const userRobots = robotRows[0];
        
        const [users] = await db.query(`SELECT last_collected, gems FROM users WHERE tg_id = ?`, [tgId]);
        const now = moment().tz("Asia/Kolkata").unix();
        
        let lastCollected = users[0]?.last_collected ?
          moment.tz(users[0].last_collected, "Asia/Kolkata").unix() :
          now;
        
        let elapsed = Math.max(0, now - lastCollected);
        if (elapsed > 7200) elapsed = 7200; // cap at 2h
        
        // Calculate gems earned
        let totalGems = 0;
        for (let i = 1; i <= 9; i++) {
          const count = parseInt(userRobots[`robot${i}`] ?? 0, 10) || 0;
          const profitPerHour = ROBOTS[i].profit;
          const perSecond = profitPerHour / 3600;
          totalGems += Math.floor(count * perSecond * elapsed);
        }
        
        if (totalGems <= 0) {
          await bot.answerCallbackQuery(query.id, { text: "⚠️ No 💎 gems to collect yet!", show_alert: true });
          return;
        }
        
        const currentGems = users[0]?.gems ?? 0;
        const newGems = currentGems + totalGems;
        
        // Update user's gems and reset last_collected
        await db.query(`UPDATE users SET gems = ?, last_collected = ? WHERE tg_id = ?`, [
          newGems,
          moment().tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss"),
          tgId,
        ]);
        
        await bot.answerCallbackQuery(query.id, { text: `✅ Collected ${totalGems} 💎!`, show_alert: true });
        bot.deleteMessage(chatId, msgId).catch(() => {});
        bot.sendMessage(
          chatId,
          `✅ Successfully collected gems!\n\nCurrent gems: *${newGems} 💎*`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [
                [{ text: "✅ OK", callback_data: "ok" }]
              ] } }
        );
        
      } catch (err) {
        console.error("Error collecting gems:", err);
        await bot.answerCallbackQuery(query.id, { text: "⚠️ Error collecting gems.", show_alert: true });
      }
    }
    
    if (query.data === "ok") {
      await bot.answerCallbackQuery(query.id);
      bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
    }
  });
};
