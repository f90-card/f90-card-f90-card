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
    page.wait_for_timeout(14000)
    print('TITLE',page.title(),'URL',page.url,'BODY',page.locator('body').inner_text()[:1000])
    page.screenshot(path=str(out/'homepage-mobile.png'),full_page=False,animations='disabled')
    browser.close()
