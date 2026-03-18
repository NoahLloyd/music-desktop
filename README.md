# Music

A personal music player you run yourself. Paste a YouTube link, it downloads the audio. Drop in files you already have. Everything lives on your machine and plays offline.

No subscriptions, no ads, no catalogue gaps. If it exists on YouTube, you can have it.

## Setup

You need a [Supabase](https://supabase.com) project (free tier works) and [yt-dlp](https://github.com/yt-dlp/yt-dlp) for YouTube downloads.

```
cp .env.example .env  # add your Supabase URL and anon key
brew install yt-dlp
npm install
npm run dev
```

Run the SQL in `supabase/migrations/` against your project and create a storage bucket called `audio-files`.

## Why Supabase?

Songs are cached locally so playback is always offline. Supabase is just cloud backup — your library syncs across machines and survives a hard drive failure.

## License

MIT
