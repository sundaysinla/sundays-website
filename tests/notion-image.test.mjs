import assert from "node:assert/strict";
import test from "node:test";

import {
  getFirstNotionFileUrl,
  projectImagePath,
} from "../lib/notion-image.mjs";

test("projectImagePath creates a stable app URL for Notion page images", () => {
  assert.equal(
    projectImagePath("abc-123"),
    "/api/project-image/abc-123"
  );
});

test("getFirstNotionFileUrl prefers uploaded Notion files over external files", () => {
  const properties = {
    "Image (JPG, PNG, or GIF)": {
      files: [
        {
          type: "file",
          file: { url: "https://notion-file.example/image.jpg" },
        },
      ],
    },
    Image: {
      files: [
        {
          type: "external",
          external: { url: "https://external.example/image.png" },
        },
      ],
    },
  };

  assert.equal(
    getFirstNotionFileUrl(properties),
    "https://notion-file.example/image.jpg"
  );
});

test("getFirstNotionFileUrl falls back to the Image property", () => {
  const properties = {
    Image: {
      files: [
        {
          type: "external",
          external: { url: "https://external.example/image.png" },
        },
      ],
    },
  };

  assert.equal(
    getFirstNotionFileUrl(properties),
    "https://external.example/image.png"
  );
});
