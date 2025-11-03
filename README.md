# create-eth-codemod

Standalone codemod utilities for [`create-eth`](https://github.com/scaffold-eth/create-eth) extensions.

## Available commands

### `migrate-scaffold-ui-imports`

Rewrites legacy `~~/components/scaffold-eth` imports to the new `@scaffold-ui` packages. This is helpful when updating third-party extensions to Scaffold-ETH's scaffold-ui transition.

```bash
yarn build
yarn migrate-scaffold-ui <path-to-extension> --dry-run # review planned changes
yarn migrate-scaffold-ui <path-to-extension>
```

The script currently handles:

- `~~/components/scaffold-eth`, `~~/components/scaffold-eth/Input`, `~~/components/scaffold-eth/Input/AddressInput`, `~~/components/scaffold-eth/Address/Address` → `@scaffold-ui/components`
- Renames `InputBase` specifiers to `BaseInput` and keeps the original alias (`{ BaseInput as InputBase }`) for backwards compatibility.
- Updates stylesheet references from `~~/components/scaffold-eth/styles.css` to `@scaffold-ui/components/styles.css`.

Use `--dry-run` first to preview changes. After applying the codemod, re-run the relevant type checks in your extension to confirm everything builds.

## Development

```bash
yarn install
yarn build
```

During development you can run `yarn dev` to watch for changes.
