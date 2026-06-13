const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');
const srcDir = path.join(root, 'src');

function log(msg) {
  console.log(`\x1b[36m[build]\x1b[0m ${msg}`);
}

function success(msg) {
  console.log(`\x1b[32m[build]\x1b[0m ${msg}`);
}

function error(msg) {
  console.error(`\x1b[31m[build error]\x1b[0m ${msg}`);
  process.exit(1);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function cleanDist() {
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
    log('已清理 dist/');
  }
  ensureDir(distDir);
}

function runTsc() {
  log('运行 TypeScript 编译...');
  try {
    execSync('npx tsc', { cwd: root, stdio: 'inherit' });
    success('TypeScript 编译完成');
  } catch (e) {
    error('TypeScript 编译失败，请修复上方错误');
  }
}

function walk(dir, ext, list = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, ext, list);
    } else if (full.endsWith(ext)) {
      list.push(full);
    }
  }
  return list;
}

function readDistEntryFile() {
  const entryEsm = path.join(distDir, 'index.js');
  if (!fs.existsSync(entryEsm)) {
    error('未找到 dist/index.js，请检查 tsconfig');
  }
  return fs.readFileSync(entryEsm, 'utf8');
}

function patchEsmImports() {
  log('补全 ESM 模块 import 扩展名...');
  const files = [];
  walk(distDir, '.js', files);

  for (const f of files) {
    let code = fs.readFileSync(f, 'utf8');
    const dir = path.dirname(f);

    code = code.replace(
      /((?:import|export)\s+(?:type\s+)?(?:[^;]*?from\s+)?['"])(\.[^'"]+)(['"])/g,
      (match, prefix, request, suffix) => {
        const fullPath = path.resolve(dir, request);
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
          if (fs.existsSync(path.join(fullPath, 'index.js'))) {
            return prefix + request + '/index.js' + suffix;
          }
        }
        if (!request.endsWith('.js') && !request.endsWith('.json')) {
          if (fs.existsSync(fullPath + '.js')) {
            return prefix + request + '.js' + suffix;
          }
          if (fs.existsSync(path.join(fullPath, 'index.js'))) {
            return prefix + request + '/index.js' + suffix;
          }
        }
        return match;
      }
    );

    fs.writeFileSync(f, code, 'utf8');
  }
  success('ESM import 扩展名补全完成');
}

function buildUMD() {
  log('生成 UMD 打包文件...');

  const files = [];
  walk(distDir, '.js', files);
  files.sort();

  const fileMap = {};
  for (const f of files) {
    const rel = path.relative(distDir, f).replace(/\\/g, '/');
    fileMap[rel] = fs.readFileSync(f, 'utf8');
  }

  const mainPath = 'index.js';
  const mainCode = fileMap[mainPath];
  if (!mainCode) {
    error('找不到 index.js');
    return;
  }

  const simpleBundle = buildSimpleUMD(fileMap);

  const umd = path.join(distDir, 'survey-sdk.umd.js');
  fs.writeFileSync(umd, simpleBundle, 'utf8');
  success(`UMD 打包完成 -> ${path.relative(root, umd)}`);
}

function transformEsmToCjs(code) {
  let result = code;

  // 1. 移除 sourceMappingURL 注释（避免干扰）
  result = result.replace(/^\/\/# sourceMappingURL=.*$/gm, '');

  // 2. 处理 import 语句
  // import { X, Y } from './path'
  result = result.replace(
    /^import\s*\{\s*([^}]+?)\s*\}\s*from\s*['"]([^'"]+)['"]\s*;?\s*$/gm,
    (match, names, path) => {
      const nameList = names.split(',').map((n) => n.trim()).filter(Boolean);
      return `const { ${nameList.join(', ')} } = require('${path}');`;
    }
  );

  // import * as X from './path'
  result = result.replace(
    /^import\s*\*\s*as\s+(\w+)\s*from\s*['"]([^'"]+)['"]\s*;?\s*$/gm,
    'const $1 = require(\'$2\');'
  );

  // import X from './path' (default import)
  result = result.replace(
    /^import\s+(\w+)\s+from\s*['"]([^'"]+)['"]\s*;?\s*$/gm,
    'const $1 = require(\'$2\').default || require(\'$2\');'
  );

  // import './path'
  result = result.replace(
    /^import\s+['"]([^'"]+)['"]\s*;?\s*$/gm,
    'require(\'$1\');'
  );

  // 3. 处理 export 语句
  // export class X {
  result = result.replace(
    /^export\s+class\s+(\w+)/gm,
    'var $1 = exports.$1 = class $1'
  );

  // export function X(
  result = result.replace(
    /^export\s+function\s+(\w+)/gm,
    'exports.$1 = function $1'
  );

  // export const X =
  result = result.replace(
    /^export\s+const\s+(\w+)\s*=/gm,
    'const $1 = exports.$1 ='
  );

  // export let X =
  result = result.replace(
    /^export\s+let\s+(\w+)\s*=/gm,
    'let $1 = exports.$1 ='
  );

  // export var X =
  result = result.replace(
    /^export\s+var\s+(\w+)\s*=/gm,
    'var $1 = exports.$1 ='
  );

  // export default ...
  result = result.replace(
    /^export\s+default\s+/gm,
    'module.exports = '
  );

  // export * from './path'
  result = result.replace(
    /^export\s*\*\s*from\s*['"]([^'"]+)['"]\s*;?\s*$/gm,
    'Object.assign(exports, require(\'$1\'));'
  );

  // export { X, Y } from './path'
  result = result.replace(
    /^export\s*\{\s*([^}]+?)\s*\}\s*from\s*['"]([^'"]+)['"]\s*;?\s*$/gm,
    (match, names, path) => {
      const nameList = names.split(',').map((n) => {
        const trimmed = n.trim();
        if (!trimmed) return null;
        const parts = trimmed.split(/\s+as\s+/);
        const original = parts[0].trim();
        const alias = parts[1] ? parts[1].trim() : original;
        return { original, alias };
      }).filter(Boolean);

      const lines = nameList.map(({ original, alias }) =>
        `exports.${alias} = require('${path}').${original};`
      );
      return lines.join('\n');
    }
  );

  // export { X, Y } (本地导出，不带 from)
  result = result.replace(
    /^export\s*\{\s*([^}]*?)\s*\}\s*;?\s*$/gm,
    (match, names) => {
      const trimmed = names.trim();
      if (!trimmed) return ''; // export {} 空导出，直接移除
      const nameList = trimmed.split(',').map((n) => {
        const t = n.trim();
        if (!t) return null;
        const parts = t.split(/\s+as\s+/);
        const original = parts[0].trim();
        const alias = parts[1] ? parts[1].trim() : original;
        return { original, alias };
      }).filter(Boolean);

      const lines = nameList.map(({ original, alias }) =>
        `exports.${alias} = ${original};`
      );
      return lines.join('\n');
    }
  );

  return result.trim() + '\n';
}

function buildSimpleUMD(fileMap) {
  const sortedTopo = topoSort(fileMap);

  const modulesCode = sortedTopo.map((relPath) => {
    let code = fileMap[relPath];
    code = transformEsmToCjs(code);

    return `
  '${relPath}': (function (module, exports, require) {
${indent(code, '    ')}
  }),`;
  }).join('\n');

  return `(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SurveySDK = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var modules = {${modulesCode}
  };
  var cache = {};
  function require(abs) {
    return __require(null, abs);
  }
  function __require(parent, request) {
    var abs = resolve(parent, request);
    if (cache[abs]) return cache[abs].exports;
    var mod = modules[abs];
    if (!mod) throw new Error('[SurveySDK] Module not found: ' + request);
    var m = cache[abs] = { exports: {} };
    mod.call(null, m, m.exports, function (req) { return __require(abs, req); });
    return m.exports;
  }
  function resolve(parent, request) {
    if (request in modules) return request;
    if (!request.startsWith('.')) return request;
    var base = '';
    if (parent) {
      var lastSlash = parent.lastIndexOf('/');
      base = lastSlash >= 0 ? parent.slice(0, lastSlash + 1) : '';
    }
    var candidate = base + request;
    var parts = [];
    for (var seg of candidate.split('/')) {
      if (seg === '..') parts.pop();
      else if (seg !== '.') parts.push(seg);
    }
    var normalized = parts.join('/');
    if (modules[normalized]) return normalized;
    if (modules[normalized + '.js']) return normalized + '.js';
    if (modules[normalized + '/index.js']) return normalized + '/index.js';
    return normalized;
  }
  function normalize(p) {
    if (p.endsWith('.js')) return p;
    if (modules[p + '.js']) return p + '.js';
    if (modules[p + '/index.js']) return p + '/index.js';
    return p;
  }
  var entry = __require(null, 'index.js');
  return entry.SurveySDK ? entry.SurveySDK : entry;
}));
`;
}

function topoSort(fileMap) {
  const all = Object.keys(fileMap);
  const deps = {};
  for (const rel of all) {
    const dir = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '';
    const imports = (fileMap[rel].match(/import\s+(?:type\s+)?(?:[^;]*?from\s+)?['"]([^'"]+)['"]/g) || [])
      .map((s) => s.match(/['"]([^'"]+)['"]/)[1])
      .filter((r) => r.startsWith('.'))
      .map((r) => resolveRel(dir, r, fileMap));
    deps[rel] = imports;
  }

  const result = [];
  const visiting = {};
  const visited = {};

  function visit(node) {
    if (visited[node]) return;
    if (visiting[node]) return;
    visiting[node] = true;
    for (const dep of (deps[node] || [])) {
      if (fileMap[dep]) visit(dep);
    }
    visiting[node] = false;
    visited[node] = true;
    result.push(node);
  }

  for (const n of all) visit(n);
  return result;
}

function resolveRel(dir, request, fileMap) {
  let base = dir ? dir + '/' : '';
  let p = base + request;
  if (p.startsWith('./')) p = p.slice(2);
  const parts = [];
  for (const seg of p.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.') parts.push(seg);
  }
  let out = parts.join('/');
  if (!out.endsWith('.js')) {
    if (fileMap[out + '.js']) out += '.js';
    else if (fileMap[out + '/index.js']) out += '/index.js';
  }
  return out;
}

function indent(str, prefix) {
  return str.split('\n').map((l) => (l ? prefix + l : l)).join('\n');
}

function buildPackageJson() {
  log('生成 package.json 发布清单...');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const outPkg = {
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
    main: 'survey-sdk.umd.js',
    module: 'index.js',
    types: 'index.d.ts',
    exports: {
      '.': {
        types: './index.d.ts',
        import: './index.js',
        require: './survey-sdk.umd.js',
      },
    },
    files: fs.readdirSync(distDir).filter((n) => {
      const full = path.join(distDir, n);
      const stat = fs.statSync(full);
      return stat.isDirectory() || n.endsWith('.js') || n.endsWith('.d.ts') || n.endsWith('.map');
    }),
    keywords: pkg.keywords,
    author: pkg.author,
    license: pkg.license,
    typesVersions: {
      '>4.0': { '*': ['*'] },
    },
  };
  fs.writeFileSync(path.join(distDir, 'package.json'), JSON.stringify(outPkg, null, 2), 'utf8');
  success('发布 package.json 已生成');
}

function buildReadmeHint() {
  const content = `SurveySDK 构建产物
===================

目录结构：
- index.js / index.d.ts        ESM + 类型声明（推荐用于 TS 项目）
- survey-sdk.umd.js            UMD 浏览器全局包，访问 window.SurveySDK
- core/                        各核心模块（可按需加载）
- renderer/                    渲染器模块
- types/                       类型定义

接入方式：

1) ESM / TS 项目
   import { SurveySDK } from 'survey-sdk';

2) 浏览器 UMD
   <script src="survey-sdk.umd.js"></script>
   const sdk = window.SurveySDK.SurveySDK.create(survey);
`;
  fs.writeFileSync(path.join(distDir, 'README.txt'), content, 'utf8');
}

function main() {
  log('=== SurveySDK 构建开始 ===');
  cleanDist();
  runTsc();
  patchEsmImports();
  buildUMD();
  buildPackageJson();
  buildReadmeHint();
  success('=== 构建成功 ===');

  const size = (p) => {
    const s = fs.statSync(p).size;
    return s < 1024 ? s + ' B' : (s / 1024).toFixed(1) + ' KB';
  };
  console.log(`
  dist/index.js           ${size(path.join(distDir, 'index.js'))}
  dist/survey-sdk.umd.js  ${size(path.join(distDir, 'survey-sdk.umd.js'))}
  dist/index.d.ts         ${size(path.join(distDir, 'index.d.ts'))}
  dist/types/index.d.ts   ${size(path.join(distDir, 'types/index.d.ts'))}
`);
}

main();
