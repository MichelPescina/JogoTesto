#!/usr/bin/env node

/**
 * Test runner for JogoTesto
 * Runs all test files using Node.js built-in test runner
 */

const { spawn } = require('node:child_process');
const { readdir } = require('node:fs/promises');
const { join } = require('node:path');

async function runTests() {
    console.log('🧪 Running JogoTesto Tests');
    console.log('=' .repeat(50));

    try {
        // Find all test files
        const testDir = __dirname;
        const files = await readdir(testDir);
        const testFiles = files.filter(file => file.endsWith('.test.js'));
        
        if (testFiles.length === 0) {
            console.log('❌ No test files found');
            process.exit(1);
        }

        console.log(`Found ${testFiles.length} test files:`);
        testFiles.forEach(file => console.log(`  - ${file}`));
        console.log('');

        let totalPassed = 0;
        let totalFailed = 0;
        let allResults = [];

        // Run each test file
        for (const testFile of testFiles) {
            const testPath = join(testDir, testFile);
            console.log(`Running ${testFile}...`);
            
            const result = await runTestFile(testPath);
            allResults.push({ file: testFile, ...result });
            
            totalPassed += result.passed;
            totalFailed += result.failed;
            
            if (result.failed > 0) {
                console.log(`❌ ${testFile}: ${result.passed} passed, ${result.failed} failed`);
            } else {
                console.log(`✅ ${testFile}: ${result.passed} passed`);
            }
            console.log('');
        }

        // Print summary
        console.log('=' .repeat(50));
        console.log('📊 TEST SUMMARY');
        console.log('=' .repeat(50));
        
        allResults.forEach(({ file, passed, failed }) => {
            const status = failed > 0 ? '❌' : '✅';
            console.log(`${status} ${file}: ${passed} passed, ${failed} failed`);
        });
        
        console.log('');
        console.log(`Total: ${totalPassed} passed, ${totalFailed} failed`);
        
        if (totalFailed > 0) {
            console.log('❌ Some tests failed');
            process.exit(1);
        } else {
            console.log('✅ All tests passed!');
            process.exit(0);
        }

    } catch (error) {
        console.error('Error running tests:', error);
        process.exit(1);
    }
}

function runTestFile(testPath) {
    return new Promise((resolve, reject) => {
        const child = spawn('node', ['--test', testPath], {
            stdio: ['inherit', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('close', (code) => {
            // Parse test results from output
            const results = parseTestOutput(stdout, stderr);
            resolve(results);
        });

        child.on('error', (error) => {
            reject(error);
        });
    });
}

function parseTestOutput(stdout, stderr) {
    // Simple parsing of Node.js test output
    let passed = 0;
    let failed = 0;
    
    // Count passed tests (lines with ✓)
    const passedMatches = stdout.match(/✓/g);
    if (passedMatches) {
        passed = passedMatches.length;
    }
    
    // Count failed tests (lines with ✗)
    const failedMatches = stdout.match(/✗/g);
    if (failedMatches) {
        failed = failedMatches.length;
    }
    
    // Alternative parsing for different output formats
    if (passed === 0 && failed === 0) {
        // Try to parse from summary lines
        const passedMatch = stdout.match(/(\d+) passing/);
        const failedMatch = stdout.match(/(\d+) failing/);
        
        if (passedMatch) passed = parseInt(passedMatch[1]);
        if (failedMatch) failed = parseInt(failedMatch[1]);
    }
    
    return { passed, failed, stdout, stderr };
}

// Run tests if this script is executed directly
if (require.main === module) {
    runTests();
}

module.exports = { runTests };