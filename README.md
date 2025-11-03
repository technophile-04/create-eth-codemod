# create-eth-codemod

Standalone codemod utilities for [`create-eth`](https://github.com/scaffold-eth/create-eth) extensions.

## Available commands

### `migrate-scaffold-ui-imports`

Rewrites legacy `~~/components/scaffold-eth` imports to the new `@scaffold-ui` packages. This is helpful when updating third-party extensions to Scaffold-ETH's scaffold-ui transition.

```bash
yarn build
npx create-eth-codemod migrate-scaffold-ui-imports <path-to-extension> --dry-run # review planned changes
npx create-eth-codemod migrate-scaffold-ui-imports <path-to-extension>
```

The legacy direct entry point (`yarn migrate-scaffold-ui <path>`) still works if you prefer to wire it into your own scripts.

The script currently handles:

- `~~/components/scaffold-eth`, `~~/components/scaffold-eth/Input`, `~~/components/scaffold-eth/Input/AddressInput`, `~~/components/scaffold-eth/Address/Address` → `@scaffold-ui/components`
- Renames `InputBase` specifiers to `BaseInput` and keeps the original alias (`{ BaseInput as InputBase }`) for backwards compatibility.

Use `--dry-run` first to preview changes. After applying the codemod, re-run the relevant type checks in your extension to confirm everything builds.

## Development

```bash
yarn install
yarn build
```

During development you can run `yarn dev` to watch for changes.
