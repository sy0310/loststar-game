"""Build and verify a private-key-signed, self-contained Android release."""
import argparse
import hashlib
import json
import os
import secrets
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
PROJECT = HERE / 'android'


def run(argv, **kwargs):
    return subprocess.run([str(value) for value in argv], check=True, **kwargs)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--sdk', type=Path, default=Path(os.environ.get('ANDROID_HOME', str(Path.home() / 'Library/Android/sdk'))))
    parser.add_argument('--gradle', type=Path, default=Path.home() / '.cache/loststar-android/gradle-8.9/bin/gradle')
    parser.add_argument('--java-home', type=Path, default=Path(os.environ.get('JAVA_HOME', '/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home')))
    parser.add_argument('--freeze', action='store_true')
    parser.add_argument('--device-tests', action='store_true', help='Also assemble instrumentation for the signed release')
    args = parser.parse_args()
    release = ROOT / 'releases/survivor-global'
    command = [sys.executable, HERE / 'build.py']
    if args.freeze:
        command.append('--freeze')
    run(command)
    assets = PROJECT / 'app/src/main/assets'
    if assets.exists():
        shutil.rmtree(assets)
    shutil.copytree(release / 'web', assets)
    icon = PROJECT / 'app/src/main/res/drawable-nodpi/game_icon.png'
    icon.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(ROOT / 'design/star-salvage/v068/store-media/exports/taptap-icon-512.png', icon)
    (PROJECT / 'local.properties').write_text('sdk.dir=' + str(args.sdk.resolve()) + '\n')

    signing = Path.home() / '.local/share/lostship/signing'
    signing.mkdir(parents=True, exist_ok=True, mode=0o700)
    settings = signing / 'android-release.json'
    key = signing / 'lostship-release.p12'
    env = dict(os.environ, JAVA_HOME=str(args.java_home), ANDROID_HOME=str(args.sdk))
    if not settings.exists():
        if key.exists():
            raise RuntimeError('A signing key already exists; restore its credentials before building')
        password = secrets.token_urlsafe(48)
        settings.write_text(json.dumps({'password': password}))
        settings.chmod(0o600)
    password = json.loads(settings.read_text())['password']
    env.update(LOSTSHIP_STORE_PASSWORD=password, LOSTSHIP_KEY_PASSWORD=password, LOSTSHIP_KEYSTORE=str(key))
    if not key.exists():
        run([args.java_home / 'bin/keytool', '-genkeypair', '-noprompt', '-storetype', 'PKCS12',
             '-keystore', key, '-alias', 'lostship', '-storepass:env', 'LOSTSHIP_STORE_PASSWORD',
             '-keypass:env', 'LOSTSHIP_KEY_PASSWORD', '-keyalg', 'RSA', '-keysize', '4096',
             '-validity', '10000', '-dname', 'CN=ShuHua, O=Lostship'], env=env)
        key.chmod(0o600)
    tasks = [':app:assembleRelease', ':app:lintRelease']
    if args.device_tests:
        tasks.append(':app:assembleReleaseAndroidTest')
    run([args.gradle, '--no-daemon', '--console=plain', *tasks], cwd=PROJECT, env=env)
    source = PROJECT / 'app/build/outputs/apk/release/app-release.apk'
    build = json.loads((release / 'web-build-info.json').read_text())
    metadata = json.loads((source.parent / 'output-metadata.json').read_text())
    package = next(item for item in metadata['elements'] if item['outputFile'] == source.name)
    if package['versionName'] != build['version']:
        raise RuntimeError('Android and bundled game versions differ')
    artifact = release / ('lostship-star-surge-' + build['sourceCommit'][:7] + '.apk')
    shutil.copy2(source, artifact)
    result = run([args.sdk / 'build-tools/35.0.0/apksigner', 'verify', '--verbose', '--print-certs', artifact],
                 env=env, text=True, stdout=subprocess.PIPE)
    run([args.sdk / 'build-tools/35.0.0/zipalign', '-c', '-P', '16', '4', artifact], env=env)
    report = {
        'version': package['versionName'], 'versionCode': package['versionCode'],
        'packageName': metadata['applicationId'],
        'sourceCommit': build['sourceCommit'], 'dirty': build['dirty'],
        'apk': artifact.name, 'bytes': artifact.stat().st_size,
        'sha256': hashlib.sha256(artifact.read_bytes()).hexdigest(),
        'minSdk': 26, 'targetSdk': 35,
        'languages': ['en', 'zh-CN'], 'defaultLanguage': 'en',
        'signingVerification': result.stdout.splitlines(),
        'signingKey': '~/.local/share/lostship/signing/lostship-release.p12',
        'permissionModel': 'Local assets only; no Android network or user-data permissions',
    }
    (release / 'android-build-info.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({key: value for key, value in report.items() if key != 'signingVerification'}))


if __name__ == '__main__':
    main()
