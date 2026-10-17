from pathlib import Path
from playwright.sync_api import sync_playwright
import json
url="https://f90card.online/index.html#/"
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={"width":390,"height":844},device_scale_factor=1,locale="ar-PS",is_mobile=True,has_touch=True)
 errors=[]
 page.on("pageerror",lambda e: errors.append(str(e)))
 page.goto(url,wait_until="domcontentloaded",timeout=60000)
 page.wait_for_function("document.documentElement.dataset.f90Ready==='1'",timeout=35000)
 # The guest account bubble intentionally contains a user icon; signed-in accounts may show an avatar.
 assert page.locator("#mobileDock").count()==1
 assert page.locator('.f90-profile-dock-emblem').count()==1,"Profile bubble missing"
 assert page.locator('.f90-profile-dock-emblem svg,.f90-profile-dock-emblem img').count()==1,"Profile bubble icon missing"
 assert page.locator("#mainContent").count()==1
 fixed_before=page.evaluate("""() => {
   const ids=["f90ThemeBackdrop","f90MediaDock","mobileDock"];
   return Object.fromEntries(ids.map(id=>{
     const el=document.getElementById(id);
     if(!el || getComputedStyle(el).display==="none")return [id,null];
     const b=el.getBoundingClientRect();
     return [id,{top:b.top,bottom:b.bottom,left:b.left}];
   }));
 }""")
 page.evaluate("window.scrollTo({top:760,behavior:'instant'})")
 page.wait_for_timeout(200)
 fixed_after=page.evaluate("""() => {
   const ids=["f90ThemeBackdrop","f90MediaDock","mobileDock"];
   return Object.fromEntries(ids.map(id=>{
     const el=document.getElementById(id);
     if(!el || getComputedStyle(el).display==="none")return [id,null];
     const b=el.getBoundingClientRect();
     return [id,{top:b.top,bottom:b.bottom,left:b.left}];
   }));
 }""")
 for name in fixed_before:
   a=fixed_before[name];b=fixed_after[name]
   if a is not None and b is not None:
     assert abs(a["top"]-b["top"])<5,(name,"moved vertically",a,b)
     assert abs(a["left"]-b["left"])<5,(name,"moved horizontally",a,b)
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
 # Exercise real touch/click navigation on the connected custom domain.
 # A first-time visitor must never be trapped behind the promotional modal.
 for selector in (".f90-welcome-skip", ".f90-welcome-enter"):
   page.goto("https://f90card.online/index.html#/welcome",wait_until="domcontentloaded",timeout=60000)
   page.locator(selector).wait_for(state="visible",timeout=20000)
   page.locator(selector).click(timeout=10000)
   page.wait_for_function("location.hash==='#/'",timeout=20000)
   page.wait_for_function("document.querySelector('#mainContent')?.dataset.page==='home'",timeout=20000)
   assert page.locator('#modalRoot .modal').count()==0,selector+" trapped by announcement"
 # Read-only smoke tests for the official branded auth and admin routes.
 page.goto("https://www.f90card.online/#/auth",wait_until="domcontentloaded",timeout=60000)
 page.wait_for_function("document.documentElement.dataset.f90Ready==='1'",timeout=35000)
 page.locator('button[data-action="google"]').wait_for(state="visible",timeout=20000)
 page.locator('button[data-action="auth-tab"][data-mode="forgot"]').click(timeout=10000)
 page.locator('form#authForm[data-mode="forgot"]').wait_for(state="visible",timeout=10000)
 assert page.locator('button[type="submit"]').filter(has_text="أرسل رابط الاستعادة").count()>=1
 # Don't submit credentials or send a real reset email in CI.
 page.goto("https://www.f90card.online/admin.html#/media-center",wait_until="domcontentloaded",timeout=60000)
 page.locator('#adminAuth').wait_for(state="visible",timeout=35000)
 assert page.locator('#adminMain').count() == 1
 assert not errors,("Browser JavaScript errors",errors[:5])
 page.screenshot(path="/tmp/f90-navigation-postfix.png")
 print(json.dumps({"route":"passed","profile_bubble":True,"homepage_scroll":before,"new_route_scroll":forward,"returned_scroll":returned,"js_errors":errors[:5],"floating_before":fixed_before,"floating_after":fixed_after},ensure_ascii=False))
 browser.close()
