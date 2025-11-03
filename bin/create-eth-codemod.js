#!/usr/bin/env node

import("../dist/cli.js").catch((error) => {
  console.error("Failed to run create-eth-codemod:", error);
  process.exitCode = 1;
});
