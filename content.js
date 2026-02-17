
function downloadCSV(data) {
    let csv = "\uFEFFName,Comment\n"; // BOM for Excel UTF-8 support
    data.forEach(row => {
        const name = row.name.replace(/"/g, '""');
        const comment = row.comment.replace(/"/g, '""');
        csv += `"${name}","${comment}"\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "facebook_comments.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function dispatchMouseEvents(el) {
    try {
        const rect = el.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        ['mousedown', 'mouseup', 'click'].forEach(type => {
            el.dispatchEvent(new MouseEvent(type, {
                view: window, bubbles: true, cancelable: true, clientX: x, clientY: y
            }));
        });
        return true;
    } catch (e) { return false; }
}

function clickWithFallbacks(el) {
    if (!el) return false;
    try { el.scrollIntoView({ block: 'center', behavior: 'auto' }); } catch (e) {}
    try { el.click(); return true; } catch (e) {}
    if (dispatchMouseEvents(el)) return true;
    let cur = el;
    for (let i = 0; i < 5 && cur; i++) {
        const btn = cur.closest('a, button, [role="button"]');
        if (btn) {
            try { btn.scrollIntoView({ block: 'center' }); btn.click(); return true; } catch (e) {}
            if (dispatchMouseEvents(btn)) return true;
        }
        cur = cur.parentElement;
    }
    return false;
}

function clickElementByXPath(xpath) {
    try {
        const res = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const node = res.singleNodeValue;
        if (!node) return false;
        const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
        return clickWithFallbacks(el);
    } catch (e) { return false; }
}

function clickElementByText(text) {
    if (!text) return false;
    const needle = text.trim().toLowerCase();
    const elems = Array.from(document.querySelectorAll('span,div,a,button,li'));

    // exact match first
    for (const el of elems) {
        const txt = el.textContent && el.textContent.trim();
        if (txt && txt.toLowerCase() === needle) {
            const btn = el.closest('a, button, [role="button"]');
            if (btn) { try { btn.click(); return true; } catch (e) {} }
            try { el.click(); return true; } catch (e) {}
        }
    }
    // partial match fallback
    for (const el of elems) {
        const txt = el.textContent && el.textContent.trim();
        if (txt && txt.toLowerCase().includes(needle)) {
            const btn = el.closest('a, button, [role="button"]');
            if (btn) { try { btn.click(); return true; } catch (e) {} }
            try { el.click(); return true; } catch (e) {}
        }
    }
    return false;
}

async function waitForElement(selector, timeoutMs = 8000) {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
        const el = document.querySelector(selector);
        if (el) return el;
        await sleep(300);
    }
    return null;
}

// Expand "View more comments", "See more replies", etc.
async function expandAllComments() {
    const loadMoreTexts = [
        'view more comments', 'view more', 'see more comments',
        'more comments', 'load more comments', 'view previous comments',
        'view more replies', 'see more replies', 'more replies',
        'view replies', 'show more'
    ];
    const seeMoreTexts = ['see more', 'see more…', 'see more...'];

    const end = Date.now() + 20000;
    while (Date.now() < end) {
        let clicked = false;

        // Expand truncated comment texts
        const inlineSeeMores = Array.from(document.querySelectorAll('span,div')).filter(el => {
            const t = el.textContent && el.textContent.trim().toLowerCase();
            return t && seeMoreTexts.some(s => t === s || t.startsWith(s));
        });
        for (const el of inlineSeeMores) {
            if (clickWithFallbacks(el)) { clicked = true; await sleep(200); }
        }

        // Load more comments/replies
        const candidates = Array.from(document.querySelectorAll('a,button,div[role="button"],span'));
        for (const el of candidates) {
            const txt = el.innerText && el.innerText.trim().toLowerCase();
            if (!txt) continue;
            if (loadMoreTexts.some(mt => txt.includes(mt))) {
                if (clickWithFallbacks(el)) { clicked = true; await sleep(300); }
            }
        }

        try { window.scrollBy(0, window.innerHeight); } catch (e) {}
        await sleep(400);
        if (!clicked) break;
    }
}

async function scrapeComments() {
    await expandAllComments();
    await sleep(800);

    const comments = [];
    const seen = new Set();

    // --- Method 1: Standard [role="article"] structure ---
    const roots = [document];
    document.querySelectorAll('[role="dialog"], [aria-modal="true"]').forEach(d => roots.push(d));

    for (const root of roots) {
        root.querySelectorAll('[role="article"]').forEach(block => {
            const nameEl =
                block.querySelector('a[role="link"] > span') ||
                block.querySelector('h3 a span') ||
                block.querySelector('h3') ||
                block.querySelector('strong') ||
                block.querySelector('a[href*="facebook.com"] span');

            const textEl =
                block.querySelector('[data-ad-preview="message"]') ||
                block.querySelector('div[dir="auto"][style*="text-align: start"]') ||
                block.querySelector('div[dir="auto"] > span') ||
                block.querySelector('div[dir="auto"]');

            if (nameEl && textEl) {
                const name = nameEl.innerText.trim();
                const comment = textEl.innerText.trim();
                const key = name + '||' + comment;
                if (name && comment && name !== comment && !seen.has(key)) {
                    seen.add(key);
                    comments.push({ name, comment });
                }
            }
        });
    }

    // --- Method 2: Walk up from comment text divs (fallback) ---
    if (comments.length === 0) {
        document.querySelectorAll('div[dir="auto"][style*="text-align: start"]').forEach(textDiv => {
            const commentText = textDiv.innerText.trim();
            if (!commentText) return;

            let container = textDiv.parentElement;
            for (let i = 0; i < 10 && container && container !== document.body; i++) {
                const nameEl =
                    container.querySelector('a[role="link"] > span') ||
                    container.querySelector('a[href*="facebook.com"] span') ||
                    container.querySelector('h3') ||
                    container.querySelector('strong');

                if (nameEl) {
                    const name = nameEl.innerText.trim();
                    const key = name + '||' + commentText;
                    if (name && name !== commentText && !seen.has(key)) {
                        seen.add(key);
                        comments.push({ name, comment: commentText });
                    }
                    break;
                }
                container = container.parentElement;
            }
        });
    }

    if (comments.length === 0) {
        alert("No comments found. Make sure the comment section is fully loaded and try again.");
    } else {
        downloadCSV(comments);
        alert(`Downloaded ${comments.length} comments.`);
    }
}

// XPaths provided by user
const COMMENT_BTN_XPATH   = '/html/body/div[1]/div/div[1]/div/div[4]/div/div/div[1]/div/div[2]/div/div/div/div/div/div/div[2]/div[2]/div/div/div[2]/div/div[2]/div[1]/div/div/span';
const ALL_COMMENTS_XPATH  = '/html/body/div[1]/div/div[1]/div/div[4]/div/div/div[1]/div/div[3]/div/div/div[1]/div[1]/div/div/div/div/div/div/div[1]/div/div[3]/div[1]/div/div[1]/span';

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    (async () => {

        // ── SCRAPE ──────────────────────────────────────────────────────────
        if (request.action === 'scrapeComments') {
            await scrapeComments();
            sendResponse({ scraped: true });
            return;
        }

        // ── CLICK COMMENT BUTTON → MOST RELEVANT → ALL COMMENTS ────────────
        if (request.action === 'clickComment') {
            let result = { clicked: false, via: null };

            // Step 1: Click the "Comment" action button on the post
            const commentXPath = request.xpath || COMMENT_BTN_XPATH;
            for (let i = 0; i < 4; i++) {
                if (clickElementByXPath(commentXPath)) {
                    result = { clicked: true, via: 'xpath' };
                    break;
                }
                await sleep(400);
            }

            // Fallback: auto-detect Comment button
            if (!result.clicked) {
                for (let i = 0; i < 4; i++) {
                    const ok = clickElementByText('Comment') || clickElementByText('Comments');
                    if (ok) { result = { clicked: true, via: 'auto' }; break; }
                    await sleep(400);
                }
            }

            if (!result.clicked) {
                sendResponse(result);
                return;
            }

            // Wait for comment section to appear
            await sleep(1000);
            await waitForElement('[role="article"]', 6000);

            // Step 2: Click "Most relevant" to open sort dropdown
            for (let i = 0; i < 5; i++) {
                const ok = clickElementByText('Most relevant') || clickElementByText('Most Relevant');
                if (ok) { await sleep(700); break; }
                await sleep(400);
            }

            // Step 3: Click "All comments" option using XPath, then text fallbacks
            for (let i = 0; i < 6; i++) {
                const ok = clickElementByXPath(ALL_COMMENTS_XPATH)
                    || clickElementByText('All comments')
                    || clickElementByText('All Comments')
                    || clickElementByText('Show all comments, including potential spam')
                    || clickElementByText('All comments, including potential spam');
                if (ok) { result.via = 'xpath->allcomments'; await sleep(800); break; }
                await sleep(500);
            }

            // Wait for comments to fully load
            await waitForElement('[role="article"]', 8000);
            await sleep(500);
            result.foundComments = document.querySelectorAll('[role="article"]').length > 0;

            sendResponse(result);
            return;
        }

    })();
    return true;
});
