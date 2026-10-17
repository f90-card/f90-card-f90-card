// Read-only extraction of a target account nickname that the supplier actually
// reported. A generic completion message or recharge ID is never a nickname.
const EXPLICIT_KEYS = [
  "supplier_account_name", "account_name", "player_name", "nickname",
  "username", "user_name", "character_name", "recipient_name", "in_game_name",
];
const REPLY_KEYS = ["replay_api", "reply_api", "replay", "reply", "response", "answer", "text"];
const SUCCESS_TEXT = /(?:عملية\s*(?:التحويل|الشحن)\s*تمت?\s*بنجاح|تم(?:ت)?\s*(?:عملية\s*)?(?:التحويل|الشحن)\s*بنجاح|تم\s*(?:شحن|التحويل)\s*(?:بنجاح)?|successful(?:ly)?\s*(?:transferred|charged|completed)|transfer\s*success)/iu;
const NAMED_LABEL = /(?:اسم\s*(?:المستخدم|الحساب|اللاعب|الشخصية)?|لقب\s*(?:اللاعب|المستخدم)?|(?:account|player|user)\s*name|username|nickname)\s*[:：=–-]\s*(.{2,120})/iu;
function acceptableName(input) {
  if (typeof input !== "string") return null;
  const s = input.trim().replace(/\s+/gu, " ");
  if (s.length < 2 || s.length > 120 ||
    !/[\p{L}]/u.test(s) ||
    /[\x00-\x1F\x7F<>]/u.test(s) ||
    /https?:|www\.|@[\w.-]+\.[a-z]{2,}/iu.test(s) ||
    /^(?:[A-Z0-9_.-]{20,}|ID[_ -]?[0-9A-Z_-]+)$/iu.test(s) ||
    SUCCESS_TEXT.test(s) ||
    /^(?:نجاح|مكتمل|قبول|مقبول|تم|تمت|شحن|رصيد|اكواد|كود|order|accept|done|wait|processing|success|completed)$/iu.test(s)
  ) return null;
  return s;
}
function parseReply(value) {
  if (typeof value !== "string" || value.length > 600) return null;
  const text = value.replace(/\r/g, "\n").trim();
  const explicit = NAMED_LABEL.exec(text);
  if (explicit) {
    const candidate = explicit[1].split(/[\n|؛;]/u)[0].trim().replace(/(?:\s*[-–]\s*(?:تم\s*الشحن|مكتمل).*?)$/iu, "");
    const named = acceptableName(candidate);
    if (named) return named;
  }
  // Yassen-style replies sometimes render "NAME / عملية التحويل تمت بنجاح".
  // Treat as a name only if the text AFTER the separator confirms success.
  const parts = text.split(/\s*[/|]\s*/u);
  if (parts.length >= 2 && parts.length <= 4 &&
    parts.slice(1).some(p => SUCCESS_TEXT.test(p))) {
    const candidate = parts[0].replace(/^(?:الرد|reply|اسم الحساب)\s*[:：]\s*/iu, "");
    return acceptableName(candidate);
  }
  return null;
}
function collectReplies(data, depth = 0, target = []) {
  if (depth > 4 || target.length > 30 || data == null) return target;
  if (typeof data === "string") {target.push(data);return target;}
  if (Array.isArray(data)) {
    for (const item of data.slice(0,15)) collectReplies(item,depth+1,target);
  } else if (typeof data === "object") {
    for (const key of [...REPLY_KEYS,"message"]) {
      if (Object.prototype.hasOwnProperty.call(data,key))
        collectReplies(data[key],depth+1,target);
    }
  }
  return target;
}
/**
 * @param {any} source Raw supplier status or order-create response.
 * @returns {string|null} Only proven supplier-provided recipient names.
 */
export function recipientNameFromSupplier(source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  for (const parent of [source,source.account,source.player,source.data]) {
    if (!parent || typeof parent !== "object" || Array.isArray(parent)) continue;
    for (const key of EXPLICIT_KEYS) {
      const name = acceptableName(parent[key]);
      if (name) return name;
    }
  }
  for (const key of REPLY_KEYS) {
    const items=collectReplies(source[key]);
    for (const item of items) {
      const parsed=parseReply(item);
      if (parsed) return parsed;
    }
  }
  return null;
}
