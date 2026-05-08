-- Run this in the Supabase SQL editor to create the clients table.
-- All variable columns map directly to {{variable_name}} placeholders
-- in your Telnyx AI assistant template.

CREATE TABLE clients (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Used to match the inbound call to this client record via telnyx_agent_target
  phone_number         TEXT UNIQUE NOT NULL,

  -- Core identity — injected into greeting and instructions
  business_name        TEXT NOT NULL,
  assistant_name       TEXT NOT NULL DEFAULT 'Alex',
  tone                 TEXT NOT NULL DEFAULT 'friendly and professional',

  -- Instruction customization
  custom_instructions  TEXT,           -- Appended to the base prompt at call time
  topics_off_limits    TEXT,           -- Plain-English list of restricted topics
  language             TEXT DEFAULT 'English',

  -- Call handling
  transfer_number      TEXT,           -- E.164 number for human fallback
  transfer_trigger     TEXT,           -- When the AI should escalate (plain English)
  hours_of_operation   TEXT,           -- e.g. "Mon–Fri 9am–5pm ET"
  voicemail_message    TEXT,           -- Read if call goes unanswered after hours

  -- Business-specific data
  address              TEXT,
  services_offered     TEXT,           -- Short comma-separated list or paragraph
  faq_blob             TEXT,           -- Compact Q&A block injected into system prompt

  -- Integration endpoints (optional per client)
  booking_webhook_url  TEXT,           -- Calendar/scheduling webhook
  crm_webhook_url      TEXT,           -- CRM logging webhook

  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at on any row change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();