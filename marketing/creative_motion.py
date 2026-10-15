from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageOps,ImageFilter
import numpy as np,math,random,wave,subprocess
B=Path(__file__).resolve().parent.parent
F=B/'marketing'/'creative-v2'
F.mkdir(parents=True,exist_ok=True)
Q='https://f90-card.github.io/f90-card-f90-card/index.html#/'
WA='https://wa.me/970568181910'
import qrcode
N=720;H=1280;FPS=20;DUR=13
FONT='/usr/share/fonts/truetype/noto/NotoKufiArabic-Bold.ttf'
SMALL='/usr/share/fonts/truetype/noto/NotoKufiArabic-Regular.ttf'
LATIN='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
L=Image.open(B/'f90-logo.png').convert('RGBA')
bbox=L.getchannel('A').point(lambda p:255 if p>20 else 0).getbbox()
if bbox:L=L.crop(bbox)
SCREEN=Image.open(B/'marketing'/'screenshots'/'homepage-mobile.png').convert('RGB')
def tx(im,text,x,y,size,color='#ffffff',center=True):
    en=all(ord(c)<128 for c in text)
    f=ImageFont.truetype(LATIN if en else FONT,size)
    ImageDraw.Draw(im).text((int(x),int(y)),text,font=f,fill=color,anchor='mm' if center else 'lm',direction='ltr' if en else 'rtl')
def qr(link):
    q=qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_H,box_size=10,border=4)
    q.add_data(link);q.make(fit=True)
    return q.make_image(fill_color='black',back_color='white').convert('RGB').resize((164,164),Image.Resampling.NEAREST)
STOREQR=qr(Q);WAQR=qr(WA)
def pasteqr(im,code,x,y,accent):
    ImageDraw.Draw(im).rounded_rectangle((x-8,y-8,x+172,y+172),radius=16,fill='#ffffff',outline=accent,width=5)
    im.paste(code,(x,y))
def make_music():
    rate=22050;dur=DUR;n=round(rate*dur)
    out=np.zeros(n,np.float32);tempo=104;beat=60/tempo
    rng=np.random.default_rng(72)
    for j in range(int(dur/beat)+1):
        st=int(j*beat*rate);nn=min(int(.22*rate),n-st)
        if nn<=0:break
        tt=np.arange(nn)/rate
        kick=.37*np.sin(2*np.pi*(86*tt+140*tt*np.exp(-22*tt))) * np.exp(-18*tt)
        out[st:st+nn]+=kick
        if j%2==1:
            nn2=min(int(.12*rate),n-st);tm=np.arange(nn2)/rate
            out[st:st+nn2]+=.075*rng.standard_normal(nn2).astype('float32')*np.exp(-23*tm)
        for half in (0,.5):
            ix=st+round(half*beat*rate);nn3=min(round(.075*rate),n-ix)
            if nn3>0:out[ix:ix+nn3]+=.016*rng.standard_normal(nn3).astype('float32')*np.exp(-42*np.arange(nn3)/rate)
    scale=[0,3,7,10,12,7,3,5]
    notes=[220*(2**(p/12)) for p in scale]
    for i in range(int(dur/(beat*.5))):
        st=round(i*.5*beat*rate);nn=min(round(beat*.45*rate),n-st)
        if nn<=0:break
        tt=np.arange(nn)/rate;hz=notes[i%len(notes)]
        out[st:st+nn]+=.095*(np.sin(2*np.pi*hz*tt)+.3*np.sin(2*np.pi*hz*2*tt))*np.exp(-3.4*tt)
    out*=.75/max(.01,np.max(np.abs(out)))
    p=F/'_campaign_soundtrack.wav'
    with wave.open(str(p),'wb') as w:
        w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate);w.writeframes((out*32767).astype(np.int16).tobytes())
    return p
MUSIC=make_music()
AD=[
 ('01-متجرك-الرقمي.png','عالمك الرقمي','أقرب إليك',(252,26,66)),
 ('02-عالم-الألعاب.png','شحن الألعاب','خيارات متنوعة',(255,104,50)),
 ('03-تطبيقات-اللايف.png','تطبيقات اللايف','شحن وتصفح',(124,75,252)),
 ('04-البطاقات-الرقمية.png','البطاقات الرقمية','خيارات متعددة',(230,171,78)),
 ('05-كيف-تبدأ.png','طريقة الطلب','خطوة بخطوة',(255,47,92)),
 ('06-تواصل-واتساب.png','الدعم عبر واتساب','تواصل معنا',(32,206,119))
]
def draw_frame(art,title,desc,accent,sec,index):
    im=Image.new('RGB',(N,H),(8,9,16))
    d=ImageDraw.Draw(im)
    for y in range(H):
        f=y/H
        d.line((0,y,N,y),fill=(min(255,round(8+28*f+accent[0]*.09)),round(10+accent[1]*.12*f),round(17+accent[2]*.12*f)))
    # Dynamic background bars and neon light particles
    for k in range(11):
        x=(130*k + int(sec*73)*(1+k%2)) % (N+240)-120
        d.line((x,0,x-300,H),fill=tuple(round(c*.3) for c in accent),width=2)
    for j in range(36):
        xx=int((j*173+index*53+sec*(8+(j%5)*4))%N)
        yy=int((j*237+sec*(25+j%4*4))%H)
        d.ellipse((xx,yy,xx+3,yy+3),fill=tuple(round(c*.48) for c in accent))
    z=sec
    if z<2.8:
        grow=min(1,max(0,z/1.15))
        w=int(440+88*grow+16*math.sin(z*4))
        l=L.copy();l.thumbnail((w,520),Image.Resampling.LANCZOS)
        im.paste(l,(int(N/2-l.width/2),int(145-l.height/2)),l)
        tx(im,title,N/2,480-int((1-grow)*120),52)
        tx(im,desc,N/2,575+int((1-grow)*110),40,'#ffb5c6' if index==0 else '#f4e9ff')
        d=ImageDraw.Draw(im)
        d.rounded_rectangle((128,748,592,832),radius=34,outline=accent,width=5)
        tx(im,'اكتشف أف تسعين كارد',360,787,32)
        d.arc((80,850,640,1410),180,335,fill=accent,width=9)
    elif z<8.1:
        zz=(z-2.8)/5.3
        scale=.75 + .09*math.sin(zz*math.pi)+.035*zz
        aw=int(660*scale)
        ah=round(aw*art.height/art.width)
        a=art.resize((aw,ah),Image.Resampling.LANCZOS)
        y0=int(160 + (1-zz)*40+7*math.sin(zz*12))
        x0=int((N-aw)/2+25*math.sin(zz*3))
        box=(x0-10,y0-10,x0+aw+10,y0+ah+10)
        d=ImageDraw.Draw(im);d.rounded_rectangle(box,radius=25,fill='#110d18',outline=accent,width=5)
        im.paste(a,(x0,y0))
        d.rounded_rectangle((80,1090,640,1166),radius=20,fill='#170e1a',outline=accent,width=3)
        tx(im,'تصفح خدمات المتجر',360,1128,36)
        tx(im,'F90 CARD',360,1240,26)
    elif z<10.5:
        zz=(z-8.1)/2.4
        tx(im,'واجهة المتجر الحقيقية',N/2,145,42)
        sw=380;sh=795
        # True scrolling of the real public website screenshot in a phone mockup
        cropx=int((SCREEN.width-sw*.8)/2)
        screen_scaled=SCREEN.resize((450,round(SCREEN.height*450/SCREEN.width)),Image.Resampling.LANCZOS)
        y_start=int(zz*min(screen_scaled.height-850,450))
        view=screen_scaled.crop((33,y_start,417,y_start+810)).resize((sw,sh),Image.Resampling.LANCZOS)
        cx=(N-sw)//2;cy=245
        ImageDraw.Draw(im).rounded_rectangle((cx-15,cy-15,cx+sw+15,cy+sh+15),radius=33,fill='#111822',outline=accent,width=7)
        mask=Image.new('L',(sw,sh));ImageDraw.Draw(mask).rounded_rectangle((0,0,sw-1,sh-1),radius=22,fill=255)
        im.paste(view,(cx,cy),mask)
        tx(im,'متجر أف تسعين كارد',N/2,1147,31)
    else:
        zz=(z-10.5)/(DUR-10.5)
        l=L.copy();l.thumbnail((445,420),Image.Resampling.LANCZOS)
        im.paste(l,(round(N/2-l.width/2),130-round(l.height/2)),l)
        tx(im,'ابدأ من هنا',N/2,373,54)
        fade=int(min(255,170+85*zz))
        d=ImageDraw.Draw(im)
        d.rounded_rectangle((57,540,663,1015),radius=25,fill='#100f19',outline=accent,width=5)
        pasteqr(im,STOREQR,106,632,accent);pasteqr(im,WAQR,447,632,accent)
        tx(im,'المتجر',194,860,30)
        tx(im,'واتساب',530,860,30)
        tx(im,'امسح الرمز وافتح الرابط',360,947,24)
        tx(im,'+970568181910',360,1131,31,'#ffc6d1')
        tx(im,'F90 CARD',360,1237,26)
    # Animated top/bottom scanline, fades at boundaries
    yy=int((sec*220)%H)
    d=ImageDraw.Draw(im)
    d.line((0,yy,N,yy),fill=tuple(min(255,round(c*.6)) for c in accent),width=2)
    return im
def render(i):
    filename,title,desc,accent=AD[i]
    art=Image.open(F/filename).convert('RGB')
    out=F/f'F90-motion-{i+1:02d}.mp4'
    cmd=['ffmpeg','-loglevel','error','-y','-f','rawvideo','-vcodec','rawvideo','-pix_fmt','rgb24','-s',f'{N}x{H}','-r',str(FPS),'-i','-','-i',str(MUSIC),'-map','0:v','-map','1:a','-c:v','libx264','-preset','veryfast','-crf','27','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-movflags','+faststart','-t',str(DUR),str(out)]
    p=subprocess.Popen(cmd,stdin=subprocess.PIPE)
    try:
        for k in range(DUR*FPS):
            im=draw_frame(art,title,desc,accent,k/FPS,i)
            p.stdin.write(im.tobytes())
    finally:
        p.stdin.close()
    rc=p.wait()
    if rc:raise RuntimeError(f'ffmpeg {i} exited {rc}')
    print('VIDEO',out.name,out.stat().st_size,flush=True)
for i in range(len(AD)):render(i)
MUSIC.unlink()
