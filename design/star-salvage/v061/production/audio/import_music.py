"""Preserve user-approved MP3 originals and produce measured H5 streaming files."""
from pathlib import Path
import hashlib
import json
import re
import shutil
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
DEST = ROOT/'prototypes/salvage-survivor-demo/assets/audio'
INPUTS = [('nebula-groove','Nebula Groove','/Users/shuhuayu/Downloads/Nebula Groove.mp3'),
          ('nebula-loop','Nebula Loop','/Users/shuhuayu/Downloads/Nebula Loop.mp3')]


def run(args):
    return subprocess.run(args,check=True,capture_output=True,text=True)


def probe(file):
    return json.loads(run(['ffprobe','-v','quiet','-show_format','-show_streams','-print_format','json',str(file)]).stdout)


def digest(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()


def loudness(file, filters):
    args = ['ffmpeg','-hide_banner','-nostats','-i',str(file),'-af',filters,'-f','null','-']
    result = run(args)
    block = result.stderr[result.stderr.rfind('{'):result.stderr.rfind('}')+1]
    return json.loads(block), args


def main():
    original_dir = HERE/'user-music'
    original_dir.mkdir(parents=True,exist_ok=True)
    DEST.mkdir(parents=True,exist_ok=True)
    rows = []
    for id,title,name in INPUTS:
        original = original_dir/(title+'.mp3')
        source = Path(name) if Path(name).is_file() else original
        assert source.is_file(), source
        if source.resolve()!=original.resolve():
            shutil.copyfile(source,original)
        assert digest(source) == digest(original)
        info = probe(original)
        duration = float(info['format']['duration'])
        assert any(row['codec_name']=='mp3' and row['channels']==2 for row in info['streams'])
        silence_args = ['ffmpeg','-hide_banner','-nostats','-i',str(original),'-af',
                        'silencedetect=noise=-52dB:d=0.3','-f','null','-']
        silence_log = run(silence_args).stderr
        events = []
        for match in re.finditer(r'silence_(start|end): ([0-9.]+)',silence_log):
            events.append({'kind':match.group(1),'seconds':float(match.group(2))})
        end = duration
        if events and events[-1]['kind']=='end' and events[-1]['seconds']>=duration-0.1:
            starts = [event['seconds'] for event in events[:-1] if event['kind']=='start']
            if starts and duration-starts[-1]>=0.35:
                end = min(duration,starts[-1]+0.15)
        elif events and events[-1]['kind']=='start' and duration-events[-1]['seconds']>=0.35:
            end = min(duration,events[-1]['seconds']+0.15)
        prefix = f'atrim=end={end:.6f},asetpts=PTS-STARTPTS,'
        measured,measure_args = loudness(original,prefix+'loudnorm=I=-17:TP=-2:LRA=11:print_format=json')
        normalization = ('loudnorm=I=-17:TP=-2:LRA=11:'
            f"measured_I={measured['input_i']}:measured_TP={measured['input_tp']}:"
            f"measured_LRA={measured['input_lra']}:measured_thresh={measured['input_thresh']}:"
            f"offset={measured['target_offset']}:linear=true:print_format=json")
        output = DEST/(id+'.mp3')
        filters = prefix+normalization+f',afade=t=out:st={max(0,end-0.15):.6f}:d=0.15'
        conversion = ['ffmpeg','-hide_banner','-loglevel','info','-nostats','-y','-i',str(original),
                      '-vn','-af',filters,'-ar','44100','-ac','2','-codec:a','libmp3lame','-b:a','96k',
                      '-map_metadata','-1','-metadata','title='+title,'-id3v2_version','3',str(output)]
        conversion_log = run(conversion).stderr
        actual = probe(output)
        levels,level_args = loudness(output,'loudnorm=I=-17:TP=-2:LRA=11:print_format=json')
        assert float(levels['input_tp']) < -0.1
        row = {'id':id,'title':title,'approvedUserFile':True,
               'sourcePath':str(source),'originalPath':str(original.relative_to(ROOT)),
               'originalBytes':original.stat().st_size,'originalSha256':digest(original),
               'sourceDuration':duration,'sourceBitrate':int(info['format']['bit_rate']),
               'silenceEvents':events,'retainedSourceEnd':end,'trimmedTail':round(duration-end,6),
               'runtimePath':str(output.relative_to(ROOT)),'runtimeUrl':'./assets/audio/'+output.name,
               'runtimeBytes':output.stat().st_size,'runtimeSha256':digest(output),
               'runtimeDuration':float(actual['format']['duration']),
               'sampleRate':44100,'channels':2,'bitrate':96000,
               'actualIntegratedLufs':float(levels['input_i']),
               'actualTruePeakDbtp':float(levels['input_tp']),
               'actualLoudnessRangeLu':float(levels['input_lra']),
               'commands':{'silence':silence_args,'measurement':measure_args,
                           'conversion':conversion,'encodedMeasurement':level_args}}
        rows.append(row)
        (HERE/(id+'-silence.log')).write_text(silence_log)
        (HERE/(id+'-conversion.log')).write_text(conversion_log)
    report = {'source':'Two actual user-provided and approved MP3 files. Original generation service and commercial licensing have not been independently verified. No account/API calls.',
              'runtimeStrategy':'Two HTMLAudio streaming elements,2-second runtime crossfade; no full-track WebAudio decode.',
              'targetLufs':-17,'targetTruePeakDbtp':-2,'tracks':rows,
              'ffmpegVersion':run(['ffmpeg','-version']).stdout.splitlines()[0],
              'runtimeTotalBytes':sum(row['runtimeBytes'] for row in rows),
              'physicalPhoneTested':False}
    assert 3000000 <= report['runtimeTotalBytes'] <= 5000000
    (HERE/'user-music-manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print('Imported actual2 MP3 originals; runtime bytes',report['runtimeTotalBytes'])
    for row in rows:
        print(row['id'],row['runtimeDuration'],row['runtimeBytes'],row['actualIntegratedLufs'],row['actualTruePeakDbtp'])


if __name__=='__main__':
    main()
