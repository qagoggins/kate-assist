const cron = require('node-cron');
const { getDueReminders, updateNextDue, parseInterval } = require('./db');
const { sendMessage } = require('./telegram');
const { getReminderMessage } = require('./utils');
const { supabase } = require('./config');

async function checkDueReminders() {
  const dueReminders = await getDueReminders();
  if (!dueReminders.length) return;

  for (const reminder of dueReminders) {
    await sendMessage(
      reminder.chat_id,
      getReminderMessage(reminder.text, reminder.id)
    );

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

function startScheduler() {
  cron.schedule('* * * * *', checkDueReminders);
  console.log('Reminder checker scheduled.');
}

module.exports = { startScheduler };