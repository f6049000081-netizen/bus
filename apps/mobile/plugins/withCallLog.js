const {
  withDangerousMod,
  withMainApplication,
  withGradleProperties,
  withAndroidManifest,
} = require('expo/config-plugins');
const path = require('path');
const fs   = require('fs');

const JAVA_SRC = path.join(__dirname, 'java');

/**
 * Config plugin that injects BusCallLog + BusCallerId native modules and
 * the BusCallScreeningService into the generated android/ project.
 */
function withCallLog(config) {
  // ── Step 1: copy all Java source files ────────────────────────────────────
  config = withDangerousMod(config, [
    'android',
    (config) => {
      const packageDir = path.join(
        config.modRequest.projectRoot,
        'android', 'app', 'src', 'main', 'java', 'com', 'bus', 'app'
      );
      fs.mkdirSync(packageDir, { recursive: true });

      const files = [
        'BusCallLogModule.java',
        'BusCallLogPackage.java',
        'BusHashHelper.java',
        'BusCallScreeningService.java',
        'BusCallerIdModule.java',
        'BusCallerIdPackage.java',
      ];
      for (const file of files) {
        fs.copyFileSync(path.join(JAVA_SRC, file), path.join(packageDir, file));
      }
      return config;
    },
  ]);

  // ── Step 2: register both packages in MainApplication ─────────────────────
  config = withMainApplication(config, (config) => {
    let src = config.modResults.contents;
    const ANCHOR = 'Packages that cannot be autolinked yet can be added manually here, for example:';

    if (!src.includes('BusCallLogPackage')) {
      if (src.includes(ANCHOR)) {
        src = src.replace(ANCHOR, `${ANCHOR}\n          add(BusCallLogPackage())`);
      } else {
        src = src.replace(/(\s+)(return packages\s*\n)/, '$1add(BusCallLogPackage())\n$1$2');
      }
    }

    if (!src.includes('BusCallerIdPackage')) {
      if (src.includes(ANCHOR)) {
        src = src.replace(ANCHOR, `${ANCHOR}\n          add(BusCallerIdPackage())`);
      } else {
        src = src.replace(/(\s+)(return packages\s*\n)/, '$1add(BusCallerIdPackage())\n$1$2');
      }
    }

    config.modResults.contents = src;
    return config;
  });

  // ── Step 3: add permissions + service to AndroidManifest ──────────────────
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    // Permissions needed for call screening
    if (!manifest['uses-permission']) manifest['uses-permission'] = [];
    const addPerm = (name, extra = {}) => {
      if (!manifest['uses-permission'].some(p => p.$['android:name'] === name)) {
        manifest['uses-permission'].push({ $: { 'android:name': name, ...extra } });
      }
    };
    addPerm('android.permission.READ_PHONE_STATE');
    addPerm('android.permission.ANSWER_PHONE_CALLS');
    addPerm('android.permission.POST_NOTIFICATIONS');

    // BusCallScreeningService declaration
    const app = manifest.application[0];
    if (!app.service) app.service = [];
    if (!app.service.some(s => s.$['android:name'] === '.BusCallScreeningService')) {
      app.service.push({
        $: {
          'android:name': '.BusCallScreeningService',
          'android:permission': 'android.permission.BIND_SCREENING_SERVICE',
          'android:exported': 'true',
        },
        'intent-filter': [{
          action: [{ $: { 'android:name': 'android.telecom.CallScreeningService' } }],
        }],
      });
    }

    return config;
  });

  // ── Step 4: remove stale Kotlin version pin ────────────────────────────────
  config = withGradleProperties(config, (config) => {
    const KEY = 'android.kotlinVersion';
    const idx = config.modResults.findIndex(p => p.type === 'property' && p.key === KEY);
    if (idx !== -1) config.modResults.splice(idx, 1);
    return config;
  });

  return config;
}

module.exports = withCallLog;
