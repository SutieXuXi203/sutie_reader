const fs = require('fs');
const path = require('path');

function removeComments(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const ext = path.extname(filePath);

    if (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx') {
        // Remove JSX comments: {/* comment */}
        content = content.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

        // Remove block comments: /* comment */ (unless it's an eslint directive)
        content = content.replace(/\/\*(?! eslint-)[\s\S]*?\*\//g, '');

        // Remove line comments: // comment (only if // is at the start of the line or preceded by spaces)
        // This avoids removing http:// or things inside strings
        content = content.replace(/^[ \t]*\/\/.*$/gm, '');

        // Remove line comments at the end of a line (rough heuristic: space + // + comment)
        // Be careful with this, let's only do it if it doesn't look like a URL
        content = content.replace(/[ \t]+\/\/(?![\/\w]).*$/gm, '');

        // Clean up multiple empty lines left behind by comment removal
        content = content.replace(/^\s*[\r\n]/gm, '\n');
        content = content.replace(/\n{3,}/g, '\n\n');
    } else if (ext === '.css') {
        // Remove block comments in CSS
        content = content.replace(/\/\*[\s\S]*?\*\//g, '');
        content = content.replace(/^\s*[\r\n]/gm, '\n');
    }

    fs.writeFileSync(filePath, content, 'utf8');
}

function processDirectory(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            processDirectory(fullPath);
        } else {
            const ext = path.extname(file);
            if (['.ts', '.tsx', '.js', '.jsx', '.css'].includes(ext)) {
                console.log(`Processing: ${fullPath}`);
                removeComments(fullPath);
            }
        }
    }
}

const targetDir = path.join(__dirname, 'src');
if (fs.existsSync(targetDir)) {
    processDirectory(targetDir);
    console.log('✅ Removed comments from all files in src/');
} else {
    console.error('src/ directory not found');
}
