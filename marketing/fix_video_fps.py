from pathlib import Path
import subprocess,json
B=Path(__file__).resolve().parent/'creative-v2'
C=Path(__file__).resolve().parent/'creative-v3'
videos=[B/f'F90-motion-{n:02d}.mp4' for n in range(1,7)]+[C/f'F90-extra-{n:02d}.mp4' for n in range(7,11)]
for infile in videos:
    assert infile.exists(),infile
    outfile=infile.with_name(infile.stem+'-25fps.mp4')
    cmd=['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(infile),'-vf','fps=25','-r','25','-c:v','libx264','-preset','veryfast','-crf','23','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-movflags','+faststart',str(outfile)]
    subprocess.run(cmd,check=True)
    check=subprocess.run(['ffprobe','-v','error','-select_streams','v:0','-show_entries','stream=avg_frame_rate,r_frame_rate','-of','json',str(outfile)],capture_output=True,text=True,check=True)
    rates=json.loads(check.stdout)['streams'][0]
    assert rates['avg_frame_rate']=='25/1',(outfile,rates)
    print(outfile.name,outfile.stat().st_size,rates,flush=True)

# Refresh 25fps masters after live-app visual correction
