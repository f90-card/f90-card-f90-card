from PIL import Image,ImageDraw,ImageFont,ImageOps,ImageFilter
from pathlib import Path
import subprocess,numpy as np,math,wave,qrcode
B=Path(__file__).resolve().parent.parent
OUT=B/'marketing'/'creative-v3'
LOGO=Image.open(B/'f90-logo.png').convert('RGBA')
BOX=LOGO.getchannel('A').point(lambda n:255 if n>16 else 0).getbbox()
if BOX: LOGO=LOGO.crop(BOX)
FONT='/usr/share/fonts/truetype/noto/NotoKufiArabic-Bold.ttf'
LAT='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
STORE='https://f90-card.github.io/f90-card-f90-card/index.html#/'
WA='https://wa.me/970568181910'
W,H=720,1280
FPS,DURATION=18,13
SCREEN=Image.open(B/'marketing'/'screenshots'/'homepage-mobile.png').convert('RGB')
MEDIA=[
('اشتراكات المشاهدة','عالم الترفيه الرقمي','01-اشتراكات-المشاهدة.png',(175,94,249)),
('تطبيقات اللايف','استكشف خدمات التطبيقات','../november/09-خدمات-التطبيقات.png',(245,64,139)),
('الذكاء الاصطناعي','خدمات وتقنيات رقمية','02-الذكاء-الاصطناعي.png',(55,217,223)),
('واجهة المتجر','كل خدماتك في مكان واحد','07-جولة-المتجر.png',(242,58,94))]
def font(sz,latin=False):return ImageFont.truetype(LAT if latin else FONT,sz)
def text(im,s,x,y,n=40,c='#ffffff'):
 en=all(ord(k)<128 for k in s)
 ImageDraw.Draw(im).text((round(x),round(y)),s,font=font(n,en),fill=c,anchor='mm',direction='ltr' if en else 'rtl')
def logoblock(im,x,y,w):
 a=LOGO.copy();a.thumbnail((w,450),Image.Resampling.LANCZOS)
 im.paste(a,(round(x-a.width/2),round(y-a.height/2)),a)
def code(link):
 q=qrcode.QRCode(box_size=9,border=4,error_correction=qrcode.constants.ERROR_CORRECT_Q)
 q.add_data(link);q.make(fit=True)
 return q.make_image(fill_color='black',back_color='white').convert('RGB').resize((140,140),Image.Resampling.NEAREST)
QR1=code(STORE);QR2=code(WA)
def bg(accent,sec):
 c=np.array(accent,dtype=np.float32)
 ar=np.zeros((H,W,3),dtype=np.uint8)
 ys=np.linspace(0,1,H,dtype=np.float32)[:,None,None]
 base=np.array([8,9,17],dtype=np.float32)[None,None,:]
 ar[:]=np.clip(base+ys*c[None,None,:]*.22,0,255).astype('uint8')
 im=Image.fromarray(ar)
 d=ImageDraw.Draw(im)
 for k in range(18):
  phase=sec*6.2+k*30
  x=int((k*84+phase)%950)-80
  d.line((x,-30,x-180,H+40),fill=tuple(int(n*.17) for n in accent),width=2)
 for k in range(5):
  radius=250+k*40
  d.arc((360-radius,510-radius,360+radius,510+radius),10+(sec*22+k*10)%360,150+(sec*22+k*10)%360,fill=tuple(int(n*.38) for n in accent),width=2)
 return im
def photo(im,source,center,scale,accent,rotate=0):
 w=int(580*scale);h=int(w*source.height/source.width)
 a=source.resize((w,h),Image.Resampling.LANCZOS)
 if rotate:
  a=a.rotate(rotate,expand=True,resample=Image.Resampling.BICUBIC)
 x=round(center[0]-a.width/2);y=round(center[1]-a.height/2)
 shadow=Image.new('RGBA',im.size)
 ImageDraw.Draw(shadow).rounded_rectangle((x-10,y-10,x+a.width+10,y+a.height+10),radius=34,fill=(10,5,14,180),outline=(*accent,255),width=7)
 im.paste(shadow,(0,0),shadow)
 im.paste(a,(x,y))
def build(i,seconds):
 title,desc,imgname,accent=MEDIA[i]
 img=bg(accent,seconds)
 d=ImageDraw.Draw(img)
 picture=Image.open(OUT/imgname).convert('RGB')
 if seconds<3:
  t=min(1,seconds/1.1)
  logoblock(img,360,300-110*(1-t),480)
  text(img,title,360,620+100*(1-t),55)
  text(img,desc,360,720,30,'#e9c9f0')
  d.rounded_rectangle((86,875,634,960),radius=35,fill=tuple(int(n*.60) for n in accent),outline=accent,width=3)
  text(img,'اكتشف المتجر',360,919,32)
  d.line((100,1060,620,1060),fill=accent,width=5)
  text(img,'أف تسعين كارد',360,1138,28)
 elif seconds<7.8:
  p=(seconds-3)/4.8
  logoblock(img,360,160,400)
  if i%2==0:
   x=360+28*math.sin(p*math.pi*2)
   y=670+20*math.cos(p*math.pi*2)
   scale=1.07+0.11*p
   photo(img,picture,(x,y),scale,accent)
  else:
   # parallax two floating media panels
   photo(img,picture,(348-42*p,560),.67+0.06*p,accent,-2)
   photo(img,picture,(420+40*p,865),.57+0.07*p,accent,3)
  text(img,title,360,1112,36)
  text(img,'تصفح الخدمات المتاحة الآن',360,1195,24,'#ffffff')
 elif seconds<10.5:
  p=(seconds-7.8)/2.7
  text(img,'هذه واجهة المتجر الفعلية',360,174,31)
  cropped=ImageOps.fit(SCREEN,(360,765),Image.Resampling.LANCZOS,centering=(.5,min(.7,.2+.5*p)))
  x=180+int(18*math.sin(p*math.pi));y=290
  d.rounded_rectangle((x-18,y-18,x+378,y+783),radius=39,fill='#10131f',outline=accent,width=8)
  m=Image.new('L',(360,765));ImageDraw.Draw(m).rounded_rectangle((0,0,360,765),radius=25,fill=255)
  img.paste(cropped,(x,y),m)
  text(img,'F90 CARD',360,1200,27)
 else:
  logoblock(img,360,190,445)
  text(img,'افتح المتجر الآن',360,426,51)
  d.rounded_rectangle((53,558,667,1010),radius=27,fill='#11121e',outline=accent,width=4)
  for x,a in [(94,QR1),(486,QR2)]:
   d.rounded_rectangle((x-8,673,x+148,829),radius=16,fill='white',outline=accent,width=4)
   img.paste(a,(x,681))
  text(img,'المتجر',164,895,29)
  text(img,'واتساب',556,895,29)
  text(img,'امسح الرمز للوصول مباشرة',360,965,24)
  text(img,'+970568181910',360,1136,29,'#ffd5df')
  text(img,'F90 CARD',360,1247,25)
 return img
def sound():
 rate=22050;num=rate*DURATION
 a=np.zeros(num,'float32')
 beat=.5
 rng=np.random.default_rng(104)
 for k in range(int(DURATION/beat)):
  start=int(k*beat*rate);count=min(int(.22*rate),num-start)
  if count<=0:break
  tt=np.arange(count,dtype=np.float32)/rate
  base=(.26 if k%4==0 else .15)*np.sin(2*np.pi*(93*tt+5*tt*tt))*np.exp(-16*tt)
  a[start:start+count]+=base
  if k%2:
   a[start:start+count]+=.015*rng.standard_normal(count).astype('float32')*np.exp(-17*tt)
 for k in range(21):
  start=int(k*.6*rate);count=min(int(.45*rate),num-start)
  if count<=0:break
  tt=np.arange(count,dtype=np.float32)/rate
  pitch=164.81*2**(([0,3,7,10,12,10,7][k%7])/12)
  a[start:start+count]+=.08*np.sin(2*np.pi*pitch*tt)*np.exp(-4*tt)
 a=np.clip(a,-.85,.85)
 path=OUT/'_nov_motion_track.wav'
 with wave.open(str(path),'wb') as w:
  w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate);w.writeframes((a*32767).astype(np.int16).tobytes())
 return path
track=sound()
for i in range(len(MEDIA)):
 out=OUT/f'F90-extra-{i+7:02d}.mp4'
 cmd=['ffmpeg','-hide_banner','-loglevel','error','-y','-f','rawvideo','-vcodec','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-i',str(track),'-map','0:v','-map','1:a','-c:v','libx264','-preset','veryfast','-crf','27','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-movflags','+faststart','-t',str(DURATION),str(out)]
 process=subprocess.Popen(cmd,stdin=subprocess.PIPE)
 for frame in range(FPS*DURATION):
  process.stdin.write(build(i,frame/FPS).tobytes())
 process.stdin.close()
 rc=process.wait()
 if rc:raise RuntimeError('render failed '+str(i))
 print(out.name,out.stat().st_size,flush=True)
track.unlink()
