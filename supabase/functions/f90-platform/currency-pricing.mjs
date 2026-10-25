// Independent native-currency prices. Thresholds are inclusive and apply to the
// entire order quantity; a blank currency inherits its previous/base price.
export function nativePrice(pricing, currency, quantity) {
  let price = Number(pricing?.prices?.[currency]) || null;
  if (pricing?.tiers_enabled === true) {
    for (const tier of [...(pricing.tiers || [])].sort((a,b)=>a.min-b.min)) {
      if (quantity >= tier.min && Number(tier.prices?.[currency]) > 0)
        price = Number(tier.prices[currency]);
    }
  }
  return price;
}

export function cleanCurrencyPricing(raw, fallbackUnit = 1) {
  const fail = (message) => { throw new Error(message); };
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  if (!object(raw)) fail('إعدادات أسعار العملات غير صحيحة');
  for (const key of ['enabled','tiers_enabled'])
    if (raw[key] != null && typeof raw[key] !== 'boolean') fail('حالة تفعيل الأسعار غير صحيحة');
  const unit = Number(raw.unit_quantity ?? fallbackUnit);
  if (!Number.isSafeInteger(unit) || unit < 1 || unit > 1000000000) fail('كمية وحدة التسعير غير صحيحة');
  const prices = value => {
    if (!object(value)) fail('أسعار العملات غير صحيحة');
    const result = {};
    for (const [code,value0] of Object.entries(value)) {
      const value = Number(value0);
      if (!/^[A-Z]{3,8}$/.test(code) || typeof value0 === 'boolean' || value0 == null || !Number.isFinite(value) || value < .000001 || value > 1000000000 || Math.abs(value*1e6-Math.round(value*1e6)) > .00001)
        fail('أدخل سعرًا موجبًا صحيحًا بحد أقصى ست منازل عشرية');
      result[code] = value;
    }
    return result;
  };
  const base = prices(raw.prices || {});
  if (raw.tiers != null && !Array.isArray(raw.tiers)) fail('شرائح الكمية غير صحيحة');
  if ((raw.tiers || []).length > 40) fail('الحد الأقصى أربعون شريحة لكل خدمة');
  const tiers = (raw.tiers || []).map(tier => {
    if (!object(tier)) fail('الشريحة غير صحيحة');
    const min = Number(tier.min);
    if (!Number.isSafeInteger(min) || min < 1 || min > 1000000000) fail('بداية الشريحة يجب أن تكون كمية صحيحة موجبة');
    const result = {min,prices:prices(tier.prices || {})};
    if (!Object.keys(result.prices).length) fail('أدخل سعرًا لعملة واحدة على الأقل في كل شريحة');
    return result;
  }).sort((a,b)=>a.min-b.min);
  for (let i=1;i<tiers.length;i++) if(tiers[i].min===tiers[i-1].min) fail('بدايات شرائح الكمية متكررة');
  if(raw.tiers_enabled === true && !tiers.length) fail('أضف شريحة واحدة على الأقل أو أوقف تسعير الشرائح');
  if(raw.enabled === true && !Object.keys(base).length && !(raw.tiers_enabled === true && tiers.length)) fail('أدخل سعرًا مستقلًا أو شريحة مفعّلة لعملة واحدة على الأقل');
  return {enabled:raw.enabled===true,unit_quantity:unit,prices:base,tiers_enabled:raw.tiers_enabled===true,tiers};
}
