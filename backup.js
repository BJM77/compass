const fs = require('fs');
const path = require('path');

function getFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (!['node_modules', '.next', '.git', 'dist', 'build'].includes(file)) {
        fileList = getFiles(fullPath, fileList);
      }
    } else {
      // Exclude environment files, images, fonts, etc.
      if (!file.startsWith('.env') && 
          !file.endsWith('.png') && 
          !file.endsWith('.jpg') && 
          !file.endsWith('.jpeg') &&
          !file.endsWith('.gif') &&
          !file.endsWith('.ico') &&
          !file.endsWith('.svg') &&
          !file.endsWith('.ttf') &&
          !file.endsWith('.woff') &&
          !file.endsWith('.woff2') &&
          !file.endsWith('.eot')) {
        fileList.push(fullPath);
      }
    }
  }
  return fileList;
}

let files = [];
const rootItems = [
  'src', 
  'public', 
  'package.json', 
  'tailwind.config.ts', 
  'tailwind.config.js',
  'postcss.config.mjs', 
  'postcss.config.js',
  'next.config.mjs', 
  'next.config.js',
  'tsconfig.json', 
  'components.json'
];

rootItems.forEach(p => {
  const fullPath = path.join(__dirname, p);
  if (fs.existsSync(fullPath)) {
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      files = getFiles(fullPath, files);
    } else {
      files.push(fullPath);
    }
  }
});

let out = '';
files.forEach(f => {
  try {
    const relativePath = path.relative(__dirname, f);
    out += `\n\n================================================================================\n`;
    out += `FILE: ${relativePath}\n`;
    out += `================================================================================\n\n`;
    out += fs.readFileSync(f, 'utf8');
  } catch (err) {
    console.error(`Error reading file ${f}: ${err.message}`);
  }
});

const backupPath = path.join(__dirname, 'site_backup.txt');
fs.writeFileSync(backupPath, out);
console.log(`Backup completed successfully. Saved to ${backupPath}`);
