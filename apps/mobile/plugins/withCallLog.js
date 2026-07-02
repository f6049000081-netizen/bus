const { withDangerousMod, withMainApplication, withGradleProperties } = require('@expo/config-plugins');
const path = require('path');
const fs   = require('fs');

const JAVA_SRC = path.join(__dirname, 'java');

/**
 * Config plugin that injects the BusCallLog native module (Java) into the
 * generated android/ project at prebuild time, avoiding the expo-module
 * sub-project resolution issue that blocked EAS builds previously.
 */
function withCallLog(config) {
  // Step 1: copy Java files into the generated android package directory
  config = withDangerousMod(config, [
    'android',
    (config) => {
      const packageDir = path.join(
        config.modRequest.projectRoot,
        'android', 'app', 'src', 'main', 'java', 'com', 'bus', 'app'
      );
      fs.mkdirSync(packageDir, { recursive: true });

      for (const file of ['BusCallLogModule.java', 'BusCallLogPackage.java']) {
        fs.copyFileSync(path.join(JAVA_SRC, file), path.join(packageDir, file));
      }
      return config;
    },
  ]);

  // Step 2: register the package in MainApplication (Kotlin or Java)
  config = withMainApplication(config, (config) => {
    let src = config.modResults.contents;

    if (src.includes('BusCallLogPackage')) return config; // already patched

    // Insert after the "manually here" comment that Expo leaves in getPackages()
    const ANCHOR = 'Packages that cannot be autolinked yet can be added manually here, for example:';
    if (src.includes(ANCHOR)) {
      // Kotlin style
      src = src.replace(
        ANCHOR,
        `${ANCHOR}\n          packages.add(BusCallLogPackage())`
      );
    } else {
      // Fallback: insert before `return packages` inside getPackages
      src = src.replace(
        /(\s+)(return packages\s*\n)/,
        '$1packages.add(BusCallLogPackage())\n$1$2'
      );
    }

    config.modResults.contents = src;
    return config;
  });

  // Step 3: pin Kotlin to 1.9.25 so Compose Compiler 1.5.15 is satisfied
  // (EAS can cache older node_modules that generate 1.9.24 by default)
  config = withGradleProperties(config, (config) => {
    const props = config.modResults;
    const KEY = 'android.kotlinVersion';
    const existing = props.find(p => p.type === 'property' && p.key === KEY);
    if (!existing) {
      props.push({ type: 'property', key: KEY, value: '1.9.25' });
    } else {
      existing.value = '1.9.25';
    }
    return config;
  });

  return config;
}

module.exports = withCallLog;
