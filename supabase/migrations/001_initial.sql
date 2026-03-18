-- Tracks table: all music metadata
create table tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text,
  duration integer, -- seconds (full file duration)
  youtube_url text,
  storage_path text not null,
  artwork_url text,
  start_time float, -- trim start point in seconds
  end_time float,   -- trim end point in seconds
  created_at timestamptz default now()
);

-- Playlists
create table playlists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cover_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Playlist tracks (many-to-many with ordering)
create table playlist_tracks (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid references playlists(id) on delete cascade,
  track_id uuid references tracks(id) on delete cascade,
  position integer not null,
  added_at timestamptz default now()
);

-- Indexes
create index idx_playlist_tracks_playlist on playlist_tracks(playlist_id, position);
create index idx_tracks_created on tracks(created_at desc);
