#!/usr/bin/env node
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const args = process.argv.slice(2);
const runTests = args.includes('--run-tests');

const tunnelName = process.env.SAUCE_TUNNEL_NAME
    || process.env.BAMBOO_BUILD_KEY
    || `${process.env.USER || process.env.USERNAME || 'local'}-sharedid-dev`;

const READY_URL = 'http://localhost:8032/readyz';

console.log(`Starting Sauce Connect with tunnel: ${tunnelName}`);
if (runTests) {
    console.log('Will run sauce tests after tunnel is ready...');
}

const scArgs = [
    'run',
    '--tunnel-name', tunnelName,
    '--region', 'us-west',
    '--proxy-localhost', 'allow',
    '--api-address', ':8032'
];

const sc = spawn('sc', scArgs, { stdio: 'inherit' });

sc.on('error', (err) => {
    console.error('Failed to start Sauce Connect:', err.message);
    console.error('Make sure "sc" is installed and in your PATH');
    process.exit(1);
});

if (!runTests) {
    sc.on('close', (code) => {
        process.exit(code || 0);
    });
} else {
    let testExitCode = 1;
    let testsProcess = null;
    let signalExitCode = null;

    const cleanup = () => {
        if (!sc.killed) {
            console.log('\nStopping Sauce Connect...');
            sc.kill('SIGTERM');
        }
    };

    process.on('SIGINT', () => {
        signalExitCode = 130;
        cleanup();
        // sc.on('close') drives the actual exit once SC has deregistered
    });

    process.on('SIGTERM', () => {
        signalExitCode = 143;
        cleanup();
    });

    sc.on('close', (code) => {
        if (code !== 0 && code !== null) {
            console.error(`Sauce Connect exited with code ${code}`);
        }
        if (testsProcess && !testsProcess.killed) {
            console.error('Sauce Connect exited unexpectedly, killing test process...');
            testsProcess.kill('SIGTERM');
        }
        if (signalExitCode !== null) {
            process.exit(signalExitCode);
        }
        process.exit(testExitCode);
    });

    const checkReady = () => {
        return new Promise((resolve) => {
            const req = http.get(READY_URL, (res) => {
                resolve(res.statusCode === 200);
            });
            req.on('error', () => resolve(false));
            req.setTimeout(2000, () => {
                req.destroy();
                resolve(false);
            });
        });
    };

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

    const runSauceTests = () => {
        console.log('Running sauce tests...\n');
        
        const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
        testsProcess = spawn(npm, ['run', 'sauce:epsilon'], { 
            stdio: 'inherit',
            cwd: path.resolve(__dirname, '../..')
        });

        testsProcess.on('error', (err) => {
            console.error('Failed to run tests:', err.message);
            testExitCode = 1;
            cleanup();
        });

        testsProcess.on('close', (code) => {
            testExitCode = code ?? 1;
            console.log(`\nTests completed with exit code: ${testExitCode}`);
            cleanup();
        });
    };

    waitForReady();
}
