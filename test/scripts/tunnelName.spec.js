'use strict';

const { expect } = require('chai');

describe('Tunnel name resolution logic', () => {
    const originalUser = process.env.USER;
    const originalUsername = process.env.USERNAME;
    const originalSauceTunnelName = process.env.SAUCE_TUNNEL_NAME;
    const originalBambooBuildKey = process.env.BAMBOO_BUILD_KEY;

    afterEach(() => {
        // Restore original env values
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
