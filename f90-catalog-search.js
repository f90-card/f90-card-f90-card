/* Arabic/English catalog search keys. Names shown on cards remain the supplier's
   product names; aliases only improve discovery. */
(() => {
  const pairs = [
    ["تيك توك", "tiktok tik tok"], ["ببجي", "pubg pubg mobile"],
    ["فري فاير", "free fire garena"], ["موبايل ليجندز", "mobile legends mlbb"],
    ["كول اوف ديوتي", "call of duty cod codm"], ["روبلوكس", "roblox robux"],
    ["جواكر", "jawaker"], ["لودو", "ludo"], ["ايت بول", "8 ball pool 8ball"],
    ["ثمانية بول", "8 ball pool 8ball"], ["ستيم", "steam"],
    ["جوجل بلاي", "google play"], ["ابل", "apple itunes"],
    ["نيتفلكس", "netflix"], ["شاهد", "shahid"],
    ["انستغرام", "instagram insta"], ["سناب شات", "snapchat snap"],
    ["فيسبوك", "facebook fb"], ["شات جي بي تي", "chatgpt openai"],
    ["جميني", "gemini"], ["اكزينا", "xena live"], ["اكسينا", "xena live"], ["كسينا", "xena live"],
    ["بوتا", "pota live"], ["جيمي", "gimme live"],
    ["عمار", "ammar chat"], ["توميلي", "tumile"],
    ["اريا", "arya chat"], ["امو", "amo chat"],
    ["ازال", "azal live"], ["الو", "allo chat"],
    ["ام ناو", "mnow m now"], ["اميسو", "amiso party"],
    ["اهلا", "ahla ahlan chat"], ["اور توك", "ourtalk our talk"],
    ["اولاميت", "olameet"], ["اولو", "oloo"], ["اومي", "ome"],
    ["ايومي", "ayome"], ["الكي", "lklk"], ["ان فن", "infun"],
    ["اي بارتي", "eparty"], ["ايمو", "imo chat"],
    ["اب فن", "upfun"], ["اي فن", "ifun"],
    ["بات لايف", "bat live"], ["بارتي غو", "partygo party go"],
    ["بارتي هيرو", "party hero"], ["بارتي ستار", "party star"],
    ["باوا", "pawa live"], ["بشار", "bashar"],
    ["بوبو شات", "bobo chat"], ["بوبو لايف", "bobo live"],
    ["بوكت", "pocket chat"], ["بوكو", "pocoo poco"],
    ["بولالا", "polala"], ["بولي", "boli"],
    ["بيجو", "bigo live"], ["بيست لايف", "best live"],
    ["بيلا شات", "beela chat bella"], ["تادا", "tada chat"],
    ["تاكا", "taka live"], ["تامي", "tami chat"],
    ["تايا", "taya chat"], ["تشيل", "chill chat"],
    ["توب توب", "toptop top top"], ["جاكو", "jaco live"],
    ["واي بلاي", "weplay"], ["جينشن", "genshin impact"],
    ["فورتنايت", "fortnite"], ["اف سي موبايل", "fc mobile fifa"],
  ];
  const normalize = value => String(value || "").normalize("NFKC")
    .toLocaleLowerCase().replace(/[\u064b-\u065f\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
    .replace(/[پڤ]/g, "ف").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  function keys(value, aliases = []) {
    const base = normalize([value, ...aliases].join(" "));
    const generic = new Set(["live", "chat", "party", "mobile", "pool", "game", "card"]);
    const extra = pairs.filter(([arabic, english]) =>
      base.includes(normalize(arabic)) || english.split(" ").some(word => word.length > 3 && !generic.has(word) && base.split(" ").includes(word)))
      .map(([arabic, english]) => arabic + " " + english);
    return normalize(base + " " + extra.join(" "));
  }
  function matches(value, query, aliases = []) {
    const haystack = keys(value, aliases);
    const terms = normalize(query).split(" ").filter(Boolean);
    return terms.every(term => haystack.includes(term));
  }
  window.F90CatalogSearch = { normalize, keys, matches };
})();
