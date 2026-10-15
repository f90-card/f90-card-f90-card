from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageFilter
import math,random,qrcode,subprocess
BASE=Path(__file__).resolve().parent.parent
OUT=BASE/'marketing'/'exports'
OUT.mkdir(parents=True,exist_ok=True)
SITE='https://f90-card.github.io/f90-card-f90-card/index.html#/'
WA='https://wa.me/970568181910'
FONT='/usr/share/fonts/truetype/noto/NotoKufiArabic-Bold.ttf'
SMALL='/usr/share/fonts/truetype/noto/NotoKufiArabic-Regular.ttf'
ASCII='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
SECTIONS=[
('شحن الألعاب','خيارات الشحن في مكان واحد','games.png','الألعاب'),
('تطبيقات اللايف','تصفح خدمات التطبيقات بسهولة','apps.png','التطبيقات'),
('البطاقات الرقمية','اكتشف خيارات البطاقات الرقمية','cards.png','البطاقات'),
('خدمات التواصل','اكتشف خدمات منصات التواصل','social.png','التواصل'),
('الاشتراكات الرقمية','تصفح الاشتراكات المتاحة','streaming.png','الاشتراكات'),
('الذكاء الاصطناعي','خدمات وتقنيات رقمية متنوعة','ai.png','الذكاء الاصطناعي'),
('خدمات أف تسعين','وجهتك لخدمات رقمية متنوعة','services.png','الخدمات'),
('خدمات الهاتف','تعرف على خدمات الهاتف المتاحة','mobile.png','الهاتف'),
('طرق الدفع','اطلع على وسائل الدفع المتاحة','payments.png','المدفوعات'),
('F90 CARD','عالم الخدمات الرقمية بين يديك','hero.png','متجر أف تسعين كارد')]
LOGO=Image.open(BASE/'f90-logo.png').convert('RGBA')
a=LOGO.getchannel('A').point(lambda v:255 if v>20 else 0).getbbox()
if a: LOGO=LOGO.crop(a)
def font(size,b=True,latin=False):return ImageFont.truetype(ASCII if latin else FONT if b else SMALL,size)
def put(d,s,x,y,size=40,color='#ffffff',bold=True):
    islatin=all(ord(c)<128 for c in s)
    d.text((round(x),round(y)),s,font=font(size,bold,islatin),anchor='mm',fill=color,direction='ltr' if islatin else 'rtl')
def background(w,h,idx):
    img=Image.new('RGB',(w,h),'#08070d')
    d=ImageDraw.Draw(img,'RGBA')
    random.seed(idx+44)
    for v in range(5):
        pad=17+v*13
        d.rounded_rectangle((pad,pad,w-pad,h-pad),radius=24,outline=(240,33,67,80//(v+1)),width=2)
    for j in range(30):
        x=random.randrange(w);y=random.randrange(h)
        d.line((x,y,x+random.randint(-40,40),y-random.randint(40,180)),fill=(230,16,52,random.randint(8,28)),width=2)
    d.ellipse((w*.18,h*.16,w*.82,h*.56),outline=(185,20,45,14),width=10)
    return img
def logo(img,x,y,w):
    s=LOGO.copy();s.thumbnail((w,round(w*0.94)),Image.Resampling.LANCZOS)
    img.paste(s,(round(x-s.width/2),round(y-s.height/2)),s)
def banner(img,path,rect):
    x0,y0,x1,y1=map(int,rect);w=x1-x0;h=y1-y0
    src=Image.open(BASE/'assets'/'sections'/path).convert('RGB')
    factor=max(w/src.width,h/src.height);nw,nh=math.ceil(src.width*factor),math.ceil(src.height*factor)
    src=src.resize((nw,nh),Image.Resampling.LANCZOS)
    src=src.crop(((nw-w)//2,(nh-h)//2,(nw+w)//2,(nh+h)//2))
    mask=Image.new('L',(w,h));ImageDraw.Draw(mask).rounded_rectangle((0,0,w-1,h-1),radius=27,fill=255)
    img.paste(src,(x0,y0),mask)
    ImageDraw.Draw(img).rounded_rectangle((x0,y0,x1,y1),radius=27,outline='#ff3a59',width=5)
def qr(img,u,x,y,s):
    q=qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_Q,border=4,box_size=8)
    q.add_data(u);q.make(fit=True)
    bitmap=q.make_image(fill_color='black',back_color='white').convert('RGB').resize((s,s),Image.Resampling.NEAREST)
    ImageDraw.Draw(img).rounded_rectangle((x-8,y-8,x+s+8,y+s+8),radius=18,fill='#ffffff',outline='#ff3658',width=5)
    img.paste(bitmap,(x,y))
def primary(idx):
    title,desc,file,small=SECTIONS[idx];img=background(1080,1350,idx);d=ImageDraw.Draw(img)
    logo(img,540,195,520)
    put(d,title,540,377,64)
    put(d,desc,540,461,34,'#ff90a0')
    banner(img,file,(80,535,1000,867))
    d.rounded_rectangle((235,900,845,984),radius=42,fill='#ba1734',outline='#ff7589',width=3)
    put(d,'اكتشف الخدمات الآن',540,940,36)
    d.line((75,1015,1005,1015),fill='#c32f4b',width=2)
    put(d,'افتح المتجر',290,1052,29)
    put(d,'تواصل واتساب',790,1052,29)
    qr(img,SITE,210,1080,160)
    qr(img,WA,710,1080,160)
    put(d,'F90 CARD',540,1281,32,'#f5f2f4')
    put(d,'+970568181910',540,1323,22,'#ff9baf')
    img.save(OUT/f'f90-post-{idx+1:02d}-{small}.png',optimize=True)
def vframe(idx,n):
    title,desc,file,small=SECTIONS[idx];img=background(720,1280,idx*3+n);d=ImageDraw.Draw(img)
    if n==0:
        logo(img,360,319,560)
        put(d,title,360,609,57)
        put(d,desc,360,706,29,'#ff9cac')
        d.rounded_rectangle((115,845,605,930),radius=40,fill='#ba1536',outline='#ff7287',width=3)
        put(d,'أف تسعين كارد',360,886,38)
        put(d,'F90 CARD',360,1103,34,'#ff5977')
    elif n==1:
        logo(img,360,230,440)
        put(d,title,360,454,54)
        banner(img,file,(46,550,674,805))
        put(d,'تصفح الأقسام واختر خدمتك',360,912,30)
        put(d,'الخيارات والتفاصيل داخل المتجر',360,987,26,'#ff9faf')
    else:
        logo(img,360,211,440)
        put(d,'افتح المتجر من هنا',360,420,42)
        qr(img,SITE,117,520,210)
        qr(img,WA,392,520,210)
        put(d,'المتجر',222,776,32)
        put(d,'واتساب',497,776,32)
        put(d,'امسح الرمز أو استخدم الرابط في الوصف',360,884,23)
        d.rounded_rectangle((80,973,640,1057),radius=37,fill='#c21939')
        put(d,'اكتشف F90 CARD',360,1014,32)
        put(d,'+970568181910',360,1147,26,'#ffacba')
    return img
def videos():
    for idx in range(10):
        folder=OUT/f'_frames_{idx+1:02d}';folder.mkdir(exist_ok=True)
        for j in range(3):vframe(idx,j).save(folder/f'{j}.png',optimize=True)
        fname=OUT/f'f90-reel-{idx+1:02d}.mp4'
        # Each original frame lasts 3 seconds, with gentle crossfade between scenes
        cmd=['ffmpeg','-hide_banner','-loglevel','error','-y']
        for j in range(3):cmd+=['-loop','1','-t','3.4','-i',str(folder/f'{j}.png')]
        flt=('[0:v]fps=25,format=yuv420p,setsar=1[v0];'
             '[1:v]fps=25,format=yuv420p,setsar=1[v1];'
             '[2:v]fps=25,format=yuv420p,setsar=1[v2];'
             '[v0][v1]xfade=transition=fade:duration=0.4:offset=3.0[t1];'
             '[t1][v2]xfade=transition=fade:duration=0.4:offset=6.0[out]')
        cmd+=['-filter_complex',flt,'-map','[out]','-t','9.4','-c:v','libx264','-preset','veryfast','-crf','29','-pix_fmt','yuv420p','-movflags','+faststart',str(fname)]
        subprocess.run(cmd,check=True)
        for p in folder.iterdir():p.unlink()
        folder.rmdir()
        print(fname.name,fname.stat().st_size,flush=True)
for idx in range(10):primary(idx)
videos()
