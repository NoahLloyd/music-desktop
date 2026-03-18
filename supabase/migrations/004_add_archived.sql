-- Add archived_at column for soft-archiving tracks
alter table tracks add column if not exists archived_at timestamptz;
