const { createClient } = require('@supabase/supabase-js');
const { TelegramClient } = require('telegram');
const { StringSession } = require("telegram/sessions")
const { NewMessage } = require('telegram/events');
const cron = require('node-cron');
const { parse, add, format, sub } = require('date-fns');
const input = require('input');
require("dotenv").config();

const { fromZonedTime, toZonedTime } = require("date-fns-tz")

const TIMEZONE = "Asia/Bishkek";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Telegram client setup
const apiId = parseInt(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const stringSession = new StringSession(process.env.TG_SESSION);  // Store session after first login
const client = new TelegramClient(stringSession, apiId, apiHash, {
  connectionRetries: 5,
});

const http = require("http");

const port = process.env.PORT || 8080;

http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("OK");
}).listen(port, () => {
  console.log(`Healthcheck server running on port ${port}`);
});

function getReminderMessage(reminderText, reminderId) {
  const withDone = [
    `✨ Hey, just a gentle nudge: **${reminderText}**\n\nReply /done ${reminderId} to archive this reminder.`,
    `🕰️ Your task is waiting: **${reminderText}**\nMark it complete with: /done ${reminderId}`,
    `💡 Quick reminder from me: **${reminderText}**\nFinished? Reply: /done ${reminderId}`,
    `🌸 Don’t forget: **${reminderText}**\nClose it when you’re done: /done ${reminderId}`,
    `📝 Task for you: **${reminderText}**\nReply /done ${reminderId} once completed.`,
    `⏳ Reminder: **${reminderText}**\nClear it when you finish: /done ${reminderId}`,
    `🌿 Just checking in—**${reminderText}**\nDone? Mark it with: /done ${reminderId}`,
    `💬 Here’s what’s next: **${reminderText}**\nArchive it with /done ${reminderId}`,
    `📌 Remember to: **${reminderText}**\nReply with /done ${reminderId} once it’s finished.`,
    `🌼 Friendly ping: **${reminderText}**\nWhen completed, let me know with /done ${reminderId}`,
  ];

  const withoutDone = [
    `✨ Just popping in to remind you: **${reminderText}**`,
    `🌿 Hey, don’t let this slip away today: **${reminderText}**`,
    `💌 Gentle ping from me: **${reminderText}**`,
    `🕊️ I kept this on your radar for a reason: **${reminderText}**`,
    `🎀 Don’t forget yourself in the middle of everything… but also, **${reminderText}**`,
    `📖 Writing this down again for you: **${reminderText}**`,
    `☀️ A little sunshine note: **${reminderText}**`,
    `💫 I thought you’d want this in front of you again: **${reminderText}**`,
    `🕰️ This one feels important right now: **${reminderText}**`,
    `🌸 Just me again, keeping track so you don’t have to: **${reminderText}**`,
  ];

  // combine both pools
  const allMessages = [...withDone, ...withoutDone];

  // pick random
  const randomIndex = Math.floor(Math.random() * allMessages.length);
  return allMessages[randomIndex];
}

// Helper functions
async function sendReminder(chatIdStr, text, reminderId) {
  await client.sendMessage(BigInt(chatIdStr), {
  message: getReminderMessage(text, reminderId),
});

}

function parseInterval(intervalStr) {
  const match = intervalStr.match(/(\d+)([hdm])/);
  if (!match) throw new Error('Invalid interval format. Use e.g. 2h, 30m, 1d');
  const [_, value, unit] = match;
  const num = parseInt(value);
  switch (unit) {
    case 'h': return { hours: num };
    case 'm': return { minutes: num };
    case 'd': return { days: num };
    default: throw new Error('Invalid unit: h=hour, m=minute, d=day');
  }
}

function calculateNextDue(type, targetValue, currentTime = new Date()) {
  if (type === "date") {
    // user types Bishkek local time
    const localDate = parse(targetValue, "yyyy-MM-dd HH:mm", currentTime);
    // convert to UTC before saving
    const targetDateUtc = fromZonedTime(localDate, TIMEZONE);

    // remind 30 minutes earlier
    // return sub(targetDateUtc, { minutes: 30 });
    return targetDateUtc;
  } else if (type === "interval") {
    const interval = parseInterval(targetValue);
    return add(currentTime, interval); // already UTC
  }
  throw new Error("Invalid type");
}

async function createReminder(userId, chatId, text, type, targetValue) {
  const now = new Date(); // UTC
  const nextDue = calculateNextDue(type, targetValue, now);

  const { data, error } = await supabase
    .from("reminders")
    .insert({
      user_id: userId,
      chat_id: chatId,
      text,
      type,
      target_value: targetValue,
      next_due: nextDue.toISOString(), // always UTC
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

async function listActiveReminders(userId) {
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .eq('archived', false)
    .order('next_due', { ascending: true });
  if (error) throw error;
  return data;
}

async function archiveReminder(reminderId, userId) {
  const { data: reminder, error: fetchError } = await supabase
    .from('reminders')
    .select('user_id')
    .eq('id', reminderId)
    .eq('user_id', userId)
    .single();
  if (fetchError || !reminder) throw new Error('Reminder not found or unauthorized');

  const { error } = await supabase
    .from('reminders')
    .update({ archived: true, is_active: false })
    .eq('id', reminderId)
    .eq('user_id', userId);
  if (error) throw error;
}

async function updateNextDue(reminderId, intervalObj) {
  const { data, error } = await supabase
    .from('reminders')
    .select('next_due, target_value, type')
    .eq('id', reminderId)
    .single();
  if (error || !data) throw error;

  if (data.type === 'interval') {
    const nextDue = add(new Date(data.next_due), intervalObj);
    await supabase
      .from('reminders')
      .update({ next_due: nextDue.toISOString() })
      .eq('id', reminderId);
  }
}

// Command handlers
async function handleMessage(event) {
  const message = event.message;
  if (!message || !message.message) return;

  const text = message.message;

  // Robust extraction of chat id
  const chatIdRaw =
    message.chatId ??
    message.peerId?.userId ??
    message.peerId?.chatId ??
    message.peerId?.channelId ??
    message.peerId?.id;

  if (!chatIdRaw) return;
  const chatId = chatIdRaw.toString();

  // Get sender info
  const sender = await message.getSender();
  const senderId = sender?.id?.toString();          // numeric ID for DB
  const senderUsername = sender?.username?.toLowerCase(); // username for whitelist

  // Allowed usernames
  const allowedUsers = ["keep_in_mindd", "adrian_rum"];

  if (!senderUsername || !allowedUsers.includes(senderUsername)) {
    console.log("Ignoring message from", senderUsername);
    return;
  }

  console.log("Allowed user:", senderUsername, "Message:", text);

  // ---------------- Commands ----------------

  if (text.startsWith("/remind")) {
    const parts = text.split('"');
    if (parts.length < 3) {
      await client.sendMessage(BigInt(chatId), {
        message:
          'Usage: /remind "text" at YYYY-MM-DD HH:mm  or  every Nh/Nm/Nd',
      });
      return;
    }

    const reminderText = parts[1].trim();
    const rest = parts[2].trim().toLowerCase();

    let type, targetValue;
    if (rest.startsWith("at ")) {
      type = "date";
      targetValue = rest.substring(3).trim();
    } else if (rest.startsWith("every ")) {
      type = "interval";
      targetValue = rest.substring(6).trim();
    } else {
      await client.sendMessage(BigInt(chatId), {
        message: 'Invalid format. Use "at" for date or "every" for interval.',
      });
      return;
    }

    try {
      const reminderId = await createReminder(
        senderId,   // ✅ numeric
        chatId,
        reminderText,
        type,
        targetValue
      );
      await client.sendMessage(BigInt(chatId), {
        message: `Reminder created! ID: ${reminderId}`,
      });
    } catch (err) {
      await client.sendMessage(BigInt(chatId), {
        message: `Error: ${err.message}`,
      });
    }

  } else if (text.startsWith("/list")) {
    try {
      const reminders = await listActiveReminders(senderId); // ✅ numeric
      if (reminders.length === 0) {
        await client.sendMessage(BigInt(chatId), {
          message: "No active reminders.",
        });
        return;
      }
      
      let response = "Active Reminders:\n";
reminders.forEach((r) => {
  const localTime = toZonedTime(new Date(r.next_due), TIMEZONE);
  response += `- ID: \`${r.id}\` 
Text: ${r.text} 
Next Due: ${format(
    localTime,
    "yyyy-MM-dd HH:mm"
  )} (Bishkek)\n`;
});

      await client.sendMessage(BigInt(chatId), { message: response, parseMode: "markdown" });
    } catch (err) {
      await client.sendMessage(BigInt(chatId), {
        message: `Error: ${err.message}`,
      });
    }

  } else if (text.startsWith("/done ")) {
    const reminderId = text.split(" ")[1];
    if (!reminderId) {
      await client.sendMessage(BigInt(chatId), {
        message: "Usage: /done <reminder_id>",
      });
      return;
    }

    try {
      await archiveReminder(reminderId, senderId); // ✅ numeric
      await client.sendMessage(BigInt(chatId), {
        message: "Reminder archived!",
      });
    } catch (err) {
      await client.sendMessage(BigInt(chatId), {
        message: `Error: ${err.message}`,
      });
    }
  }
}



// Periodic checker for due reminders (every minute)
async function checkDueReminders() {
  const now = new Date();
  const { data: dueReminders, error } = await supabase
    .from('reminders')
    .select('*')
    .lte('next_due', now.toISOString())
    .eq('is_active', true)
    .eq('archived', false);

  if (error || !dueReminders || dueReminders.length === 0) return;

  for (const reminder of dueReminders) {
    await sendReminder(reminder.chat_id, reminder.text, reminder.id);

    if (reminder.type === 'date') {
      await supabase
        .from('reminders')
        .update({ is_active: false, archived: true })
        .eq('id', reminder.id);
    } else if (reminder.type === 'interval') {
      const interval = parseInterval(reminder.target_value);
      await updateNextDue(reminder.id, interval);
    }
  }
}

// Main function
async function main() {
  console.log('Starting Telegram Reminder Userbot...');
  await client.start({
    phoneNumber: async () => process.env.TELEGRAM_PHONE,
    password: async () => await input.text('Password? '),
    phoneCode: async () => await input.text('Code? '),
    onError: (err) => console.log(err),
  });
  console.log('Client logged in!');
console.log(stringSession);
  // Listen for new messages
  client.addEventHandler(handleMessage, new NewMessage({}));

  // Schedule checker every minute
  cron.schedule('* * * * *', checkDueReminders);
  console.log('Reminder checker scheduled.');

  // Keep alive
  console.log('Userbot running. Press Ctrl+C to stop.');
  process.on('SIGINT', async () => {
    await client.destroy();
    process.exit();
  });
}

main().catch(console.error);