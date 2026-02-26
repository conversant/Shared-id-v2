# SharedId (Shared-id-v2) Product Plan

## Executive Summary

SharedId (formerly Publisher Common ID / PubCID) is an open-source, privacy-centric first-party identity solution hosted under Prebid's GitHub organization. It generates a unique identifier for each user on a publisher's site, stored locally in the user's browser. Unlike cross-domain tracking solutions, SharedId creates site-specific identifiers that remain under the publisher's control—enabling better audience targeting and measurement without compromising user privacy.

---

## What SharedId Does

SharedId is a lightweight JavaScript library that:

1. **Generates a Unique ID** - Creates a standard UUID (v4) for each new visitor
2. **Stores Locally** - Saves the ID in localStorage (preferred) or cookies
3. **Persists Across Sessions** - Maintains the same ID for returning visitors (default: 1 year)
4. **Checks Consent** - Integrates with TCF 2.0 CMPs to respect user privacy choices
5. **Provides Simple API** - Exposes the ID to other scripts via `PublisherCommonId.getId()`

---

## Why SharedId Exists

### The Problem

Publishers face fundamental challenges in the evolving digital advertising ecosystem:

1. **Third-Party Cookie Deprecation** - Browsers are eliminating third-party cookies, breaking traditional user identification
2. **Privacy Regulations** - GDPR, CCPA, and other laws require explicit consent for tracking
3. **ID Fragmentation** - Each ad tech vendor has its own ID, creating inefficiency and latency
4. **Control Loss** - Publishers using third-party ID solutions lose control over their user data
5. **Ecosystem Compatibility** - Need an ID that works within the Prebid ecosystem

### The Solution

SharedId addresses these challenges by:

- **First-Party Only** - IDs are site-specific and never sync across domains
- **Publisher Control** - Publishers own and control the identifier
- **Privacy by Design** - Built-in consent checking via TCF 2.0
- **Open Source** - Apache 2.0 license, hosted under Prebid organization
- **Prebid Integration** - Native compatibility with Prebid.js User ID module
- **Performance** - Single ID reduces multiple vendor lookups

---

## Target Users

### Primary Users

| User Type | Use Case |
|-----------|----------|
| **Prebid Publishers** | Native SharedId integration in Prebid.js |
| **Open Source Contributors** | Improve SharedId for the community |
| **Ad Tech Partners** | Receive consistent first-party IDs |
| **Development Teams** | Integrate SharedId into publisher websites |

### Publisher Segments

| Segment | Characteristics |
|---------|-----------------|
| **Prebid-Heavy Publishers** | Using Prebid.js extensively, want unified ID |
| **Premium Publishers** | High traffic, need stable first-party identity |
| **Privacy-Focused Publishers** | Prioritize user privacy, avoid cross-site tracking |
| **International Publishers** | GDPR compliance critical, TCF 2.0 required |

---

## Key Capabilities

### 1. Prebid Native Integration

**What it does:** Works seamlessly with Prebid.js User ID module

**Why it matters:** Single source of truth for user identity in Prebid auctions

**Integration:**
```javascript
pbjs.setConfig({
  userSync: {
    userIds: [{
      name: 'sharedId',
      storage: { type: 'html5', name: '_pubcid', expires: 365 }
    }]
  }
});
```

### 2. Simple Standalone Usage

**What it does:** Single script tag with zero required configuration

**Why it matters:** Publishers can implement in minutes

**Implementation:**
```html
<script src="pubcid.min.js"></script>
<script>
  var id = PublisherCommonId.getId();
</script>
```

### 3. Dual Storage Support

**What it does:** Stores IDs in localStorage or cookies

**Why it matters:** Flexibility for different browser environments

**Storage options:**
- `html5` (localStorage) - Preferred, no HTTP overhead
- `cookie` - Fallback, enables server-side reading
- Automatic fallback when primary isn't available

### 4. Privacy Compliance

**What it does:** Integrates with TCF 2.0 CMPs for consent checking

**Why it matters:** Publishers stay compliant without extra work

**Privacy features:**
- Checks TCF purpose 1 (storage) consent
- Supports opt-out cookie
- Auto-deletes ID when consent withdrawn
- Works in SafeFrame and cross-frame scenarios

### 5. Server-Side Cookie Extension

**What it does:** Optional server pixel for cookie extension

**Why it matters:** Server-set cookies have longer lifetimes (ITP mitigation)

**Configuration:**
```javascript
window.pubcid_options = {
  type: 'cookie',
  pixelUrl: '/api/extend-pubcid'
};
```

---

## Current State

### Strengths

| Area | Status |
|------|--------|
| Core Functionality | Stable, production-ready |
| Prebid Compatibility | Native integration available |
| Browser Support | Modern browsers + IE11 |
| TCF 2.0 Support | Full integration |
| Open Source | Apache 2.0, Prebid organization |
| Testing | Unit tests with Karma/Sauce Labs |
| Modern Tooling | webpack 5, ESLint 9 |

### Limitations

| Area | Current State |
|------|---------------|
| CCPA Support | Not implemented (TCF only) |
| GPP Support | Not implemented |
| Analytics | No tracking of ID metrics |
| Documentation | README only |
| Community | Limited contributors |

---

## Product Roadmap

### Phase 1: Privacy Expansion

**Focus:** Support additional privacy frameworks

| Initiative | Description |
|------------|-------------|
| CCPA Support | Add US Privacy string checking |
| GPP Support | Add Global Privacy Platform integration |
| GPC Support | Respect Global Privacy Control signal |
| TCF 2.2 Updates | Keep pace with TCF specification |

### Phase 2: Prebid Enhancement

**Focus:** Deeper Prebid ecosystem integration

| Initiative | Description |
|------------|-------------|
| Module Sync | Ensure SharedId module stays in sync |
| Documentation | Prebid.org integration guides |
| Examples | Reference implementations |
| Testing | Cross-module compatibility tests |

### Phase 3: Developer Experience

**Focus:** Make adoption easier

| Initiative | Description |
|------------|-------------|
| TypeScript Types | Add .d.ts definitions |
| NPM Publishing | Public npm registry |
| CDN Hosting | Provide hosted script option |
| Debugging Tools | Enhanced logging mode |

### Phase 4: Analytics & Visibility

**Focus:** Help publishers understand performance

| Initiative | Description |
|------------|-------------|
| Event Callbacks | onIdCreated, onIdRead hooks |
| Metrics API | Success/failure rates |
| Diagnostics | Health check utility |

---

## Success Metrics

### Adoption Metrics

| Metric | Description |
|--------|-------------|
| GitHub Stars | Community interest |
| npm Downloads | Package usage |
| Prebid Module Usage | Adoption via Prebid.js |
| Contributors | Active community members |

### Technical Metrics

| Metric | Description |
|--------|-------------|
| Bundle Size | Keep minimal |
| Initialization Time | Time to ready |
| Consent Check Latency | CMP response time |
| Test Coverage | Maintain 80%+ |

### Community Metrics

| Metric | Description |
|--------|-------------|
| Issues Resolved | Time to resolution |
| PR Merge Time | Community contribution velocity |
| Documentation Views | User engagement |

---

## Competitive Positioning

### Market Landscape

| Solution | Approach |
|----------|----------|
| **Unified ID 2.0** | Email-based, cross-site |
| **LiveRamp ATS** | Authenticated traffic solution |
| **ID5** | Probabilistic + deterministic |
| **SharedId** | First-party, site-specific |

### SharedId Advantages

1. **True First-Party** - No cross-domain syncing, ever
2. **Open Source** - Apache 2.0, community-driven
3. **Prebid Native** - Part of Prebid ecosystem
4. **Privacy by Design** - Site-specific IDs protect users
5. **Simplicity** - Works out of the box
6. **No Vendor Lock-in** - Publisher owns the data

### Areas for Improvement

1. **Cross-Device** - No cross-device identity (by design)
2. **Scale** - Each publisher operates independently
3. **Attribution** - Limited cross-site measurement
4. **Community** - Smaller than UID2 community

---

## Integration Architecture

### Standalone Usage

```html
<script src="pubcid.min.js"></script>
<script>
  var sharedId = PublisherCommonId.getId();
  // Use in ad calls, analytics, etc.
</script>
```

### With Prebid.js

```javascript
pbjs.setConfig({
  userSync: {
    userIds: [{
      name: 'sharedId',
      storage: {
        type: 'html5',
        name: '_pubcid',
        expires: 365
      }
    }]
  }
});

// SharedId available in bid requests
pbjs.requestBids({
  bidsBackHandler: function(bids) {
    // Bids include SharedId for bidders that support it
  }
});
```

### With Google Ad Manager

```javascript
googletag.cmd.push(function() {
  var sharedId = PublisherCommonId.getId();
  googletag.pubads().setTargeting('sharedid', sharedId);
});
```

---

## Community & Governance

### Repository

- **GitHub:** https://github.com/prebid/Shared-id-v2
- **License:** Apache 2.0
- **Organization:** Prebid.org

### Contributing

1. Fork the repository
2. Create feature branch
3. Submit pull request
4. Review process by maintainers

### Support Channels

- GitHub Issues
- Prebid.org Slack
- Stack Overflow (prebid.js tag)

---

## Risk Factors

### Technical Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Browser storage limits | Medium | Fallback between storage types |
| ITP/cookie restrictions | Medium | localStorage preference |
| CMP failures | Medium | Graceful degradation |

### Community Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Low contributor engagement | Medium | Better documentation, easier onboarding |
| Version fragmentation | Low | Clear upgrade path |
| Prebid module drift | Medium | Regular sync with Prebid.js module |

### Regulatory Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Privacy regulation changes | High | Modular consent framework |
| TCF specification updates | Medium | Active monitoring |
| New privacy frameworks | Medium | Extensible architecture |

---

## Resource Requirements

### Maintainers

| Role | Focus |
|------|-------|
| Core Maintainers | PR review, releases |
| Community Managers | Issue triage, support |

### Contributors

| Role | Focus |
|------|-------|
| JavaScript Developers | Feature development |
| Privacy Engineers | Consent framework updates |
| Documentation Writers | Guides, examples |

---

## Appendix: Configuration Examples

### Default (Auto-Initialize)

```html
<script src="pubcid.min.js"></script>
```

### Cookie-Only Storage

```html
<script>
  window.pubcid_options = {
    type: 'cookie',
    expInterval: 43200 // 30 days
  };
</script>
<script src="pubcid.min.js"></script>
```

### With Server Extension

```html
<script>
  window.pubcid_options = {
    type: 'cookie',
    pixelUrl: '/api/extend-pubcid'
  };
</script>
<script src="pubcid.min.js"></script>
```

### Disable Auto-Create

```html
<script>
  window.pubcid_options = {
    create: false,
    extend: false
  };
</script>
<script src="pubcid.min.js"></script>
```

### Async with Queue

```html
<script>
  var PublisherCommonId = PublisherCommonId || {};
  PublisherCommonId.que = PublisherCommonId.que || [];
  
  PublisherCommonId.que.push(function() {
    var id = PublisherCommonId.getId();
    sendToAnalytics(id);
  });
</script>
<script src="pubcid.min.js" async></script>
```
