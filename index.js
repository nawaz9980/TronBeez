require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const db = require("./db");
const keyboards = require("./keyboards");
const fs = require("fs");
const path = require("path");

// Create bot instance
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

/**
 * ✅ Centralized user access check
 */
async function checkUserAccess(msg) {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;

  try {
    // 1️⃣ Ensure user exists in DB
    const [rows] = await db.query("SELECT * FROM users WHERE tg_id = ? LIMIT 1", [telegramId]);

    if (rows.length === 0) {
      await db.query(
        "INSERT INTO users (tg_id, balance, status, referred_rewarded) VALUES (?, 0, 'active', 0)",
        [telegramId]
      );
      console.log(`👤 New user added: ${telegramId}`);
    }

    const user = rows[0] || { status: "active" };

    // 2️⃣ Block banned users
    if (user.status === "banned") {
      return { allowed: false, reason: "banned" };
    }

    // 3️⃣ Force join required channel
    if (process.env.FORCE_CHANNEL) {
      try {
        const member = await bot.getChatMember(process.env.FORCE_CHANNEL, telegramId);
        if (member.status === "left" || member.status === "kicked") {
          return { allowed: false, reason: "join_channel" };
        }
      } catch (err) {
        console.error("Force join check error:", err.message);
        return { allowed: false, reason: "error" };
      }
    }

    // ✅ All good
    return { allowed: true };
  } catch (err) {
    console.error("Global check error:", err);
    return { allowed: false, reason: "error" };
  }
}

/**
 * ✅ Middleware wrapper to enforce checks before executing handlers
 */
function withAccess(handler) {
  return async (msg, ...args) => {
    const check = await checkUserAccess(msg);
    if (!check.allowed) {
      if (check.reason === "banned") {
        return bot.safeSendMessage(msg.chat.id, "🚫 You are banned from using this bot.");
      }
      if (check.reason === "join_channel") {
        return bot.safeSendMessage(
          msg.chat.id,
          `⚠️ Please join our channel first: ${process.env.FORCE_CHANNEL}`
        );
      }
      return; // stop execution if error
    }
    // ✅ Run actual handler if allowed
    handler(msg, ...args);
  };
}

/**
 * ✅ Safe wrapper for Telegram API calls
 */
function safeWrap(methodName) {
  const original = bot[methodName].bind(bot);

  bot[`safe${methodName.charAt(0).toUpperCase() + methodName.slice(1)}`] = async (
    ...args
  ) => {
    try {
      return await original(...args);
    } catch (err) {
      if (
        err.response &&
        err.response.statusCode === 403 &&
        err.response.body?.description?.includes("bot was blocked")
      ) {
        const chatId = args[0]?.chat_id || args[0];
        console.log(`🚫 User ${chatId} blocked the bot. Updating status...`);
        await db.query("UPDATE users SET status = 'blocked' WHERE tg_id = ?", [chatId]);
        return null;
      }
      console.error(`❌ ${methodName} error:`, err.message);
      return null;
    }
  };
}

// ✅ Patch common methods
["sendMessage", "editMessageText", "answerCallbackQuery", "sendPhoto", "sendDocument"].forEach(
  safeWrap
);

// ✅ Auto-load all handlers from /handlers
const handlersPath = path.join(__dirname, "handlers");
fs.readdirSync(handlersPath).forEach((file) => {
  if (file.endsWith(".js")) {
    const handler = require(path.join(handlersPath, file));
    if (typeof handler === "function") {
      handler(bot, db, keyboards, withAccess); // inject wrapper too
    }
  }
});

console.log("✅ Bot is running...");
