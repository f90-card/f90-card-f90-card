from pathlib import Path
from PIL import Image,ImageOps,ImageDraw,ImageFont
import qrcode,math,random
B=Path(__file__).resolve().parent.parent
O=B/'marketing'/'november';O.mkdir(parents=True,exist_ok=True)
LOGO=Image.open(B/'f90-logo.png').convert('RGBA')
bounds=LOGO.getchannel('A').point(lambda v:255 if v>20 else 0).getbbox()
if bounds:LOGO=LOGO.crop(bounds)
F='/usr/share/fonts/truetype/noto/NotoKufiArabic-Bold.ttf'
R='/usr/share/fonts/truetype/noto/NotoKufiArabic-Regular.ttf'
EN='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
S=Image.open(B/'marketing'/'screenshots'/'homepage-mobile.png').convert('RGB')
C=Image.open(B/'marketing'/'screenshots'/'categories-mobile.png').convert('RGB')
SITE='https://f90-card.github.io/f90-card-f90-card/index.html#/'
WA='https://wa.me/970568181910'
W,H=1080,1350
TOPICS=[
('01-تجربة-التصفح','جولة داخل المتجر','واجهة F90 CARD الفعلية','hero.png','#f02f53','#080910',0),
('02-أقسام-المتجر','تصفح أقسامنا','خدمات رقمية في مكان واحد','services.png','#fc5472','#17111c',1),
('03-متابعة-الطلب','تابع طلباتك','من داخل حسابك','services.png','#ff4d6b','#0a1118',2),
('04-طرق-الدفع','اختر طريقة الدفع','راجع تفاصيل الإيداع','payments.png','#37da96','#081e17',3),
('05-الاستفسارات','دعم واتساب','تواصل مع فريقنا','social.png','#39d78d','#071910',4),
('06-تثبيت-التطبيق','تثبيت المتجر','وصول مباشر من هاتفك','hero.png','#fe7191','#1b0a16',0),
('07-الاشتراكات','عالم المشاهدة','تصفح اشتراكات المشاهدة','streaming.png','#c38df8','#140d2c',1),
('08-البطاقات','بطاقات رقمية','تعرف على خيارات البطاقات','cards.png','#f2c076','#23170e',2),
('09-خدمات-التطبيقات','تطبيقات اللايف','استكشف خدمات التطبيقات','apps.png','#8b9fff','#090d2e',3),
('10-خيارات-رقمية','دليلك الرقمي','الألعاب والتطبيقات والبطاقات','ai.png','#f04465','#17101a',4)
]
def colhex(x):
 h=x.lstrip('#');return tuple(int(h[i:i+2],16) for i in (0,2,4))
def background(accent,dark,num):
 a=colhex(accent);b=colhex(dark);im=Image.new('RGB',(W,H));d=ImageDraw.Draw(im)
 for y in range(H):
  p=y/H;d.line((0,y,W,y),fill=tuple(round(b[i]*(1-p)+a[i]*.18*p) for i in range(3)))
 random.seed(num+333)
 for j in range(22):
  x=random.randrange(W);y=random.randrange(H)
  d.line((x,y,x+random.randint(-130,130),y+random.randint(-160,200)),fill=tuple(round(t*.20) for t in a),width=random.choice((1,2,3)))
 return im
def txt(im,s,x,y,size=40,c='#ffffff',bold=True):
 font=ImageFont.truetype(EN if all(ord(k)<128 for k in s) else F if bold else R,size)
 ImageDraw.Draw(im).text((int(x),int(y)),s,font=font,anchor='mm',direction='ltr' if all(ord(k)<128 for k in s) else 'rtl',fill=c)
def identity(im,x=540,y=145,w=360):
 a=LOGO.copy();a.thumbnail((w,380),Image.Resampling.LANCZOS)
 im.paste(a,(round(x-a.width/2),round(y-a.height/2)),a)
def card(im,name,rect,edge,source=None):
 x,y,x2,y2=map(int,rect);w=x2-x;h=y2-y
 a=Image.open(B/'assets'/'sections'/name).convert('RGB') if source is None else source
 a=ImageOps.fit(a,(w,h),Image.Resampling.LANCZOS)
 m=Image.new('L',(w,h));ImageDraw.Draw(m).rounded_rectangle((0,0,w-1,h-1),radius=24,fill=255)
 im.paste(a,(x,y),m)
 ImageDraw.Draw(im).rounded_rectangle(rect,radius=24,outline=edge,width=5)
def qr(link):
 a=qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_Q,border=4,box_size=10);a.add_data(link);a.make(fit=True)
 return a.make_image(fill_color='#090909',back_color='white').convert('RGB').resize((142,142),Image.Resampling.NEAREST)
QS=qr(SITE);QW=qr(WA)
def bottom(im,accent):
 d=ImageDraw.Draw(im)
 d.rounded_rectangle((57,1050,1023,1290),radius=23,fill='#17121d',outline=accent,width=3)
 for x,bmp,label in [(103,QS,'الموقع الرسمي'),(826,QW,'واتساب الدعم')]:
  d.rounded_rectangle((x-7,1090,x+149,1240),radius=15,fill='#ffffff',outline=accent,width=4)
  im.paste(bmp,(x,1094));txt(im,label,x+71,1262,22)
 txt(im,'F90 CARD',540,1137,34)
 txt(im,'+970568181910',540,1202,27,'#f7adbd')
def poster(topic,index):
 fn,title,subtitle,section,accent,dark,style=topic
 im=background(accent,dark,index)
 d=ImageDraw.Draw(im)
 if style==0:
  identity(im,540,142,355)
  txt(im,title,540,347,63)
  txt(im,subtitle,540,433,30,accent)
  d.polygon([(0,496),(1080,461),(1080,1028),(0,1037)],fill='#260e1c')
  card(im,section,(64,534,528,786),accent)
  card(im,section,(562,649,1023,926),accent,source=S)
 elif style==1:
  d.rounded_rectangle((35,38,1045,442),radius=48,fill='#2e1224',outline=accent,width=4)
  identity(im,540,158,360)
  txt(im,title,540,338,70)
  txt(im,subtitle,540,457,32,accent)
  card(im,section,(55,549,1025,970),accent)
  d.arc((70,635,1010,1170),200,345,fill=accent,width=10)
 elif style==2:
  identity(im,790,136,320)
  txt(im,title,540,333,74)
  txt(im,subtitle,540,425,36,accent)
  card(im,section,(80,551,1000,841),accent)
  for j,word in enumerate(['استكشف','اختر','تابع']):
   x=90+j*327
   d.rounded_rectangle((x,892,x+282,997),radius=29,fill='#281724',outline=accent,width=3)
   txt(im,word,x+141,941,34)
 elif style==3:
  d.polygon([(0,0),(1080,0),(1080,548),(0,688)],fill='#0f2e31')
  identity(im,540,149,340)
  txt(im,title,540,352,65)
  txt(im,subtitle,540,444,33,'#c6ffec')
  card(im,section,(80,544,1000,928),accent)
  d.rounded_rectangle((199,965,881,1013),radius=25,fill='#095d4e')
  txt(im,'F90 CARD',540,988,25)
 else:
  identity(im,540,146,370)
  txt(im,title,540,334,68)
  txt(im,subtitle,540,427,35,accent)
  card(im,section,(59,558,1021,953),accent)
  d.arc((85,524,998,1040),10,100,fill=accent,width=10)
 bottom(im,accent)
 im.save(O/fn+'.png',optimize=True)
 print(fn,(O/(fn+'.png')).stat().st_size,flush=True)
for i,t in enumerate(TOPICS):poster(t,i)
