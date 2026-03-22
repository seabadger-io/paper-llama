const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Determine the correct python executable path
let pythonPath = 'python';
const winVenv = path.join('venv', 'Scripts', 'python.exe');
const unixVenv = path.join('venv', 'bin', 'python');

if (fs.existsSync(winVenv)) {
    pythonPath = winVenv;
} else if (fs.existsSync(unixVenv)) {
    pythonPath = unixVenv;
}

const args = process.argv.slice(2);
console.log(`> Executing with python: ${pythonPath} ${args.join(' ')}`);

const result = spawnSync(pythonPath, args, { stdio: 'inherit' });
if (result.error) {
    console.error(`Failed to execute python: ${result.error.message}`);
    process.exit(1);
}
process.exit(result.status !== null ? result.status : 1);
