# Design: raycast-video-to-audio

**Date:** 2026-06-26
**Status:** Approved (pre-implementation)

## Purpose

A Raycast extension that extracts the audio track from a video file and saves it as
an audio file (M4A or MP3) next to the source. Single-file, form-driven, with the
output format and bitrate chosen at run time.

## Scope

**In scope**
- One Raycast `view` command rendering a form.
- Input: single video file, pre-filled from the current Finder selection when present.
- Output formats: M4A and MP3, chosen per run.
- Bitrate selection (used for MP3 always, and for the M4A AAC fallback).
- Output written next to the source file, with collision-safe naming.
- Progress / success / error feedback via Raycast Toast.

**Out of scope (YAGNI — may add later)**
- Batch / multi-file conversion (explicitly single-file).
- Choosing a custom output directory.
- Custom codec / sample-rate / channel options or presets.

## Prerequisites (verified 2026-06-26)

- Node v26.0.0, npm 11.12.1.
- `ffmpeg` 8.1.1 at `/opt/homebrew/bin/ffmpeg`.
- Raycast app installed.
- `ray` CLI runs via `npx` (no global install).

## Architecture

A single `view` command. The command renders a `<Form>`; on submit it resolves the
output path, runs `ffmpeg` via Node `child_process.execFile`, and reports the result
through a Toast.

Two units with distinct responsibilities:

- **`src/convert.tsx`** — UI only. Renders the form, reads the Finder selection on
  mount, validates input, drives the Toast lifecycle, and exposes the "Reveal in
  Finder" action. Knows nothing about ffmpeg argument construction.
- **`src/ffmpeg.ts`** — pure logic + process execution. Exposes:
  - `buildFfmpegArgs(input, output, format, bitrate)` → `string[]` (pure, testable).
  - `resolveOutputPath(inputPath, ext)` → collision-safe absolute path (pure, testable).
  - `runConversion(...)` → runs ffmpeg, implements the M4A copy→AAC fallback, returns
    the final output path or throws with a trimmed stderr message.

This split keeps the argument/path logic unit-testable without launching ffmpeg or
the Raycast runtime.

## Form

| Field   | Type                | Default                                                        |
|---------|---------------------|---------------------------------------------------------------|
| File    | `Form.FilePicker` (single, files only) | pre-filled from Finder selection filtered to video extensions; else empty |
| Format  | `Form.Dropdown`     | `M4A` (other: `MP3`)                                          |
| Bitrate | `Form.Dropdown`     | `192k` (options: 128k / 192k / 256k / 320k)                  |

`File` is required; submit is blocked with an inline error if empty.

## ffmpeg invocation

ffmpeg path comes from a Raycast **preference** `ffmpegPath`, default
`/opt/homebrew/bin/ffmpeg`. The Raycast Node environment does not include Homebrew on
`PATH`, so an absolute path is required. Existence is checked before running; a missing
binary produces a clear error pointing at the preference.

All invocations pass arguments as an **array via `execFile`** (never a shell string),
so paths containing spaces, diacritics, or quotes are passed verbatim with no shell
interpretation or injection surface.

- **MP3:** `-i <in> -vn -c:a libmp3lame -b:a <bitrate> <out>.mp3`
- **M4A:** first attempt `-i <in> -vn -c:a copy <out>.m4a` (fast, lossless). On a
  non-zero exit (source audio not AAC — e.g. Opus in webm, AC3 in mkv), automatically
  fall back to `-i <in> -vn -c:a aac -b:a <bitrate> <out>.m4a`. The fallback is silent
  to the user beyond normal progress.

`-vn` drops the video stream. The extension computes a non-colliding output path itself,
so no `-y`/`-n` overwrite flag is needed.

## Output naming

Same directory as the input, same basename, new extension. If the target exists, append
`-1`, `-2`, … until free (`film.m4a` → `film-1.m4a`). Implemented in
`resolveOutputPath()`.

## Feedback

- On submit: `Toast` style `Animated`, "Converting…".
- On success: `Toast` style `Success`, "Saved <filename>", with a primary action
  **Reveal in Finder** (`showInFinder(outputPath)`).
- On failure: `Toast` style `Failure`, title from the error, message = trimmed tail of
  ffmpeg `stderr`.

## Error handling / edge cases

| Case | Handling |
|------|----------|
| No file selected | Required-field validation blocks submit |
| ffmpeg binary missing | Pre-run existence check → Failure toast referencing the preference |
| M4A copy incompatible (non-AAC source) | Automatic AAC re-encode fallback at chosen bitrate |
| Output filename collision | Auto-suffix `-1`, `-2`, … |
| Path with spaces / diacritics | `execFile` array args (no shell) |
| Audio-only input (e.g. .m4a) | Works; `-vn` is a no-op, audio is copied/encoded |
| ffmpeg non-zero exit | Throw with trimmed stderr → Failure toast |

## Project structure

```
raycast-video-to-audio/
  package.json        # Raycast manifest (commands, preferences) + deps
  tsconfig.json
  eslint.config.js
  src/
    convert.tsx       # view command: Form, Toast, Finder selection, actions
    ffmpeg.ts         # buildFfmpegArgs(), resolveOutputPath(), runConversion()
  assets/
    command-icon.png  # required Raycast command icon (512x512)
  docs/specs/         # this design doc
  README.md
```

Dependencies: `@raycast/api`, `@raycast/utils`; dev: `typescript`, `@types/node`,
Raycast's eslint config. Scripts: `dev` (`ray develop`), `build` (`ray build`),
`lint`.

## Testing

- **Unit (automated):** `buildFfmpegArgs()` — correct flags per format/bitrate;
  `resolveOutputPath()` — extension swap and collision suffixing. Run with a Node test
  runner (`node:test` or `vitest`).
- **Integration (manual):** `npm run dev` loads the command into Raycast; convert a
  real `.mp4` (AAC → M4A copy path) and a `.webm`/`.mkv` (non-AAC → AAC fallback path),
  plus an MP3 run, verifying output location, naming, and Reveal-in-Finder.

## Open questions

None. Design approved by user on 2026-06-26.
