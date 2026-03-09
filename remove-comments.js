const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function (file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            results.push(file);
        }
    });
    return results;
}

const files = walk(srcDir);

files.forEach(file => {
    if (file.endsWith('.css')) {
        let content = fs.readFileSync(file, 'utf8');
        const newContent = content.replace(/\/\*[\s\S]*?\*\//g, '');
        if (content !== newContent) {
            fs.writeFileSync(file, newContent, 'utf8');
            console.log('Removed comments from:', file);
        }
    } else if (file.match(/\.(ts|tsx|js|jsx)$/)) {
        let content = fs.readFileSync(file, 'utf8');
        // Simple regex to remove lines that start with optional whitespace and //
        // But don't break URLs. We only match // if it's after whitespace or at start of line
        const lines = content.split('\n');
        let changed = false;
        const newLines = lines.filter(line => {
            // If line is ONLY a comment (ignoring leading whitespace)
            if (line.match(/^\s*\/\//)) {
                changed = true;
                return false;
            }
            return true;
        });

        if (changed) {
            fs.writeFileSync(file, newLines.join('\n'), 'utf8');
            console.log('Removed // comments from:', file);
        }
    }
});
