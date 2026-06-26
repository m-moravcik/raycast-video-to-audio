import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import * as path from "node:path";

const execFileAsync = promisify(execFile);

export type AudioFormat = "m4a" | "mp3";

/** Discriminated union describing one concrete ffmpeg invocation. */
export type ConversionOptions =
  | { format: "mp3"; bitrate: string }
  | { format: "m4a"; mode: "copy" }
  | { format: "m4a"; mode: "encode"; bitrate: string };

export interface ConversionResult {
  /** Absolute path the audio was written to. */
  outputPath: string;
  /** True when audio was re-encoded rather than stream-copied. */
  reencoded: boolean;
}

/** Runs ffmpeg with the given args. Injectable so the orchestration is testable. */
export type FfmpegRunner = (
  ffmpegPath: string,
  args: string[],
) => Promise<void>;

/**
 * Build the ffmpeg argument vector for one conversion. Pure — no I/O.
 * `-vn` drops the video stream; `-y` overwrites our own (already collision-resolved)
 * target, which matters when the M4A copy attempt leaves a partial file behind.
 */
export function buildFfmpegArgs(
  input: string,
  output: string,
  opts: ConversionOptions,
): string[] {
  const base = ["-y", "-i", input, "-vn", "-c:a"];
  if (opts.format === "mp3") {
    return [...base, "libmp3lame", "-b:a", opts.bitrate, output];
  }
  if (opts.mode === "copy") {
    return [...base, "copy", output];
  }
  return [...base, "aac", "-b:a", opts.bitrate, output];
}

/**
 * Resolve a non-colliding output path next to the source: same directory and base
 * name, new extension. On collision, append `-1`, `-2`, … until free. Pure given an
 * injected `exists` predicate (defaults to the real filesystem).
 */
export function resolveOutputPath(
  inputPath: string,
  ext: string,
  exists: (p: string) => boolean = existsSync,
): string {
  const dir = path.dirname(inputPath);
  const base = path.parse(inputPath).name;
  let candidate = path.join(dir, `${base}.${ext}`);
  let n = 1;
  while (exists(candidate)) {
    candidate = path.join(dir, `${base}-${n}.${ext}`);
    n += 1;
  }
  return candidate;
}

const defaultRunner: FfmpegRunner = async (ffmpegPath, args) => {
  await execFileAsync(ffmpegPath, args);
};

/**
 * Convert a video to audio. For MP3 it encodes with libmp3lame. For M4A it first tries
 * a lossless stream copy and, if the source audio is not AAC-compatible, silently falls
 * back to an AAC re-encode at the chosen bitrate.
 *
 * `run` is injectable for testing; production code uses `execFile` (array args, no
 * shell) so paths with spaces or diacritics are passed verbatim.
 */
export async function runConversion(
  params: {
    ffmpegPath: string;
    inputPath: string;
    format: AudioFormat;
    bitrate: string;
    exists?: (p: string) => boolean;
  },
  run: FfmpegRunner = defaultRunner,
): Promise<ConversionResult> {
  const { ffmpegPath, inputPath, format, bitrate, exists } = params;
  const outputPath = resolveOutputPath(inputPath, format, exists);

  if (format === "mp3") {
    await run(
      ffmpegPath,
      buildFfmpegArgs(inputPath, outputPath, { format: "mp3", bitrate }),
    );
    return { outputPath, reencoded: true };
  }

  try {
    await run(
      ffmpegPath,
      buildFfmpegArgs(inputPath, outputPath, { format: "m4a", mode: "copy" }),
    );
    return { outputPath, reencoded: false };
  } catch {
    await run(
      ffmpegPath,
      buildFfmpegArgs(inputPath, outputPath, {
        format: "m4a",
        mode: "encode",
        bitrate,
      }),
    );
    return { outputPath, reencoded: true };
  }
}
