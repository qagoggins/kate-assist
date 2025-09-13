const { startTelegramClient } = require('./telegram');
const { startScheduler } = require('./scheduler');
const { handleMessage } = require('./commands');
const { startServer } = require('./server');
const { NewMessage } = require('telegram/events');
const { client } = require("./config")


async function main() {
  console.log('Starting Telegram Reminder Userbot...');
  await startTelegramClient();
  client.addEventHandler(handleMessage);
  startScheduler();
  startServer();

  console.log('Userbot running. Press Ctrl+C to stop.');
  process.on('SIGINT', async () => {
    await client.destroy();
    process.exit();
  });
}

main().catch(console.error);