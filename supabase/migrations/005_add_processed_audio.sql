-- Add processed audio path and loudness measurement
alter table tracks add column if not exists processed_storage_path text;
alter table tracks add column if not exists loudness_db float;
