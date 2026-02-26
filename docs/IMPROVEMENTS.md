# SharedId (Shared-id-v2) Problems and Suggested Improvements

This document identifies issues in the current SharedId codebase and proposes solutions for each, organized by priority level.

---

## Summary

| Priority | Count | Description |
|----------|-------|-------------|
| HIGH | 5 | Security, data integrity, or functionality issues |
| MEDIUM | 9 | Code quality, reliability, or maintainability issues |
| LOW | 8 | Minor improvements or optimizations |

---

## HIGH Priority Issues

### 1. PostMessage Uses Wildcard Origin

**Problem:** The `FrameProxy.callApi()` method sends postMessage with `'*'` as the target origin, allowing any frame to receive the message.

**Impact:**
- Any frame on the page can intercept CMP communication
- Potential for malicious scripts to intercept or spoof messages
- Security vulnerability in cross-frame messaging

**Location:** `src/lib/consenthandler/proxy/frameProxy.js` line 85

**Current Code:**

```javascript
callApi(cmd, arg, callback) {
    let callId = Math.random() + "";
    let msg = this.driver.createMsg(cmd,arg,callId);
    this.cmpCallbacks[callId] = callback;
    this.cmpFrame.postMessage(msg, '*');
}
```

**Recommendation:**

Validate and use specific origin when determinable:

```javascript
callApi(cmd, arg, callback) {
    let callId = Math.random() + "";
    let msg = this.driver.createMsg(cmd, arg, callId);
    this.cmpCallbacks[callId] = callback;
    
    // Use specific origin if we can determine it
    const targetOrigin = this.getTargetOrigin();
    this.cmpFrame.postMessage(msg, targetOrigin);
}

getTargetOrigin() {
    try {
        // Same-origin frames can use specific origin
        if (this.cmpFrame.location.origin) {
            return this.cmpFrame.location.origin;
        }
    } catch (e) {
        // Cross-origin - can't determine
    }
    return '*'; // TCF spec allows this for cross-origin
}
```

---

### 2. No PostMessage Origin Validation

**Problem:** The `processEvent()` method doesn't validate the origin of incoming postMessage events.

**Impact:**
- Any origin can send fake CMP responses
- Consent status could be spoofed by malicious actors
- Security vulnerability

**Location:** `src/lib/consenthandler/proxy/frameProxy.js` lines 26-48

**Current Code:**

```javascript
processEvent(event) {
    let json = {};
    try {
        json = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    }
    catch(e){
        // ignore
    }

    if (json[this.driver.returnMsgName] && json[this.driver.returnMsgName].callId) {
        // Process without checking event.origin
    }
}
```

**Recommendation:**

Add origin validation:

```javascript
processEvent(event) {
    // Validate origin
    if (!this.isValidOrigin(event.origin)) {
        return;
    }

    let json = {};
    try {
        json = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    } catch(e) {
        return;
    }

    if (json[this.driver.returnMsgName]?.callId) {
        // ... existing logic
    }
}

isValidOrigin(origin) {
    // Accept same origin
    if (origin === window.location.origin) return true;
    
    // Accept parent origins (for embedded scenarios)
    try {
        if (origin === window.top.location.origin) return true;
    } catch (e) {
        // Cross-origin - accept since CMP may be cross-origin
    }
    
    return true; // TCF allows cross-origin CMP
}
```

---

### 3. Typo in Log Method Name

**Problem:** The `Log` class has a typo: `errro` instead of `error`.

**Impact:**
- Calling `log.error()` would fail with undefined method
- Errors may not be logged properly
- Runtime error if error logging is attempted

**Location:** `src/lib/log.js` line 13

**Current Code:**

```javascript
errro(...args) {
    /* eslint-disable-next-line no-console */
    console.error(...args);
}
```

**Recommendation:**

Fix the typo:

```javascript
error(...args) {
    /* eslint-disable-next-line no-console */
    console.error(...args);
}
```

---

### 4. Event Listener Never Removed (Memory Leak)

**Problem:** `FrameProxy` adds a `message` event listener in `setup()` but `stop()` is never called automatically, and has a bug.

**Impact:**
- Memory leak on single-page applications
- Event listener persists after proxy is no longer needed
- Multiple listeners if proxy is recreated

**Location:** `src/lib/consenthandler/proxy/frameProxy.js` lines 52-68

**Current Code:**

```javascript
setup() {
    if (window.addEventListener)
        window.addEventListener('message', this.fProcess, false);
    else
        window.attachEvent('onmessage', this.fProcess);
}

stop() {
    if (window.removeEventListener)
        window.removeEventListener('message', this.fProcess, false);
    else
        window.detachEvent('onmessage', this.fProcess());  // Bug: extra ()
}
```

**Recommendation:**

1. Fix the bug in `stop()` (remove parentheses)
2. Auto-remove listener after consent is resolved

```javascript
stop() {
    if (window.removeEventListener) {
        window.removeEventListener('message', this.fProcess, false);
    } else {
        window.detachEvent('onmessage', this.fProcess);  // Fixed
    }
}

// Call stop() after consent is resolved
cleanup() {
    this.stop();
    this.cmpCallbacks = {};
}
```

---

### 5. SafeFrameProxy Missing callApi Implementation

**Problem:** `SafeFrameProxy` has `callSafeFrame()` but doesn't implement `callApi()` which is required by `BaseProxy.sendCmpRequests()`.

**Impact:**
- SafeFrame environments fail silently
- Incomplete proxy implementation
- Runtime errors in SafeFrame ads

**Location:** `src/lib/consenthandler/proxy/safeFrameProxy.js`

**Current Code:**

```javascript
export class SafeFrameProxy extends BaseProxy{
    constructor(driver){
        super(driver);
    }
    
    callSafeFrame(commandName, arg, callback) {
        // Implementation exists
    }
    // Missing: callApi()
}
```

**Recommendation:**

Add `callApi` that delegates to `callSafeFrame`:

```javascript
export class SafeFrameProxy extends BaseProxy {
    constructor(driver) {
        super(driver);
    }
    
    callApi(cmd, args, callback) {
        this.callSafeFrame(cmd, args, callback);
    }
    
    callSafeFrame(commandName, arg, callback) {
        // ... existing implementation
    }
}
```

---

## MEDIUM Priority Issues

### 6. No CCPA or GPP Support

**Problem:** The ConsentHandler only supports TCF 2.0, with no support for CCPA (US Privacy) or GPP (Global Privacy Platform).

**Impact:**
- Publishers in US may be non-compliant with CCPA
- No support for the unified GPP framework
- Limited compared to other identity solutions

**Location:** `src/lib/consenthandler/consentHandler.js`

**Recommendation:**

Add CCPA and GPP support:

```javascript
constructor(option = {}) {
    this.config = {
        timeout: 1000,
        alwaysCallback: false,
        type: 'iab',
        consentTypes: ['tcf2']  // New: extensible
    };
    Object.assign(this.config, option);
    
    // Initialize proxies for each consent type
    this.proxies = {};
    if (this.config.consentTypes.includes('tcf2')) {
        this.proxies.tcf2 = createProxy(new Tcf());
    }
    if (this.config.consentTypes.includes('ccpa')) {
        this.proxies.ccpa = createProxy(new Ccpa());
    }
}
```

---

### 7. No Global Privacy Control (GPC) Support

**Problem:** The library doesn't check `navigator.globalPrivacyControl`.

**Impact:**
- May not respect user's browser-level privacy signal
- Potential regulatory issues as GPC adoption grows
- Inconsistent with similar libraries

**Location:** `src/lib/pubcidHandler.js`

**Recommendation:**

Add GPC check in `hasConsent()`:

```javascript
hasConsent(callback) {
    const {optoutName} = this.config;
    
    // Check Global Privacy Control first
    if (navigator.globalPrivacyControl) {
        callback(false);
        return;
    }
    
    // Check opt-out cookie
    if (optoutName) {
        const optout = readValue(COOKIE, optoutName) || readValue(LOCAL_STORAGE, optoutName);
        if (optout) {
            callback(false);
            return;
        }
    }
    
    // ... rest of consent checking
}
```

---

### 8. Duplicate Log Implementations

**Problem:** The codebase has two separate logging approaches: a custom `Log` class and `loglevel` library.

**Impact:**
- Inconsistent logging behavior
- Confusion about which to use
- Maintenance burden

**Locations:**
- `src/lib/log.js` - Custom Log class (with typo)
- `src/pubcid.js` - Uses loglevel with prefix

**Recommendation:**

Remove custom Log class and use `loglevel` consistently:

```javascript
// Delete src/lib/log.js

// Update src/lib/storageUtils.js to use loglevel
import log from 'loglevel';

// Replace log.debug() calls with loglevel
```

---

### 9. Variable Shadowing in isStorageSupported

**Problem:** `isStorageSupported()` declares `storage` twice—once outside try block and once inside, causing the outer variable to be unused.

**Impact:**
- The outer `storage` is never used meaningfully
- In catch block, `storage.length` references empty object, not actual storage
- Bug in quota exceeded detection

**Location:** `src/lib/storageUtils.js` lines 12-36

**Current Code:**

```javascript
export function isStorageSupported(type = 'localStorage') {
    let storage = {};  // Declared but shadowed

    try {
        const storage = window[type];  // Shadows outer
        const x = '__' + type + '_test__';
        storage.setItem(x, x);
        storage.removeItem(x);
        return true;
    }
    catch(e) {
        return e instanceof DOMException && (
            // ...
            storage.length !== 0;  // Uses outer (empty) storage!
        );
    }
}
```

**Recommendation:**

Fix variable scoping:

```javascript
export function isStorageSupported(type = 'localStorage') {
    try {
        const storage = window[type];
        const x = '__' + type + '_test__';
        storage.setItem(x, x);
        storage.removeItem(x);
        return true;
    }
    catch(e) {
        // QuotaExceededError means storage exists but is full
        const storage = window[type];
        return e instanceof DOMException && (
            e.code === 22 ||
            e.code === 1014 ||
            e.name === 'QuotaExceededError' ||
            e.name === 'NS_ERROR_DOM_QUOTA_REACHED') &&
            storage && storage.length !== 0;
    }
}
```

---

### 10. Consent Timeout Resolves Silently

**Problem:** When CMP timeout occurs, `fetchDataCallback` is called with `undefined` and `false`, but there's no clear indication to consumers.

**Impact:**
- Ambiguous consent state
- Publishers may not know CMP is failing
- Could default to wrong consent assumption

**Location:** `src/lib/consenthandler/proxy/baseProxy.js` lines 47-52

**Current Code:**

```javascript
setTimeout(()=>{
    if (this.driver.cmpSuccess === undefined){
        log.debug('Timedout waiting for CMP server');
        this.driver.fetchDataCallback(undefined, false);
    }
}, timeout);
```

**Recommendation:**

Make timeout explicit in the response:

```javascript
setTimeout(() => {
    if (this.driver.cmpSuccess === undefined) {
        log.warn('CMP timeout after ' + timeout + 'ms');
        this.driver.fetchDataCallback({
            timeout: true,
            error: 'CMP_TIMEOUT'
        }, false);
    }
}, timeout);
```

---

### 11. Queue Processing Doesn't Handle Errors

**Problem:** `processQueue()` doesn't catch errors from queued functions.

**Impact:**
- One bad queued function breaks all subsequent processing
- Silent failures
- Difficult to debug

**Location:** `src/lib/pubcidModule.js` lines 22-37

**Current Code:**

```javascript
function processQueue(args) {
    if (typeof args !== 'function') {
        const params = [].slice.call(args);
        const method = params.shift();
        if (typeof delegate[method] === 'function') {
            delegate[method].apply(delegate, params);  // No try/catch
        }
    } else {
        args();  // No try/catch
    }
}
```

**Recommendation:**

Add error handling:

```javascript
function processQueue(args) {
    try {
        if (typeof args !== 'function') {
            const params = [].slice.call(args);
            const method = params.shift();
            if (typeof delegate[method] === 'function') {
                log.debug(`Processing command: ${method}`);
                delegate[method].apply(delegate, params);
            } else {
                log.warn(`Skipped unrecognized command: ${method}`);
            }
        } else {
            log.debug('Processing anonymous function');
            args();
        }
    } catch (e) {
        log.error('Error processing queue item:', e);
    }
}
```

---

### 12. extractDomain Writes Multiple Test Cookies

**Problem:** `extractDomain()` writes multiple test cookies in a loop to determine the top-level domain.

**Impact:**
- Firefox logs warnings for failed cookie writes
- Unnecessary cookie operations
- Could confuse cookie monitoring tools

**Location:** `src/lib/storageUtils.js` lines 204-232

**Recommendation:**

Cache the result and add common TLD shortcuts:

```javascript
const domainCache = new Map();

export function extractDomain(hostname) {
    if (domainCache.has(hostname)) {
        return domainCache.get(hostname);
    }
    
    // Quick check for common patterns
    const knownTlds = ['.co.uk', '.co.za', '.com.au', '.org.uk'];
    for (const tld of knownTlds) {
        if (hostname.endsWith(tld)) {
            const parts = hostname.split('.');
            const domain = parts.slice(-3).join('.');
            domainCache.set(hostname, domain);
            return domain;
        }
    }
    
    // Fall back to test cookie approach
    const domain = detectDomainViaCookies(hostname);
    domainCache.set(hostname, domain);
    return domain;
}
```

---

### 13. No TypeScript Support

**Problem:** The codebase is pure JavaScript with no type checking.

**Impact:**
- Runtime type errors possible
- No IDE autocompletion for consumers
- Harder to maintain and refactor

**Location:** Entire codebase

**Recommendation:**

Add TypeScript support with JSDoc or full migration:

```json
// tsconfig.json
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    "noEmit": true,
    "strict": true
  },
  "include": ["src/**/*"]
}
```

Or generate `.d.ts` type definitions for npm consumers.

---

### 14. No Error Callback in ConsentHandler

**Problem:** `checkConsent()` calls callback with empty object `{}` on CMP connection failure.

**Impact:**
- Can't distinguish "no CMP" from "CMP error"
- No error details available
- Difficult to debug

**Location:** `src/lib/consenthandler/consentHandler.js` lines 31-35

**Recommendation:**

Add explicit error state:

```javascript
if (this.proxy) {
    this.proxy.getConsent(callback);
} else {
    callback({
        error: 'NO_CMP_FOUND',
        gdprApplies: undefined
    });
}
```

---

## LOW Priority Issues

### 15. No Bundle Size Tracking

**Problem:** No mechanism to prevent bundle size growth.

**Impact:**
- Bundle could grow unexpectedly
- Performance regression possible
- No visibility into size over time

**Recommendation:**

Add size-limit to CI:

```json
// package.json
{
  "scripts": {
    "size": "size-limit"
  },
  "size-limit": [
    {
      "path": "dist/pubcid.min.js",
      "limit": "10 KB"
    }
  ]
}
```

---

### 16. Test Files Not Following Consistent Pattern

**Problem:** Test files use different assertion styles and setup patterns.

**Impact:**
- Harder to write new tests
- Inconsistent coverage
- Maintenance burden

**Recommendation:**

Create test helpers and standardize:

```javascript
// test/helpers.js
export function createMockCmp(responses) {
    return function(cmd, version, callback) {
        const response = responses[cmd] || {};
        setTimeout(() => callback(response, true), 0);
    };
}
```

---

### 17. README Uses Old Name Throughout

**Problem:** README still heavily uses "PubCID" terminology despite rebrand to "SharedId".

**Impact:**
- Confusing for new users
- Inconsistent messaging
- SEO issues

**Recommendation:**

Update README to prioritize "SharedId" while mentioning "PubCID" as former name:

```markdown
# SharedId (Shared-id-v2)
SharedId (formerly Publisher Common ID / PubCID) is a privacy-centric...
```

---

### 18. No Contributing Guidelines

**Problem:** Repository lacks CONTRIBUTING.md file.

**Impact:**
- Harder for new contributors to get started
- Inconsistent PR quality
- Slower community growth

**Recommendation:**

Add CONTRIBUTING.md:

```markdown
# Contributing to SharedId

## Getting Started
1. Fork the repository
2. npm install
3. npm test

## Pull Request Process
1. Create feature branch
2. Add tests
3. Update documentation
4. Submit PR

## Code Style
- ESLint rules enforced
- Prefer const over let
- JSDoc comments for public APIs
```

---

### 19. No Source Maps in Production Build

**Problem:** Production build doesn't generate source maps.

**Impact:**
- Can't debug production issues
- Stack traces are unreadable
- Harder to diagnose publisher issues

**Recommendation:**

Add source maps to webpack config:

```javascript
// webpack.config.js
module.exports = {
    mode: 'production',
    devtool: 'source-map',
    // ...
};
```

---

### 20. No CHANGELOG Entries for v2

**Problem:** CHANGELOG.md may not document v2 changes clearly.

**Impact:**
- Publishers don't know what changed
- Can't assess upgrade risk
- No historical record

**Recommendation:**

Update CHANGELOG with v2 migration notes:

```markdown
## [2.0.0] - YYYY-MM-DD
### Changed
- Moved to Prebid organization
- Updated to webpack 5
- Updated to ESLint 9

### Migration from v1
- No breaking API changes
- Update import paths if using npm
```

---

### 21. Old devDependencies Versions

**Problem:** Some devDependencies could use security updates.

**Impact:**
- Potential security vulnerabilities
- Missing bug fixes
- Compatibility issues

**Recommendation:**

Regular dependency audits:

```bash
npm audit
npm update
```

---

### 22. No GitHub Actions CI

**Problem:** Relies on Bamboo CI instead of GitHub Actions.

**Impact:**
- External contributors can't see CI status
- No automated checks on PRs
- Slower feedback loop

**Recommendation:**

Add GitHub Actions workflow:

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm test
```

---

## Implementation Priority

### Immediate (Sprint 1)

1. Fix typo in log.js `errro` → `error` (#3)
2. Fix `detachEvent` bug in frameProxy.js (#4)
3. Fix variable shadowing in isStorageSupported (#9)
4. Add `callApi` to SafeFrameProxy (#5)

### Short-term (Sprint 2)

5. Add postMessage origin validation (#2)
6. Add GPC support (#7)
7. Remove event listener after consent (#4)
8. Add error handling to queue processing (#11)

### Medium-term (Sprint 3-4)

9. Add CCPA support (#6)
10. Consolidate logging (#8)
11. Add explicit error states in ConsentHandler (#14)
12. Cache extractDomain results (#12)

### Long-term (Backlog)

13. Add TypeScript support (#13)
14. Add GPP support (#6)
15. Update README branding (#17)
16. Add GitHub Actions CI (#22)
17. Add CONTRIBUTING.md (#18)

---

## Testing Recommendations

### Unit Test Gaps

| Module | Missing Coverage |
|--------|------------------|
| `SafeFrameProxy` | No tests for callSafeFrame |
| `FrameProxy` | No tests for stop(), origin validation |
| `extractDomain` | Edge cases (IP addresses, localhost) |
| `ConsentHandler` | Timeout scenarios |

### Integration Test Needs

| Scenario | Description |
|----------|-------------|
| TCF 2.0 full flow | End-to-end with mock CMP |
| SafeFrame environment | Test in simulated SafeFrame |
| No CMP present | Graceful degradation |
| CMP timeout | Verify timeout handling |
| Multiple storage types | Cookie + localStorage fallback |

### Browser Compatibility

| Browser | Priority | Test Focus |
|---------|----------|------------|
| Chrome | High | Standard flow |
| Safari | High | ITP, cookie restrictions |
| Firefox | Medium | GPC, privacy features |
| Edge | Medium | Chromium compatibility |
| IE11 | Low | Polyfill functionality |
