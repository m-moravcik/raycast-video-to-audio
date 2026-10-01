# Video to Audio for Raycast

Extract audio from a video without opening an editor. Select a file in Finder, run **Convert Video to Audio** in Raycast, and save an M4A or MP3 beside the original.

<img src="assets/command-icon.png" alt="Video to Audio extension icon" width="96" height="96">

## Features

- Pre-fills the video from your current Finder selection, or lets you choose a file.
- M4A first tries a lossless audio stream copy; if that fails, it re-encodes to AAC.
- MP3 encoding with 128, 192, 256 or 320 kbps. The default is 192 kbps.
- Adds a numeric suffix when an output filename already exists.
- Shows conversion progress and a **Reveal in Finder** action on completion.
- Runs ffmpeg locally. The extension does not upload your media.

## Install from source

You need macOS, [Raycast](https://www.raycast.com/), Node.js with npm, and [ffmpeg](https://ffmpeg.org/). This repository provides a source installation; it does not include a Raycast Store install link.

```sh
brew install ffmpeg
git clone https://github.com/m-moravcik/raycast-video-to-audio.git
cd raycast-video-to-audio
npm ci
npm run dev
```

The development command loads the extension into your installed Raycast app. Open Raycast and search for **Convert Video to Audio**.

The default ffmpeg location is `/opt/homebrew/bin/ffmpeg`. If yours is different, run `which ffmpeg` and set the absolute path in the extension's **ffmpeg Path** preference. Intel Homebrew installations commonly use `/usr/local/bin/ffmpeg`.

## Use

1. Select a video in Finder, or choose it in the command's file picker.
2. Choose **M4A** or **MP3** and a bitrate.
3. Submit the form to convert.
4. Use **Reveal in Finder** to find the output.

For `film.mp4`, the result is `film.m4a` or `film.mp3`. If that name is taken, the extension uses `film-1.m4a`, then `film-2.m4a`, and so on. The input is left unchanged.

Bitrate affects MP3 and the M4A AAC fallback. It does not affect a successful stream copy. The current command converts one file at a time and saves beside the source. Failed conversions can leave a partial output file.

## Troubleshooting

- **ffmpeg not found:** check the absolute path in extension preferences.
- **Conversion failed:** check that the input contains audio and that its folder is writable. The failure toast includes the ffmpeg error.
- **Finder selection is empty:** choose the file manually in the form.

## Development

```sh
npm test       # ffmpeg arguments, output naming and conversion orchestration
npm run lint   # manifest, icons, ESLint and formatting
npm run build  # compile the Raycast extension
```

`src/convert.tsx` contains the form and Raycast integration. `src/ffmpeg.ts` handles conversion and output naming. The original design notes are in `docs/specs/`.

## License

MIT. See [LICENSE](LICENSE). Raycast and ffmpeg are separate dependencies with their own licenses.

Built by [Michal Moravčík](https://github.com/m-moravcik). [More projects](https://web.pexelo.com/portfolio).
