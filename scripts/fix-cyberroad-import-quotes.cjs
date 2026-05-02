const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', 'minigames', 'cyberroad', 'core');

function normalizeImports(source) {
  return source
    .replace(/from\s+['"]@\/minigames\/cyberroad\/core\/([^'"]+)["']/g, "from '@/minigames/cyberroad/core/$1'")
    .replace(/import\s+['"]@\/minigames\/cyberroad\/core\/([^'"]+)["']/g, "import '@/minigames/cyberroad/core/$1'");
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    const src = fs.readFileSync(full, 'utf8');
    const out = normalizeImports(src);
    fs.writeFileSync(full, out, 'utf8');
  }
}

walk(root);
console.log('Normalized Cyber Road import quotes.');
