# Video to Audio

A Raycast extension that extracts the audio track from a video file and saves it as
**M4A** or **MP3** next to the source file.

## Command

**Convert Video to Audio** — opens a form:

- **File** — the video to convert. Pre-filled from the current Finder selection when a
  video is selected; otherwise pick one.
- **Format** — `M4A` (default) or `MP3`.
- **Bitrate** — `128k` / `192k` (default) / `256k` / `320k`. Used for MP3, and for the
  M4A AAC fallback.

The output is written next to the source (`film.mp4` → `film.m4a`). If the name is
taken, a numeric suffix is added (`film-1.m4a`).

### M4A behaviour

M4A first tries a stream copy (`-c:a copy`) — instant and lossless. If the source audio
is not AAC (e.g. Opus in `.webm`, AC3 in `.mkv`), it automatically falls back to an AAC
re-encode at the chosen bitrate.

## Requirements

- [`ffmpeg`](https://ffmpeg.org/) on disk. Default path `/opt/homebrew/bin/ffmpeg`
  (Homebrew). Override via the extension's **ffmpeg Path** preference if installed
  elsewhere.

## Development

```bash
npm install
npm run dev     # ray develop — loads the command into Raycast with hot reload
npm test        # vitest — unit tests for the pure ffmpeg helpers
npm run build   # ray build
```

See `docs/specs/` for the design document.
