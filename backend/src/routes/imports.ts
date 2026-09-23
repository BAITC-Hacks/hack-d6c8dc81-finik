import multer from "multer";
import { Router } from "express";

import { HttpError } from "../domain/errors.js";
import { importDataset } from "../services/import-service.js";
import type { ActiveDatasetStore } from "../services/dataset-service.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 4, fileSize: 5 * 1024 * 1024 },
});

export function createImportRouter(datasetStore: ActiveDatasetStore): Router {
  const router = Router();

  router.post("/import", (request, response, next) => {
    upload.array("files", 4)(request, response, (uploadError: unknown) => {
      if (uploadError) {
        next(new HttpError(400, "INVALID_IMPORT", "Upload must provide up to four files in the files field."));
        return;
      }
      try {
        const files = Array.isArray(request.files)
          ? request.files.map((file) => ({ originalname: file.originalname, buffer: file.buffer }))
          : [];
        response.status(200).json(importDataset(datasetStore, files));
      } catch (error) {
        next(error);
      }
    });
  });

  return router;
}
