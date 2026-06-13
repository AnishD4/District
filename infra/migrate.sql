-- =============================================
-- AI City — Supabase Database Migration
-- Run this in Supabase → SQL Editor
-- =============================================

-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Districts
CREATE TABLE districts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text DEFAULT '#6c63ff',
  position_x float DEFAULT 0,
  position_z float DEFAULT 0,
  radius float DEFAULT 50,
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Buildings
CREATE TABLE buildings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id uuid REFERENCES districts(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text CHECK (type IN ('project','subject','personal','work')) DEFAULT 'project',
  position_x float DEFAULT 0,
  position_z float DEFAULT 0,
  height float DEFAULT 10,
  embedding vector(768),
  file_count int DEFAULT 0,
  drive_tokens jsonb,
  drive_folder_id text,
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX buildings_embedding_idx ON buildings 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Rooms
CREATE TABLE rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid REFERENCES buildings(id) ON DELETE CASCADE,
  name text NOT NULL,
  room_type text CHECK (room_type IN ('files','notes','code','docs','chat')) DEFAULT 'files'
);

-- Files
CREATE TABLE files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE,
  name text NOT NULL,
  content text,
  drive_file_id text,
  url text,
  mime_type text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX files_room_idx ON files(room_id);
CREATE UNIQUE INDEX files_drive_file_idx ON files(drive_file_id) WHERE drive_file_id IS NOT NULL;

-- Connections (Skybridges between buildings)
CREATE TABLE connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_a uuid REFERENCES buildings(id) ON DELETE CASCADE,
  building_b uuid REFERENCES buildings(id) ON DELETE CASCADE,
  strength float CHECK (strength >= 0 AND strength <= 1),
  created_at timestamptz DEFAULT now(),
  UNIQUE(building_a, building_b)
);

-- AI Conversations
CREATE TABLE ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid REFERENCES buildings(id) ON DELETE CASCADE,
  messages jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their districts" ON districts
  USING (user_id = auth.uid());

-- =============================================
-- RPC Functions
-- =============================================

CREATE OR REPLACE FUNCTION increment_file_count(building_id uuid)
RETURNS void AS $$
  UPDATE buildings SET file_count = file_count + 1, last_updated = now()
  WHERE id = building_id;
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION find_similar_buildings(
  query_embedding vector(768),
  exclude_id uuid,
  threshold float,
  limit_count int
)
RETURNS TABLE(id uuid, name text, similarity float) AS $$
  SELECT id, name, 1 - (embedding <=> query_embedding) as similarity
  FROM buildings
  WHERE id != exclude_id
    AND embedding IS NOT NULL
    AND 1 - (embedding <=> query_embedding) > threshold
  ORDER BY similarity DESC
  LIMIT limit_count;
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION semantic_search(
  query_embedding vector(768),
  threshold float,
  limit_count int
)
RETURNS TABLE(id uuid, name text, type text, district_id uuid, similarity float) AS $$
  SELECT id, name, type, district_id, 1 - (embedding <=> query_embedding) as similarity
  FROM buildings
  WHERE embedding IS NOT NULL
    AND 1 - (embedding <=> query_embedding) > threshold
  ORDER BY similarity DESC
  LIMIT limit_count;
$$ LANGUAGE sql;

-- =============================================
-- Seed Demo Data
-- =============================================

INSERT INTO districts (id, name, color, position_x, position_z, radius)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Work', '#6c63ff', -80, 0, 60),
  ('22222222-2222-2222-2222-222222222222', 'Research', '#ff6b6b', 80, 0, 60),
  ('33333333-3333-3333-3333-333333333333', 'Personal', '#4ecdc4', 0, 120, 50);

INSERT INTO buildings (id, district_id, name, type, position_x, position_z, height)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'AI City App', 'project', -80, 0, 25),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'Machine Learning', 'subject', 80, 0, 20),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333', 'Journal', 'personal', 0, 120, 15);

-- Seed rooms for each building
INSERT INTO rooms (building_id, name, room_type) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Files', 'files'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Files', 'files'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Files', 'files');
