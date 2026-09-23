import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { loadBackendEnvironment } from "../src/config/load-environment.js";

it("loads optional env files while preserving existing shell values", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cq-env-test-"));
  const file = join(directory, ".env");
  const key = "CAREERQUEST_ENV_LOADING_TEST";
  const previous = process.env[key];
  try {
    delete process.env[key];
    loadBackendEnvironment(file); // Missing file is valid; no API key needed.
    await writeFile(file, `${key}=placeholder\n`);
    loadBackendEnvironment(file);
    expect(process.env[key]).toBe("placeholder");
    process.env[key] = "shell-value";
    loadBackendEnvironment(file);
    expect(process.env[key]).toBe("shell-value");
  } finally {
    if (previous === undefined) delete process.env[key]; else process.env[key] = previous;
    await rm(directory, { recursive: true, force: true });
  }
});
