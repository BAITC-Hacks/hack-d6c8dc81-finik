import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

// Resolve backend/.env identically from src/config and dist/config, independent of cwd.
// Node preserves existing process environment values. Never log the loaded contents.
export function loadBackendEnvironment(path = fileURLToPath(new URL("../../.env", import.meta.url))): void {
  try { loadEnvFile(path); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new Error("Unable to load backend environment file.");
  }
}
