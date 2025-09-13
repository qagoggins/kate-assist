const { createClient } = require('@supabase/supabase-js');
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
require('dotenv').config();

const TIMEZONE = 'Asia/Bishkek';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const telegramConfig = {
  apiId: parseInt(process.env.TELEGRAM_API_ID),
  apiHash: process.env.TELEGRAM_API_HASH,
  stringSession: new StringSession(process.env.TG_SESSION), //process.env.TG_SESSION for prod, process.env.TEST_TG_SESSION for dev
  connectionRetries: 5,
};

const client = new TelegramClient(
  telegramConfig.stringSession,
  telegramConfig.apiId,
  telegramConfig.apiHash,
  { connectionRetries: telegramConfig.connectionRetries }
);

module.exports = { supabase, client, TIMEZONE, telegramConfig };