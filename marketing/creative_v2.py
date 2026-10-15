from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageFilter,ImageOps
import math,random,qrcode
B=Path(__file__).resolve().parent.parent
O=B/'marketing'/'creative-v2';O.mkdir(parents=True,exist_ok=True)
SITE='https://f90-card.github.io/f90-card-f90-card/index.html#/'
WA='https://wa.me/970568181910'
FA='/usr/share/fonts/truetype/noto/NotoKufiArabic-Bold.ttf'
FM='/usr/share/fonts/truetype/noto/NotoKufiArabic-Regular.ttf'
FE='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
LOGO=Image.open(B/'f90-logo.png').convert('RGBA')
bb=LOGO.getchannel('A').point(lambda v:255 if v>28 else 0).getbbox()
if bb:LOGO=LOGO.crop(bb)
W=1080;H=1350
shot=B/'marketing'/'screenshots'/'homepage-mobile.png'
SCREEN=Image.open(shot).convert('RGB')
def f(n,bold=True,en=False):return ImageFont.truetype(FE if en else FA if bold else FM,n)
def t(im,s,x,y,z=44,c='#ffffff',anchor='mm',b=True):
    en=all(ord(ch)<128 for ch in s)
    ImageDraw.Draw(im).text((int(x),int(y)),s,font=f(z,b,en),fill=c,anchor=anchor,direction='ltr' if en else 'rtl')
def logo(im,x,y,w):
    a=LOGO.copy();a.thumbnail((w,w),Image.Resampling.LANCZOS);im.paste(a,(int(x-a.width/2),int(y-a.height/2)),a)
def base(c1,c2):
    im=Image.new('RGB',(W,H));d=ImageDraw.Draw(im)
    for y in range(H):
        p=y/H;d.line((0,y,W,y),fill=tuple(round((1-p)*c1[j]+p*c2[j]) for j in range(3)))
    return im
def glow(im,x,y,r,col):
    lay=Image.new('RGBA',(W,H));ImageDraw.Draw(lay).ellipse((x-r,y-r,x+r,y+r),fill=(*col,175))
    lay=lay.filter(ImageFilter.GaussianBlur(140));im.paste(lay,(0,0),lay)
def src(name):
    p=B/'assets'/'sections'/name
    return Image.open(p if p.exists() else B/'assets'/'sections'/'hero.png').convert('RGB')
def image_card(im,photo,coords,edge='#ff4064',rad=22):
    x,y,x2,y2=map(int,coords);w=x2-x;h=y2-y
    a=ImageOps.fit(photo,(w,h),Image.Resampling.LANCZOS)
    m=Image.new('L',(w,h));ImageDraw.Draw(m).rounded_rectangle((0,0,w-1,h-1),radius=rad,fill=255)
    im.paste(a,(x,y),m);ImageDraw.Draw(im).rounded_rectangle(coords,radius=rad,outline=edge,width=5)
def scan(im,url,x,y,z,edge='#fc3957'):
    q=qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_H,box_size=12,border=4);q.add_data(url);q.make(fit=True)
    a=q.make_image(fill_color='black',back_color='white').convert('RGB').resize((z,z),Image.Resampling.NEAREST)
    ImageDraw.Draw(im).rounded_rectangle((x-11,y-11,x+z+11,y+z+11),radius=14,fill='#ffffff',outline=edge,width=6)
    im.paste(a,(x,y))
def footer(im,bg='#ef3557'):
    d=ImageDraw.Draw(im);d.line((72,1285,1008,1285),fill=bg,width=3)
    t(im,'F90 CARD',75,1320,24,anchor='lm');t(im,'+970568181910',1005,1320,24,anchor='rm')
def brand_phone(im,x,y,width,height,rot=0):
    p=ImageOps.fit(SCREEN,(width-32,height-38),Image.Resampling.LANCZOS)
    phone=Image.new('RGBA',(width,height))
    d=ImageDraw.Draw(phone)
    d.rounded_rectangle((1,1,width-2,height-2),radius=55,fill='#12141e',outline='#ff4667',width=12)
    mask=Image.new('L',p.size);ImageDraw.Draw(mask).rounded_rectangle((0,0,p.width-1,p.height-1),radius=40,fill=255)
    phone.paste(p,(16,19),mask)
    phone=phone.rotate(rot,expand=True,resample=Image.Resampling.BICUBIC)
    im.paste(phone,(x,y),phone)
def p1():
    im=base((7,10,19),(48,6,22));glow(im,850,610,420,(239,25,52));d=ImageDraw.Draw(im)
    for k in range(11):d.line((550+k*68,0,310+k*68,1340),fill='#391021',width=3)
    logo(im,220,142,330)
    for s,y,z,c in [('متجرك الرقمي',385,64,'white'),('صار أقرب إليك',488,61,'#ff4a6e'),('شحن الألعاب والتطبيقات',652,31,'#ffcad1'),('والبطاقات الرقمية',703,31,'#ffcad1')]:t(im,s,57,y,z,c,anchor='lm')
    brand_phone(im,556,258,382,720,12)
    d.rounded_rectangle((70,895,460,990),radius=29,fill='#e91948')
    t(im,'اكتشف المتجر',265,941,32)
    scan(im,SITE,763,1040,155);t(im,'امسح رمز الموقع',839,1234,22)
    t(im,'واتساب للدعم',75,1093,29,'#a5f5c6',anchor='lm');footer(im)
    im.save(O/'01-متجرك-الرقمي.png',optimize=True)
def p2():
    im=base((33,8,15),(10,10,18));glow(im,510,555,540,(255,75,24));d=ImageDraw.Draw(im)
    d.polygon([(0,0),(1080,0),(1080,300),(0,810)],fill='#2d0c17')
    logo(im,815,140,340)
    t(im,'عالم الألعاب',80,306,80,anchor='lm');t(im,'بين يديك',80,413,62,'#ff7654',anchor='lm')
    image_card(im,src('games.png'),(52,527,1028,955),edge='#ff5f43',rad=20)
    d.rounded_rectangle((60,1010,585,1128),radius=23,fill='#100a0d',outline='#fa563f',width=4)
    t(im,'تصفح قسم الألعاب',322,1065,34)
    scan(im,SITE,760,1040,155,edge='#ff7851');t(im,'المتجر',839,1239,26)
    footer(im,'#f85439');im.save(O/'02-عالم-الألعاب.png',optimize=True)
def p3():
    im=base((5,19,32),(28,10,48));glow(im,820,550,560,(115,42,252));d=ImageDraw.Draw(im)
    d.polygon([(0,0),(540,0),(0,900)],fill='#0a2636')
    logo(im,540,157,325)
    t(im,'تطبيقات اللايف',540,355,77)
    t(im,'خدمات رقمية بتصميم مختلف',540,458,30,'#92e8ec')
    image_card(im,src('apps.png'),(70,530,1010,979),'#69d7ed')
    d.rounded_rectangle((87,1034,989,1240),radius=27,fill='#16132c',outline='#8164f6',width=3)
    scan(im,SITE,130,1075,122,'#61dfe6');scan(im,WA,829,1075,122,'#a28ffb')
    t(im,'تصفح المتجر',460,1108,30);t(im,'واختر خدمتك',460,1172,30,'#b7f5ff')
    im.save(O/'03-تطبيقات-اللايف.png',optimize=True)
def p4():
    im=base((19,15,12),(39,28,12));glow(im,480,550,570,(191,133,38));d=ImageDraw.Draw(im)
    for k in range(10):d.line((0,k*140,1080,180+k*140),fill='#52402a',width=2)
    logo(im,535,137,375)
    d.polygon([(40,265),(1040,217),(1040,407),(40,457)],fill='#4b351c')
    t(im,'البطاقات الرقمية',540,347,71,'#ffe4ad')
    image_card(im,src('cards.png'),(57,528,1020,963),'#d8ae63')
    d.rounded_rectangle((74,1020,1006,1238),radius=24,fill='#14100b',outline='#d1a55a',width=3)
    scan(im,SITE,117,1056,150,'#c99d51');scan(im,WA,813,1056,150,'#c99d51')
    t(im,'ادخل المتجر',537,1097,31,'#f8dfaa');t(im,'وتابع خدماتنا',537,1162,30,'#d9bc89')
    im.save(O/'04-البطاقات-الرقمية.png',optimize=True)
def p5():
    im=base((247,244,240),(220,219,216));d=ImageDraw.Draw(im)
    d.polygon([(0,0),(1080,0),(1080,478),(0,670)],fill='#111421')
    logo(im,540,145,350)
    t(im,'طريقة الطلب من متجرنا',540,391,44)
    image_card(im,SCREEN,(55,510,455,1175),'#1c2637',rad=28)
    for n,(title,y) in enumerate([('تصفح الأقسام',604),('اختر الخدمة',798),('تابع طلبك',992)],1):
        d.rounded_rectangle((510,y,1020,y+160),radius=25,fill='#ffffff',outline='#c8c4c0',width=3)
        d.ellipse((533,y+42,619,y+128),fill='#f52a50');t(im,str(n).zfill(2),576,y+85,26)
        t(im,title,820,y+84,32,'#181c2b')
    scan(im,SITE,101,1180,116);d.rounded_rectangle((517,1197,1025,1301),radius=27,fill='#d41e48')
    t(im,'ابدأ من المتجر',771,1249,33)
    im.save(O/'05-كيف-تبدأ.png',optimize=True)
def p6():
    im=base((4,25,20),(6,47,32));glow(im,570,640,520,(19,201,105));d=ImageDraw.Draw(im)
    logo(im,540,148,390)
    t(im,'تواصل معنا',540,389,77)
    t(im,'مباشرة عبر واتساب',540,473,42,'#adfbd0')
    d.ellipse((385,550,695,860),fill='#0cce72',outline='#b7ffd7',width=9)
    d.arc((445,610,635,805),33,322,fill='#f5fff9',width=31)
    d.polygon([(454,784),(419,848),(501,816)],fill='white')
    d.rounded_rectangle((73,940,1007,1203),radius=29,fill='#08271b',outline='#27c981',width=3)
    scan(im,WA,110,990,161,'#2ac977')
    t(im,'امسح رمز واتساب',638,1016,34)
    t(im,'وتواصل مع فريق الدعم',639,1092,29,'#c2f9d7')
    t(im,'+970568181910',630,1162,28)
    t(im,'F90 CARD',540,1297,27)
    im.save(O/'06-تواصل-واتساب.png',optimize=True)
for fn in [p1,p2,p3,p4,p5,p6]:fn()
print('CREATED',len(list(O.glob('*.png'))),'unique layouts')
