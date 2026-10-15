from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageOps,ImageFilter
import random,math,qrcode
B=Path(__file__).resolve().parent.parent
O=B/'marketing'/'creative-v3';O.mkdir(parents=True,exist_ok=True)
STORE='https://f90-card.github.io/f90-card-f90-card/index.html#/'
WA='https://wa.me/970568181910'
F='/usr/share/fonts/truetype/noto/NotoKufiArabic-Bold.ttf'
R='/usr/share/fonts/truetype/noto/NotoKufiArabic-Regular.ttf'
ENG='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
logo=Image.open(B/'f90-logo.png').convert('RGBA')
bound=logo.getchannel('A').point(lambda p:255 if p>16 else 0).getbbox()
if bound:logo=logo.crop(bound)
def text(img,s,x,y,z=40,col='white',bold=True):
    e=all(ord(c)<128 for c in s)
    font=ImageFont.truetype(ENG if e else F if bold else R,z)
    ImageDraw.Draw(img).text((int(x),int(y)),s,font=font,fill=col,anchor='mm',direction='ltr' if e else 'rtl')
def paste_logo(img,x,y,maxw=360):
    pic=logo.copy();pic.thumbnail((maxw,350),Image.Resampling.LANCZOS)
    img.paste(pic,(int(x-pic.width/2),int(y-pic.height/2)),pic)
def rgb(hex):
    h=hex.lstrip('#');return tuple(int(h[i:i+2],16) for i in (0,2,4))
def gradient(a,b,w=1080,h=1350):
    img=Image.new('RGB',(w,h));d=ImageDraw.Draw(img);p=rgb(a);q=rgb(b)
    for y in range(h):
        t=y/h;d.line((0,y,w,y),fill=tuple(round(p[i]*(1-t)+q[i]*t) for i in range(3)))
    return img
def decoration(img,seed,accent):
    d=ImageDraw.Draw(img);random.seed(seed)
    for i in range(28):
        x=random.randint(0,1080);y=random.randint(0,1350)
        a=rgb(accent);col=tuple(round(c*.22) for c in a)
        d.line((x,y,x+random.randint(-80,80),y+random.randint(-350,80)),fill=col,width=random.choice([1,2,2,3]))
def add_section(img,section,box,border,radius=24):
    a=Image.open(B/'assets'/'sections'/section).convert('RGB')
    x,y,x2,y2=map(int,box);w=x2-x;h=y2-y
    a=ImageOps.fit(a,(w,h),Image.Resampling.LANCZOS)
    m=Image.new('L',(w,h));ImageDraw.Draw(m).rounded_rectangle((0,0,w-1,h-1),radius=radius,fill=255)
    img.paste(a,(x,y),m)
    ImageDraw.Draw(img).rounded_rectangle(box,radius=radius,outline=border,width=5)
def qr(url):
    q=qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_H,box_size=9,border=4)
    q.add_data(url);q.make(fit=True)
    return q.make_image(fill_color='black',back_color='white').convert('RGB')
STOREQR=qr(STORE);WAQR=qr(WA)
def qrpair(img,y,accent,wide=False):
    d=ImageDraw.Draw(img)
    x1,x2=(85,838) if not wide else (155,775)
    s=146 if not wide else 140
    for x,urlpic in [(x1,STOREQR),(x2,WAQR)]:
        d.rounded_rectangle((x-8,y-8,x+s+8,y+s+8),radius=19,fill='#ffffff',outline=accent,width=5)
        img.paste(urlpic.resize((s,s),Image.Resampling.NEAREST),(x,y))
    text(img,'الموقع الرسمي',x1+s/2,y+s+39,24)
    text(img,'واتساب الدعم',x2+s/2,y+s+39,24)
def lower(img):
    d=ImageDraw.Draw(img)
    d.line((70,1302,1010,1302),fill='#d7b9c2',width=2)
    text(img,'F90 CARD',145,1329,24)
    text(img,'+970568181910',900,1329,22)
items=[
  ('01-اشتراكات-المشاهدة.png','اشتراكات المشاهدة','استكشف الاشتراكات الرقمية','streaming.png','#130d28','#280a26','#b979f9',0),
  ('02-الذكاء-الاصطناعي.png','خدمات الذكاء الاصطناعي','تصفح أدواتك الرقمية','ai.png','#061b28','#0a2a37','#4de5e9',1),
  ('03-التواصل-الاجتماعي.png','عالم التواصل الاجتماعي','خدماتك في واجهة واحدة','social.png','#210a19','#370b23','#ff4f94',2),
  ('04-خدمات-الهاتف.png','خدمات الهاتف','اكتشف فئة أرصدة الجوال','mobile.png','#081b2a','#061f39','#59c4ff',3),
  ('05-طرق-الدفع.png','طرق الدفع المتاحة','راجع تعليمات الإيداع قبل التحويل','payments.png','#05291c','#13251f','#35cd83',4),
  ('06-الخدمات-الرقمية.png','أف تسعين كارد','خدمات رقمية منظمة','services.png','#240a18','#310b1d','#ff5676',5),
  ('07-جولة-المتجر.png','تصفح متجرك من الهاتف','واجهة حقيقية من المتجر','hero.png','#130e1e','#0c111b','#ff607a',6),
  ('08-اكتشف-الأقسام.png','أقسام متعددة','اختر الفئة التي تناسبك','games.png','#1f1027','#10172d','#bf8ff5',7),
]
def draw_one(entry):
    filename,title,sub,section,c1,c2,accent,v=entry
    im=gradient(c1,c2);decoration(im,v+200,accent)
    d=ImageDraw.Draw(im)
    if v==0:
        paste_logo(im,540,150,360)
        text(im,title,540,337,59)
        d.rounded_rectangle((125,393,955,491),radius=31,fill='#251836',outline=accent,width=3)
        text(im,sub,540,440,31)
        add_section(im,section,(74,537,1006,956),accent)
        qrpair(im,1027,accent)
    elif v==1:
        d.polygon(((0,0),(860,0),(250,710),(0,930)),fill='#083745')
        paste_logo(im,793,158,335)
        text(im,title,540,358,58)
        text(im,sub,540,446,35,accent)
        add_section(im,section,(74,560,1006,923),accent)
        d.line((120,983,955,983),fill=accent,width=4)
        qrpair(im,1030,accent)
    elif v==2:
        d.polygon(((0,0),(1080,0),(1080,510),(0,260)),fill='#4c102e')
        paste_logo(im,200,145,330)
        text(im,'خدمات التواصل',545,378,63)
        text(im,'على منصاتك المفضلة',545,470,39,accent)
        add_section(im,section,(60,565,1020,965),accent)
        qrpair(im,1046,accent)
    elif v==3:
        paste_logo(im,540,152,360)
        d.arc((32,260,1048,1000),155,335,fill=accent,width=11)
        text(im,title,540,351,70)
        text(im,sub,540,451,34,accent)
        add_section(im,section,(96,563,984,958),accent)
        qrpair(im,1042,accent)
    elif v==4:
        d.rounded_rectangle((50,48,1030,530),radius=50,fill='#0a3b29',outline=accent,width=4)
        paste_logo(im,540,165,345)
        text(im,title,540,350,63)
        text(im,sub,540,445,29,'#dcf8e8')
        add_section(im,section,(80,568,1000,933),accent)
        qrpair(im,1048,accent)
    elif v==5:
        d.polygon(((0,0),(1080,0),(1080,700),(0,450)),fill='#4b122b')
        paste_logo(im,540,181,410)
        text(im,title,540,393,77)
        text(im,sub,540,483,36,'#ffd9e0')
        add_section(im,section,(55,558,1025,945),accent)
        qrpair(im,1050,accent)
    elif v==6:
        paste_logo(im,540,145,335)
        text(im,title,540,344,59)
        text(im,sub,540,429,35,'#e2adbb')
        screenshot=B/'marketing'/'screenshots'/'homepage-mobile.png'
        mobile=Image.open(screenshot).convert('RGB')
        add_section(im,section,(66,530,544,766),accent)
        x,y,x2,y2=572,490,993,946
        photo=ImageOps.fit(mobile,(x2-x,y2-y),Image.Resampling.LANCZOS)
        mask=Image.new('L',(x2-x,y2-y));ImageDraw.Draw(mask).rounded_rectangle((0,0,x2-x-1,y2-y-1),radius=32,fill=255)
        im.paste(photo,(x,y),mask)
        d.rounded_rectangle((x,y,x2,y2),radius=32,outline=accent,width=7)
        text(im,'واجهة المتجر الفعلية',540,1006,31)
        qrpair(im,1072,accent)
    else:
        paste_logo(im,540,152,370)
        text(im,title,540,350,73)
        text(im,sub,540,449,35,accent)
        add_section(im,'services.png',(57,533,523,784),accent)
        add_section(im,'apps.png',(556,533,1023,784),accent)
        add_section(im,'cards.png',(57,819,523,1035),accent)
        add_section(im,'ai.png',(556,819,1023,1035),accent)
        qrpair(im,1050,accent)
    lower(im)
    im.save(O/filename,optimize=True)
    print(filename, (O/filename).stat().st_size,flush=True)
for entry in items:draw_one(entry)
