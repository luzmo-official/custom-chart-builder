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
const { OptionsConfigSchema } = require('../projects/builder/src/app/options-schema.ts');
const { TranslationsConfigSchema } = require('../projects/builder/src/app/translations-schema.ts');

const manifestPath = path.join(__dirname, '../projects/custom-chart/src/manifest.json');

function formatValidationPath(segments, manifest, propertyName, identifierName) {
  if (segments.length === 0) {
    return `manifest.${propertyName}`;
  }

  let formattedPath = propertyName;
  let startIndex = 0;
  const firstSegment = segments[0];

  if (typeof firstSegment === 'number') {
    formattedPath += `[${firstSegment}]`;

    const config = manifest[propertyName]?.[firstSegment];
    if (identifierName && config && typeof config[identifierName] === 'string') {
      formattedPath += ` ("${config[identifierName]}")`;
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
        .map((err) => `${formatValidationPath(err.path, manifest, 'slots', 'name')}: ${err.message}`)
        .join('\n');

      console.error(`❌ Validation failed:\n${formattedErrors}`);
      return false;
    }

    if (manifest.options !== undefined) {
      const optionsResult = OptionsConfigSchema.safeParse(manifest.options);

      if (!optionsResult.success) {
        const formattedErrors = optionsResult.error.errors
          .map((err) => `${formatValidationPath(err.path, manifest, 'options', 'key')}: ${err.message}`)
          .join('\n');

        console.error(`❌ Validation failed:\n${formattedErrors}`);
        return false;
      }
    }

    if (manifest.translations !== undefined) {
      const translationsResult = TranslationsConfigSchema.safeParse(manifest.translations);

      if (!translationsResult.success) {
        const formattedErrors = translationsResult.error.errors
          .map((err) => `${formatValidationPath(err.path, manifest, 'translations')}: ${err.message}`)
          .join('\n');

        console.error(`❌ Validation failed:\n${formattedErrors}`);
        return false;
      }
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
