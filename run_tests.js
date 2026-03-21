const { execSync } = require('child_process');
const fs = require('fs');
try {
    execSync('npx vitest run --no-color', { encoding: 'utf8', stdio: 'pipe' });
    fs.writeFileSync('out.txt', 'Success');
} catch (e) {
    fs.writeFileSync('out.txt', e.stdout + '\n' + e.stderr);
}
