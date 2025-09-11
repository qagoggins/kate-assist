const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input"); // npm i input
const dotenv = require("dotenv")
dotenv.config()

// const apiId = 
// const apiHash = 

// empty session on first run
const stringSession = new StringSession(""); 

(async () => {
  console.log("Generating new session string...");
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => await input.text("Please enter your number: "),
    password: async () => await input.text("Please enter your password (if 2FA enabled): "),
    phoneCode: async () => await input.text("Please enter the code you received: "),
    onError: (err) => console.log(err),
  });

  console.log("Login successful!");
  console.log("Session string:\n", client.session.save());
})();
