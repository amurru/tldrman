// Shared preferred-output-language list for tldrman.
// Loaded by both options.html and sidepanel.html (no modules, no build step).
// code: BCP-47-ish tag stored in chrome.storage.local as `language`.
var TLDRMAN_LANGUAGES = [
  { code: "auto", label: "Match page language (auto)", group: "General", instruction: "Respond in the same language as the page content." },
  { code: "en", label: "English", group: "General", instruction: "Respond entirely in English." },
  { code: "fr", label: "French", group: "European", instruction: "Respond entirely in French." },
  { code: "de", label: "German", group: "European", instruction: "Respond entirely in German." },
  { code: "it", label: "Italian", group: "European", instruction: "Respond entirely in Italian." },
  { code: "es-ES", label: "Spanish (Spain)", group: "European", instruction: "Respond entirely in European Spanish (Spain, use Spain vocabulary and vosotros where natural)." },
  { code: "es-419", label: "Spanish (Latin America)", group: "European", instruction: "Respond entirely in Latin American Spanish (neutral, Latin American vocabulary, no vosotros)." },
  { code: "pt-PT", label: "Portuguese (Portugal)", group: "European", instruction: "Respond entirely in European Portuguese (Portugal)." },
  { code: "pt-BR", label: "Portuguese (Brazil)", group: "European", instruction: "Respond entirely in Brazilian Portuguese." },
  { code: "nl", label: "Dutch", group: "European", instruction: "Respond entirely in Dutch." },
  { code: "pl", label: "Polish", group: "European", instruction: "Respond entirely in Polish." },
  { code: "ru", label: "Russian", group: "European", instruction: "Respond entirely in Russian." },
  { code: "uk", label: "Ukrainian", group: "European", instruction: "Respond entirely in Ukrainian." },
  { code: "sv", label: "Swedish", group: "European", instruction: "Respond entirely in Swedish." },
  { code: "el", label: "Greek", group: "European", instruction: "Respond entirely in Greek." },
  { code: "tr", label: "Turkish", group: "European", instruction: "Respond entirely in Turkish." },
  { code: "ar", label: "Arabic (Standard)", group: "Middle East & Africa", instruction: "Respond entirely in Modern Standard Arabic." },
  { code: "fa", label: "Persian (Farsi)", group: "Middle East & Africa", instruction: "Respond entirely in Persian (Farsi)." },
  { code: "he", label: "Hebrew", group: "Middle East & Africa", instruction: "Respond entirely in Hebrew." },
  { code: "hi", label: "Hindi", group: "Asia", instruction: "Respond entirely in Hindi." },
  { code: "bn", label: "Bengali", group: "Asia", instruction: "Respond entirely in Bengali." },
  { code: "id", label: "Indonesian", group: "Asia", instruction: "Respond entirely in Indonesian." },
  { code: "vi", label: "Vietnamese", group: "Asia", instruction: "Respond entirely in Vietnamese." },
  { code: "th", label: "Thai", group: "Asia", instruction: "Respond entirely in Thai." },
  { code: "ja", label: "Japanese", group: "Asia", instruction: "Respond entirely in Japanese." },
  { code: "ko", label: "Korean", group: "Asia", instruction: "Respond entirely in Korean." },
  { code: "zh-CN", label: "Chinese Simplified (Mandarin)", group: "Asia", instruction: "Respond entirely in Simplified Chinese (Mainland Mandarin, simplified characters only)." },
  { code: "zh-TW", label: "Chinese Traditional (Mandarin)", group: "Asia", instruction: "Respond entirely in Traditional Chinese (Taiwan Mandarin, traditional characters only)." },
  { code: "yue-Hant", label: "Cantonese (Traditional)", group: "Asia", instruction: "Respond entirely in written Cantonese (Hong Kong usage, traditional characters)." }
];

var TLDRMAN_DEFAULT_LANGUAGE = "en";

function tldrmanLanguageLabel(code) {
  var found = null;
  for (var i = 0; i < TLDRMAN_LANGUAGES.length; i++) {
    if (TLDRMAN_LANGUAGES[i].code === code) { found = TLDRMAN_LANGUAGES[i]; break; }
  }
  return found ? found.label : code || TLDRMAN_DEFAULT_LANGUAGE;
}

function tldrmanLanguageInstruction(code) {
  for (var i = 0; i < TLDRMAN_LANGUAGES.length; i++) {
    if (TLDRMAN_LANGUAGES[i].code === code) return TLDRMAN_LANGUAGES[i].instruction;
  }
  return "Respond entirely in English.";
}
