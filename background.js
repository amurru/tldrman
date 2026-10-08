// Service worker: only job is to make the toolbar icon open the side panel.
// Static default_path is used (no per-tab setOptions) because Vivaldi
// has rendering bugs with dynamic sidePanel.setOptions.
chrome.runtime.onInstalled.addListener(async () => {
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch (e) {
    console.warn("setPanelBehavior failed:", e);
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.sidePanel.open({ windowId: tab.windowId });
  } catch (e) {
    console.warn("sidePanel.open failed:", e);
  }
});
