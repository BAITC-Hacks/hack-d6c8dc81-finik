import { loadBackendEnvironment } from "./config/load-environment.js";
import { createApp } from "./app.js";
import { loadConfig } from "./config/env.js";
import { ActiveDatasetStore, loadDatasetFromDirectory } from "./services/dataset-service.js";

loadBackendEnvironment();
const config = loadConfig();
const activeDataset = await loadDatasetFromDirectory(config.dataDir);
const datasetStore = new ActiveDatasetStore(activeDataset);
const app = createApp(config, datasetStore);

app.listen(config.port, () => {
  console.info(`Career Quest backend listening at http://localhost:${config.port}/api`);
});
