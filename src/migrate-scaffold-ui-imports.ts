#!/usr/bin/env node

import arg from "arg";
import chalk from "chalk";
import fs from "fs/promises";
import path from "path";

type SpecifierRenameRule = {
  newName: string;
  keepAlias?: boolean;
};

type NamedImportEntry = {
  raw: string;
  spec?: {
    isType: boolean;
    imported: string;
    alias?: string;
  };
  leadingWhitespace?: string;
  trailingWhitespace?: string;
  comma?: string;
};

type NamedImportParseResult = {
  entries: NamedImportEntry[];
  specifiers: string[];
};

type ImportTransform = {
  newPath: string;
  renameSpecifiers?: Record<string, SpecifierRenameRule>;
  description: string;
};

type ImportAnalysis = {
  original: string;
  updated: string;
  specifiers: string[];
  defaultImport?: string;
  appliedTransform?: ImportTransform;
};

const COMPONENT_TARGET = "@scaffold-ui/components";

const LEGACY_COMPONENT_SPECIFIERS = new Set([
  "Address",
  "AddressInput",
  "Balance",
  "EtherInput",
  "InputBase",
  "BaseInput",
]);

const COMPONENT_SPECIFIER_RENAMES: Record<string, SpecifierRenameRule> = {
  InputBase: { newName: "BaseInput", keepAlias: true },
};

const RAW_PATH_REPLACEMENTS: Array<[string, string]> = [
  ["~~/components/scaffold-eth/Input/AddressInput", COMPONENT_TARGET],
  ["~~/components/scaffold-eth/Input/EtherInput", COMPONENT_TARGET],
  ["~~/components/scaffold-eth/Input", COMPONENT_TARGET],
  ["~~/components/scaffold-eth/Address/Address", COMPONENT_TARGET],
  ["~~/components/scaffold-eth/Address", COMPONENT_TARGET],
];

const SUPPORTED_CODE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
  ".args.mjs",
  ".md",
  ".mdx",
]);

const IGNORED_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  "dist",
  ".next",
  "build",
  "out",
]);

const IMPORT_REGEX = /import\s+[\s\S]*?from\s+["']([^"']+)["'];?/g;
const EXPORT_FROM_REGEX = /export\s+[\s\S]*?from\s+["']([^"']+)["'];?/g;

async function main(rawArgs: string[]) {
  const args = arg(
    {
      "--dry-run": Boolean,
      "--help": Boolean,
      "-h": "--help",
    },
    { argv: rawArgs.slice(2) }
  );

  if (args["--help"]) {
    printHelp();
    return;
  }

  const targetPath = args._[0];
  if (!targetPath) {
    console.error(
      chalk.red("✖ Missing target path. Run with --help for usage.")
    );
    process.exitCode = 1;
    return;
  }

  const absoluteTarget = path.resolve(process.cwd(), targetPath);
  let stats;
  try {
    stats = await fs.stat(absoluteTarget);
  } catch (error) {
    console.error(chalk.red(`✖ Unable to access path: ${absoluteTarget}`));
    console.error(String(error));
    process.exitCode = 1;
    return;
  }

  const dryRun = Boolean(args["--dry-run"]);

  const filesToProcess: string[] = [];
  if (stats.isDirectory()) {
    await collectFilesRecursively(absoluteTarget, filesToProcess);
  } else if (stats.isFile()) {
    filesToProcess.push(absoluteTarget);
  } else {
    console.error(
      chalk.red("✖ Provided path is neither a file nor a directory.")
    );
    process.exitCode = 1;
    return;
  }

  if (filesToProcess.length === 0) {
    console.log(
      chalk.yellow("⚠ No files found matching supported extensions.")
    );
    return;
  }

  let filesChanged = 0;
  const changeSummary: string[] = [];

  for (const filePath of filesToProcess) {
    const { changed, summary } = await processFile(filePath, dryRun);
    if (changed) {
      filesChanged += 1;
      changeSummary.push(
        ...summary.map(
          (line) => `${path.relative(process.cwd(), filePath)}: ${line}`
        )
      );
    }
  }

  const header = dryRun
    ? chalk.cyan("Dry run complete")
    : chalk.green("Codemod complete");
  console.log(`\n${header}`);
  console.log(
    `${filesChanged} file${filesChanged === 1 ? "" : "s"} updated${dryRun ? " (simulated)" : ""}.`
  );
  if (changeSummary.length > 0) {
    console.log("\nChanges:");
    changeSummary.forEach((line) => console.log(`  • ${line}`));
  }
}

function printHelp() {
  console.log(`
Usage: yarn migrate-scaffold-ui <path> [--dry-run]

Arguments:
  path        File or directory to update. For extensions, point to the extension root or packages directory.

Options:
  --dry-run   Show the planned changes without writing to disk.
  --help      Show this message.
`);
}

async function collectFilesRecursively(
  targetDir: string,
  accumulator: string[]
) {
  const dirEntries = await fs.readdir(targetDir, { withFileTypes: true });
  for (const entry of dirEntries) {
    if (IGNORED_DIRECTORIES.has(entry.name)) continue;

    const fullPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      await collectFilesRecursively(fullPath, accumulator);
      continue;
    }

    if (!entry.isFile()) continue;

    const ext = getExtension(entry.name);
    if (SUPPORTED_CODE_EXTENSIONS.has(ext)) {
      accumulator.push(fullPath);
    }
  }
}

async function processFile(filePath: string, dryRun: boolean) {
  const originalContent = await fs.readFile(filePath, "utf8");
  const { updatedContent, summary } = transformContent(
    originalContent,
    filePath
  );

  const changed = updatedContent !== originalContent;
  if (changed && !dryRun) {
    await fs.writeFile(filePath, updatedContent, "utf8");
  }

  return { changed, summary };
}

function transformContent(content: string, filePath: string) {
  const summary: string[] = [];
  let updated = content;

  const importMatches = Array.from(updated.matchAll(IMPORT_REGEX));
  for (const match of importMatches) {
    const fullStatement = match[0];
    const legacyPath = match[1];
    const analysis = analyzeImportStatement(fullStatement, legacyPath);
    if (!analysis) continue;

    const { appliedTransform, updated: rewritten } = analysis;
    if (appliedTransform && rewritten !== fullStatement) {
      summary.push(`import → ${appliedTransform.description}`);
      updated = updated.replace(fullStatement, rewritten);
    }
  }

  const exportMatches = Array.from(updated.matchAll(EXPORT_FROM_REGEX));
  for (const match of exportMatches) {
    const fullStatement = match[0];
    const legacyPath = match[1];
    const transform = determineTransform(legacyPath, []);
    if (transform) {
      const rewritten = fullStatement.replace(legacyPath, transform.newPath);
      if (rewritten !== fullStatement) {
        summary.push(`export → ${transform.description}`);
        updated = updated.replace(fullStatement, rewritten);
      }
    }
  }

  for (const [legacy, modern] of RAW_PATH_REPLACEMENTS) {
    if (updated.includes(legacy)) {
      updated = updated.split(legacy).join(modern);
      summary.push(`text → ${legacy} → ${modern}`);
    }
  }

  return { updatedContent: updated, summary };
}

function analyzeImportStatement(
  fullStatement: string,
  legacyPath: string
): ImportAnalysis | undefined {
  const namedSectionMatch = fullStatement.match(/\{([\s\S]*?)\}/);
  const namedResult = namedSectionMatch
    ? parseNamedImports(namedSectionMatch[1])
    : undefined;
  const specifiers = namedResult?.specifiers ?? [];
  const defaultImport = extractDefaultImport(fullStatement);
  if (defaultImport) {
    specifiers.push(defaultImport);
  }

  const transform = determineTransform(legacyPath, specifiers);
  if (!transform) {
    return {
      original: fullStatement,
      updated: fullStatement,
      specifiers,
      defaultImport,
    };
  }

  let updatedStatement = fullStatement.replace(legacyPath, transform.newPath);

  if (namedSectionMatch && transform.renameSpecifiers && namedResult) {
    const updatedBraceContent = buildNamedImport(
      namedResult.entries,
      transform.renameSpecifiers
    );
    updatedStatement = updatedStatement.replace(
      namedSectionMatch[0],
      `{${updatedBraceContent}}`
    );
  }

  return {
    original: fullStatement,
    updated: updatedStatement,
    specifiers,
    defaultImport,
    appliedTransform: transform,
  };
}

function determineTransform(
  legacyPath: string,
  specifiers: string[]
): ImportTransform | undefined {
  if (!legacyPath.startsWith("~~/components/scaffold-eth")) {
    return undefined;
  }

  if (legacyPath === "~~/components/scaffold-eth") {
    const usesLegacyComponent = specifiers.some((specifier) =>
      LEGACY_COMPONENT_SPECIFIERS.has(specifier)
    );
    if (!usesLegacyComponent) {
      return undefined;
    }

    return {
      newPath: COMPONENT_TARGET,
      renameSpecifiers: COMPONENT_SPECIFIER_RENAMES,
      description: `components import migrated to ${COMPONENT_TARGET}`,
    };
  }

  // Specific nested paths that previously re-exported legacy components.
  if (
    legacyPath === "~~/components/scaffold-eth/Input" ||
    legacyPath === "~~/components/scaffold-eth/Input/AddressInput" ||
    legacyPath === "~~/components/scaffold-eth/Input/EtherInput" ||
    legacyPath === "~~/components/scaffold-eth/Address/Address" ||
    legacyPath === "~~/components/scaffold-eth/Address"
  ) {
    return {
      newPath: COMPONENT_TARGET,
      renameSpecifiers: COMPONENT_SPECIFIER_RENAMES,
      description: `components import migrated to ${COMPONENT_TARGET}`,
    };
  }

  return undefined;
}

function parseNamedImports(content: string): NamedImportParseResult {
  const entries: NamedImportEntry[] = [];
  const specifiers: string[] = [];

  const matcher = /([^,]+)(,?)/g;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(content)) !== null) {
    const full = match[0];
    const specText = match[1];
    const comma = match[2] ?? "";
    const trimmed = specText.trim();

    if (!trimmed) {
      entries.push({ raw: full });
      continue;
    }

    const leadingWhitespace = specText.slice(0, specText.indexOf(trimmed));
    const trailingWhitespace = specText.slice(
      specText.indexOf(trimmed) + trimmed.length
    );

    let isType = false;
    let rest = trimmed;
    if (rest.startsWith("type ")) {
      isType = true;
      rest = rest.slice(5).trim();
    }

    let alias: string | undefined;
    let imported = rest;
    const asMatch = rest.match(/\s+as\s+/);
    if (asMatch && asMatch.index !== undefined) {
      imported = rest.slice(0, asMatch.index).trim();
      alias = rest.slice(asMatch.index + asMatch[0].length).trim();
    }

    specifiers.push(imported);
    entries.push({
      raw: full,
      spec: {
        isType,
        imported,
        alias,
      },
      leadingWhitespace,
      trailingWhitespace,
      comma,
    });
  }

  return { entries, specifiers };
}

function buildNamedImport(
  entries: NamedImportEntry[],
  renameMap: Record<string, SpecifierRenameRule>
) {
  return entries
    .map((entry) => {
      if (!entry.spec) {
        return entry.raw;
      }

      const rule = renameMap[entry.spec.imported];
      const imported = rule ? rule.newName : entry.spec.imported;
      const alias = rule
        ? (entry.spec.alias ??
          (rule.keepAlias ? entry.spec.imported : undefined))
        : entry.spec.alias;

      let specText = entry.spec.isType ? `type ${imported}` : imported;
      if (alias) {
        specText += ` as ${alias}`;
      }

      return `${entry.leadingWhitespace ?? ""}${specText}${entry.trailingWhitespace ?? ""}${entry.comma ?? ""}`;
    })
    .join("");
}

function extractDefaultImport(statement: string) {
  const sanitized = statement.replace(/\s+/g, " ");
  const match = sanitized.match(/import\s+([A-Za-z_$][\w$]*)\s*(?:,|from)/);
  if (!match) return undefined;

  const identifier = match[1];
  if (identifier === "type") {
    return undefined;
  }
  return identifier;
}

function getExtension(fileName: string) {
  if (fileName.endsWith(".args.mjs")) {
    return ".args.mjs";
  }

  return path.extname(fileName);
}

main(process.argv).catch((error) => {
  console.error(chalk.red("✖ Codemod failed"));
  console.error(error);
  process.exitCode = 1;
});
