// CREATE TABLE reminders (
//   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
//   user_id BIGINT NOT NULL,  -- Telegram user ID
//   chat_id BIGINT NOT NULL,  -- Chat where reminder was created (for sending back)
//   text TEXT NOT NULL,
//   type TEXT NOT NULL CHECK (type IN ('date', 'interval')),  -- 'date' or 'interval'
//   target_value TEXT,  -- For 'date': ISO string of target datetime; For 'interval': e.g. '2h', '1d', '30m'
//   next_due TIMESTAMP WITH TIME ZONE NOT NULL,  -- Next time to remind
//   is_active BOOLEAN DEFAULT TRUE,
//   archived BOOLEAN DEFAULT FALSE,
//   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
// );

// CREATE INDEX idx_reminders_user_id ON reminders(user_id);
// CREATE INDEX idx_reminders_next_due ON reminders(next_due);
// CREATE INDEX idx_reminders_active ON reminders(is_active, archived) WHERE is_active = TRUE AND archived = FALSE;