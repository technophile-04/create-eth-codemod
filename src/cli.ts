import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const COMMAND_MODULES: Record<string, string> = {
  "migrate-scaffold-ui-imports": "./migrate-scaffold-ui-imports.js",
};

function printHelp(): void {
  const commandList = Object.keys(COMMAND_MODULES)
    .map((command) => `  • ${command}`)
    .join("\n");

  console.log(
    `Usage: create-eth-codemod <command> [...args]\n\nAvailable commands:\n${commandList}`,
  );
}

export async function run(argv: string[]): Promise<void> {
  const [, , command, ...rest] = argv;

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    if (!command) {
      process.exitCode = 1;
    }
    return;
  }

  const modulePath = COMMAND_MODULES[command];
  if (!modulePath) {
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exitCode = 1;
    return;
  }

  const targetUrl = new URL(modulePath, import.meta.url);
  const childExitCode = await new Promise<number>((resolve) => {
    const child = spawn(
      process.execPath,
      [fileURLToPath(targetUrl), ...rest],
      {
        stdio: "inherit",
      },
    );

    child.on("exit", (code) => {
      resolve(code ?? 0);
    });
    child.on("error", (error) => {
      console.error(`Failed to run command ${command}:`, error);
      resolve(1);
    });
  });

  process.exitCode = childExitCode;
}

run(process.argv).catch((error) => {
  console.error("Failed to run create-eth-codemod:", error);
  process.exitCode = 1;
});

