const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const outPath = path.join(rootDir, 'site_backup.txt');

const skipDirs = ['node_modules', '.git', '.next', 'dist', 'build', '.gemini'];
const allowedExts = ['.js', '.jsx', '.ts', '.tsx', '.css', '.json', '.md'];

function getStructure(dir, prefix = '') {
  let result = '';
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const filtered = entries.filter(e => !skipDirs.includes(e.name) && !e.name.startsWith('.'));
  
  filtered.forEach((e, i) => {
    const isLast = i === filtered.length - 1;
    result += `${prefix}${isLast ? '└── ' : '├── '}${e.name}\n`;
    if (e.isDirectory()) {
      result += getStructure(path.join(dir, e.name), prefix + (isLast ? '    ' : '│   '));
    }
  });
  return result;
}

function getAllFiles(dir, fileList = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  entries.forEach(e => {
    if (skipDirs.includes(e.name) || e.name.startsWith('.')) return;
    const fullPath = path.join(dir, e.name);
    if (e.isDirectory()) {
      getAllFiles(fullPath, fileList);
    } else {
      if (allowedExts.includes(path.extname(e.name)) && e.name !== 'package-lock.json') {
        fileList.push(fullPath);
      }
    }
  });
  return fileList;
}

let output = '=== SITE STRUCTURE ===\n\n';
output += '.\n' + getStructure(rootDir);
output += '\n\n=== SOURCE CODE ===\n\n';

const files = getAllFiles(rootDir);
files.forEach(f => {
  const relPath = path.relative(rootDir, f);
  let content = fs.readFileSync(f, 'utf8');
  
  // Basic masking of API keys
  content = content.replace(/(apiKey|api_key|secret|token)["\']?\s*[:=]\s*["\'][^"\']+["\']/gi, '$1: "MASKED_API_KEY"');
  
  output += `\n\n--- FILE: ${relPath} ---\n\n`;
  output += content;
});

fs.writeFileSync(outPath, output);
console.log('Backup generated at: ' + outPath);
