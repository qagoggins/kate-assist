const { parse, add, format, sub } = require('date-fns');
const { fromZonedTime, toZonedTime } = require('date-fns-tz');
const { TIMEZONE } = require('./config');

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

  const allMessages = [...withDone, ...withoutDone];
  const randomIndex = Math.floor(Math.random() * allMessages.length);
  return allMessages[randomIndex];
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
  if (type === 'date') {
    const localDate = parse(targetValue, 'yyyy-MM-dd HH:mm', currentTime);
    const targetDateUtc = fromZonedTime(localDate, TIMEZONE);
    return targetDateUtc;
  } else if (type === 'interval') {
    const interval = parseInterval(targetValue);
    return add(currentTime, interval);
  }
  throw new Error('Invalid type');
}

module.exports = { getReminderMessage, parseInterval, calculateNextDue };