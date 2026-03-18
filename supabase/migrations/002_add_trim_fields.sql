-- Add trim start/end columns to tracks (run this if table already exists)
alter table tracks add column if not exists start_time float;
alter table tracks add column if not exists end_time float;
