const express = require('express');
const path = require('path');
const app = express();
const port = 3050;

const bundleFolder = path.join(__dirname, 'custom-chart-build-output');
app.use(express.static(bundleFolder));

app.listen(port, () => {
  console.log(`Custom chart bundle server running at http://localhost:${port}`);
});
