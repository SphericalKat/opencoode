import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with ${result.status}`);
  return result.stdout;
}

try {
  const devices = JSON.parse(run('simslim', ['list', '--json']));
  const requested = process.env.SIMULATOR_UDID;
  const phones = devices.filter(device => device.platform === 'iOS' && device.name.startsWith('iPhone'));
  const selected = requested ? devices.find(device => device.udid === requested) : phones.find(device => device.state === 'Booted') ?? phones.sort((a, b) => b.osVersion.localeCompare(a.osVersion, undefined, { numeric: true }))[0];
  if (!selected || selected.platform !== 'iOS') throw new Error('No iOS simulator is available. Install a runtime in Xcode, or set SIMULATOR_UDID to an available iOS device.');
  const profile = fileURLToPath(new URL('./simslim-dev.json', import.meta.url));
  console.log(`Use ${selected.name} (${selected.osVersion}) with SimSlim`);
  if (selected.state !== 'Booted') run('simslim', ['boot', selected.udid], { stdio: 'inherit' });
  run('simslim', ['on', selected.udid, '--no-reboot', '--profile', profile], { stdio: 'inherit' });
  if (!process.argv.includes('--slim-only')) {
    const expo = spawn('pnpm', ['exec', 'expo', 'start', '--ios', '--max-workers', '2'], { stdio: 'inherit' });
    expo.on('error', error => { console.error(error.message); process.exitCode = 1; });
    expo.on('exit', code => { process.exitCode = code ?? 1; });
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
