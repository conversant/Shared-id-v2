# SharedId (Shared-id-v2) Technical Specification

## Overview

**Package:** `pubcid` (SharedId)  
**Version:** 2.0.5  
**Repository:** https://github.com/prebid/Shared-id-v2  
**Language:** JavaScript (ES6+)  
**Runtime:** Browser (DOM environment)  
**Dependencies:** `loglevel`, `loglevel-plugin-prefix`  
**License:** Apache-2.0

SharedId (formerly Publisher Common ID / PubCID) is a client-side JavaScript library that generates and manages a first-party UUID for user identification. Hosted under Prebid's GitHub organization, it provides a privacy-centric identity solution where IDs are site-specific and never sync across domains.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Publisher Page                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │               window.PublisherCommonId                          │ │
│  │                 (Global API Object)                             │ │
│  │                                                                 │ │
│  │  Sync Methods:          Async Methods:                         │ │
│  │  • getId()              • getIdWithConsent(cb)                 │ │
│  │  • createId()           • updateIdWithConsent(cb)              │ │
│  │  • deleteId()                                                   │ │
│  │  • generateId()         Queue:                                 │ │
│  │  • init()               • que.push([method, ...args])          │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                              │                                       │
│                              ▼                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                     PubcidHandler                               │ │
│  │                (Core Logic & Storage)                           │ │
│  │                                                                 │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐ │ │
│  │  │ Storage Utils   │  │ Cookie Utils    │  │ Consent        │ │ │
│  │  │                 │  │                 │  │ Handler        │ │ │
│  │  │ • localStorage  │  │ • setCookie()   │  │                │ │ │
│  │  │ • expiration    │  │ • getCookie()   │  │ • TCF 2.0      │ │ │
│  │  │ • fallback      │  │ • domain calc   │  │ • Proxies      │ │ │
│  │  └─────────────────┘  └─────────────────┘  └────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                              │                                       │
│                              ▼                                       │
│                    ┌─────────────────┐                              │
│                    │  Browser        │                              │
│                    │  localStorage   │                              │
│                    │  or Cookies     │                              │
│                    └─────────────────┘                              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Module Reference

### Entry Point (`src/pubcid.js`)

IIFE that initializes logging and sets up the PublisherCommonId global object.

```javascript
(function(w, d, o) {
    prefix.reg(log);
    prefix.apply(log, {
        template: '[%n] %l -',
        nameFormatter: function(name) { return name || 'Pubcid' }
    });
    setupPubcid(w, d, o);
})(window, document, window.pubcid_options);
```

---

### PubcidModule (`src/lib/pubcidModule.js`)

Factory function that creates the `window.PublisherCommonId` API object.

#### Function Signature

```javascript
function setupPubcid(win, doc, options = {})
```

#### Exposed Methods

| Method | Sync/Async | Description |
|--------|------------|-------------|
| `getId()` | Sync | Return stored SharedId without consent check |
| `init()` | Sync | Create/refresh SharedId if consent exists |
| `createId()` | Sync | Create SharedId (caller handles consent) |
| `deleteId()` | Sync | Delete SharedId from all storage |
| `generateId()` | Sync | Generate new UUID without storing |
| `updateIdWithConsent(cb)` | Async | Create/refresh SharedId with consent check |
| `getIdWithConsent(cb)` | Async | Read SharedId with consent check |

#### Queue Processing

Supports pre-script queueing for async loading:

```javascript
PublisherCommonId.que = PublisherCommonId.que || [];
PublisherCommonId.que.push(['getIdWithConsent', callback]);
```

After script loads, `que.push` is intercepted to process commands immediately.

---

### PubcidHandler (`src/lib/pubcidHandler.js`)

Core class managing SharedId generation, storage, and consent checking.

#### Default Configuration

```javascript
{
    name: '_pubcid',           // Cookie/localStorage key
    optoutName: '_pubcid_optout', // Opt-out flag key
    expInterval: 525600,       // 1 year in minutes
    create: true,              // Auto-create if missing
    cookieDomain: undefined,   // Auto-detect domain
    type: 'html5,cookie',      // Storage priority
    extend: true,              // Extend expiration on access
    pixelUrl: '',              // Server-side extension URL
    consent: {
        type: 'iab',           // Consent framework
        alwaysCallback: true   // Callback even without consent
    }
}
```

#### Key Methods

| Method | Description |
|--------|-------------|
| `hasConsent(callback)` | Check consent via ConsentHandler |
| `fetchPubcid()` | Deprecated - use updatePubcidWithConsent |
| `updatePubcidWithConsent(callback)` | Create/extend if consent, delete if not |
| `readPubcidWithConsent(callback)` | Read only if consent exists |
| `getPixel(id)` | Fire server-side extension pixel |
| `createPubcid()` | Generate and store SharedId |
| `deletePubcid({all})` | Delete from storage |
| `readPubcid({any})` | Read from storage |
| `getDomain(type)` | Get cookie domain |
| `getHostname()` | Get document hostname (testable) |

#### Storage Type Resolution

```
1. Parse type string (e.g., 'html5,cookie')
2. Check each type in order:
   - 'html5' (localStorage) → isStorageSupported()
   - 'cookie' → isCookieSupported()
3. Use first supported type
```

---

### ConsentHandler (`src/lib/consenthandler/consentHandler.js`)

Manages consent checking via TCF 2.0 CMP integration.

#### Configuration

```javascript
{
    timeout: 1000,         // CMP response timeout (ms)
    alwaysCallback: false, // Callback when gdprApplies undefined
    type: 'iab'           // 'iab' or disabled
}
```

#### Key Methods

| Method | Description |
|--------|-------------|
| `checkConsent(callback)` | Get consent data from CMP |
| `consentEnabled()` | Check if IAB consent is configured |
| `hasStorageConsent(callback)` | Check purpose 1 (storage) consent |

#### Consent Flow

```
1. consentEnabled() → type === 'iab'
2. If enabled:
   a. createProxy() → Select proxy type
   b. proxy.fetchConsentData() → Get consent
   c. hasStorageConsent() → Check purpose.consents[1]
3. If disabled:
   a. Return { gdprApplies: false }
```

---

### Proxy System (`src/lib/consenthandler/proxy/`)

Abstracts CMP communication across different execution contexts.

#### Proxy Selection Priority

```
1. LocalProxy     → Direct window.__tcfapi access
2. SafeFrameProxy → Via $sf.ext for SafeFrame ads
3. FrameProxy     → postMessage to __tcfapiLocator frame
```

#### ProxyFactory (`proxyFactory.js`)

```javascript
function createProxy() {
    const driver = new Tcf();
    return _createProxy(driver);
}

function _createProxy(driver) {
    // 1. Check for local __tcfapi
    if (typeof window[driver.cmpApi] === 'function') {
        return new LocalProxy(fCmp, driver);
    }
    // 2. Check for SafeFrame
    else if (window.$sf?.ext?.[driver.safeframeCall]) {
        return new SafeFrameProxy(driver);
    }
    // 3. Fall back to frame messaging
    else {
        const frame = findCmpFrame(driver.locatorFrame);
        if (frame) return new FrameProxy(frame, driver);
    }
}
```

#### BaseProxy (`baseProxy.js`)

Abstract base class for all proxies.

| Method | Description |
|--------|-------------|
| `fetchConsentData(timeout)` | Start async consent fetch |
| `getConsent(callback)` | Get cached consent data |
| `sendCmpRequests(requests, callback, timeout)` | Execute CMP API calls |

#### LocalProxy (`localProxy.js`)

Direct CMP API access when `__tcfapi` is on window.

```javascript
callApi(cmd, args, callback) {
    this.driver.callCmp(this.fCmp, cmd, callback, args);
}
```

#### FrameProxy (`frameProxy.js`)

Cross-frame postMessage communication for CMP in parent frames.

```javascript
callApi(cmd, arg, callback) {
    let callId = Math.random() + "";
    let msg = this.driver.createMsg(cmd, arg, callId);
    this.cmpCallbacks[callId] = callback;
    this.cmpFrame.postMessage(msg, '*');
}
```

#### SafeFrameProxy (`safeFrameProxy.js`)

SafeFrame container communication via `$sf.ext` API.

---

### TCF Driver (`src/lib/consenthandler/drivers/tcf.js`)

TCF 2.0 CMP protocol implementation.

#### Constants

```javascript
TCF_API = '__tcfapi'
TCF_FRAME = '__tcfapiLocator'
TCF_API_VERSION = 2
TCF_GET_DATA = 'getTCData'
TCF_GET_MSG = '__tcfapiCall'
TCF_RETURN_MSG = '__tcfapiReturn'
```

#### Key Methods

| Method | Description |
|--------|-------------|
| `formatData(tcData)` | Normalize TCF response |
| `createMsg(cmd, arg, callId)` | Build postMessage payload |
| `callCmp(fCmp, cmd, callback, args)` | Direct API call |
| `getListenerCmd()` | Returns `[["addEventListener"]]` |
| `fetchDataCallback(result, success)` | Process CMP response |
| `getConsent(callback)` | Return cached or queue callback |

#### Formatted Data Structure

```javascript
{
    version: 2,
    gdprApplies: boolean,
    consentString: string,
    tcData: object,
    hasStorageAccess: boolean  // purpose.consents[1]
}
```

---

### Storage Utils (`src/lib/storageUtils.js`)

Unified storage abstraction for cookies and localStorage.

#### Key Functions

| Function | Description |
|----------|-------------|
| `isStorageSupported(type)` | Check localStorage availability |
| `clearStorage()` | Clear all localStorage |
| `setStorageItem(key, val, expires)` | Set with expiration |
| `getStorageItem(key)` | Get if not expired |
| `removeStorageItem(key)` | Remove item and expiration |
| `readValue(type, name)` | Unified read |
| `writeValue(type, name, value, expInterval, domain)` | Unified write |
| `deleteValue(type, name, domain)` | Unified delete |
| `extractDomain(hostname)` | Find top-level writable domain |

#### Expiration Implementation

localStorage doesn't have native expiration, so it's tracked via separate key:

```javascript
// Storage keys:
// _pubcid: 'abc123-def456'
// _pubcid_exp: 'Sat, 01 Jan 2028 00:00:00 GMT'
```

---

### Cookie Utils (`src/lib/cookieUtils.js`)

Low-level cookie operations.

| Function | Description |
|----------|-------------|
| `setCookie(name, value, expires, domain, path, sameSite)` | Set cookie |
| `getCookie(name)` | Get cookie value |
| `delCookie(name, domain, path, sameSite)` | Delete cookie |
| `clearAllCookies(domain, path)` | Delete all cookies (testing) |
| `isCookieSupported()` | Check cookie availability |

---

### Utils (`src/lib/utils.js`)

General utility functions.

| Function | Description |
|----------|-------------|
| `genRandomValue(radix)` | Crypto-safe random number |
| `uuid4()` | Generate v4 UUID |
| `parseQueryString(qs)` | Parse URL query string |
| `addQueryParam(url, key, val)` | Add/replace query param |
| `firePixel(url)` | Load 1x1 pixel image |
| `copyOptions(dst, src)` | Merge options objects |

#### UUID Generation

Uses `crypto.getRandomValues()` when available:

```javascript
function uuid4() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c=>{
        return (c ^ genRandomValue() >> c / 4).toString(16);
    });
}
```

---

## Data Models

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `expInterval` | number | 525600 | Expiration in minutes (1 year) |
| `type` | string | 'html5,cookie' | Storage priority list |
| `create` | boolean | true | Auto-create if missing |
| `extend` | boolean | true | Extend expiration on read |
| `pixelUrl` | string | '' | Server extension endpoint |
| `name` | string | '_pubcid' | Storage key name |
| `optoutName` | string | '_pubcid_optout' | Opt-out key name |
| `cookieDomain` | string | undefined | Override cookie domain |
| `consent.type` | string | 'iab' | 'iab' or '' (disabled) |
| `consent.timeout` | number | 1000 | CMP timeout in ms |
| `consent.alwaysCallback` | boolean | true | Callback without consent |
| `autoinit` | boolean | true | Auto-call init() on load |

### SharedId Format

```
f9e17bd4-4bda-4c2e-a656-6468ae2a61c2
```

Standard UUID v4 format: 8-4-4-4-12 hexadecimal characters.

---

## Public API

### Global Object

```javascript
window.PublisherCommonId
```

### Synchronous Methods

```javascript
// Get existing SharedId (no consent check)
const id = PublisherCommonId.getId();

// Force create/refresh (caller checks consent)
PublisherCommonId.createId();

// Delete SharedId
PublisherCommonId.deleteId();

// Generate new UUID without storing
const tempId = PublisherCommonId.generateId();

// Initialize (auto-called unless autoinit: false)
PublisherCommonId.init();
```

### Asynchronous Methods

```javascript
// Get SharedId with consent check
PublisherCommonId.getIdWithConsent(function(sharedId) {
    if (sharedId) {
        console.log('Got SharedId:', sharedId);
    } else {
        console.log('No consent or SharedId');
    }
});

// Create/refresh with consent check
PublisherCommonId.updateIdWithConsent(function(sharedId) {
    // sharedId is set if consent, null otherwise
});
```

### Queue API

```javascript
// Before script loads
var PublisherCommonId = PublisherCommonId || {};
PublisherCommonId.que = PublisherCommonId.que || [];

// Queue a method call
PublisherCommonId.que.push(['getIdWithConsent', callback]);

// Queue a function
PublisherCommonId.que.push(function() {
    var id = PublisherCommonId.getId();
});
```

---

## Library Export (`src/index.js`)

For npm package consumers:

```javascript
export {
    PubcidHandler,
    ConsentHandler,
    getCookie, setCookie, delCookie, clearAllCookies, isCookieSupported,
    getStorageItem, setStorageItem, removeStorageItem, clearStorage,
    isStorageSupported, extractDomain, deleteValue, readValue, writeValue
};
```

---

## Build Output

```
dist/
├── pubcid.min.js    # Minified browser bundle
└── index.js         # CommonJS/ESM entry
```

---

## Browser Support

Via Babel and `@babel/runtime-corejs3`:
- Modern browsers (Chrome, Firefox, Safari, Edge)
- IE 11 (with polyfills)

---

## Differences from PubCID v1

| Aspect | v1 (pubcid.js) | v2 (Shared-id-v2) |
|--------|----------------|-------------------|
| Repository | Internal/pycnvr | Prebid organization |
| Version | 1.5.2 | 2.0.5 |
| webpack | 4.x | 5.x |
| ESLint | 5.x (.eslintrc.js) | 9.x (eslint.config.js) |
| karma-sauce-launcher | 2.x | 4.x |
| npm publish | Internal registry | Public (implicit) |
| copyOptions | dst.hasOwnProperty() | Object.prototype.hasOwnProperty.call() |

---

## Glossary

| Term | Definition |
|------|------------|
| **SharedId** | Current name for Publisher Common ID |
| **PubCID** | Former name (still used in code) |
| **UUID v4** | Universally Unique Identifier version 4 (random) |
| **TCF 2.0** | Transparency and Consent Framework version 2 |
| **CMP** | Consent Management Platform |
| **Purpose 1** | TCF purpose for storing information on a device |
| **SafeFrame** | IAB-standard secure iframe for ads |
| **Locator Frame** | Hidden iframe for cross-frame CMP communication |
