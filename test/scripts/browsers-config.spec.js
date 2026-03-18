'use strict';

const { expect } = require('chai');
const path = require('path');
const browsersEpsilon = require(path.resolve(__dirname, '../../browsers.epsilon.json'));

describe('browsers.epsilon.json Appium field consistency', () => {
    const mobileEntries = Object.entries(browsersEpsilon).filter(
        ([, cfg]) => cfg.platformName === 'iOS' || cfg.platformName === 'Android'
    );

    it('all mobile entries use platformName (W3C key) not the legacy platform key', () => {
        mobileEntries.forEach(([name, cfg]) => {
            expect(cfg, `${name} should not use legacy 'platform' key`).not.to.have.property('platform');
            expect(cfg, `${name} should use 'platformName'`).to.have.property('platformName');
        });
    });

    it('all Edge entries use consistent major.minor version string format', () => {
        const edgeEntries = Object.entries(browsersEpsilon).filter(
            ([, cfg]) => cfg.browserName === 'MicrosoftEdge'
        );
        edgeEntries.forEach(([name, cfg]) => {
            expect(cfg.version, `${name} version should be in major.minor format`).to.match(/^\d+\.\d+$/);
        });
    });

    it('no mobile entry contains appium:-prefixed keys mixed with un-prefixed equivalents', () => {
        mobileEntries.forEach(([name, cfg]) => {
            const keys = Object.keys(cfg);
            const hasNamespaced = keys.some(k => k.startsWith('appium:'));
            const hasUnNamespaced = keys.some(k =>
                ['platformVersion', 'deviceName', 'automationName'].includes(k)
            );
            if (hasNamespaced) {
                expect(hasUnNamespaced, `${name} mixes appium: and un-prefixed Appium keys`).to.be.false;
            }
        });
    });
});
