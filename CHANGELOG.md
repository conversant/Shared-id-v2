# Changelog
Notable changes to the project

## [Unreleased] - 2026-03-18
### Changed
- Migrated SauceLabs CI from karma-sauce-launcher's built-in SC4 tunnel to an
  externally managed SC5 (`sc` CLI v5) tunnel (`scripts/sc-start.js`).
- Tunnel name fallback chain (`SAUCE_TUNNEL_NAME` → `BAMBOO_BUILD_KEY` →
  `USER`/`USERNAME` → `local`) is now shared between `sc-start.js` and
  `karma.saucelabs.epsilon.js` via `scripts/tunnelName.js`.
- `scripts/sc-start.js` now kills the test child process if SC exits
  unexpectedly, defers `process.exit` until SC has fully disconnected on
  SIGINT/SIGTERM, and reports SC non-zero exit codes to stderr.
### Added
- `karma.saucelabs.epsilon.js` — Karma config for the SC5 epsilon pipeline.
- `browsers.epsilon.json` — browser matrix for the epsilon pipeline.
- `npm run sc:start` — start SC5 tunnel only.
- `npm run sc:test` — start SC5 tunnel and run the epsilon test suite.
- `npm run sauce:epsilon` — run Karma against an already-running SC5 tunnel.
- `npm run test-bamboo:epsilon` — CI: lint + sc:test + coverage.

## [1.5.1] - 2022-08-09
### Added
- Export additional storage-utility functions
- When consent is not given don't write cookies while trying to find the root

## [1.5.0] - 2022-03-28
### Added
- spdx header to identify version and license in pubcid.min.js
- async callback support for api

## [1.4.1] - 2021-5-24
- Updated consenthandler to keep listening for updates
## [1.4.0] - 2020-12-1
### Changed
- Remove CMP v1 support
- Reader should also check consent and optout
- Add support to determine TLD for cookies

## [1.3.3] - 2020-07-27
### Changed
- Docker repo change for production environment.

## [1.3.2]
### Changed
- Create package with module statement to allow clients to select polyfill

## [1.3.1]
### Changed
- Switch to use @babel/plugin-transform-runtime for smaller bundle size

## [1.3.0]
### Changed
- Webpack config file cleanup

## [1.2.0]
### Added
- TCF V2 support
