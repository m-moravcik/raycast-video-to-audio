import { describe, it, expect } from "vitest";
import { buildFfmpegArgs, resolveOutputPath, runConversion } from "./ffmpeg";

describe("buildFfmpegArgs", () => {
  it("builds MP3 args with libmp3lame and the chosen bitrate", () => {
    expect(
      buildFfmpegArgs("/in/film.mp4", "/in/film.mp3", {
        format: "mp3",
        bitrate: "192k",
      }),
    ).toEqual([
      "-y",
      "-i",
      "/in/film.mp4",
      "-vn",
      "-c:a",
      "libmp3lame",
      "-b:a",
      "192k",
      "/in/film.mp3",
    ]);
  });

  it("builds M4A copy args with no bitrate (lossless stream copy)", () => {
    expect(
      buildFfmpegArgs("/in/film.mp4", "/in/film.m4a", {
        format: "m4a",
        mode: "copy",
      }),
    ).toEqual([
      "-y",
      "-i",
      "/in/film.mp4",
      "-vn",
      "-c:a",
      "copy",
      "/in/film.m4a",
    ]);
  });

  it("builds M4A AAC encode args with bitrate for the copy fallback", () => {
    expect(
      buildFfmpegArgs("/in/film.webm", "/in/film.m4a", {
        format: "m4a",
        mode: "encode",
        bitrate: "256k",
      }),
    ).toEqual([
      "-y",
      "-i",
      "/in/film.webm",
      "-vn",
      "-c:a",
      "aac",
      "-b:a",
      "256k",
      "/in/film.m4a",
    ]);
  });
});

describe("resolveOutputPath", () => {
  it("swaps the extension when no file exists", () => {
    expect(resolveOutputPath("/a/b/film.mp4", "m4a", () => false)).toBe(
      "/a/b/film.m4a",
    );
  });

  it("adds a -1 suffix on a single collision", () => {
    const taken = new Set(["/a/b/film.m4a"]);
    expect(resolveOutputPath("/a/b/film.mp4", "m4a", (p) => taken.has(p))).toBe(
      "/a/b/film-1.m4a",
    );
  });

  it("increments the suffix until a free name is found", () => {
    const taken = new Set([
      "/a/b/film.m4a",
      "/a/b/film-1.m4a",
      "/a/b/film-2.m4a",
    ]);
    expect(resolveOutputPath("/a/b/film.mp4", "m4a", (p) => taken.has(p))).toBe(
      "/a/b/film-3.m4a",
    );
  });

  it("keeps only the final extension on multi-dot names", () => {
    expect(
      resolveOutputPath("/a/b/my.holiday.video.mov", "mp3", () => false),
    ).toBe("/a/b/my.holiday.video.mp3");
  });

  it("preserves directories containing spaces and diacritics", () => {
    expect(
      resolveOutputPath("/a/Môj film (2)/klip.mp4", "m4a", () => false),
    ).toBe("/a/Môj film (2)/klip.m4a");
  });
});

describe("runConversion", () => {
  it("uses the MP3 encoder and reports the .mp3 output path", async () => {
    const calls: string[][] = [];
    const run = async (_bin: string, args: string[]) => {
      calls.push(args);
    };
    const result = await runConversion(
      {
        ffmpegPath: "/bin/ffmpeg",
        inputPath: "/in/clip.mp4",
        format: "mp3",
        bitrate: "192k",
        exists: () => false,
      },
      run,
    );
    expect(result.outputPath).toBe("/in/clip.mp3");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("libmp3lame");
  });

  it("copies the audio stream for M4A when the source is compatible", async () => {
    const calls: string[][] = [];
    const run = async (_bin: string, args: string[]) => {
      calls.push(args);
    };
    const result = await runConversion(
      {
        ffmpegPath: "/bin/ffmpeg",
        inputPath: "/in/clip.mp4",
        format: "m4a",
        bitrate: "192k",
        exists: () => false,
      },
      run,
    );
    expect(result).toEqual({ outputPath: "/in/clip.m4a", reencoded: false });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("copy");
  });

  it("falls back to an AAC re-encode when the M4A stream copy fails", async () => {
    const calls: string[][] = [];
    let first = true;
    const run = async (_bin: string, args: string[]) => {
      calls.push(args);
      if (first) {
        first = false;
        throw new Error("Could not write header (incorrect codec parameters?)");
      }
    };
    const result = await runConversion(
      {
        ffmpegPath: "/bin/ffmpeg",
        inputPath: "/in/clip.webm",
        format: "m4a",
        bitrate: "256k",
        exists: () => false,
      },
      run,
    );
    expect(result).toEqual({ outputPath: "/in/clip.m4a", reencoded: true });
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain("copy");
    expect(calls[1]).toContain("aac");
    expect(calls[1]).toContain("256k");
  });
});
