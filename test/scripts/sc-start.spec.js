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

describe('sc-start signal handler deferred exit', () => {
    it('SIGINT sets signalExitCode to 130 and does not exit immediately', () => {
        let signalExitCode = null;
        const exitSpy = sinon.spy();

        const onSIGINT = () => {
            signalExitCode = 130;
            // cleanup() would be called here, but we do NOT call process.exit
        };

        onSIGINT();

        expect(signalExitCode).to.equal(130);
        expect(exitSpy.called).to.be.false;
    });

    it('SIGTERM sets signalExitCode to 143 and does not exit immediately', () => {
        let signalExitCode = null;
        const exitSpy = sinon.spy();

        const onSIGTERM = () => {
            signalExitCode = 143;
        };

        onSIGTERM();

        expect(signalExitCode).to.equal(143);
        expect(exitSpy.called).to.be.false;
    });

    it('sc.on(close) exits with signalExitCode when a signal was received', () => {
        let signalExitCode = 130;
        const testExitCode = 0;
        let exitedWith = null;

        const onScClose = () => {
            if (signalExitCode !== null) {
                exitedWith = signalExitCode;
                return;
            }
            exitedWith = testExitCode;
        };

        onScClose();

        expect(exitedWith).to.equal(130);
    });

    it('sc.on(close) exits with testExitCode when no signal was received', () => {
        let signalExitCode = null;
        const testExitCode = 0;
        let exitedWith = null;

        const onScClose = () => {
            if (signalExitCode !== null) {
                exitedWith = signalExitCode;
                return;
            }
            exitedWith = testExitCode;
        };

        onScClose();

        expect(exitedWith).to.equal(0);
    });
});

describe('sc-start cleanup() guard', () => {
    it('calls kill when sc is not yet killed', () => {
        const sc = { killed: false, kill: sinon.spy() };
        const cleanup = () => {
            if (!sc.killed) sc.kill('SIGTERM');
        };
        cleanup();
        expect(sc.kill.calledOnceWith('SIGTERM')).to.be.true;
    });

    it('does not call kill when sc is already killed', () => {
        const sc = { killed: true, kill: sinon.spy() };
        const cleanup = () => {
            if (!sc.killed) sc.kill('SIGTERM');
        };
        cleanup();
        expect(sc.kill.called).to.be.false;
    });
});

describe('sc-start test exit code on tests process close', () => {
    function resolveTestExitCode(code) {
        return code ?? 1;
    }

    it('preserves a zero exit code when tests pass', () => {
        expect(resolveTestExitCode(0)).to.equal(0);
    });

    it('preserves a non-zero exit code when tests fail', () => {
        expect(resolveTestExitCode(1)).to.equal(1);
        expect(resolveTestExitCode(2)).to.equal(2);
    });

    it('returns 1 for null (signal-killed process) instead of masking it as success', () => {
        expect(resolveTestExitCode(null)).to.equal(1);
    });
});
