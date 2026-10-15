from pathlib import Path
from playwright.sync_api import sync_playwright
import time
root=Path(__file__).resolve().parent
out=root/'screenshots'
out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=2,locale='ar-PS',timezone_id='Asia/Hebron',is_mobile=True,has_touch=True)
    page.goto('https://f90-card.github.io/f90-card-f90-card/index.html#/',wait_until='domcontentloaded',timeout=60000)
    page.wait_for_timeout(6500)
    try:
        page.get_by_text('متابعة التصفح',exact=True).click(timeout=5000)
        page.wait_for_timeout(6500)
    except Exception as e:
        print('MODAL_NOT_FOUND',str(e)[:160])
    print('TITLE',page.title(),'URL',page.url,'BODY',page.locator('body').inner_text()[:1000])
    page.screenshot(path=str(out/'homepage-mobile.png'),full_page=False,animations='disabled')
    for label,scroll in [('categories-mobile',1120),('products-mobile',2050)]:
        page.evaluate('(scroll)=>window.scrollTo(0,scroll)',scroll)
        page.wait_for_timeout(2200)
        page.screenshot(path=str(out/(label+'.png')),full_page=False,animations='disabled')
    browser.close()

# Re-run capture after CI upload workflow correction
