from pathlib import Path
from playwright.sync_api import sync_playwright
import json
url="https://f90-card.github.io/f90-card-f90-card/index.html#/"
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={"width":390,"height":844},device_scale_factor=1,locale="ar-PS",is_mobile=True,has_touch=True)
 errors=[]
 page.on("pageerror",lambda e: errors.append(str(e)))
 page.goto(url,wait_until="domcontentloaded",timeout=60000)
 page.wait_for_timeout(9000)
 # The real store must show its branded mobile bar on all routes.
 assert page.locator("#mobileDock").count()==1
 assert page.locator('.f90-profile-dock-emblem img').count()==1,"Profile bubble logo missing"
 assert page.locator("#mainContent").count()==1
 page.evaluate("window.scrollTo({top:760,behavior:'instant'})")
 page.wait_for_timeout(200)
 before=page.evaluate("window.scrollY")
 assert before>=240,("Homepage not scrollable",before)
 page.evaluate("""() => {
    const a=document.createElement("a");
    a.href="#/search";a.textContent="بحث";document.body.append(a);a.click();a.remove();
 }""")
 page.wait_for_function("location.hash==='#/search'",timeout=10000)
 page.wait_for_timeout(1600)
 assert page.locator("#mainContent").get_attribute("data-page")=="search","Search route missing"
 forward=page.evaluate("window.scrollY")
 assert forward<150,("New route not reset to top",forward)
 page.go_back(wait_until="domcontentloaded",timeout=12000)
 page.wait_for_timeout(1800)
 returned=page.evaluate("window.scrollY")
 assert page.evaluate("location.hash==='#/'"),"Back did not return home"
 assert abs(returned-before)<180,("Back scroll did not restore",before,returned)
 page.screenshot(path="/tmp/f90-navigation-postfix.png")
 print(json.dumps({"route":"passed","profile_bubble":True,"homepage_scroll":before,"new_route_scroll":forward,"returned_scroll":returned,"js_errors":errors[:5]},ensure_ascii=False))
 browser.close()
