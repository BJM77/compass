const fs = require('fs');
const path = require('path');

const srcDir = path.join(process.cwd(), 'src');
const outputFile = path.join(process.cwd(), 'all_code_backup.txt');

let allFiles = [];

function getFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const res = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      getFiles(res);
    } else {
      if (res.endsWith('.ts') || res.endsWith('.tsx') || res.endsWith('.js') || res.endsWith('.jsx') || res.endsWith('.css') || res.endsWith('.json') || res.endsWith('.rules')) {
        allFiles.push(res);
      }
    }
  }
}

// Add root config files
if (fs.existsSync(path.join(process.cwd(), 'firestore.rules'))) allFiles.push(path.join(process.cwd(), 'firestore.rules'));
if (fs.existsSync(path.join(process.cwd(), 'package.json'))) allFiles.push(path.join(process.cwd(), 'package.json'));

getFiles(srcDir);

console.log('Total files found:', allFiles.length);

let combined = '';

function sanitize(content) {
  return content
    .replace(/AIzaSy[A-Za-z0-9_-]{33}/g, 'AIzaSy_REDACTED_API_KEY')
    .replace(/GEMINI_API_KEY=[^\s\n]+/g, 'GEMINI_API_KEY=REDACTED')
    .replace(/NEXT_PUBLIC_FIREBASE_API_KEY=[^\s\n]+/g, 'NEXT_PUBLIC_FIREBASE_API_KEY=REDACTED');
}

for (const filePath of allFiles) {
  const relativePath = path.relative(process.cwd(), filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  combined += `\n=========================================\n`;
  combined += `FILE: ${relativePath}\n`;
  combined += `=========================================\n\n`;
  combined += sanitize(content) + `\n\n`;
}

fs.writeFileSync(outputFile, combined, 'utf8');
console.log('Successfully wrote combined file backup to:', outputFile, 'Size:', Math.round(combined.length / 1024), 'KB');
