document.addEventListener('DOMContentLoaded', () => {

    const toggle = document.getElementById('translateToggle');

    // ── Restore saved preference ──────────────────────────────────────────
    chrome.storage.local.get('translateEnabled', ({ translateEnabled }) => {
        // Default ON if never saved
        toggle.checked = (translateEnabled !== false);
    });

    // ── Persist preference on change ──────────────────────────────────────
    toggle.addEventListener('change', () => {
        chrome.storage.local.set({ translateEnabled: toggle.checked });
    });

    // ── Send message to content script (inject if needed) ─────────────────
    function send(action) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs || !tabs[0]) {
                alert('No active tab found. Make sure you are on a Facebook page.');
                return;
            }
            const msg = { action, translate: toggle.checked };

            chrome.tabs.sendMessage(tabs[0].id, msg, (_resp) => {
                if (chrome.runtime.lastError) {
                    // Content script not yet injected — inject then retry
                    chrome.scripting.executeScript(
                        { target: { tabId: tabs[0].id }, files: ['content.js'] },
                        () => chrome.tabs.sendMessage(tabs[0].id, msg)
                    );
                }
            });
        });
    }

    document.getElementById('scrapeBtn').addEventListener('click', () => {
        send('openAndScrape');
    });

    document.getElementById('scrapeAllBtn').addEventListener('click', () => {
        send('scrapeAllPosts');
    });

});
