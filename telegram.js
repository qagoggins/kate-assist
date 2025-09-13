const { client } = require('./config');
const input = require('input');

async function startTelegramClient() {
  await client.start({
    phoneNumber: async () => process.env.TELEGRAM_PHONE,
    password: async () => await input.text('Password? '),
    phoneCode: async () => await input.text('Code? '),
    onError: (err) => console.log(err),
  });
  console.log('Telegram client logged in!');
}

async function sendMessage(chatId, message, options = {}) {
  await client.sendMessage(BigInt(chatId), {
    message,
    ...options,
  });
}

module.exports = { startTelegramClient, sendMessage };