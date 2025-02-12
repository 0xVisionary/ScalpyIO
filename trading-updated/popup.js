document.getElementById('toggleSidebar').addEventListener('click', async () => {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            // Execute the content script first
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['contentScript.js']
            });
            // Then send the message
            chrome.tabs.sendMessage(tab.id, { action: "toggleSidebar" });
        }
    } catch (error) {
        console.error('Error:', error);
    }
}); 