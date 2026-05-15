CREATE TABLE IF NOT EXISTS clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id VARCHAR(64), -- Legacy field, can be removed after migration
  open_id VARCHAR(64), -- Legacy field, can be removed after migration
  email VARCHAR(320),
  business_name TEXT,
  address TEXT,
  city TEXT,
  state VARCHAR(2),
  zip VARCHAR(10),
  phone VARCHAR(20),
  service_types JSONB,
  hours JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);