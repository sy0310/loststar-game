"""Install the frozen release, exercise native input, and bind evidence to its source."""
import argparse
import hashlib
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
PACKAGE = 'com.shuhua.lostship.starsurge'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--serial', required=True)
    parser.add_argument('--start-stage', type=int, default=1)
    parser.add_argument('--renderer', choices=['auto', 'swiftshader'], default='auto')
    parser.add_argument('--methods', nargs='+', choices=['prepareAndPause', 'resumeAfterProcessRestart'],
                        default=['prepareAndPause', 'resumeAfterProcessRestart'])
    args = parser.parse_args()
    adb = Path.home() / 'Library/Android/sdk/platform-tools/adb'
    release = ROOT / 'releases/survivor-global'
    metadata = json.loads((release / 'android-build-info.json').read_text())
    apk = release / metadata['apk']
    assert not metadata['dirty']
    assert hashlib.sha256(apk.read_bytes()).hexdigest() == metadata['sha256']
    output = ROOT / 'artifacts/survivor-global/android'
    if args.start_stage == 1 and output.exists():
        timestamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
        history = ROOT / 'releases/survivor-global-private/native-history' / timestamp
        history.parent.mkdir(parents=True, exist_ok=True)
        output.rename(history)
    output.mkdir(parents=True, exist_ok=True)

    def run(*command):
        return subprocess.check_output([str(adb), '-s', args.serial, *map(str, command)], text=True)

    run('install', '-r', apk)
    run('install', '-r', HERE / 'android/app/build/outputs/apk/androidTest/release/app-release-androidTest.apk')
    journal = output / 'summary.json'
    stages = []
    if args.start_stage > 1:
        previous = json.loads(journal.read_text())
        assert previous['source'] == metadata['sourceCommit']
        assert previous['apkSha256'] == metadata['sha256']
        stages = previous['stages']
        assert len(stages) == args.start_stage - 1
    for index, method in enumerate(args.methods, args.start_stage):
        run('shell', 'am', 'force-stop', PACKAGE)
        result = run('shell', 'am', 'instrument', '-w', '-r', '-e', 'class',
                     PACKAGE + '.NativeFlowTest#' + method,
                     PACKAGE + '.test/androidx.test.runner.AndroidJUnitRunner')
        (output / f'{index}-{method}.log').write_text(result)
        if 'OK (1 test)' not in result:
            raise RuntimeError(f'Android stage {index} failed; see {output}')
        stage = output / f'stage-{index}'
        if stage.exists():
            raise RuntimeError('Preserve the previous evidence directory before rerunning')
        name = 'native-first-session' if method == 'prepareAndPause' else 'native-second-session'
        names = ['01-start.png', '02-refits.png', '03-starting-weapons.png', '04-native-combat.png', '05-pause-audio.png'] if method == 'prepareAndPause' else ['00-resume-start.png', '06-native-results.png']
        stage.mkdir()
        for filename in [*names, name + '.json']:
            run('pull', f'/sdcard/Android/data/{PACKAGE}/files/international-evidence/{filename}', stage / filename)
        report = json.loads((stage / (name + '.json')).read_text())
        assert report['build']['commit'] == metadata['sourceCommit']
        assert not report['build']['dirty']
        stages.append({'method': method, 'result': report, 'evidence': stage.name, 'renderer': args.renderer})
        journal.write_text(json.dumps({
            'apkSha256': metadata['sha256'], 'source': metadata['sourceCommit'],
            'serial': args.serial, 'stages': stages, 'physicalPhone': False,
        }, indent=2) + '\n')
        print(json.dumps({'stage': index, 'method': method, 'passed': True}), flush=True)


if __name__ == '__main__':
    main()
