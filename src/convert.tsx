import { useEffect, useState } from "react";
import { existsSync } from "node:fs";
import { basename } from "node:path";
import {
  Action,
  ActionPanel,
  Form,
  Toast,
  getPreferenceValues,
  getSelectedFinderItems,
  popToRoot,
  showInFinder,
  showToast,
} from "@raycast/api";
import { AudioFormat, runConversion } from "./ffmpeg";

const VIDEO_EXTENSIONS = new Set([
  "mp4",
  "mov",
  "mkv",
  "avi",
  "webm",
  "m4v",
  "flv",
  "wmv",
  "mpg",
  "mpeg",
  "ts",
  "3gp",
  "ogv",
]);

interface Preferences {
  ffmpegPath: string;
}

function isVideo(path: string): boolean {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return VIDEO_EXTENSIONS.has(ext);
}

/** Pull the last few meaningful lines out of an ffmpeg failure for the toast. */
function extractFfmpegError(error: unknown): string {
  if (error && typeof error === "object" && "stderr" in error) {
    const stderr = (error as { stderr?: unknown }).stderr;
    if (stderr) {
      const lines = stderr.toString().trim().split("\n").filter(Boolean);
      if (lines.length > 0) return lines.slice(-3).join("\n");
    }
  }
  return error instanceof Error ? error.message : String(error);
}

export default function Command() {
  const [files, setFiles] = useState<string[]>([]);
  const [format, setFormat] = useState<AudioFormat>("m4a");
  const [bitrate, setBitrate] = useState("192k");
  const [fileError, setFileError] = useState<string | undefined>();

  // Best-effort pre-fill from the current Finder selection.
  useEffect(() => {
    (async () => {
      try {
        const selected = await getSelectedFinderItems();
        const video = selected.map((item) => item.path).find(isVideo);
        if (video) setFiles([video]);
      } catch {
        // Finder not frontmost or nothing selected — leave empty for manual pick.
      }
    })();
  }, []);

  async function handleSubmit() {
    const inputPath = files[0];
    if (!inputPath) {
      setFileError("Select a video file");
      return;
    }

    const { ffmpegPath } = getPreferenceValues<Preferences>();
    if (!existsSync(ffmpegPath)) {
      await showToast({
        style: Toast.Style.Failure,
        title: "ffmpeg not found",
        message: `No binary at ${ffmpegPath}. Set the correct path in extension preferences.`,
      });
      return;
    }

    const toast = await showToast({
      style: Toast.Style.Animated,
      title: "Converting…",
      message: basename(inputPath),
    });

    try {
      const { outputPath, reencoded } = await runConversion({
        ffmpegPath,
        inputPath,
        format,
        bitrate,
      });
      toast.style = Toast.Style.Success;
      toast.title = `Saved ${basename(outputPath)}`;
      toast.message =
        format === "m4a" && !reencoded
          ? "Stream copied (lossless)"
          : `Encoded · ${bitrate}`;
      toast.primaryAction = {
        title: "Reveal in Finder",
        onAction: () => {
          showInFinder(outputPath);
        },
      };
      await popToRoot();
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = "Conversion failed";
      toast.message = extractFfmpegError(error);
    }
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Convert" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.FilePicker
        id="file"
        title="Video File"
        allowMultipleSelection={false}
        canChooseDirectories={false}
        value={files}
        error={fileError}
        onChange={(next) => {
          setFiles(next);
          if (next.length > 0) setFileError(undefined);
        }}
      />
      <Form.Dropdown
        id="format"
        title="Format"
        value={format}
        onChange={(value) => setFormat(value as AudioFormat)}
      >
        <Form.Dropdown.Item value="m4a" title="M4A (AAC)" />
        <Form.Dropdown.Item value="mp3" title="MP3" />
      </Form.Dropdown>
      <Form.Dropdown
        id="bitrate"
        title="Bitrate"
        value={bitrate}
        onChange={setBitrate}
      >
        <Form.Dropdown.Item value="128k" title="128 kbps" />
        <Form.Dropdown.Item value="192k" title="192 kbps" />
        <Form.Dropdown.Item value="256k" title="256 kbps" />
        <Form.Dropdown.Item value="320k" title="320 kbps" />
      </Form.Dropdown>
      <Form.Description text="M4A copies the audio stream losslessly when possible, otherwise re-encodes to AAC at the chosen bitrate. The result is saved next to the source file." />
    </Form>
  );
}
