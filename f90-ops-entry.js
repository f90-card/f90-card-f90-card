(function(){"use strict";async function start(){const root=document.getElementById("f90OpsCenter");if(!root)return;
try{const session=await window.F90API?.client?.auth?.getSession();if(!session?.data?.session){root.innerHTML='<p class="notice">سجّل الدخول من لوحة الإدارة أولًا. <a href="./admin.html">فتح الإدارة</a></p>';return;}
const r=await window.F90API.call("me");if(r?.role!=="manager"){root.innerHTML='<p class="notice">هذه الأدوات مخصصة للمدير المخوّل فقط.</p>';return;}
window.F90OpsCenter.render("f90OpsCenter");
}catch(e){root.textContent="تعذّر التحقق من جلسة الإدارة. افتح لوحة الإدارة وحاول مجددًا.";}}
document.addEventListener("DOMContentLoaded",start);
})();