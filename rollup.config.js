import typescript from "@rollup/plugin-typescript";
import autoExternal from "rollup-plugin-auto-external";
import json from "@rollup/plugin-json";

const plugins = [autoExternal(), typescript({ exclude: ["dist/**"] }), json()];
const external = ["fs", "fs/promises", "path"];

export default {
  input: {
    cli: "src/cli.ts",
    "migrate-scaffold-ui-imports": "src/migrate-scaffold-ui-imports.ts",
  },
  output: {
    dir: "dist",
    format: "es",
    sourcemap: true,
  },
  external,
  plugins,
};
