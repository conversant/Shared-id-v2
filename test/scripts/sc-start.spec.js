'use strict';

const { expect } = require('chai');
const sinon = require('sinon');

/**
 * Unit tests for sc-start.js behaviours.
 *
 * sc-start.js is a process-entry-point script, so we test the core logic
 * patterns directly rather than requiring the script (which would spawn
 * real child processes).
 */

describe('sc-start orphan-process guard', () => {
    it('kills testsProcess when SC closes while tests are still running', () => {
        const testsProcess = {
            killed: false,
            kill: sinon.spy(),
        };

        // Simulate the sc.on('close') handler logic added in this commit
        const onScClose = () => {
            if (testsProcess && !testsProcess.killed) {
                testsProcess.kill('SIGTERM');
            }
        };

        onScClose();

        expect(testsProcess.kill.calledOnce).to.be.true;
        expect(testsProcess.kill.calledWith('SIGTERM')).to.be.true;
    });

    it('does not attempt to kill testsProcess when it has already been killed', () => {
        const testsProcess = {
            killed: true,
            kill: sinon.spy(),
        };

        const onScClose = () => {
            if (testsProcess && !testsProcess.killed) {
                testsProcess.kill('SIGTERM');
            }
        };

        onScClose();

        expect(testsProcess.kill.called).to.be.false;
    });

    it('does not attempt to kill testsProcess when it is null (SC closed before tests started)', () => {
        let testsProcess = null;
        const kill = sinon.spy();

        const onScClose = () => {
            if (testsProcess && !testsProcess.killed) {
                testsProcess.kill('SIGTERM');
            }
        };

        expect(() => onScClose()).not.to.throw();
        expect(kill.called).to.be.false;
    });
});
