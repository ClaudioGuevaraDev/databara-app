import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";

// This module is the only place that talks to the Tauri updater/process plugins,
// mirroring the boundary rule that keeps databaraService.ts as the sole `invoke` caller.

export type { Update };

export type DownloadProgress = {
  downloaded: number;
  total: number;
};

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

// Returns the pending update, or null when up to date / running outside the
// desktop app (e.g. `pnpm run dev` in a browser, where the plugin is absent).
export async function checkForUpdate(): Promise<Update | null> {
  if (!isTauriRuntime()) return null;
  return check();
}

// Downloads and installs the update, reporting cumulative download progress.
// `total` is 0 until the server advertises a Content-Length.
export async function downloadAndInstallUpdate(
  update: Update,
  onProgress: (progress: DownloadProgress) => void,
): Promise<void> {
  let downloaded = 0;
  let total = 0;

  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case "Started":
        total = event.data.contentLength ?? 0;
        onProgress({ downloaded, total });
        break;
      case "Progress":
        downloaded += event.data.chunkLength;
        onProgress({ downloaded, total });
        break;
      case "Finished":
        onProgress({ downloaded: total || downloaded, total });
        break;
    }
  });
}

export async function relaunchApp(): Promise<void> {
  if (!isTauriRuntime()) return;
  await relaunch();
}
