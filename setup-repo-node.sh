## curl -fsSL "https://github.com/synle/workflows/blob/main/setup-repo-node.sh?raw=1" | bash
# Initialize configuration files
echo "* text=auto eol=lf" >.gitattributes

# dependabot
mkdir -p .github
cat <<EOF >.github/dependabot.yml
version: 2
updates:
  - package-ecosystem: npm
    directory: '/'
    schedule:
      interval: monthly
      time: '13:00'
    open-pull-requests-limit: 10
    versioning-strategy: increase
EOF

# oxfmt
node -e """
const file = '.oxfmtrc.json';
const additions = [
  '*.bundle.*',
  '*.min.*',
  '.build',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'package-lock.json',
  'yarn.lock',
].sort();
const fs = require('fs');

let config = {};
if (fs.existsSync(file)) {
  try {
    config = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.log('⚠️  ' + file + ' is not valid JSON, recreating it.');
  }
}

config['\$schema'] = './node_modules/oxfmt/configuration_schema.json';
config.ignorePatterns = [...new Set([...(config.ignorePatterns || []), ...additions])].sort();
config.printWidth = config.printWidth || 140;

fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n');
console.log('✅ ' + file + ' consolidated and cleaned.');
"""

# gitignore
node -e """
const file = '.gitignore';
const additions = [
  '*.LICENSE.txt', 
  '*.rej', 
  '*storybook.log', 
  '.cache', 
  '.claude', 
  '.DS_Store', 
  '.env', 
  '.npmrc', 
  '.nyc_output', 
  '.vs-code', 
  'build', 
  'coverage', 
  'DEBUG', 
  'dist', 
  'Error', 
  'node_modules', 
  'npm-debug.log*', 
  'public/vs', 
  'upload', 
  'yarn-debug.log*', 
  'yarn-error.log*', 
].sort();
const fs = require('fs');
let existing = '';
if (fs.existsSync(file)) {
  existing = fs.readFileSync(file, 'utf8');
}

const lines = [...existing.split(/\r?\n/), ...additions]
  .map(l => l.trim())
  .filter(Boolean);

const unique = [...new Set(lines)];
fs.writeFileSync(file, unique.join('\n') + '\n');
console.log('✅ ' + file + ' consolidated and cleaned.');
"""

# Update package.json scripts using Node (No jq required)
node -e '
const file = "package.json";
const fs = require("fs");
if (fs.existsSync(file)) {
  const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
  pkg.scripts = pkg.scripts || {};
  
  pkg.scripts.format = "oxfmt --write .";
  pkg.scripts["format:check"] = "oxfmt --check .";
  
  // prettier is replaced by oxfmt — drop it from both dependency maps
  delete pkg.dependencies?.prettier;
  delete pkg.devDependencies?.prettier;
  
  const currentOxfmt = pkg?.dependencies?.oxfmt || pkg?.devDependencies?.oxfmt;

  // oxfmt is a build-time tool, so it always belongs in devDependencies
  delete pkg.dependencies?.oxfmt;
  pkg.devDependencies = pkg.devDependencies || {};
  pkg.devDependencies.oxfmt = currentOxfmt || "^0.61.0";
  
  fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");
  console.log("✅ " + file + " format script updated.");
} else {
  console.log("❌ " + file + " not found.");
}
'
