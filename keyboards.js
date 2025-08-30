module.exports = {
  mainMenu: {
    reply_markup: {
      keyboard: [
        ["💰Balance"], // row 1
        ["🤖 BuyRobot", "🗃 Warehouse"], // row 2
        ["👥 Invite", "🎁 Bonus", "🔄 Converter"], // row 3
        ["👛 Wallet", "📊 Statistics", "💸 Withdraw"], // row 4
        ["❓support"], // row 5
        // ["ℹ️ Manual & Info"]                             // row 6
      ],
      resize_keyboard: true,
      one_time_keyboard: false
    },
  },
};