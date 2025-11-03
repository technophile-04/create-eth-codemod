#!/usr/bin/env node

import("../dist/migrate-scaffold-ui-imports.js").catch(error => {
  console.error("Failed to run migrate-scaffold-ui-imports:", error);
  process.exitCode = 1;
});
