document.getElementById("toggleSidebar").addEventListener("click", async () => {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab) {
      // Toggle the side panel
      chrome.sidePanel.open({ windowId: tab.windowId });
      // Close the popup
      window.close();
    }
  } catch (error) {
    console.error("Error:", error);
  }
});
