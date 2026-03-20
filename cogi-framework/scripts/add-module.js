#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function splitWords(input) {
  return String(input || '')
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeModuleName(rawName) {
  const words = splitWords(rawName);
  if (words.length === 0) return '';

  return words.join('-').toLowerCase();
}

function toPascalCase(input) {
  const words = splitWords(input);
  return words
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}

function toCamelCase(input) {
  const pascal = toPascalCase(input);
  if (!pascal) return '';
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function ensureDir(dirPath) {
  if (fs.existsSync(dirPath)) return false;
  fs.mkdirSync(dirPath, { recursive: true });
  return true;
}

function writeFileIfNotExists(filePath, content) {
  if (fs.existsSync(filePath)) {
    console.log(`Skipped file (already exists): ${path.relative(projectRoot, filePath)}`);
    return false;
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Created file: ${path.relative(projectRoot, filePath)}`);
  return true;
}

function buildFeaturesTemplate({ moduleName, moduleNameUpper, camelName }) {
  return `const ${camelName}Features = {
  group: {
    name: "${moduleNameUpper}",
    code: "${moduleName}",
    order: 1,
    icon: "cilFolder",
  },
  features: [
    {
      name: "${moduleNameUpper} Home",
      key: "${moduleName}.home",
      order: 1,
      description: "${moduleNameUpper} home page",
      path: "/${moduleName}",
    },
  ],
};

export default ${camelName}Features;
`;
}

function buildPageTemplate({ componentName, moduleNameUpper }) {
  return `export default function ${componentName}() {
  return (
    <div>
      <h2 style={{ marginTop: 0 }}>${moduleNameUpper} Home</h2>
      <p>${moduleNameUpper} module page</p>
    </div>
  );
}
`;
}

function buildRoutesTemplate({ moduleName, routesVarName, componentName }) {
  return `import ${componentName} from "../pages/${componentName}";

const ${routesVarName} = [
  {
    path: "/${moduleName}",
    featureKey: "${moduleName}.home",
    component: ${componentName},
  },
];

export default ${routesVarName};
`;
}

function buildIndexTemplate({ camelName, moduleName }) {
  return `export { default as moduleFeatures } from "./config/${camelName}Features";
export { default as moduleRoutes } from "./routes/${moduleName}Routes";
`;
}

function main() {
  const rawModuleName = process.argv[2];
  const moduleName = normalizeModuleName(rawModuleName);

  if (!moduleName) {
    console.error('Usage: node scripts/add-module.js <moduleName>');
    console.error('Example: node scripts/add-module.js hrm');
    process.exit(1);
  }

  const moduleNamePascal = toPascalCase(moduleName);
  const moduleNameUpper = moduleNamePascal || moduleName.toUpperCase();
  const moduleNameCamel = toCamelCase(moduleName);
  const routesVarName = `${moduleNameCamel}Routes`;
  const homeComponentName = `${moduleNamePascal}Home`;

  const moduleRoot = path.join(projectRoot, 'src', 'modules', moduleName);
  const configDir = path.join(moduleRoot, 'config');
  const pagesDir = path.join(moduleRoot, 'pages');
  const routesDir = path.join(moduleRoot, 'routes');

  [moduleRoot, configDir, pagesDir, routesDir].forEach((dirPath) => {
    const created = ensureDir(dirPath);
    if (created) {
      console.log(`Created directory: ${path.relative(projectRoot, dirPath)}`);
    }
  });

  const files = [
    {
      filePath: path.join(configDir, `${moduleNameCamel}Features.js`),
      content: buildFeaturesTemplate({
        moduleName,
        moduleNameUpper,
        camelName: moduleNameCamel,
      }),
    },
    {
      filePath: path.join(pagesDir, `${homeComponentName}.jsx`),
      content: buildPageTemplate({
        componentName: homeComponentName,
        moduleNameUpper,
      }),
    },
    {
      filePath: path.join(routesDir, `${moduleName}Routes.js`),
      content: buildRoutesTemplate({
        moduleName,
        routesVarName,
        componentName: homeComponentName,
      }),
    },
    {
      filePath: path.join(moduleRoot, 'index.js'),
      content: buildIndexTemplate({
        camelName: moduleNameCamel,
        moduleName,
      }),
    },
  ];

  files.forEach(({ filePath, content }) => writeFileIfNotExists(filePath, content));

  console.log(`Done. Module skeleton is ready at: src/modules/${moduleName}`);
}

main();
