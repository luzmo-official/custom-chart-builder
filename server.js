const express = require('express');
const path = require('path');
const { exec } = require('node:child_process');
const app = express();
const port = 3000;

const rootDir = path.resolve(__dirname);
const bundleFolder = path.join(rootDir, 'custom-chart-build-output');

app.use(express.json());
app.use(express.static(bundleFolder));

let buildInFlight = null;

app.post('/build', (_req, res) => {
  if (!buildInFlight) {
    console.log('Build requested via /build endpoint...');
    buildInFlight = new Promise((resolve) => {
      exec('npm run build', { cwd: rootDir }, (err, _stdout, stderr) => {
        buildInFlight = null;
        if (err) {
          console.error('Build failed:', stderr || err.message);
          resolve({ ok: false, error: stderr || err.message });
        } else {
          console.log('Build completed successfully');
          resolve({ ok: true, error: null });
        }
      });
    });
  } else {
    console.log('Build already in flight, joining existing run...');
  }

  buildInFlight.then((r) => res.status(r.ok ? 200 : 500).json(r));
});

app.listen(port, () => {
  console.log(`Custom chart bundle server running at http://localhost:${port}`);
});
