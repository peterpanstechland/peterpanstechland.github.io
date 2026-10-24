from pathlib import Path
import sys,json,subprocess,shutil
import finish_v4 as f
R=f.R;O=f.O;D=f.D
def music():
 data=json.loads((R/'runway-v4-results.json').read_text(encoding='utf-8'));end=data[1]['meta']['durationSeconds'];last=end-19
 flt=f'[0:a]loudnorm=I=-20:TP=-3:LRA=9,aresample=48000,atrim=0:121,asetpts=PTS-STARTPTS[a];[1:a]loudnorm=I=-20:TP=-3:LRA=9,aresample=48000,asplit=3[b][c][d];[b]atrim=32.7:103.7,asetpts=PTS-STARTPTS[b0];[c]atrim=119.9:135.4,asetpts=PTS-STARTPTS[c0];[d]atrim={last}:{end},asetpts=PTS-STARTPTS[d0];[a][b0]acrossfade=d=2:c1=tri:c2=tri[ab];[ab][c0]acrossfade=d=2:c1=tri:c2=tri[abc];[abc][d0]acrossfade=d=2:c1=tri:c2=tri,atrim=0:220.5,afade=t=in:d=0.5,afade=t=out:st=217.5:d=3,aresample=48000[m]'
 f.run(['-i',str(O/'Runway-new-act-1.mp3'),'-i',str(O/'Runway-new-act-2.mp3'),'-filter_complex',flt,'-map','[m]','-ac','2','-c:a','pcm_s24le',str(O/'music-complete.wav')],'new-runway-score.log')
 f.run(['-i',str(O/'music-complete.wav'),'-c:a','libmp3lame','-b:a','192k',str(D/'Runway-New-Score-Full-220s.mp3')],'score-mp3.log')
 shutil.copyfile(R/'ad-v3-renders/sound-design.wav',O/'sound-design.wav')
 print('Fresh Runway score ready, 220.5 seconds',flush=True)
def audio():
 for lang in ['zh','en']:
  f.make_voice(lang)
  for p in [D/f'Techland-{lang}.srt',O/f'subtitles-{lang}.ass']:
   text=p.read_text(encoding='utf-8-sig').replace('Pu laude','PLAUD').replace('peterpanstechland dot github dot io','peterpanstechland.github.io');p.write_text(text,encoding='utf-8-sig' if p.suffix=='.ass' else 'utf-8')
  f.mix(lang)
def export(lang):
 ass=(O/f'subtitles-{lang}.ass').resolve().as_posix().replace(':',r'\:');out=D/f'Techland-Cyber-Eternal-Studio-{lang.upper()}-1080p.mp4'
 flt=f"[0:v]scale=1760:990:flags=lanczos,pad=1920:1080:80:0:color=0x100b1c,ass=filename='{ass}',tpad=stop_mode=clone:stop_duration=1,trim=duration=220.5[b];[b][2:v]overlay=0:0:enable='between(t,188,201.5)'[c];[c][3:v]overlay=0:0:enable='gte(t,215.5)',format=yuv420p[v]"
 f.run(['-i',str(R/f'ad-v3-renders/visual-{lang}.mp4'),'-i',str(O/f'mixed-{lang}.wav'),'-loop','1','-i',str(O/f'entry-{lang}.png'),'-loop','1','-i',str(O/f'entry-end-{lang}.png'),'-filter_complex',flt,'-map','[v]','-map','1:a','-c:v','libx264','-threads','6','-preset','fast','-crf','19','-r','30','-c:a','aac','-b:a','256k','-ar','48000','-t','220.5','-movflags','+faststart',str(out)],f'export-{lang}.log')
 f.run(['-v','error','-i',str(out),'-f','null','-'],f'decode-{lang}.log');print('EXPORTED',out,out.stat().st_size,flush=True)
if __name__=='__main__':
 if sys.argv[1]=='music':music()
 elif sys.argv[1]=='audio':audio()
 else:export(sys.argv[1])
