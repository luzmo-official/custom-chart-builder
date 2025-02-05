const chokidar = require('chokidar');
const { exec } = require('child_process');
const { join } = require('path');
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });
let currentBuild = null;

chokidar.watch([
  join(__dirname, '../../projects/custom-chart/src/chart.ts'),
  join(__dirname, '../../projects/custom-chart/src/slots.config.ts')
], {
  ignoreInitial: true,
  persistent: true,
  ignored: /(^|[\/\\])\../,
  useFsEvents: false,
  usePolling: true,
  interval: 1000
}).on('change', () => {
  if (currentBuild) {
    currentBuild.kill();
  }

  currentBuild = exec('npm run build', { cwd: join(__dirname) }, (error, stdout) => {
    if (error) {
      console.error('Build failed:', error);
      return;
    }
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send('watcher-rebuild');
      }
    });
  });
});