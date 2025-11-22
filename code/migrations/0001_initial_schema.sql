-- Initial schema for Ming coaching app
-- Matches original LibSQL storage patterns from src/backend/src/mastra/memory.ts

-- Enable foreign key constraints (required for SQLite/D1)
PRAGMA foreign_keys = ON;

-- conversations table (matches thread concept)
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- messages table (matches original message storage)
-- Note: Foreign key constraint removed temporarily for compatibility
-- Referential integrity handled in application code
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  role TEXT NOT NULL, -- 'user' | 'assistant' | 'system'
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- feedback_reports table (stores workflow output)
CREATE TABLE IF NOT EXISTS feedback_reports (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  segmented_analysis TEXT NOT NULL,
  summary_analysis TEXT NOT NULL,
  detailed_feedback TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- user_scores table (stores performance scores)
CREATE TABLE IF NOT EXISTS user_scores (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL,
  scenario_id TEXT,
  empathy INTEGER,
  clarity INTEGER,
  assertiveness INTEGER,
  flexibility INTEGER,
  active_listening INTEGER,
  conflict_management INTEGER,
  created_at INTEGER NOT NULL
);

-- scenarios table (stores generated scenarios)
CREATE TABLE IF NOT EXISTS scenarios (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL,
  scenario_data TEXT NOT NULL, -- JSON
  prompts TEXT NOT NULL, -- JSON
  reports TEXT NOT NULL, -- JSON
  created_at INTEGER NOT NULL
);

-- indexes
CREATE INDEX IF NOT EXISTS idx_conversations_resource ON conversations(resource_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_feedback_resource ON feedback_reports(resource_id);
CREATE INDEX IF NOT EXISTS idx_scores_resource ON user_scores(resource_id);

