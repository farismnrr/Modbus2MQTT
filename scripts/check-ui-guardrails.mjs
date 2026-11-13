import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const FRONTEND_SRC = join(ROOT, 'frontend', 'src');
const MAX_LINES = 260;

const FORBIDDEN_DAISY_CLASSES = [
  'btn-primary',
  'btn-ghost',
  'btn-outline',
  'btn-square',
  'badge-success',
  'badge-warning',
  'badge-error',
  'badge-outline',
  'modal-box',
  'modal-open',
  'modal-backdrop',
  'form-control',
  'label-text',
  'tabs-boxed',
  'input-bordered',
  'select-bordered',
  'loading-spinner',
];

const BARREL_DIRS = [
  join(FRONTEND_SRC, 'components', 'ui'),
  join(FRONTEND_SRC, 'components', 'shared'),
  join(FRONTEND_SRC, 'hooks'),
  join(FRONTEND_SRC, 'lib'),
  join(FRONTEND_SRC, 'pages'),
];

function walkTsFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walkTsFiles(full));
    } else if (full.endsWith('.ts') || full.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

const errors = [];

for (const file of walkTsFiles(FRONTEND_SRC)) {
  const rel = relative(ROOT, file);
  const content = readFileSync(file, 'utf8');
  const lines = content.split('\n');

  if (lines.length > MAX_LINES) {
    errors.push(`${rel}: ${lines.length} lines exceeds max ${MAX_LINES} lines (split into reusable components/hooks).`);
  }

  for (const cls of FORBIDDEN_DAISY_CLASSES) {
    const re = new RegExp(`\\b${cls}\\b`);
    if (re.test(content)) {
      errors.push(`${rel}: contains forbidden legacy DaisyUI class "${cls}". Use shadcn/ui primitives instead.`);
    }
  }
}

for (const dir of BARREL_DIRS) {
  const barrel = join(dir, 'index.ts');
  const rel = relative(ROOT, barrel);
  let content = '';
  try {
    content = readFileSync(barrel, 'utf8');
  } catch {
    errors.push(`${rel}: missing required barrel file.`);
    continue;
  }

  const stripped = content
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .trim();
  const statements = stripped
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  const badStatement = statements.find((s) => !s.startsWith('export '));

  if (badStatement) {
    errors.push(`${rel}: barrel file must be wiring-only (exports only). Found: ${badStatement}`);
  }
}

if (errors.length > 0) {
  console.error('UI Guardrail violations detected:\n');
  for (const err of errors) {
    console.error(` - ${err}`);
  }
  process.exit(1);
}

console.log('UI guardrails passed cleanly.');
