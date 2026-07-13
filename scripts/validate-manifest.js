const fs = require('fs');
const path = require('path');

require('ts-node').register({
  skipProject: true,
  transpileOnly: true,
  compilerOptions: {
    esModuleInterop: true,
    module: 'Node16',
    moduleResolution: 'Node16',
    target: 'ES2022'
  }
});

const { SlotsConfigSchema } = require('../projects/builder/src/app/slot-schema.ts');

const manifestPath = path.join(__dirname, '../projects/custom-chart/src/manifest.json');

function formatValidationPath(segments, manifest) {
  if (segments.length === 0) {
    return 'manifest.slots';
  }

  let formattedPath = 'slots';
  let startIndex = 0;
  const firstSegment = segments[0];

  if (typeof firstSegment === 'number') {
    formattedPath += `[${firstSegment}]`;

    const slot = manifest.slots?.[firstSegment];
    if (slot && typeof slot.name === 'string') {
      formattedPath += ` ("${slot.name}")`;
    }

    startIndex = 1;
  }

  for (let index = startIndex; index < segments.length; index += 1) {
    const segment = segments[index];
    formattedPath += typeof segment === 'number' ? `[${segment}]` : `.${segment}`;
  }

  return formattedPath;
}

function validateManifest() {
  try {
    console.log('Validating manifest.json...');

    if (!fs.existsSync(manifestPath)) {
      throw new Error(`manifest.json not found at ${manifestPath}`);
    }

    const manifestContent = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestContent);

    if (!manifest.slots || !Array.isArray(manifest.slots)) {
      console.error('❌ Manifest validation error: "slots" property must be an array');
      return false;
    }

    const result = SlotsConfigSchema.safeParse(manifest.slots);

    if (!result.success) {
      const formattedErrors = result.error.errors
        .map((err) => `${formatValidationPath(err.path, manifest)}: ${err.message}`)
        .join('\n');

      console.error(`❌ Validation failed:\n${formattedErrors}`);
      return false;
    }

    console.log('✅ Manifest validation successful!');
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Manifest validation error:', errorMessage);
    return false;
  }
}

module.exports = validateManifest;

if (require.main === module) {
  const isValid = validateManifest();
  process.exit(isValid ? 0 : 1);
}
