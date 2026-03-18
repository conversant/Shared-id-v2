# Code Review: MPUB-21099 — External Sauce Connect

**Branch:** `feature/202603/external_sauce_connect/MPUB-21099`  
**Commit:** `14424f3`  
**Reviewer Date:** 2026-03-17

## Summary

This PR migrates the SauceLabs test infrastructure from the karma-sauce-launcher's built-in Sauce Connect (SC4, managed by the Karma plugin) to an externally managed SC5 (`sc` CLI v5) tunnel. A new Karma config, browser matrix, and a Node.js helper script are introduced to support this. The approach is architecturally sound, but there are several bugs and consistency issues that should be addressed before merging.

---

## Issues by File

---

### `build/bin/sc-start.js`

#### Bug — Tunnel name mismatch between `sc-start.js` and `karma.saucelabs.epsilon.js` on Windows

`sc-start.js` (line 11) includes `process.env.USERNAME` as a Windows fallback, but `karma.saucelabs.epsilon.js` (line 9) does not. On a Windows machine, SC starts with one tunnel name and Karma connects using a different tunnel name, so the tests will never connect.

**`sc-start.js` (correct):**
```js
|| `${process.env.USER || process.env.USERNAME || 'local'}-sharedid-dev`;
```

**`karma.saucelabs.epsilon.js` (missing `USERNAME`):**
```js
|| `${process.env.USER || 'local'}-sharedid-dev`;
```

**Fix:** Add `process.env.USERNAME` to the karma config's fallback:
```js
|| `${process.env.USER || process.env.USERNAME || 'local'}-sharedid-dev`;
```

---

#### Bug — Orphaned `npm` process if Sauce Connect crashes mid-test

If SC crashes while tests are still running, `sc.on('close')` fires and calls `process.exit(testExitCode)`. This exits the parent immediately, leaving the `npm run sauce:epsilon` child process running as an orphan. In CI environments this can cause hung builds or port conflicts on subsequent runs.

**Current code (lines 60–62):**
```js
sc.on('close', (code) => {
    process.exit(testExitCode);
});
```

**Fix:** Track the `tests` process at a higher scope and kill it if SC exits unexpectedly:
```js
let testsProcess = null;

sc.on('close', (code) => {
    if (testsProcess && !testsProcess.killed) {
        console.error('Sauce Connect exited unexpectedly, killing test process...');
        testsProcess.kill('SIGTERM');
    }
    process.exit(testExitCode);
});

const runSauceTests = () => {
    // ...
    testsProcess = spawn(npm, ['run', 'sauce:epsilon'], { ... });
    // ...
};
```

---

#### Bug — Signal handlers exit before Sauce Connect finishes cleanup

`SIGINT`/`SIGTERM` handlers call `cleanup()` (which sends SIGTERM to SC) and then immediately call `process.exit()`. SC5 may need time to deregister the tunnel from Sauce Labs. Exiting before SC has closed can leave an orphaned tunnel entry that blocks subsequent runs using the same tunnel name.

**Current code (lines 50–58):**
```js
process.on('SIGINT', () => {
    cleanup();
    process.exit(130);
});

process.on('SIGTERM', () => {
    cleanup();
    process.exit(143);
});
```

**Fix:** Let the `sc.on('close')` handler drive the exit, storing the intended signal exit code:
```js
let signalExitCode = null;

process.on('SIGINT', () => {
    signalExitCode = 130;
    cleanup();
    // do NOT call process.exit() here; sc.on('close') will do it
});

process.on('SIGTERM', () => {
    signalExitCode = 143;
    cleanup();
});

sc.on('close', (code) => {
    if (signalExitCode !== null) {
        process.exit(signalExitCode);
    }
    process.exit(testExitCode);
});
```

---

#### Minor — SC exit code ignored and not logged

When SC closes, the `code` parameter is discarded with no log message. If SC crashes (non-zero exit), the only indication is the inherited stdio output. Adding a log line aids debugging.

**Current (line 60):**
```js
sc.on('close', (code) => {
    process.exit(testExitCode);
});
```

**Suggested:**
```js
sc.on('close', (code) => {
    if (code !== 0 && code !== null) {
        console.error(`Sauce Connect exited with code ${code}`);
    }
    process.exit(testExitCode);
});
```

---

#### Minor — `testExitCode = code || 0` converts `null` to `0`

On line 116, if the `npm` test process is killed by a signal, `code` is `null`. `null || 0` evaluates to `0`, marking tests as passed when they were interrupted.

**Current (line 116):**
```js
testExitCode = code || 0;
```

**Fix:**
```js
testExitCode = code ?? 1;
```

This defaults to `1` (failure) for a null/signal-killed process, which is the safer assumption.

---

#### Minor — `if (sc && !sc.killed)` in `cleanup()` is redundant

`sc` is always defined at that point in the code (it is declared in the outer scope before the branch). The `if (sc &&` check is dead code.

**Suggested:**
```js
const cleanup = () => {
    if (!sc.killed) {
        console.log('\nStopping Sauce Connect...');
        sc.kill('SIGTERM');
    }
};
```

---

#### Minor — Tunnel does not check for the first iteration immediately

The `waitForReady` loop adds `interval` to `waited` *before* sleeping, so the minimum wait is always `interval` (2 seconds) even though SC might already be ready. Checking once before the loop starts would save up to 2 seconds.

**Suggested:**
```js
const waitForReady = async () => {
    const maxWait = 120000;
    const interval = 2000;
    let waited = 0;

    console.log(`Waiting for Sauce Connect to be ready (polling ${READY_URL})...`);

    while (waited <= maxWait) {
        const ready = await checkReady();
        if (ready) {
            console.log('Sauce Connect is ready!\n');
            runSauceTests();
            return;
        }
        await new Promise(r => setTimeout(r, interval));
        waited += interval;
    }

    console.error('Timeout waiting for Sauce Connect to be ready');
    cleanup();
    process.exit(1);
};
```

---

#### Architecture — `build/bin/` is a non-standard location for scripts

Placing a utility script in `build/bin/` is unconventional. The `build/` directory is commonly understood to be a generated artifact directory (webpack output, etc.), not a home for source scripts. `build/` is also not excluded from the `files` array in `package.json`, which means `sc-start.js` would be included in any npm publish.

**Recommendation:** Move to `scripts/sc-start.js` and update `package.json` accordingly:
```json
"sc:start": "node scripts/sc-start.js",
"sc:test":  "node scripts/sc-start.js --run-tests"
```

And add `scripts/` to the `files` exclusion in `package.json` if it should not be published:
```json
"files": [
  "CHANGELOG.md",
  "LICENSE",
  "README.md",
  "src",
  "dist",
  "!dist/stats.json",
  "!scripts"
]
```

---

#### Architecture — Tunnel name logic is duplicated

The tunnel name fallback chain appears in both `sc-start.js` and `karma.saucelabs.epsilon.js`. Any future change (e.g., a new CI environment variable) must be updated in two places. Consider extracting to a shared CommonJS module:

**`scripts/tunnelName.js`:**
```js
module.exports =
    process.env.SAUCE_TUNNEL_NAME
    || process.env.BAMBOO_BUILD_KEY
    || `${process.env.USER || process.env.USERNAME || 'local'}-sharedid-dev`;
```

Then in both files:
```js
const tunnelName = require('./tunnelName');
```

---

### `browsers.epsilon.json`

#### Inconsistency — Mixed Appium field namespacing in `sl_chrome_android_8`

The Android browser entry mixes W3C-namespaced (`appium:`) and legacy (non-namespaced) Appium fields:

```json
"appium:platformVersion": "8.0",
"appium:deviceName": "Google Pixel Emulator",
"appium:automationName": "UiAutomator2",
"appiumVersion": "2.11.0"
```

`appiumVersion` (without the namespace) is a legacy field; `appium:` fields are the W3C-compliant style for Appium v2. Using both in the same entry may cause unexpected behaviour depending on how Sauce Labs resolves them. The iOS entry (`sl_safari_ios_14`) uses only legacy fields.

**Fix:** Standardise to all W3C-namespaced fields for the Android entry and use the same `appiumVersion` strategy as the iOS entry, or align both to the same Appium API style.

---

#### Inconsistency — `platform` vs `platformName` between mobile browser entries

- `sl_safari_ios_14` uses `platformName` (W3C key).
- `sl_chrome_android_8` uses `platform` (legacy key).

Both should use the same field name. For Appium v2, prefer `platformName`.

---

#### Inconsistency — Version string formatting in Edge entries

- `sl_edge_79_windows_10` uses `"version": "79"` (no decimal).
- `sl_edge_80_windows_10` uses `"version": "80.0"` (with decimal).

They should be formatted consistently, e.g. both as `"79.0"` and `"80.0"`.

---

#### Risk — `"version": "latest"` for Chrome is non-deterministic

`sl_chrome_latest_windows_11` uses `"version": "latest"`. While convenient, this means the test suite runs against different browser versions on different days, making it harder to distinguish flaky tests from genuine regressions. Consider pinning to a specific version and updating it periodically.

---

#### Missing context — Intentional removal of IE 11 and old Android not documented

`browsers.json` contains `sl_ie_11_windows_10` and `sl_chrome_android_7` which are absent from `browsers.epsilon.json`. If this is intentional (IE EOL, old Android EOL), document it in a comment or in the PR description. If it's an oversight, add the entries back.

---

### `karma.saucelabs.epsilon.js`

#### Consistency — Missing inline comments present in `karma.saucelabs.js`

The original config documents the reason for each non-default timeout value:

```js
browserDisconnectTimeout: 10000, // default 2000
browserDisconnectTolerance: 1,   // default 0
browserNoActivityTimeout: 4 * 60 * 1000, // default 10000
captureTimeout: 4 * 60 * 1000,  // default 60000
```

The epsilon config drops these comments, making it harder to justify the values in future maintenance.

**Fix:** Carry the comments over from `karma.saucelabs.js`.

---

### `package.json`

#### Missing — No CI/bamboo equivalent script for epsilon

The existing `test-bamboo` combines lint + sauce + coverage. There is no corresponding script for the new epsilon pipeline. If epsilon is intended to replace or supplement the existing CI run, a `test-bamboo:epsilon` (or updated `test-bamboo`) should be added.

**Suggested addition:**
```json
"test-bamboo:epsilon": "npm run lint && npm run sc:test && npm run coverage"
```

---

### General

#### No documentation updates

Neither the `README.md` nor `CHANGELOG.md` are updated. Developers using this repo will not know:
- That a new `sc` binary (SC5 CLI) must be installed and in `PATH`.
- How to obtain Sauce Labs credentials (`SAUCE_USERNAME`, `SAUCE_ACCESS_KEY`).
- When to use `sc:test` vs `sauce` vs `sauce:epsilon`.
- The meaning of `SAUCE_TUNNEL_NAME` and `BAMBOO_BUILD_KEY`.

At minimum, add a section to the README explaining the SC5 workflow.

---

## Summary of Required Fixes

| Priority | File | Issue |
|---|---|---|
| **High** | `karma.saucelabs.epsilon.js` | Tunnel name missing `USERNAME` fallback → mismatch on Windows |
| **High** | `build/bin/sc-start.js` | Orphaned test process if SC crashes mid-run |
| **High** | `build/bin/sc-start.js` | Signal handlers exit before SC fully disconnects |
| **Medium** | `build/bin/sc-start.js` | `code \|\| 0` masks signal-killed test processes as success |
| **Medium** | `build/bin/sc-start.js` | Duplicated tunnel name logic with `karma.saucelabs.epsilon.js` |
| **Medium** | `browsers.epsilon.json` | Mixed Appium field namespacing in Android entry |
| **Medium** | `browsers.epsilon.json` | `platform` vs `platformName` inconsistency across mobile entries |
| **Low** | `build/bin/sc-start.js` | Script location should be `scripts/` not `build/bin/` |
| **Low** | `build/bin/sc-start.js` | SC exit code not logged |
| **Low** | `build/bin/sc-start.js` | Redundant `if (sc &&` guard in `cleanup()` |
| **Low** | `browsers.epsilon.json` | Edge version string inconsistency (`79` vs `80.0`) |
| **Low** | `browsers.epsilon.json` | `"version": "latest"` for Chrome is non-deterministic |
| **Low** | `karma.saucelabs.epsilon.js` | Missing inline comments for timeout values |
| **Low** | `package.json` | No CI script for epsilon pipeline |
| **Low** | `README.md` / `CHANGELOG.md` | No documentation of the new SC5 workflow |
