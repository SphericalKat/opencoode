import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFile(resolve(root, path), 'utf8');
const [xterm, fit, css, runtime, xtermLicense, fitLicense] = await Promise.all([
  read('node_modules/@xterm/xterm/lib/xterm.js'),
  read('node_modules/@xterm/addon-fit/lib/addon-fit.js'),
  read('node_modules/@xterm/xterm/css/xterm.css'),
  read('scripts/terminal-runtime.js'),
  read('node_modules/@xterm/xterm/LICENSE'),
  read('node_modules/@xterm/addon-fit/LICENSE'),
]);
const script = value => value.replace(/\/\/# sourceMappingURL=.*$/gm, '').replace(/<\/script/gi, '<\\/script');
const html = `<!doctype html><!-- @xterm/xterm\n${xtermLicense}\n@xterm/addon-fit\n${fitLicense}\n--><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'"><style>${css}
html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent}#terminal{visibility:hidden;width:100%;height:100%;box-sizing:border-box;padding:8px;overflow-x:auto;overflow-y:hidden}.xterm{height:100%}</style></head><body><div id="terminal" role="application" aria-label="Remote terminal"></div><script>${script(xterm)}</script><script>${script(fit)}</script><script>${script(runtime)}</script></body></html>`;
await mkdir(resolve(root, 'src/generated'), { recursive: true });
await writeFile(resolve(root, 'src/generated/terminal-html.ts'), `export const terminalHtml = ${JSON.stringify(html)};\n`);
await writeFile(resolve(root, 'src/generated/terminal-licenses.txt'), `@xterm/xterm\n\n${xtermLicense}\n\n@xterm/addon-fit\n\n${fitLicense}`);
