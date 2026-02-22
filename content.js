
// ═════════════════════════════════════════════════════════════════════════════
// USER-PROVIDED PATTERNS
// ═════════════════════════════════════════════════════════════════════════════
const MOST_RELEVANT_XPATH = '/html/body/div[1]/div/div[1]/div/div[4]/div/div/div[1]/div/div[2]/div/div/div/div/div/div/div[2]/div[2]/div/div/div[2]/div/div[2]/div[1]/div/div/span';
const ALL_COMMENTS_XPATH  = '/html/body/div[1]/div/div[1]/div/div[4]/div/div/div[1]/div/div[3]/div/div/div[1]/div[1]/div/div/div/div/div/div/div[1]/div/div[2]/div[1]/div/div[1]/span';
const COMMENTS_BTN_XPATH  = '/html/body/div[1]/div/div[1]/div/div[3]/div/div/div[1]/div[1]/div/div/div[4]/div[2]/div/div[2]/div[2]/div[1]/div/div/div/div/div/div/div/div/div/div/div/div[13]/div/div/div[4]/div/div/div[1]/div/div[1]/div/div[2]/div[2]/span/div/span/span';

// ═════════════════════════════════════════════════════════════════════════════
// GLOBAL STATE
// ═════════════════════════════════════════════════════════════════════════════
let _paused           = false;
let _stopped          = false;
let _badge            = null;
let _pauseBtn         = null;
let _translateEnabled = true;

// ═════════════════════════════════════════════════════════════════════════════
// SLEEP  (pause-aware + stop-aware)
// ═════════════════════════════════════════════════════════════════════════════
async function sleep(ms) {
    const TICK = 100;
    let elapsed = 0;
    while (elapsed < ms || _paused) {
        if (_stopped) return;
        await new Promise(r => setTimeout(r, TICK));
        if (!_paused) elapsed += TICK;
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// STATUS BADGE
// ═════════════════════════════════════════════════════════════════════════════
function showStatus(msg, color = '#1877f2') {
    if (!_badge) {
        _badge = document.createElement('div');
        Object.assign(_badge.style, {
            position: 'fixed', top: '16px', right: '16px', zIndex: '2147483647',
            padding: '14px 16px', borderRadius: '12px', fontSize: '13px',
            fontWeight: 'bold', color: '#fff',
            boxShadow: '0 4px 20px rgba(0,0,0,0.45)',
            maxWidth: '300px', fontFamily: 'Arial, sans-serif',
        });
        const txt = document.createElement('div');
        txt.id = '_fb_s_txt';
        Object.assign(txt.style, { marginBottom: '10px', lineHeight: '1.5', whiteSpace: 'pre-wrap' });
        _badge.appendChild(txt);
        const row = document.createElement('div');
        Object.assign(row.style, { display: 'flex', gap: '8px' });
        _pauseBtn = document.createElement('button');
        Object.assign(_pauseBtn.style, {
            flex: '1', padding: '6px 0', border: 'none', borderRadius: '6px',
            cursor: 'pointer', fontWeight: 'bold', fontSize: '12px',
            background: 'rgba(255,255,255,0.28)', color: '#fff',
        });
        _pauseBtn.textContent = 'Pause';
        _pauseBtn.onclick = () => {
            _paused = !_paused;
            _pauseBtn.textContent = _paused ? 'Resume' : 'Pause';
            _pauseBtn.style.background = _paused
                ? 'rgba(255,200,0,0.55)' : 'rgba(255,255,255,0.28)';
        };
        const stopBtn = document.createElement('button');
        Object.assign(stopBtn.style, {
            flex: '1', padding: '6px 0', border: 'none', borderRadius: '6px',
            cursor: 'pointer', fontWeight: 'bold', fontSize: '12px',
            background: 'rgba(220,50,50,0.65)', color: '#fff',
        });
        stopBtn.textContent = 'Stop';
        stopBtn.onclick = () => { _stopped = true; _paused = false; hideStatus(); };
        row.appendChild(_pauseBtn);
        row.appendChild(stopBtn);
        _badge.appendChild(row);
        document.body.appendChild(_badge);
    }
    _badge.style.background = color;
    const t = document.getElementById('_fb_s_txt');
    if (t) t.textContent = msg;
}

function hideStatus() {
    if (_badge) { _badge.remove(); _badge = null; _pauseBtn = null; }
}

// ═════════════════════════════════════════════════════════════════════════════
// SENTIMENT LEXICON  (English + Bangla + Romanised)
// ═════════════════════════════════════════════════════════════════════════════
const POSITIVE_WORDS = [
    'good','great','excellent','amazing','wonderful','fantastic','love','like','beautiful',
    'awesome','perfect','best','happy','joy','nice','thank','thanks','brilliant','superb',
    'outstanding','impressive','helpful','kind','lovely','magnificent','marvelous','pleasant',
    'success','win','congratulations','congrats','bravo','support','proud','inspire',
    'appreciate','grateful','blessing','blessed','hope','achieve','strong','brave',
    'smart','wise','talented','skilled','expert','creative','innovative','well done','respect',
    'valo','bhalo','sundor','oshadharon','darun','khub valo','dhonnobad','mashallah',
    'alhamdulillah','masha allah','subhanallah','jajakallah','mojar','shandhar','osthir','fatafati',
    'ভালো','সুন্দর','দারুণ','অসাধারণ','ধন্যবাদ','ভালোবাসি','মাশাল্লাহ','আলহামদুলিল্লাহ',
    'শুকরিয়া','অনেক ভালো','খুব ভালো','চমৎকার','অপূর্ব','প্রেম','শুভেচ্ছা',
];
const NEGATIVE_WORDS = [
    'bad','terrible','awful','horrible','hate','dislike','ugly','worst','poor','sad',
    'angry','wrong','false','lie','liar','fake','fraud','scam','cheat','disgusting',
    'stupid','idiot','fool','dumb','useless','pathetic','shameful','shame','disgrace',
    'boring','waste','spam','annoying','irritating','toxic','disappointed','criminal',
    'kharap','bekar','baje','jhut','mithha','faltu','ganda','ghrina','nafrat','pagol',
    'খারাপ','বাজে','ঘৃণা','মিথ্যা','ফালতু','বেকার','বিরক্ত','রাগ','দুঃখ','কষ্ট','লজ্জা',
];
const EMOJI_POS = ['❤️','😍','😊','🥰','👍','🙏','💕','😁','✨','🌟','😃','😄','🎉','🎊','👏','💯','🔥','⭐','🌈','😇','🤩','💪','🙌','💖','💝','🌹','🌸','🤗','😘','🫶','🥳'];
const EMOJI_NEG = ['😡','😠','👎','🤮','😤','💔','😢','😭','🤬','😒','😔','😞','😟','😣','😩','😫','🤢','💀','🖕','🤦','😰','😱','🥺'];

// ═════════════════════════════════════════════════════════════════════════════
// LANGUAGE DETECTION  — Bangla Unicode block U+0980–U+09FF
// ═════════════════════════════════════════════════════════════════════════════
function isBangla(text) {
    if (!text || text.length < 2) return false;
    let count = 0;
    for (const ch of text) {
        const cp = ch.codePointAt(0);
        if (cp >= 0x0980 && cp <= 0x09FF) count++;
    }
    return (count / text.length) > 0.12;
}

// ═════════════════════════════════════════════════════════════════════════════
// TRANSLATION  — Google Translate free endpoint, no API key needed
//   Batches CHUNK comments per call; retries once on failure; 450 ms throttle.
// ═════════════════════════════════════════════════════════════════════════════
const _TSEP  = '\n◈◈◈\n';
const _CHUNK = 15;

async function _translateChunk(texts, retry) {
    const joined = texts.join(_TSEP);
    const url = 'https://translate.googleapis.com/translate_a/single' +
        '?client=gtx&sl=auto&tl=en&dt=t&q=' + encodeURIComponent(joined);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
        const resp = await fetch(url, { signal: controller.signal });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const json = await resp.json();
        const full  = json[0].map(s => s[0]).join('');
        const parts = full.split(/\n?◈◈◈\n?/);
        return texts.map((orig, i) => (parts[i] || orig).trim());
    } catch(e) {
        if (!retry) {
            await sleep(1500);
            return _translateChunk(texts, true);   // one retry
        }
        return texts;  // give up — return originals
    } finally {
        clearTimeout(timer);
    }
}

async function translateResults(results) {
    const banglaIdxs = [];
    results.forEach((r, i) => { if (isBangla(r.comment)) banglaIdxs.push(i); });

    if (!banglaIdxs.length) {
        return results.map(r => ({ ...r, lang: 'en', translatedComment: '' }));
    }

    const txMap = {};

    for (let c = 0; c < banglaIdxs.length; c += _CHUNK) {
        if (_stopped) break;
        const slice = banglaIdxs.slice(c, c + _CHUNK);
        const done  = Math.min(c + _CHUNK, banglaIdxs.length);
        showStatus(
            'Step 5/5: Translating Bangla → English\n' +
            done + ' / ' + banglaIdxs.length + ' comments', '#7b2d8b'
        );
        const txts  = slice.map(i => results[i].comment);
        const trans = await _translateChunk(txts, false);
        slice.forEach((idx, j) => { txMap[idx] = trans[j]; });
        await sleep(450);
    }

    return results.map((r, i) => {
        const bn         = isBangla(r.comment);
        const translated = bn ? (txMap[i] || r.comment) : '';
        const scoreText  = translated || r.comment;
        const { label, score } = sentiment(scoreText);
        return { ...r, lang: bn ? 'bn' : 'en', translatedComment: translated, sentiment: label, score };
    });
}

// ═════════════════════════════════════════════════════════════════════════════
// TEXT + SENTIMENT
// ═════════════════════════════════════════════════════════════════════════════
function getText(el) {
    if (!el) return '';
    const p = [];
    const walk = n => {
        if (n.nodeType === Node.TEXT_NODE)      p.push(n.textContent);
        else if (n.nodeName === 'IMG' && n.alt) p.push(n.alt);
        else if (n.nodeName === 'BR')           p.push('\n');
        else                                    n.childNodes.forEach(walk);
    };
    walk(el);
    return p.join('').replace(/\uFEFF/g, '').trim().replace(/[ \t]+/g, ' ');
}

function sentiment(text) {
    if (!text) return { label: 'Neutral', score: 0 };
    const lo = text.toLowerCase();
    let s = 0;
    for (const w of POSITIVE_WORDS) if (lo.includes(w.toLowerCase())) s++;
    for (const w of NEGATIVE_WORDS) if (lo.includes(w.toLowerCase())) s--;
    for (const e of EMOJI_POS) if (text.includes(e)) s++;
    for (const e of EMOJI_NEG) if (text.includes(e)) s--;
    return { label: s > 0 ? 'Positive' : s < 0 ? 'Negative' : 'Neutral', score: +s.toFixed(2) };
}

// Facebook UI strings that should never be treated as comment text
const _UI_RE = /^(like|reply|see translation|write a (comment|reply)|most relevant|all comments|newest first|\d+[smhdwy]|\d+\s+(like|love|reaction|comment|share)s?)$/i;
function isUIText(t) { return !t || t.length < 2 || _UI_RE.test(t.trim()); }

// ═════════════════════════════════════════════════════════════════════════════
// CSV + DOWNLOAD
// ═════════════════════════════════════════════════════════════════════════════
function buildCSV(data) {
    const hasPosts = data.some(r => r.post && r.post !== '');
    const hasTrans = data.some(r => r.translatedComment && r.translatedComment !== '');
    const q = s => '"' + String(s || '').replace(/"/g, '""') + '"';

    const hdrs = [];
    if (hasPosts) hdrs.push('Post');
    hdrs.push('Name', 'Language', 'Comment');
    if (hasTrans) hdrs.push('TranslatedComment');
    hdrs.push('Sentiment', 'Score');

    const rows = data.map(r => {
        const row = [];
        if (hasPosts) row.push(q(r.post));
        row.push(q(r.name));
        row.push(q(r.lang === 'bn' ? 'Bangla' : 'English'));
        row.push(q(r.comment));
        if (hasTrans) row.push(q(r.translatedComment || ''));
        row.push(q(r.sentiment), q(r.score));
        return row.join(',');
    });

    return '\uFEFF' + hdrs.join(',') + '\n' + rows.join('\n');
}

function downloadCSV(data, filename = 'fb_sentiment.csv') {
    chrome.runtime.sendMessage({ action: 'downloadCSV', csv: buildCSV(data), filename });
}

// ═════════════════════════════════════════════════════════════════════════════
// PIE CHART OVERLAY
// ═════════════════════════════════════════════════════════════════════════════
function showChart(data) {
    const old = document.getElementById('_fb_chart_overlay');
    if (old) old.remove();

    const pos     = data.filter(x => x.sentiment === 'Positive').length;
    const neg     = data.filter(x => x.sentiment === 'Negative').length;
    const neu     = data.filter(x => x.sentiment === 'Neutral').length;
    const total   = data.length;
    const bnCount = data.filter(x => x.lang === 'bn').length;
    const transOk = data.filter(x => x.translatedComment).length;

    const ov = document.createElement('div');
    ov.id = '_fb_chart_overlay';
    Object.assign(ov.style, {
        position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
        background: 'rgba(0,0,0,0.62)', zIndex: '2147483646',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    });

    const box = document.createElement('div');
    Object.assign(box.style, {
        background: '#fff', borderRadius: '18px', padding: '28px 32px',
        width: '390px', fontFamily: 'Arial, sans-serif', textAlign: 'center',
        boxShadow: '0 16px 60px rgba(0,0,0,0.5)', maxHeight: '92vh', overflowY: 'auto',
    });

    const langBar = bnCount > 0
        ? `<div style="background:#f3e8ff;border-radius:8px;padding:7px 12px;margin-bottom:14px;font-size:12px;color:#7b2d8b;text-align:left">` +
          `<b>${bnCount}</b> Bangla translated → English &nbsp;·&nbsp; <b>${total - bnCount}</b> English` +
          (transOk < bnCount ? `<br><span style="color:#e07800">${bnCount - transOk} used original (API limit)</span>` : '') + `</div>` : '';

    const scoreNote = transOk > 0 ? 'Sentiment scored on translated English text' : 'Sentiment scored on original text';

    box.innerHTML =
        '<h2 style="margin:0 0 4px;color:#1877f2;font-size:20px;font-weight:800">Sentiment Results</h2>' +
        '<p style="margin:0 0 14px;color:#888;font-size:13px">' + total + ' comments analysed &nbsp;·&nbsp; <span style="color:#aaa;font-size:11px">' + scoreNote + '</span></p>' +
        langBar +
        '<canvas id="_fb_pie_canvas" width="240" height="240" style="display:block;margin:0 auto 18px"></canvas>' +
        '<div id="_fb_pie_legend" style="text-align:left;margin-bottom:18px"></div>' +
        '<div style="display:flex;gap:10px">' +
        '<button id="_fb_chart_dl" style="flex:1;padding:10px;background:#42b72a;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:bold;font-size:13px">Download CSV</button>' +
        '<button id="_fb_chart_close" style="flex:1;padding:10px;background:#1877f2;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:bold;font-size:13px">Close</button>' +
        '</div>';

    ov.appendChild(box);
    document.body.appendChild(ov);

    document.getElementById('_fb_chart_close').onclick = () => ov.remove();
    document.getElementById('_fb_chart_dl').onclick    = () => downloadCSV(data);
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });

    const canvas = document.getElementById('_fb_pie_canvas');
    const ctx    = canvas.getContext('2d');
    const cx = 120, cy = 120, OUTER = 108, INNER = 54;
    const slices  = [
        { label: 'Positive', count: pos, color: '#42b72a' },
        { label: 'Negative', count: neg, color: '#e41e2b' },
        { label: 'Neutral',  count: neu, color: '#f0a500' },
    ];
    const nonZero = slices.filter(s => s.count > 0);

    if (!nonZero.length) {
        ctx.font = '14px Arial'; ctx.fillStyle = '#aaa';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('No data', cx, cy);
    } else {
        let angle = -Math.PI / 2;
        for (const s of nonZero) {
            const sweep = (s.count / total) * 2 * Math.PI;
            ctx.beginPath(); ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, OUTER, angle, angle + sweep);
            ctx.closePath(); ctx.fillStyle = s.color; ctx.fill();
            ctx.beginPath(); ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, OUTER, angle, angle + sweep);
            ctx.closePath(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
            if (sweep > 0.22) {
                const mid = angle + sweep / 2;
                ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(((s.count / total) * 100).toFixed(1) + '%',
                    cx + OUTER * 0.68 * Math.cos(mid), cy + OUTER * 0.68 * Math.sin(mid));
            }
            angle += sweep;
        }
        ctx.beginPath(); ctx.arc(cx, cy, INNER, 0, 2 * Math.PI);
        ctx.fillStyle = '#fff'; ctx.fill();
        ctx.fillStyle = '#222'; ctx.font = 'bold 22px Arial';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(total, cx, cy - 10);
        ctx.font = '11px Arial'; ctx.fillStyle = '#999';
        ctx.fillText('comments', cx, cy + 12);
    }

    const legend = document.getElementById('_fb_pie_legend');
    for (const s of slices) {
        const pct = total ? ((s.count / total) * 100).toFixed(1) : '0.0';
        const row = document.createElement('div');
        Object.assign(row.style, { display: 'flex', alignItems: 'center', marginBottom: '8px' });
        row.innerHTML =
            '<span style="width:14px;height:14px;background:' + s.color + ';border-radius:3px;display:inline-block;margin-right:10px;flex-shrink:0"></span>' +
            '<span style="font-size:13px;color:#333">' + s.label + ': <b>' + s.count + '</b> <span style="color:#999">(' + pct + '%)</span></span>';
        legend.appendChild(row);
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// CORE UTILITIES
// ═════════════════════════════════════════════════════════════════════════════
async function waitFor(fn, ms) {
    const end = Date.now() + (ms || 8000);
    while (Date.now() < end) {
        if (_stopped) return null;
        const v = fn();
        if (v) return v;
        await sleep(250);
    }
    return fn();
}

function fireClick(el) {
    if (!el) return;
    try { el.scrollIntoView({ block: 'center', behavior: 'instant' }); } catch(e) {}
    try { el.click(); } catch(e) {}
    try {
        const r = el.getBoundingClientRect();
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        const o = { bubbles: true, cancelable: true, composed: true, view: window, clientX: x, clientY: y };
        ['pointerdown','pointerup','mousedown','mouseup','click'].forEach(t =>
            el.dispatchEvent(new PointerEvent(t, Object.assign({}, o, { pointerId: 1, pointerType: 'mouse', isPrimary: true })))
        );
    } catch(e) {}
}

function clickEl(el) {
    if (!el) return;
    fireClick(el);
    const btn = el.closest('a,button,[role="button"],[role="link"]');
    if (btn && btn !== el) fireClick(btn);
}

function byXPath(xpath) {
    try {
        const n = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        return n ? (n.nodeType === Node.ELEMENT_NODE ? n : n.parentElement) : null;
    } catch(e) { return null; }
}

// ═════════════════════════════════════════════════════════════════════════════
// DOM FINDERS
// ═════════════════════════════════════════════════════════════════════════════
function findMostRelevant() {
    return Array.from(document.querySelectorAll('span.xdmh292'))
        .find(el => (el.innerText || el.textContent || '').trim().startsWith('Most relevant'));
}

function findAllComments() {
    return document.querySelector('span.xk50ysn') ||
        Array.from(document.querySelectorAll('span.xdmh292'))
            .find(el => (el.innerText || el.textContent || '').trim() === 'All comments');
}

function findCommentBtns() {
    let els = Array.from(document.querySelectorAll('span.xdj266r.x14z9mp'))
        .filter(el => /\d+\s+comments?/i.test(el.textContent || ''));
    if (els.length) return els;
    els = Array.from(document.querySelectorAll('span.xdj266r'))
        .filter(el => /\d+\s+comments?/i.test(el.textContent || ''));
    if (els.length) return els;
    return Array.from(document.querySelectorAll('span,a'))
        .filter(el => /^\d+\s+comments?$/i.test((el.innerText || '').trim()));
}

// ── "View more" buttons — broad scan of role="button" elements ────────────
//   This replaces the narrow span.xdmh292 approach that missed most buttons.
function findViewMoreBtns(root) {
    const r = root || document;
    const KEYWORDS_EN = [
        'view more comments', 'see more comments',
        'view more replies',  'see more replies',
        'load more comments', 'view all comments',
        'view previous comments',
    ];
    const KEYWORDS_BN = [
        'আরও মন্তব্য', 'আরও দেখুন', 'সব দেখুন',
        'আরও প্রতিক্রিয়া', 'প্রতিমন্তব্য দেখুন', 'পূর্ববর্তী মন্তব্য',
    ];
    const ALL_KW = [...KEYWORDS_EN, ...KEYWORDS_BN];

    const seen  = new Set();
    const found = [];

    // Check role="button" elements directly AND spans within them
    for (const el of r.querySelectorAll('[role="button"], button, div[role="button"]')) {
        const t = (el.innerText || el.textContent || '').trim();
        if (!t || t.length > 120) continue;
        const tl = t.toLowerCase();
        if (ALL_KW.some(k => tl.includes(k.toLowerCase()))) {
            if (!seen.has(el)) { seen.add(el); found.push(el); }
        }
    }

    // Also check span.xdmh292 (the old class) as supplemental
    for (const el of r.querySelectorAll('span.xdmh292')) {
        const t = (el.innerText || el.textContent || '').trim().toLowerCase();
        if (ALL_KW.some(k => t.includes(k.toLowerCase()))) {
            const btn = el.closest('[role="button"],button') || el;
            if (!seen.has(btn)) { seen.add(btn); found.push(btn); }
        }
    }

    return found;
}

// ─────────────────────────────────────────────────────────────────────────────
// FIXED: findCommentScrollArea()
//
// BUG in the old findCommentContainer():
//   It walked up from findMostRelevant() (the "Most relevant" sort button).
//   After sortToAllComments() clicks "All comments", that button disappears
//   from the DOM → findMostRelevant() returns undefined → the whole function
//   returns null → scrollAndCollect() hits the dead-end `else { sleep(900) }`
//   branch and never scrolls → only the initially-visible ~4 comments are seen.
//
// FIX: Walk up from the FIRST [role="article"] comment element instead.
//   Comment articles are always present once the section is open.
//   Secondary fallback: scan the dialog's children for any scrollable div.
// ─────────────────────────────────────────────────────────────────────────────
function findCommentScrollArea() {
    const root = getCommentRoot();

    // Strategy A — walk up from the first visible comment article
    const firstArticle = root.querySelector('[role="article"]');
    if (firstArticle) {
        let el = firstArticle.parentElement;
        for (let i = 0; i < 25 && el && el !== document.body; i++) {
            const cs = window.getComputedStyle(el);
            if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') &&
                el.scrollHeight > el.clientHeight + 80) {
                return el;
            }
            el = el.parentElement;
        }
    }

    // Strategy B — scan dialog children for any scrollable div (handles modal dialogs)
    const dialog = document.querySelector('[role="dialog"],[aria-modal="true"]');
    if (dialog) {
        // BFS the dialog to find ALL scrollable nodes, pick deepest large one
        const queue = [dialog];
        const candidates = [];
        while (queue.length) {
            const node = queue.shift();
            for (const child of node.children) {
                const cs = window.getComputedStyle(child);
                if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') &&
                    child.scrollHeight > child.clientHeight + 80) {
                    candidates.push(child);
                }
                queue.push(child);
            }
        }
        // Pick the one with the most articles (= the real comment container)
        candidates.sort((a, b) =>
            b.querySelectorAll('[role="article"]').length -
            a.querySelectorAll('[role="article"]').length
        );
        if (candidates.length) return candidates[0];
    }

    // Strategy C — look for any element whose inline style has overflow:auto/scroll
    //              (Facebook sometimes sets this inline rather than via CSS class)
    for (const el of document.querySelectorAll('div[style]')) {
        const s = el.getAttribute('style') || '';
        if (/overflow(-y)?:\s*(auto|scroll)/i.test(s) &&
            el.scrollHeight > el.clientHeight + 80 &&
            el.querySelector('[role="article"]')) {
            return el;
        }
    }

    return null;
}

function isPostPage() {
    return /\/(posts|permalink|photo|video|videos|groups\/[^/]+\/posts|reel)\//i.test(location.href) ||
           /[?&](story_fbid|fbid|id)=\d/i.test(location.href);
}

function getCommentRoot() {
    const dialog = document.querySelector('[role="dialog"],[aria-modal="true"]');
    if (dialog) return dialog;
    return document;
}

// ═════════════════════════════════════════════════════════════════════════════
// PHASE 1: OPEN COMMENT SECTION
// ═════════════════════════════════════════════════════════════════════════════
async function openCommentSection() {
    if (findMostRelevant()) return true;

    const btns = findCommentBtns();
    if (!btns.length) {
        const xEl = byXPath(COMMENTS_BTN_XPATH);
        if (xEl) btns.push(xEl); else return false;
    }

    const btn     = btns[0];
    const prevURL = location.href;
    showStatus('Step 1/5: Opening comment section...');

    let cur = btn;
    for (let i = 0; i < 6 && cur && cur !== document.body; i++, cur = cur.parentElement) {
        if (_stopped) return false;
        fireClick(cur);
        await sleep(200);
        if (findMostRelevant() || location.href !== prevURL) break;
    }

    const ok = await waitFor(() => findMostRelevant() || (location.href !== prevURL && 'nav'), 8000);
    if (ok === 'nav') {
        showStatus('Step 1/5: Loading post page...');
        await sleep(3000);
    }
    return !!findMostRelevant();
}

// ═════════════════════════════════════════════════════════════════════════════
// PHASE 2+3: SORT TO "ALL COMMENTS"
// ═════════════════════════════════════════════════════════════════════════════
async function sortToAllComments() {
    if (!findMostRelevant()) return;
    showStatus('Step 2/5: Opening sort dropdown...');

    for (let i = 0; i < 8 && !findAllComments(); i++) {
        if (_stopped) return;
        const mr = findMostRelevant() || byXPath(MOST_RELEVANT_XPATH);
        if (mr) { clickEl(mr); await sleep(900); }
        else await sleep(400);
    }

    showStatus('Step 3/5: Selecting "All comments"...');

    for (let i = 0; i < 8 && findAllComments(); i++) {
        if (_stopped) return;
        const ac = findAllComments() || byXPath(ALL_COMMENTS_XPATH);
        if (ac) { clickEl(ac); await sleep(900); }
        else await sleep(400);
    }

    await sleep(1800);   // give Facebook time to reload the sorted list
}

// ═════════════════════════════════════════════════════════════════════════════
// HARVEST VISIBLE COMMENTS
//   — Two strategies: role="article" (primary), walk-up (fallback)
//   — Filters out Facebook UI strings (Like, Reply, time stamps, etc.)
// ═════════════════════════════════════════════════════════════════════════════
function harvestVisible(seen, postLabel) {
    const out  = [];
    const root = getCommentRoot();

    // ── Strategy 1: role="article" blocks ───────────────────────────────────
    for (const block of root.querySelectorAll('[role="article"]')) {
        // Skip the main post article (it contains h1/h2)
        if (block.querySelector('h1,h2,h3')) continue;

        // Commenter name — first profile link with short non-numeric text
        let name = '';
        for (const link of block.querySelectorAll('a[role="link"]')) {
            const sp = link.querySelector('span');
            if (!sp) continue;
            const c = (sp.innerText || sp.textContent || '').trim();
            if (c && c.length > 0 && c.length < 100 &&
                !/^\d+/.test(c) && !isUIText(c)) { name = c; break; }
        }
        if (!name) continue;

        // Comment text — pick the longest non-UI text div/span with dir="auto"
        let comment = '';
        for (const td of block.querySelectorAll('div[dir="auto"], span[dir="auto"]')) {
            const t = getText(td);
            if (t && t !== name && !isUIText(t) && t.length > comment.length) comment = t;
        }
        if (!comment || comment.length < 2) continue;

        const key = name + '\x00' + comment.substring(0, 120);
        if (seen.has(key)) continue;
        seen.add(key);
        const { label, score } = sentiment(comment);
        out.push({ post: postLabel, name, comment, sentiment: label, score, lang: '', translatedComment: '' });
    }

    // ── Strategy 2: walk-up fallback (when no articles found) ───────────────
    if (out.length === 0) {
        for (const textDiv of root.querySelectorAll('div[dir="auto"], span[dir="auto"]')) {
            const comment = getText(textDiv);
            if (!comment || comment.length < 3 || isUIText(comment)) continue;
            let container = textDiv.parentElement;
            for (let i = 0; i < 20 && container && container !== document.body; i++) {
                let name = null;
                for (const link of container.querySelectorAll('a[role="link"]')) {
                    const sp = link.querySelector('span');
                    if (!sp) continue;
                    const c = (sp.innerText || sp.textContent || '').trim();
                    if (c && c.length > 1 && c.length < 80 &&
                        c !== comment && !/^\d/.test(c) && !isUIText(c)) {
                        name = c; break;
                    }
                }
                if (name) {
                    const key = name + '\x00' + comment.substring(0, 120);
                    if (!seen.has(key)) {
                        seen.add(key);
                        const { label, score } = sentiment(comment);
                        out.push({ post: postLabel, name, comment, sentiment: label, score, lang: '', translatedComment: '' });
                    }
                    break;
                }
                container = container.parentElement;
            }
        }
    }

    return out;
}

// ═════════════════════════════════════════════════════════════════════════════
// PHASE 4: INCREMENTAL SCROLL + COLLECT
//
// Root cause of "only 4 comments" bug — fixed in findCommentScrollArea().
//
// Additional fixes here:
//   1. ALWAYS try container scroll + window scroll (not either/or).
//   2. After clicking "View more", wait 2 s for FB to inject new DOM nodes.
//   3. MAX_IDLE raised to 20 — handles slow connections / large threads.
//   4. MAX_ITEMS raised to 10 000.
// ═════════════════════════════════════════════════════════════════════════════
async function scrollAndCollect(seen, postLabel) {
    const SEE_MORE_KW = [
        'see more', 'see more\u2026',
        '\u0986\u09b0\u09cb \u09a6\u09c7\u0996\u09c1\u09a8',
        '\u0986\u09b0\u09cb\u0993 \u09a6\u09c7\u0996\u09c1\u09a8',
    ];
    const MAX_IDLE  = 20;      // rounds with no new comments before giving up
    const SCROLL_PX = 600;     // px per step
    const MAX_ITEMS = 10000;   // capacity cap

    const results  = [];
    let idleRounds = 0;
    let prevSize   = 0;

    showStatus('Step 4/5: Collecting comments...\n0 collected');

    while (idleRounds < MAX_IDLE && !_stopped) {
        const root = getCommentRoot();

        // 1. Click "View more comments / replies" — broad detection
        const moreBtns = findViewMoreBtns(root);
        if (moreBtns.length) {
            for (const el of moreBtns) {
                if (_stopped) return results;
                clickEl(el);
            }
            // Wait longer after clicking "View more" — Facebook needs time to load
            await sleep(2200);
        }

        // 2. Expand "See more" inside truncated comment text
        for (const el of root.querySelectorAll('div[dir="auto"] span,[role="button"]>span')) {
            if (_stopped) return results;
            const t = (el.textContent || '').trim().toLowerCase();
            if (SEE_MORE_KW.some(s => t === s)) {
                try { el.click(); } catch(e) {}
                await sleep(120);
            }
        }

        // 3. Harvest whatever is visible now
        const batch = harvestVisible(seen, postLabel);
        results.push.apply(results, batch);

        // 4. SCROLL — always try the comment container first;
        //             also scroll window (works on post permalink pages).
        //             We no longer skip window scroll on non-post pages because
        //             FB sometimes requires it even inside a dialog on feed pages.
        const container = findCommentScrollArea();
        if (container) {
            const beforeTop = container.scrollTop;
            container.scrollTop += SCROLL_PX;
            // If container is at the very bottom, nudge it again
            if (container.scrollTop === beforeTop) {
                container.scrollTop = container.scrollHeight;
            }
        }
        // Always try window scroll as supplemental trigger
        window.scrollBy(0, SCROLL_PX);
        document.documentElement.scrollTop += SCROLL_PX;

        await sleep(container ? 1100 : 1500);

        // 5. Track idle rounds (only increment when truly nothing new)
        const currentSize = seen.size;
        showStatus(
            'Step 4/5: Collecting...\n' +
            results.length + ' comments | idle ' + idleRounds + '/' + MAX_IDLE +
            (container ? '' : '\n(searching for scroll area...)')
        );

        if (currentSize > prevSize) {
            idleRounds = 0;
            prevSize   = currentSize;
        } else {
            idleRounds++;
        }

        if (results.length >= MAX_ITEMS) {
            showStatus('Step 4/5: Reached ' + MAX_ITEMS + ' comment cap');
            await sleep(400);
            break;
        }
    }

    return results;
}

// ═════════════════════════════════════════════════════════════════════════════
// CLOSE DIALOG / COLLAPSE COMMENTS
// ═════════════════════════════════════════════════════════════════════════════
async function closeCurrentComments(prevURL, commentBtn) {
    if (location.href !== prevURL) {
        history.back();
        await sleep(3000);
        return;
    }
    const dialog = document.querySelector('[role="dialog"]');
    if (dialog) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
        await sleep(800);
        const x = dialog.querySelector('[aria-label="Close"],[aria-label="close"]');
        if (x) { fireClick(x); await sleep(600); }
        return;
    }
    if (commentBtn) { try { commentBtn.click(); } catch(e) {} await sleep(600); }
}

// ═════════════════════════════════════════════════════════════════════════════
// BLUE BUTTON — Scrape the post currently open
// ═════════════════════════════════════════════════════════════════════════════
async function openAndScrape() {
    _paused  = false;
    _stopped = false;
    showStatus('FB Scraper: Starting...');

    try {
        const opened = await openCommentSection();
        if (!opened) {
            showStatus('Step 2/5: Looking for sort options...');
            await sleep(2000);
        }
        if (_stopped) return;

        await sortToAllComments();
        if (_stopped) return;

        const seen = new Set();
        let data   = await scrollAndCollect(seen, '');
        if (_stopped) return;

        if (!data.length) {
            hideStatus();
            alert('No comments found.\n\nTry:\n1. Reload the page (F5)\n2. Open the post directly (click its timestamp → permalink)\n3. Click Scrape This Post again');
            return;
        }

        // Step 5: translate Bangla → English
        if (_translateEnabled) {
            data = await translateResults(data);
        } else {
            data = data.map(r => ({ ...r, lang: isBangla(r.comment) ? 'bn' : 'en', translatedComment: '' }));
        }

        hideStatus();
        showChart(data);
    } catch(e) {
        hideStatus();
        alert('Error: ' + e.message);
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// GREEN BUTTON — Scrape all posts on current FB feed / profile page
// ═════════════════════════════════════════════════════════════════════════════
async function scrapeAllPosts() {
    _paused  = false;
    _stopped = false;

    const MAX_POSTS  = 20;
    const all        = [];
    const seen       = new Set();
    let processed    = 0;
    let noNewCount   = 0;
    const MAX_NO_NEW = 5;

    showStatus('Finding posts on page...');
    await sleep(500);

    while (processed < MAX_POSTS && !_stopped) {
        const allBtns = findCommentBtns().filter(el => {
            const r = el.getBoundingClientRect();
            return r.top > -400 && r.top < window.innerHeight * 3;
        });
        const newBtns = allBtns.filter(el => !el.dataset.fbScraped);

        if (!newBtns.length) {
            noNewCount++;
            if (noNewCount >= MAX_NO_NEW) break;
            showStatus('Looking for more posts...\n' + processed + ' done, ' + all.length + ' comments');
            window.scrollBy(0, Math.round(window.innerHeight * 0.7));
            await sleep(2000);
            continue;
        }
        noNewCount = 0;

        for (const btn of newBtns) {
            if (processed >= MAX_POSTS || _stopped) break;
            btn.dataset.fbScraped = '1';
            if (/^0\s+comments?$/i.test((btn.textContent || '').trim())) continue;

            showStatus('Post ' + (processed + 1) + '/' + MAX_POSTS + ': Opening...\n' + all.length + ' collected');

            try { btn.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch(e) {}
            await sleep(700);

            const prevURL = location.href;
            let cur = btn;
            for (let lv = 0; lv < 6 && cur && cur !== document.body; lv++, cur = cur.parentElement) {
                if (_stopped) break;
                fireClick(cur);
                await sleep(200);
                if (findMostRelevant() || location.href !== prevURL) break;
            }

            const ok = await waitFor(() => findMostRelevant() || (location.href !== prevURL && 'nav'), 6000);
            if (ok === 'nav') await sleep(3000);

            if (findMostRelevant()) {
                await sortToAllComments();
                if (!_stopped) {
                    const postData = await scrollAndCollect(seen, 'Post ' + (processed + 1));
                    all.push.apply(all, postData);
                    showStatus('Post ' + (processed + 1) + ': ' + postData.length + ' comments\nTotal: ' + all.length);
                }
                await closeCurrentComments(prevURL, btn);
            }

            processed++;
            await sleep(800);
        }

        window.scrollBy(0, Math.round(window.innerHeight * 0.7));
        await sleep(2000);
    }

    if (_stopped) return;

    if (!all.length) {
        hideStatus();
        alert('Checked ' + processed + ' posts — no comments found.\n\nTip: Use the Blue button on a specific post.');
        return;
    }

    let enriched = all;
    if (_translateEnabled) {
        enriched = await translateResults(all);
    } else {
        enriched = all.map(r => ({ ...r, lang: isBangla(r.comment) ? 'bn' : 'en', translatedComment: '' }));
    }

    hideStatus();
    showChart(enriched);
}

// ═════════════════════════════════════════════════════════════════════════════
// MESSAGE LISTENER
// ═════════════════════════════════════════════════════════════════════════════
chrome.runtime.onMessage.addListener((req, _sender, sendResponse) => {
    (async () => {
        if (typeof req.translate === 'boolean') _translateEnabled = req.translate;

        if (req.action === 'openAndScrape')  await openAndScrape();
        if (req.action === 'scrapeAllPosts') await scrapeAllPosts();
        if (req.action === 'pause') {
            _paused = true;
            if (_pauseBtn) { _pauseBtn.textContent = 'Resume'; _pauseBtn.style.background = 'rgba(255,200,0,0.55)'; }
        }
        if (req.action === 'resume') {
            _paused = false;
            if (_pauseBtn) { _pauseBtn.textContent = 'Pause'; _pauseBtn.style.background = 'rgba(255,255,255,0.28)'; }
        }
        if (req.action === 'stop') {
            _stopped = true; _paused = false; hideStatus();
        }
        sendResponse({ done: true });
    })();
    return true;
});
