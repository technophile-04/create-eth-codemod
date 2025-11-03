#!/usr/bin/env node

import("../dist/migrate-scaffold-ui-imports.js").catch(error => {
  console.error("Failed to run create-eth-codemod:", error);
  process.exitCode = 1;
});
