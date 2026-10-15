from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps
from pathlib import Path
import qrcode,random,math
BASE=Path(__file__).resolve().parent.parent
OUT=BASE/'marketing'/'exports'; OUT.mkdir(parents=True,exist_ok=True)
STORE='https://f90-card.github.io/f90-card-f90-card/index.html#/'
WHATSAPP='https://wa.me/970568181910'
FONT='/usr/share/fonts/truetype/noto/NotoKufiArabic-Regular.ttf'
BOLD='/usr/share/fonts/truetype/noto/NotoKufiArabic-Bold.ttf'
LATIN='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
if not Path(FONT).exists():FONT='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
if not Path(BOLD).exists():BOLD=FONT
def write(d,s,x,y,size=40,color='white',bold=True):
    eng=all(ord(c)<128 for c in s)
    font=ImageFont.truetype(LATIN if eng else BOLD if bold else FONT,size)
    d.text((int(x),int(y)),s,font=font,anchor='mm',fill=color,direction='ltr' if eng else 'rtl')
def bg(w,h,seed):
    im=Image.new('RGB',(w,h),'#08070c')
    v=Image.linear_gradient('L').resize((1,h)).resize((w,h))
    tint=Image.new('RGB',(w,h),'#2a0718')
    im=Image.composite(tint,im,v.point(lambda x: int(x*.66)))
    g=Image.new('RGBA',(w,h));d=ImageDraw.Draw(g)
    random.seed(seed)
    for i in range(22):
        x=random.randrange(10,w);y=random.randrange(10,h)
        d.line((x,y,x+random.randrange(-90,90),y+random.randrange(-220,220)),fill=(250,35,65,random.randrange(8,35)),width=2)
    for n in range(3):
        a=25+n*11
        d.rounded_rectangle((a,a,w-a,h-a),radius=28,outline=(245,32,66,90-20*n),width=2)
    im.paste(g,(0,0),g)
    return im
def logo(im,x,y,width):
    img=Image.open(BASE/'f90-logo.png').convert('RGBA')
    a=img.getchannel('A')
    box=a.point(lambda n:255 if n>18 else 0).getbbox()
    if box:img=img.crop(box)
    img.thumbnail((width,700),Image.Resampling.LANCZOS)
    im.paste(img,(int(x-img.width/2),int(y-img.height/2)),img)
def hero(im,box):
    img=Image.open(BASE/'assets'/'sections'/'hero.png').convert('RGB')
    x,y,x2,y2=box;w=x2-x;h=y2-y
    ratio=max(w/img.width,h/img.height)
    img=img.resize((math.ceil(img.width*ratio),math.ceil(img.height*ratio)),Image.Resampling.LANCZOS)
    sw,sh=img.size
    img=img.crop(((sw-w)//2,(sh-h)//2,(sw+w)//2,(sh+h)//2))
    mask=Image.new('L',(w,h));ImageDraw.Draw(mask).rounded_rectangle((0,0,w-1,h-1),radius=25,fill=255)
    im.paste(img,(x,y),mask)
    ImageDraw.Draw(im).rounded_rectangle(box,radius=25,outline='#f02f50',width=4)
def qr(im,url,x,y,size):
    code=qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_Q,border=4,box_size=12)
    code.add_data(url);code.make(fit=True)
    img=code.make_image(fill_color='black',back_color='white').convert('RGB').resize((size,size),Image.Resampling.NEAREST)
    d=ImageDraw.Draw(im);d.rounded_rectangle((x-10,y-10,x+size+10,y+size+10),radius=16,fill='white',outline='#f02f50',width=5)
    im.paste(img,(x,y))
def pill(d,label,x,y,w):
    d.rounded_rectangle((x,y,x+w,y+74),radius=32,fill='#b81632',outline='#ff7184',width=3)
    write(d,label,x+w/2,y+36,34)
def foot(im,y):
    d=ImageDraw.Draw(im);w=im.width
    d.line((70,y,w-70,y),fill='#a62140',width=3)
    write(d,'امسح الرمز وافتح المتجر',w*.28,y+41,27)
    write(d,'تواصل عبر واتساب',w*.73,y+41,27)
    qr(im,STORE,int(w*.28)-85,y+70,170)
    qr(im,WHATSAPP,int(w*.73)-85,y+70,170)
    write(d,'F90 CARD',w/2,y+284,30,'#ffffff')
    write(d,'+970568181910',w/2,y+322,27,'#ff9eae')
def post():
    im=bg(1080,1350,2);d=ImageDraw.Draw(im)
    logo(im,540,205,510)
    write(d,'كل خدماتك الرقمية',540,363,65)
    write(d,'في مكان واحد',540,442,61,'#ff5970')
    write(d,'شحن الألعاب   تطبيقات اللايف   البطاقات الرقمية',540,519,26,bold=False)
    hero(im,(86,570,994,860))
    pill(ImageDraw.Draw(im),'اكتشف خدمات المتجر',255,884,570)
    foot(im,987)
    im.save(OUT/'f90-launch-post-1080x1350.png',optimize=True)
def story():
    im=bg(1080,1920,9);d=ImageDraw.Draw(im)
    logo(im,540,320,670)
    write(d,'وجهتك لخدمات الشحن الرقمية',540,549,51)
    write(d,'متجر أف تسعين كارد',540,627,45,'#ff6073')
    hero(im,(66,750,1014,1125))
    for label,y in [('شحن الألعاب',1210),('شحن تطبيقات اللايف',1300),('البطاقات الرقمية',1390)]:
        d.rounded_rectangle((185,y-37,895,y+37),radius=23,fill='#160a12',outline='#b72542',width=3)
        write(d,label,540,y,32)
    pill(d,'تصفح المتجر الآن',285,1490,510)
    foot(im,1597)
    im.save(OUT/'f90-story-1080x1920.png',optimize=True)
def square():
    im=bg(1080,1080,4);d=ImageDraw.Draw(im)
    logo(im,540,180,440)
    write(d,'الألعاب والتطبيقات',540,325,58)
    write(d,'والبطاقات الرقمية',540,401,49,'#ff536b')
    hero(im,(78,455,1002,730))
    d.rounded_rectangle((80,776,1000,1016),radius=24,fill='#100b12',outline='#bf2a48',width=3)
    qr(im,STORE,119,814,153);qr(im,WHATSAPP,808,814,153)
    write(d,'افتح المتجر',415,862,30)
    write(d,'تواصل واتساب',663,862,30)
    write(d,'+970568181910',540,950,26,'#ff9daa')
    im.save(OUT/'f90-square-1080x1080.png',optimize=True)
post();story();square()
print('F90 posters ready: 3')
