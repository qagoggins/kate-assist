const { sendMessage } = require('./telegram');
const { createReminder, listActiveReminders, archiveReminder } = require('./db');
const { format, toZonedTime } = require('date-fns-tz');
const { TIMEZONE } = require('./config');

async function getRandomQuote() {
  try {
    const res = await fetch(`${process.env.SUPABASE_URL}/functions/v1/quotes`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Quote fetch failed:', err);
    return null;
  }
}

async function handleMessage(event) {
  const message = event.message;
  if (!message || !message.message) return;

  const text = message.message;
  const chatIdRaw =
    message.chatId ??
    message.peerId?.userId ??
    message.peerId?.chatId ??
    message.peerId?.channelId ??
    message.peerId?.id;
  if (!chatIdRaw) return;
  const chatId = chatIdRaw.toString();

  const sender = await message.getSender();
  const senderId = sender?.id?.toString();
  const senderUsername = sender?.username?.toLowerCase();

  const allowedUsers = ['keep_in_mindd', 'adrian_rum'];
  if (!senderUsername || !allowedUsers.includes(senderUsername)) {
    console.log('Ignoring message from', senderUsername);
    return;
  }

  console.log('Allowed user:', senderUsername, 'Message:', text);

  if (text.startsWith('/remind')) {
    const parts = text.split('"');
    if (parts.length < 3) {
      await sendMessage(chatId, 'Usage: /remind "text" at YYYY-MM-DD HH:mm  or  every Nh/Nm/Nd');
      return;
    }

    const reminderText = parts[1].trim();
    const rest = parts[2].trim().toLowerCase();
    let type, targetValue;
    if (rest.startsWith('at ')) {
      type = 'date';
      targetValue = rest.substring(3).trim();
    } else if (rest.startsWith('every ')) {
      type = 'interval';
      targetValue = rest.substring(6).trim();
    } else {
      await sendMessage(chatId, 'Invalid format. Use "at" for date or "every" for interval.');
      return;
    }

    try {
      const reminderId = await createReminder(senderId, chatId, reminderText, type, targetValue);
      await sendMessage(chatId, `Reminder created! ID: ${reminderId}`);
    } catch (err) {
      await sendMessage(chatId, `Error: ${err.message}`);
    }
  } else if (text.startsWith('/list')) {
    try {
      const reminders = await listActiveReminders(senderId);
      if (reminders.length === 0) {
        await sendMessage(chatId, 'No active reminders.');
        return;
      }

      let response = 'Active Reminders:\n';
      reminders.forEach((r) => {
        const localTime = toZonedTime(new Date(r.next_due), TIMEZONE);
        response += `- ID: \`${r.id}\` 
Text: ${r.text} 
Next Due: ${format(localTime, 'yyyy-MM-dd HH:mm')} (Bishkek)\n`;
      });

      await sendMessage(chatId, { message: response, parseMode: 'markdown' });
    } catch (err) {
      await sendMessage(chatId, `Error: ${err.message}`);
    }
  } else if (text.startsWith('/done ')) {
    const reminderId = text.split(' ')[1];
    if (!reminderId) {
      await sendMessage(chatId, 'Usage: /done <reminder_id>');
      return;
    }

    try {
      await archiveReminder(reminderId, senderId);
      await sendMessage(chatId, 'Reminder archived!');
    } catch (err) {
      await sendMessage(chatId, `Error: ${err.message}`);
    }
  } else if (text.startsWith('/quote')) {
    try {
      const response = await getRandomQuote();
      const quote = await JSON.stringify(response, null, 2)
      console.log(quote);
      console.log(quote[0].text);
      
      
      if (!quote) {
        await sendMessage(chatId, 'Sorry, I couldn’t fetch a quote right now 🌸');
        return;
      }

      const formatted = `💭 "${quote.text}"\n` + (quote.author ? `\n╰ ${quote.author}` : '');
      await sendMessage(chatId, { message: formatted, parseMode: 'markdown' });
    } catch (err) {
      await sendMessage(chatId, `Error fetching quote: ${err.message}`);
    }
  }
}

module.exports = { handleMessage };