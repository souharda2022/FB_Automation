
// Background service worker — handles CSV download from content script
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === 'downloadCSV') {
        // Use data URL so no blob URL issues across contexts
        const dataUrl = 'data:text/csv;charset=utf-8,' + encodeURIComponent(msg.csv);
        chrome.downloads.download(
            { url: dataUrl, filename: msg.filename || 'fb_sentiment.csv', saveAs: false },
            (id) => sendResponse({ ok: true, id })
        );
        return true; // async response
    }
});
