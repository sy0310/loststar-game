# International Android build

The international client presents the existing survival game in English by default. The start and pause screens offer a persistent Chinese/English switch. `en.tsv` contains explicit translations. The localization layer changes presentation and two Canvas label render calls in the exported copy. The canonical rules, prices, equipment IDs and persistence implementation come from the current game source.

## Build

Run from the repository root with Python 3, Java 17, Gradle 8.9 and the official Android SDK installed. The Android project uses AGP 8.7.3, Android API 35 and build tools 35.0.0.

```bash
python3 prototypes/salvage-survivor-demo/international/build_android.py --freeze --device-tests
```

Commit runtime changes before `--freeze`. Build metadata records the source commit, every packaged runtime file hash, APK size, APK hash and certificate verification. Outputs are under `releases/survivor-global/`.

The app ID is `com.shuhua.lostship.starsurge`, with minimum Android 8 and target Android 15. It packages local assets through AndroidX `WebViewAssetLoader` on an HTTPS app-assets origin. Native Back pauses gameplay, backgrounding requests the existing pause action, and the host handles screen insets. The release disables WebView debugging, cloud backup, file access and external navigation. The manifest requests no network or user-data permissions.

## Signing

The build creates a private app-signing key on first use. Preserve both files for future updates.

- `~/.local/share/lostship/signing/lostship-release.p12`
- `~/.local/share/lostship/signing/android-release.json`

The directory is mode 700 and both files are mode 600. The build passes credentials through environment variables. Credentials and generated build files stay outside Git.

## Browser regression

Serve the exported runtime and run the international suite from the repository root.

```bash
python3 -m http.server 4460 --bind 127.0.0.1 --directory releases/survivor-global/web
```

In another terminal run the tests.

```bash
npx playwright test --config prototypes/salvage-survivor-demo/international/playwright.config.cjs
SURVIVOR_URL=http://127.0.0.1:4460/ SURVIVOR_REPORT=artifacts/survivor-global/storage.json npm --prefix prototypes/salvage-survivor-demo run test:browser -- storage.spec.cjs
```

The locale suite covers English rendering, Chinese restoration, language persistence, native-pause event binding, actual pointer movement, suspended-run reload, upgrade cards, elite evolution/fusion and unchanged save data. The existing storage suite covers migration, isolated legacy namespaces, failures, concurrency and single settlement on the same exported runtime.

## Android regression

`NativeFlowTest` targets the signed release APK. Install the release and its test APK into an isolated emulator, then run the two methods separately. Force-stop the target app between methods to verify process-restart persistence. Preserve the emulator data between runs.

```bash
adb -s emulator-5554 install -r releases/survivor-global/lostship-star-surge-<commit>.apk
adb -s emulator-5554 install -r prototypes/salvage-survivor-demo/international/android/app/build/outputs/apk/androidTest/release/app-release-androidTest.apk
adb -s emulator-5554 shell am instrument -w -r -e class 'com.shuhua.lostship.starsurge.NativeFlowTest#prepareAndPause' com.shuhua.lostship.starsurge.test/androidx.test.runner.AndroidJUnitRunner
adb -s emulator-5554 shell am force-stop com.shuhua.lostship.starsurge
adb -s emulator-5554 shell am instrument -w -r -e class 'com.shuhua.lostship.starsurge.NativeFlowTest#resumeAfterProcessRestart' com.shuhua.lostship.starsurge.test/androidx.test.runner.AndroidJUnitRunner
```

Device screenshots and JSON reports are written into the target app's external files directory under `international-evidence`. A physical-phone check remains a separate acceptance step.

The host runner checks APK hashes, installs the signed release and its instrumentation, checks the JUnit result, and pulls the images for each completed method. Use a dedicated test AVD. Preparation settles any previous test run through the normal UI before beginning the next check.

```bash
python3 prototypes/salvage-survivor-demo/international/run_android_tests.py --serial emulator-5554
```

Each passed stage updates its journal. A fresh full run archives the previous evidence under `releases/survivor-global-private/native-history/`. After an emulator interruption, resume the remaining method against the same APK and retained data.

```bash
python3 prototypes/salvage-survivor-demo/international/run_android_tests.py --serial emulator-5554 --start-stage 2 --renderer swiftshader --methods resumeAfterProcessRestart
```

## Store media

`capture_gallery.cjs` captures legal prepared combat/upgrade states through the ordinary player entry in private browser profiles. It checks the frozen source stamp and English locale. The existing active-gameplay recorder accepts `ACTIVE_VIDEO_EXPECTED_SOURCE`, `SURVIVOR_URL` and `ACTIVE_VIDEO_OUT`. Media provenance distinguishes prepared loadouts, browser capture and actual Android capture.

International media uses `ACTIVE_VIDEO_SECONDS=30`. `export_video.py` verifies every five-second motion window and exports thirty seconds with the actual output audio. The recorder's existing default duration stays at sixty seconds.

The international Android installation owns its private storage. Chinese H5, WeChat and the legacy planet/chapter/route saves stay in their original app/browser namespaces. Cross-app save transfer is outside this release.
