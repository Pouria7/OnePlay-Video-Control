/**
 * Universal Floating Video Controls - Background Service Worker (Manifest V3)
 *
 * Ephemeral background service worker managing extension lifecycle, default storage,
 * and icon badges. Never retains mutable state in variables across executions.
 */

import { DEFAULT_GLOBAL_SETTINGS } from '../storage/types';

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // Initialize default storage schema
    const existing = await chrome.storage.sync.get(['globalSettings', 'siteSettings', 'customThemes']);
    if (!existing.globalSettings) {
      await chrome.storage.sync.set({
        globalSettings: DEFAULT_GLOBAL_SETTINGS,
        siteSettings: {
          'instagram.com': {
            enabled: true,
            minWidth: 180,
            minHeight: 180,
            visibilityThreshold: 0.65,
            allowMultiple: false
          },
          'youtube.com': {
            enabled: true,
            minWidth: 120,
            minHeight: 80,
            visibilityThreshold: 0.5,
            allowMultiple: true
          }
        },
        customThemes: {}
      });
    }
  }
});

// Listener for runtime messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'PING') {
    sendResponse({ status: 'PONG', version: chrome.runtime.getManifest().version });
    return true;
  }
  return false;
});
