/**
 * took from https://www.npmjs.com/package/google-translate-api-browser
 */

var a = {
    d: (e, n) => {
        for (var t in n) a.o(n, t) && !a.o(e, t) && Object.defineProperty(e, t, { enumerable: !0, get: n[t] })
    }, o: (a, e) => Object.prototype.hasOwnProperty.call(a, e)
}, e = {};
function n(a) {
    let e = [], n = 0;
    for (let t = 0; t < a.length; t++) {
        let i = a.charCodeAt(t);
        128 > i ? e[n++] = i : (2048 > i ? e[n++] = i >> 6 | 192 : (55296 == (64512 & i) && t + 1 < a.length && 56320 == (64512 & a.charCodeAt(t + 1)) ? (i = 65536 + ((1023 & i) << 10) + (1023 & a.charCodeAt(++t)), e[n++] = i >> 18 | 240, e[n++] = i >> 12 & 63 | 128) : e[n++] = i >> 12 | 224, e[n++] = i >> 6 & 63 | 128), e[n++] = 63 & i | 128)
    } let i = 0; for (n = 0; n < e.length; n++)i += e[n], i = t(i, "+-a^+6"); return i = t(i, "+-3^+b+-f"), i ^= 0, 0 > i && (i = 2147483648 + (2147483647 & i)), i %= 1e6, i.toString() + "." + i.toString()
}
a.d(e, {
    ZP: () => m, j1: () => r, Gb: () => s, e6: () => l, XU: () => c, Iu: () => d
});
const t = function (a, e) {
    for (let n = 0; n < e.length - 2; n += 3) { let t = e.charAt(n + 2); t = "a" <= t ? t.charCodeAt(0) - 87 : Number(t), t = "+" == e.charAt(n + 1) ? a >>> t : a << t, a = "+" == e.charAt(n) ? a + t : a ^ t } return a
}, i = {
    client: "gtx", from: "auto", to: "en", hl: "en", tld: "com"
};
function r(a, e) {
    const t = Object.assign(Object.assign({}, i), e), r = { client: t.client, sl: t.from, tl: t.to, hl: t.hl, ie: "UTF-8", oe: "UTF-8", otf: "1", ssel: "0", tsel: "0", kc: "7", q: a, tk: n(a) }, o = new URLSearchParams(r); return ["at", "bd", "ex", "ld", "md", "qca", "rw", "rm", "ss", "t"].forEach((a => o.append("dt", a))), `https://translate.google.${t.tld}/translate_a/single?${o}`
}
const o = {
    auto: "Automatic", af: "Afrikaans", sq: "Albanian", am: "Amharic", ar: "Arabic", hy: "Armenian", az: "Azerbaijani", eu: "Basque", be: "Belarusian", bn: "Bengali", bs: "Bosnian", bg: "Bulgarian", ca: "Catalan", ceb: "Cebuano", ny: "Chichewa", zh: "Chinese Simplified", "zh-cn": "Chinese Simplified", "zh-tw": "Chinese Traditional", co: "Corsican", hr: "Croatian", cs: "Czech", da: "Danish", nl: "Dutch", en: "English", eo: "Esperanto", et: "Estonian", tl: "Filipino", fi: "Finnish", fr: "French", fy: "Frisian", gl: "Galician", ka: "Georgian", de: "German", el: "Greek", gu: "Gujarati", ht: "Haitian Creole", ha: "Hausa", haw: "Hawaiian", he: "Hebrew", iw: "Hebrew", hi: "Hindi", hmn: "Hmong", hu: "Hungarian", is: "Icelandic", ig: "Igbo", id: "Indonesian", ga: "Irish", it: "Italian", ja: "Japanese", jw: "Javanese", kn: "Kannada", kk: "Kazakh", km: "Khmer", rw: "Kinyarwanda", ko: "Korean", ku: "Kurdish (Kurmanji)", ky: "Kyrgyz", lo: "Lao", la: "Latin", lv: "Latvian", lt: "Lithuanian", lb: "Luxembourgish", mk: "Macedonian", mg: "Malagasy", ms: "Malay", ml: "Malayalam", mt: "Maltese", mi: "Maori", mr: "Marathi", mn: "Mongolian", my: "Myanmar (Burmese)", ne: "Nepali", no: "Norwegian", or: "Odia (Oriya)", ps: "Pashto", fa: "Persian", pl: "Polish", pt: "Portuguese", pa: "Punjabi", ro: "Romanian", ru: "Russian", sm: "Samoan", gd: "Scots Gaelic", sr: "Serbian", st: "Sesotho", sn: "Shona", sd: "Sindhi", si: "Sinhala", sk: "Slovak", sl: "Slovenian", so: "Somali", es: "Spanish", su: "Sundanese", sw: "Swahili", sv: "Swedish", tg: "Tajik", ta: "Tamil", tt: "Tatar", te: "Telugu", th: "Thai", tr: "Turkish", tk: "Turkmen", uk: "Ukrainian", ur: "Urdu", ug: "Uyghur", uz: "Uzbek", vi: "Vietnamese", cy: "Welsh", xh: "Xhosa", yi: "Yiddish", yo: "Yoruba", zu: "Zulu"
}, s = a => Boolean(o[a]);
function l(a, e = !1) {
    const n = { text: "", pronunciation: "", from: { language: { didYouMean: !1, iso: "" }, text: { autoCorrected: !1, value: "", didYouMean: !1 } } }; if (a[0].forEach((a => { a[0] ? n.text += a[0] : a[2] && (n.pronunciation += a[2]) })), a[2] === a[8][0][0] ? n.from.language.iso = a[2] : (n.from.language.didYouMean = !0, n.from.language.iso = a[8][0][0]), a[7] && a[7][0]) { let e = a[7][0]; e = e.replace(/<b><i>/g, "["), e = e.replace(/<\/i><\/b>/g, "]"), n.from.text.value = e, !0 === a[7][5] ? n.from.text.autoCorrected = !0 : n.from.text.didYouMean = !0 } return e && (n.raw = a), n
}
var u = function (a, e, n, t) {
    return new (n || (n = Promise))((function (i, r) { function o(a) { try { l(t.next(a)) } catch (a) { r(a) } } function s(a) { try { l(t.throw(a)) } catch (a) { r(a) } } function l(a) { var e; a.done ? i(a.value) : (e = a.value, e instanceof n ? e : new n((function (a) { a(e) }))).then(o, s) } l((t = t.apply(a, e || [])).next()) }))
};
let h = "";
const c = a => (h = a, d);
function d(a, e = {}) {
    return u(this, void 0, void 0, (function* () { const n = r(a, e), t = yield fetch(`${h}${n}`); if (!t.ok) throw new Error("Request failed"); return l(yield t.json(), e.raw) }))
}
const m = d;
var g = e.ZP, f = e.j1, b = e.Gb, p = e.e6, y = e.XU, k = e.Iu;

// export {
//     g as default, f as generateRequestUrl, b as isSupported, p as normaliseResponse, y as setCORS, k as translate
// };

/**
 * 
 * @param {string} text 
 * @param {"iw" | "en"} target 
 * @returns {Promise<{  text: string, pronunciation: string, 
*                      from: { language: { didYouMean: boolean, iso: "iw" | "en" }, 
*                              text: { autoCorrected: boolean, value: '', didYouMean: false }
*                      }}>}
*/
export default async function translate(text, target = "iw") {
    let url = f(text, { to: target })
    return fetch(url)
        .then(res => res.text())
        .then(data => p(JSON.parse(data)))
}

export const languages = [
    {
        code: "iw",
        name1: "עברית",
        name2: "hebrew",
        nickname: "he",
    },
    {
        code: "en",
        name1: "אנגלית",
        name2: "english",
        nickname: "en",
    },
    {
        code: "ar",
        name1: "ערבית",
        name2: "arabic",
        nickname: "ar",
    },
    {
        code: "ru",
        name1: "רוסית",
        name2: "russian",
        nickname: "ru",
    },
    {
        code: "es",
        name1: "ספרדית",
        name2: "spanish",
        nickname: "es",
    },
    {
        code: "fr",
        name1: "צרפתית",
        name2: "french",
        nickname: "fr",
    },
    {
        code: "de",
        name1: "גרמנית",
        name2: "german",
        nickname: "de",
    },
    {
        code: "it",
        name1: "איטלקית",
        name2: "italian",
        nickname: "it",
    },
    {
        code: "tr",
        name1: "טורקית",
        name2: "turkish",
        nickname: "tr",
    },
    {
        code: "el",
        name1: "יוונית",
        name2: "greek",
        nickname: "el",
    },
    {
        code: "hi",
        name1: "הודית",
        name2: "hindi",
        nickname: "hi",
    },
    {
        code: "ja",
        name1: "יפנית",
        name2: "japanese",
        nickname: "ja",
    },
    {
        code: "ko",
        name1: "קוריאנית",
        name2: "korean",
        nickname: "ko",
    },
    {
        code: "zh",
        name1: "סינית",
        name2: "chinese",
        nickname: "zh",
    },
    {
        code: "pl",
        name1: "פולנית",
        name2: "polish",
        nickname: "pl",
    },
    {
        code: "sv",
        name1: "שוודית",
        name2: "swedish",
        nickname: "sv",
    },
    {
        code: "yi",
        name1: "אידיש",
        name2: "yiddish",
        nickname: "יידיש",
    }
];

