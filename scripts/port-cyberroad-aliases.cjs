const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', 'minigames', 'cyberroad', 'core');

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    let src = fs.readFileSync(full, 'utf8');
    src = src.replace(/from\s+["']@\//g, "from '@/minigames/cyberroad/core/");
    src = src.replace(/import\s+["']@\//g, "import '@/minigames/cyberroad/core/");
    fs.writeFileSync(full, src, 'utf8');
  }
}

walk(root);
console.log('Rewrote @/ imports for Cyber Road core.');
