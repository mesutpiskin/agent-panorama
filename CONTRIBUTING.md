# Contributing

1. Open an issue describing the behavior and privacy impact.
2. Create a focused branch and add tests with the change.
3. Run `npm ci && npm run check && npm run package`.
4. Submit a pull request using a Conventional Commit-style title.

Provider adapters must use documented interfaces, validate all external input, declare confidence honestly, and never capture transcripts or source code by default.

