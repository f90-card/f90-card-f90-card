// Read-only detail endpoint used by Shihab's own public storefront.
export function supplierPlainText(html) {
  return String(html || "").replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi," ")
    .replace(/<[^>]*>/g," ").replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/gi,"&")
    .replace(/&#(\d+);/g,(_,n)=>Number(n)<=0x10ffff?String.fromCodePoint(Number(n)):" ")
    .replace(/\s+/g," ").trim().slice(0,12000);
}
export function supplierDetailEvidence(product) {
  const id=String(product?.id??"");
  if(!/^\d{1,100}$/.test(id))throw new Error("Supplier detail ID missing");
  const description=supplierPlainText(product.description);
  const hint=supplierPlainText(product.hint);
  const normalized=(description+". "+hint).replace(/[\u064b-\u065f\u0670]/g,"").replace(/[أإآ]/g,"ا")
    .replace(/دقايق/g,"دقائق").replace(/دقيقه/g,"دقيقة").replace(/ساعه/g,"ساعة").replace(/ثانيه/g,"ثانية");
  const manual=normalized.match(/(?:يعمل|تعمل|تنفيذ|التنفيذ|الشحن|شحن|المنتج|الطلب)[^.!؟\n]{0,55}(?:يدوي|يدويا)/i);
  const automatic=normalized.match(/(?:يعمل|تعمل|تنفيذ|التنفيذ|الشحن|شحن|المنتج|الطلب)[^.!؟\n]{0,55}(?:تلقائي|تلقائيا|اوتوماتيك|اتوماتيك)/i);
  const negative=/(?:غير|ليس|ليست|لا يتم)[^.!؟]{0,12}(?:يدوي|تلقائي|اوتوماتيك|اتوماتيك)/.test(normalized);
  const mode=!negative && !!manual!==!!automatic ? (manual?"manual":"automatic"):null;
  const durations=[];
  const units={"ثانية":1/60,"ثواني":1/60,"ثوان":1/60,"دقيقة":1,"دقائق":1,"ساعة":60,"ساعات":60};
  const ranges=/(?:من\s*)?(\d{1,5}|دقيقة|ساعة|ثانية)\s*(ثانية|ثواني|ثوان|دقيقة|دقائق|ساعة|ساعات)?\s*(?:الى|الي|حتى|[-–])\s*(\d{1,5})\s*(ثانية|ثواني|ثوان|دقيقة|دقائق|ساعة|ساعات)/g;
  for(const match of normalized.matchAll(ranges)){
    const context=normalized.slice(Math.max(0,match.index-80),match.index+match[0].length+80);
    if(!/(?:مدة التنفيذ|مده التنفيذ|يصل طلبك|تنفيذ الطلب|معالجة الطلب|وقت التنفيذ)/.test(context))continue;
    const min=(units[match[1]]||Number(match[1])*units[match[2]||match[4]]),max=Number(match[3])*units[match[4]];
    if(min>0&&max>=min&&max<=10080)durations.push({text:match[0],min_minutes:min,max_minutes:max});
  }
  const single=/تنفيذ\s+(?:هذا\s+)?(?:الطلب|المنتج)\s+خلال\s+(\d{1,5})\s*(ثانية|ثواني|ثوان|دقيقة|دقائق|ساعة|ساعات)/g;
  for(const match of normalized.matchAll(single)){
    const max=Number(match[1])*units[match[2]];
    if(max>0&&max<=10080)durations.push({text:`خلال ${match[1]} ${match[2]}`,min_minutes:null,max_minutes:max});
  }
  const distinct=[...new Map(durations.map(d=>[`${d.min_minutes}:${d.max_minutes}`,d])).values()];
  const delivery=distinct.length===1?distinct[0]:null;
  return {id,mode,evidence:mode?{mode,source:"supplier_product_description",quote:(manual||automatic)[0].slice(0,160),
    url:`https://api.shihabcard.com/api/client/product/get/${id}?lang=ar`}:null,
    delivery,source:{id:product.id,description,hint}};
}
export async function fetchSupplierDetail(id,fetcher=fetch) {
  if(!/^\d{1,100}$/.test(String(id)))throw new Error("Invalid supplier detail ID");
  const response=await fetcher(`https://api.shihabcard.com/api/client/product/get/${id}?lang=ar`,{
    method:"GET",headers:{Accept:"application/json"},redirect:"error",signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error("Supplier details unavailable");
  const raw=await response.text();if(raw.length>100000)throw new Error("Supplier details too large");
  const payload=JSON.parse(raw);if(payload.status!=="OK"||String(payload.data?.id)!==String(id))
    throw new Error("Supplier detail ID mismatch");
  return supplierDetailEvidence(payload.data);
}
