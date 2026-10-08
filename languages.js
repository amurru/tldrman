// Shared preferred-output-language list for tldrman.
// Loaded by both options.html and sidepanel.html (no modules, no build step).
// code: BCP-47-ish tag stored in chrome.storage.local as `language`.
// label: English name followed by the language's own name (autonym) in brackets.
var TLDRMAN_LANGUAGES = [
  { code: "auto", label: "Match page language (auto)", group: "General", instruction: "Respond in the same language as the page content." },
  { code: "en", label: "English (English)", group: "General", instruction: "Respond entirely in English." },
  { code: "fr", label: "French (Français)", group: "General", instruction: "Respond entirely in French." },
  { code: "de", label: "German (Deutsch)", group: "European", instruction: "Respond entirely in German." },
  { code: "it", label: "Italian (Italiano)", group: "European", instruction: "Respond entirely in Italian." },
  { code: "es-ES", label: "Spanish (Spain) (Español - España)", group: "European", instruction: "Respond entirely in European Spanish (Spain, use Spain vocabulary and vosotros where natural)." },
  { code: "es-419", label: "Spanish (Latin America) (Español - Latinoamérica)", group: "European", instruction: "Respond entirely in Latin American Spanish (neutral, Latin American vocabulary, no vosotros)." },
  { code: "pt-PT", label: "Portuguese (Portugal) (Português - Portugal)", group: "European", instruction: "Respond entirely in European Portuguese (Portugal)." },
  { code: "pt-BR", label: "Portuguese (Brazil) (Português - Brasil)", group: "European", instruction: "Respond entirely in Brazilian Portuguese." },
  { code: "nl", label: "Dutch (Nederlands)", group: "European", instruction: "Respond entirely in Dutch." },
  { code: "pl", label: "Polish (Polski)", group: "European", instruction: "Respond entirely in Polish." },
  { code: "ru", label: "Russian (Русский)", group: "European", instruction: "Respond entirely in Russian." },
  { code: "uk", label: "Ukrainian (Українська)", group: "European", instruction: "Respond entirely in Ukrainian." },
  { code: "sv", label: "Swedish (Svenska)", group: "European", instruction: "Respond entirely in Swedish." },
  { code: "el", label: "Greek (Ελληνικά)", group: "European", instruction: "Respond entirely in Greek." },
  { code: "tr", label: "Turkish (Türkçe)", group: "European", instruction: "Respond entirely in Turkish." },
  { code: "ar", label: "Arabic (العربية)", group: "Middle East & Africa", instruction: "Respond entirely in Modern Standard Arabic." },
  { code: "fa", label: "Persian (Farsi) (فارسی)", group: "Middle East & Africa", instruction: "Respond entirely in Persian (Farsi)." },
  { code: "he", label: "Hebrew (עברית)", group: "Middle East & Africa", instruction: "Respond entirely in Hebrew." },
  { code: "hi", label: "Hindi (हिन्दी)", group: "Asia", instruction: "Respond entirely in Hindi." },
  { code: "bn", label: "Bengali (বাংলা)", group: "Asia", instruction: "Respond entirely in Bengali." },
  { code: "id", label: "Indonesian (Bahasa Indonesia)", group: "Asia", instruction: "Respond entirely in Indonesian." },
  { code: "vi", label: "Vietnamese (Tiếng Việt)", group: "Asia", instruction: "Respond entirely in Vietnamese." },
  { code: "th", label: "Thai (ไทย)", group: "Asia", instruction: "Respond entirely in Thai." },
  { code: "ja", label: "Japanese (日本語)", group: "Asia", instruction: "Respond entirely in Japanese." },
  { code: "ko", label: "Korean (한국어)", group: "Asia", instruction: "Respond entirely in Korean." },
  { code: "zh-CN", label: "Chinese Simplified (Mandarin) (简体中文)", group: "Asia", instruction: "Respond entirely in Simplified Chinese (Mainland Mandarin, simplified characters only)." },
  { code: "zh-TW", label: "Chinese Traditional (Mandarin) (繁體中文)", group: "Asia", instruction: "Respond entirely in Traditional Chinese (Taiwan Mandarin, traditional characters only)." },
  { code: "yue-Hant", label: "Cantonese (Traditional) (粵語)", group: "Asia", instruction: "Respond entirely in written Cantonese (Hong Kong usage, traditional characters)." }
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
