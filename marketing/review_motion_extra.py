from pathlib import Path
from PIL import Image,ImageOps
from io import BytesIO
import subprocess
P=Path(__file__).resolve().parent/'creative-v3'
out=Image.new('RGB',(4*260,4*468),'#100c12')
for row,n in enumerate(range(7,11)):
 fn=P/f'F90-extra-{n:02d}-25fps.mp4'
 for col,sec in enumerate((1.7,5.2,9.2,11.7)):
  z=subprocess.run(['ffmpeg','-v','error','-ss',str(sec),'-i',str(fn),'-frames:v','1','-f','image2pipe','-vcodec','mjpeg','-'],capture_output=True,check=True)
  im=Image.open(BytesIO(z.stdout)).convert('RGB')
  out.paste(ImageOps.fit(im,(260,462),Image.Resampling.LANCZOS),(col*260,row*468))
out.save(P/'motion-extra-review.jpg',quality=81,optimize=True)
print('Contact sheet saved')
