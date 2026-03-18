'use strict';

const { expect } = require('chai');
const path = require('path');

const TUNNEL_NAME_MODULE = path.resolve(__dirname, '../../scripts/tunnelName.js');

describe('Tunnel name resolution logic (inline formula)', () => {
    const originalUser = process.env.USER;
    const originalUsername = process.env.USERNAME;
    const originalSauceTunnelName = process.env.SAUCE_TUNNEL_NAME;
    const originalBambooBuildKey = process.env.BAMBOO_BUILD_KEY;

    afterEach(() => {
        restoreOrDelete('USER', originalUser);
        restoreOrDelete('USERNAME', originalUsername);
        restoreOrDelete('SAUCE_TUNNEL_NAME', originalSauceTunnelName);
        restoreOrDelete('BAMBOO_BUILD_KEY', originalBambooBuildKey);
    });

    function restoreOrDelete(key, original) {
        if (original === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = original;
        }
    }

    function resolveTunnelName() {
        return process.env.SAUCE_TUNNEL_NAME
            || process.env.BAMBOO_BUILD_KEY
            || `${process.env.USER || process.env.USERNAME || 'local'}-sharedid-dev`;
    }

    it('uses SAUCE_TUNNEL_NAME when set', () => {
        delete process.env.BAMBOO_BUILD_KEY;
        delete process.env.USER;
        delete process.env.USERNAME;
        process.env.SAUCE_TUNNEL_NAME = 'my-ci-tunnel';
        expect(resolveTunnelName()).to.equal('my-ci-tunnel');
    });

    it('falls back to BAMBOO_BUILD_KEY when SAUCE_TUNNEL_NAME is absent', () => {
        delete process.env.SAUCE_TUNNEL_NAME;
        delete process.env.USER;
        delete process.env.USERNAME;
        process.env.BAMBOO_BUILD_KEY = 'PROJ-42';
        expect(resolveTunnelName()).to.equal('PROJ-42');
    });

    it('falls back to USER-sharedid-dev on POSIX', () => {
        delete process.env.SAUCE_TUNNEL_NAME;
        delete process.env.BAMBOO_BUILD_KEY;
        delete process.env.USERNAME;
        process.env.USER = 'alice';
        expect(resolveTunnelName()).to.equal('alice-sharedid-dev');
    });

    it('falls back to USERNAME-sharedid-dev on Windows when USER is absent', () => {
        delete process.env.SAUCE_TUNNEL_NAME;
        delete process.env.BAMBOO_BUILD_KEY;
        delete process.env.USER;
        process.env.USERNAME = 'winuser';
        expect(resolveTunnelName()).to.equal('winuser-sharedid-dev');
    });

    it('defaults to local-sharedid-dev when no env vars are set', () => {
        delete process.env.SAUCE_TUNNEL_NAME;
        delete process.env.BAMBOO_BUILD_KEY;
        delete process.env.USER;
        delete process.env.USERNAME;
        expect(resolveTunnelName()).to.equal('local-sharedid-dev');
    });
});

describe('scripts/tunnelName.js module', () => {
    beforeEach(() => {
        delete require.cache[TUNNEL_NAME_MODULE];
    });

    afterEach(() => {
        delete require.cache[TUNNEL_NAME_MODULE];
    });

    function loadTunnelName() {
        return require(TUNNEL_NAME_MODULE);
    }

    it('returns SAUCE_TUNNEL_NAME when set', () => {
        process.env.SAUCE_TUNNEL_NAME = 'ci-tunnel';
        delete process.env.BAMBOO_BUILD_KEY;
        delete process.env.USER;
        delete process.env.USERNAME;
        expect(loadTunnelName()).to.equal('ci-tunnel');
        delete process.env.SAUCE_TUNNEL_NAME;
    });

    it('returns BAMBOO_BUILD_KEY as fallback', () => {
        delete process.env.SAUCE_TUNNEL_NAME;
        process.env.BAMBOO_BUILD_KEY = 'BUILD-99';
        delete process.env.USER;
        delete process.env.USERNAME;
        expect(loadTunnelName()).to.equal('BUILD-99');
        delete process.env.BAMBOO_BUILD_KEY;
    });

    it('returns USER-sharedid-dev on POSIX', () => {
        delete process.env.SAUCE_TUNNEL_NAME;
        delete process.env.BAMBOO_BUILD_KEY;
        process.env.USER = 'bob';
        delete process.env.USERNAME;
        expect(loadTunnelName()).to.equal('bob-sharedid-dev');
        delete process.env.USER;
    });

    it('returns USERNAME-sharedid-dev on Windows when USER is absent', () => {
        delete process.env.SAUCE_TUNNEL_NAME;
        delete process.env.BAMBOO_BUILD_KEY;
        delete process.env.USER;
        process.env.USERNAME = 'winbob';
        expect(loadTunnelName()).to.equal('winbob-sharedid-dev');
        delete process.env.USERNAME;
    });

    it('returns local-sharedid-dev when all env vars are absent', () => {
        delete process.env.SAUCE_TUNNEL_NAME;
        delete process.env.BAMBOO_BUILD_KEY;
        delete process.env.USER;
        delete process.env.USERNAME;
        expect(loadTunnelName()).to.equal('local-sharedid-dev');
    });
});
