import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

export interface AppConfig {
  port: number;
  corsOrigin: string;
  dataDir: string;
  openAiApiKey: string | undefined;
  openAiModel: string;
}

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const defaultDataDir = resolve(moduleDirectory, "../../..");

function readPort(value: string | undefined): number {
  if (value === undefined || value === "") {
    return 8000;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }

  return port;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: readPort(env.PORT),
    corsOrigin: env.CORS_ORIGIN?.trim() || "http://localhost:5173",
    dataDir: env.DATA_DIR?.trim() || defaultDataDir,
    openAiApiKey: env.OPENAI_API_KEY,
    openAiModel: env.OPENAI_MODEL?.trim() || "gpt-5-mini",
  };
}
