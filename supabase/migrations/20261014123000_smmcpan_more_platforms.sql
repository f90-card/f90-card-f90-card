-- Additional platforms actually present in the SMMCPAN catalog.
insert into public.categories(name,slug,parent_id,sort_order,is_active)
select v.name,v.slug,parent.id,v.position,true from (values
 ('واتساب','f90-smm-whatsapp','social-media',120),
 ('كواي','f90-smm-kwai','social-media',130),
 ('لينكدإن','f90-smm-linkedin','social-media',140),
 ('لايكي','f90-smm-likee','social-media',150),
 ('في كيه','f90-smm-vk','social-media',160),
 ('بلوسكاي','f90-smm-bluesky','social-media',170),
 ('ديسكورد','f90-smm-discord','social-media',180),
 ('تويتش','f90-smm-twitch','social-media',190),
 ('تروفو','f90-smm-trovo','social-media',200),
 ('سبوتيفاي','f90-smm-spotify','streaming',210),
 ('ساوند كلاود','f90-smm-soundcloud','streaming',220),
 ('تايدل','f90-smm-tidal','streaming',230)
) v(name,slug,parent_slug,position)
join public.categories parent on parent.slug=v.parent_slug
on conflict(slug) do nothing;

create or replace function f90_private.smm_classify(p_name text,p_category text default '')
returns text language plpgsql immutable set search_path='' as $$
declare t text:=lower(coalesce(p_name,'')||' '||coalesce(p_category,''));
begin
  if lower(coalesce(p_name,'')) ~ '(iptv|آي[ -]?بي[ -]?تي[ -]?في)' then return 'f90-smm-iptv'; end if;
  if t ~ '(instagram|انست[اغقر])' then return 'f90-smm-instagram'; end if;
  if t ~ '(facebook|فيس[ -]?بوك)' then return 'f90-smm-facebook'; end if;
  if t ~ '(tiktok|tik[ -]?tok|تيك[ -]?توك)' then return 'f90-smm-tiktok'; end if;
  if t ~ '(youtube|يوتيوب)' then return 'f90-smm-youtube'; end if;
  if t ~ '(telegram|تيل?ي?جرام)' then return 'f90-smm-telegram'; end if;
  if t ~ '(snapchat|سناب|منصة الاضواء)' then return 'f90-smm-snapchat'; end if;
  if t ~ '(kick|كيك)' then return 'f90-smm-kick'; end if;
  if t ~ '(jaco|جاكو)' then return 'f90-smm-jaco'; end if;
  if t ~ '(twitter|تويتر|إكس \(|اكس \()' then return 'f90-smm-x'; end if;
  if t ~ '(whatsapp|واتس[ -]?اب)' then return 'f90-smm-whatsapp'; end if;
  if t ~ '(kwai|كواي)' then return 'f90-smm-kwai'; end if;
  if t ~ '(linkedin|لينكد[ -]?ان|لينكدإن)' then return 'f90-smm-linkedin'; end if;
  if t ~ '(likee|لايكي)' then return 'f90-smm-likee'; end if;
  if t ~ '(^|[ /])vk([ /]|$)|في كيه' then return 'f90-smm-vk'; end if;
  if t ~ '(bluesky|بلو[ -]?سكاي)' then return 'f90-smm-bluesky'; end if;
  if t ~ '(discord|ديسكورد)' then return 'f90-smm-discord'; end if;
  if t ~ '(twitch|تويتش)' then return 'f90-smm-twitch'; end if;
  if t ~ '(trovo|تروفو)' then return 'f90-smm-trovo'; end if;
  if t ~ '(spotify|سبوتيفاي)' then return 'f90-smm-spotify'; end if;
  if t ~ '(soundcloud|ساوند[ -]?كلاود)' then return 'f90-smm-soundcloud'; end if;
  if t ~ '(tidal|تايدل)' then return 'f90-smm-tidal'; end if;
  if t ~ '(مشاهدات.*بث|بث مباشر|live stream)' then return 'f90-smm-live'; end if;
  return null;
end $$;

create or replace function f90_private.smm_image(p_slug text)
returns text language sql immutable set search_path='' as $$
 select case p_slug
 when 'f90-smm-instagram' then 'https://cdn.jsdelivr.net/npm/simple-icons@16/icons/instagram.svg'
 when 'f90-smm-facebook' then 'https://cdn.jsdelivr.net/npm/simple-icons@16/icons/facebook.svg'
 when 'f90-smm-tiktok' then 'https://cdn.jsdelivr.net/npm/simple-icons@16/icons/tiktok.svg'
 when 'f90-smm-youtube' then 'https://cdn.jsdelivr.net/npm/simple-icons@16/icons/youtube.svg'
 when 'f90-smm-telegram' then 'https://cdn.jsdelivr.net/npm/simple-icons@16/icons/telegram.svg'
 when 'f90-smm-snapchat' then 'https://cdn.jsdelivr.net/npm/simple-icons@16/icons/snapchat.svg'
 when 'f90-smm-kick' then 'https://cdn.jsdelivr.net/npm/simple-icons@16/icons/kick.svg'
 when 'f90-smm-x' then 'https://cdn.jsdelivr.net/npm/simple-icons@16/icons/x.svg'
 when 'f90-smm-whatsapp' then 'https://cdn.jsdelivr.net/npm/simple-icons@16/icons/whatsapp.svg'
 when 'f90-smm-linkedin' then 'https://cdn.jsdelivr.net/npm/simple-icons@16/icons/linkedin.svg'
 when 'f90-smm-bluesky' then 'https://cdn.jsdelivr.net/npm/simple-icons@16/icons/bluesky.svg'
 when 'f90-smm-discord' then 'https://cdn.jsdelivr.net/npm/simple-icons@16/icons/discord.svg'
 when 'f90-smm-twitch' then 'https://cdn.jsdelivr.net/npm/simple-icons@16/icons/twitch.svg'
 when 'f90-smm-spotify' then 'https://cdn.jsdelivr.net/npm/simple-icons@16/icons/spotify.svg'
 when 'f90-smm-soundcloud' then 'https://cdn.jsdelivr.net/npm/simple-icons@16/icons/soundcloud.svg'
 when 'f90-smm-tidal' then 'https://cdn.jsdelivr.net/npm/simple-icons@16/icons/tidal.svg'
 when 'f90-smm-iptv' then 'https://f90-card.github.io/f90-card-f90-card/assets/sections/streaming.png'
 else 'https://f90-card.github.io/f90-card-f90-card/assets/sections/social.png' end $$;

-- Reconsider only services that were held for classification; no published
-- product, price, order, or another supplier is touched here.
update f90_private.smm_source set state='pending',next_attempt_at=now(),error=null
where state='review' and f90_private.smm_classify(payload->>'name',payload->>'category') is not null;
update f90_private.smm_queue q set state='pending',next_attempt_at=now(),error=null
from public.products p,public.f90_product_internal i
where q.product_id=p.id and i.product_id=p.id and
 i.provider_id='c0e80eb6-7079-4071-8310-4c013614ffd5'::uuid
 and q.state='review' and f90_private.smm_classify(p.name,'') is not null;
