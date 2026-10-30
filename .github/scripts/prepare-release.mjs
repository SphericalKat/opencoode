import { readFile, writeFile } from 'node:fs/promises';

const app = JSON.parse(await readFile('app.json', 'utf8'));
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const version = app.expo.version;
const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
if (!match || version !== pkg.version) throw new Error('app.json and package.json must contain the same stable version');
const [, major, minor, patch] = match.map(Number);
if (major > 9999 || minor > 99 || patch > 99) throw new Error('Native versions require major <= 9999 and minor/patch <= 99');
if (process.env.RELEASE_TAG && process.env.RELEASE_TAG !== `v${version}`) throw new Error('The release tag does not match the app version');

app.expo.android.versionCode = major * 10000 + minor * 100 + patch;
app.expo.ios.buildNumber = version;
await writeFile('app.json', `${JSON.stringify(app, null, 2)}\n`);
console.log(`Prepared Opencoode ${version}, Android versionCode ${app.expo.android.versionCode}`);
