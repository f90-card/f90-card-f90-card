const BASE='https://api.brand-one-card.com';
const key=name=>String(name||'').replace(/\bAPI\b/gi,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function productPresentation(supplier, storefront) {
  if(!Array.isArray(supplier)||!Array.isArray(storefront))throw Error('Invalid supplier presentation list');
  const exact=new Map(),aliases=new Map(),positions=new Map();
  for(const source of storefront){
    const order=positions.get(source.category)||0;positions.set(source.category,order+1);
    const row={...source,_sourceOrder:order};
    const title=String(row.title||'');
    exact.set(title,[...(exact.get(title)||[]),row]);
    if(key(title))aliases.set(key(title),[...(aliases.get(key(title))||[]),row]);
  }
  const result=[],missing=[];
  for(const raw of supplier){
    let rows=exact.get(raw.name)||[];
    if(!rows.length && /\bAPI\b/i.test(raw.name||''))rows=aliases.get(key(raw.name))||[];
    if(!rows.length || new Set(rows.map(r=>r.imageUrl||'')).size>1){missing.push(String(raw.id));continue;}
    const row=rows[0];
    const image=row.imageUrl?new URL(row.imageUrl,BASE).href:raw.category_img;
    if(!image?.startsWith(BASE+'/uploads/')){missing.push(String(raw.id));continue;}
    result.push({source_id:String(raw.id),title:row.title,image_url:image,image_source:row.imageUrl?'product':'category',public_id:row.id,category_slug:row.category,image_tile:row.imageTile||{},description:row.description||'',sort_order:row._sourceOrder});
  }
  return {products:result,missing};
}
