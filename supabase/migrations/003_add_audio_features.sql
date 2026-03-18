-- Add volume, BPM, speed, fade, and key fields to tracks
alter table tracks add column if not exists volume float default 1.0;
alter table tracks add column if not exists bpm float;
alter table tracks add column if not exists playback_speed float default 1.0;
alter table tracks add column if not exists preserve_pitch boolean default true;
alter table tracks add column if not exists fade_in float default 0;
alter table tracks add column if not exists fade_out float default 0;
alter table tracks add column if not exists key text;
