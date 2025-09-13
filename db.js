const { supabase } = require('./config');
const { parseInterval, calculateNextDue } = require('./utils');

async function createReminder(userId, chatId, text, type, targetValue) {
  const now = new Date();
  const nextDue = calculateNextDue(type, targetValue, now);

  const { data, error } = await supabase
    .from('reminders')
    .insert({
      user_id: userId,
      chat_id: chatId,
      text,
      type,
      target_value: targetValue,
      next_due: nextDue.toISOString(),
    })
    .select('id')
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

async function getDueReminders() {
  const now = new Date();
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .lte('next_due', now.toISOString())
    .eq('is_active', true)
    .eq('archived', false);
  if (error) throw error;
  return data || [];
}

module.exports = {
  createReminder,
  listActiveReminders,
  archiveReminder,
  updateNextDue,
  getDueReminders,
};