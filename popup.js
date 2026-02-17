
document.getElementById("scrapeBtn").addEventListener("click", async () => {
    // Hardcoded XPath from user for the comment span
    const xpath = "/html/body/div[1]/div/div[1]/div/div[4]/div/div/div[1]/div/div[2]/div/div/div/div/div/div/div[2]/div[2]/div/div/div[2]/div/div[2]/div[1]/div/div/span";
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    // Request the content script to click the provided XPath, then scrape after a short delay
    chrome.tabs.sendMessage(tab.id, { action: "clickComment", xpath }, (response) => {
        // inform user if click succeeded or failed
        try {
            if (!response || !response.clicked) {
                alert('Could not open comment section automatically. The XPath may be incorrect or the element is not clickable.');
            }
        } catch (e) {}

        // wait longer to allow comment section to fully load before scraping
        setTimeout(() => {
            chrome.tabs.sendMessage(tab.id, { action: "scrapeComments" });
        }, 4000);
    });
});
