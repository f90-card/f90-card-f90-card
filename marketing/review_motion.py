from pathlib import Path
from PIL import Image, ImageOps, ImageDraw, ImageFont
import subprocess
root=Path(__file__).resolve().parent
folder=root/'creative-v2'
frames=[]
for n in range(1,7):
    fn=folder/f'F90-motion-{n:02d}.mp4'
    for sec in (1.5,5.5,9.0,11.7):
        r=subprocess.run(['ffmpeg','-loglevel','error','-ss',str(sec),'-i',str(fn),'-frames:v','1','-f','image2pipe','-vcodec','mjpeg','-'],capture_output=True,check=True)
        from io import BytesIO
        frames.append(Image.open(BytesIO(r.stdout)).convert('RGB'))
preview=Image.new('RGB',(4*260,6*468),'#111111')
for i,im in enumerate(frames):
    r=i//4;c=i%4
    small=ImageOps.fit(im,(260,462),Image.Resampling.LANCZOS)
    preview.paste(small,(c*260,r*468))
preview.save(folder/'motion-quality-sheet.jpg',quality=80,optimize=True)
print('QA GRID',preview.size, (folder/'motion-quality-sheet.jpg').stat().st_size)
