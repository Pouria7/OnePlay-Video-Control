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

  if (message.type === 'DOWNLOAD_VIDEO') {
    const url = message.url;
    const filename = message.filename || `video_${Date.now()}.mp4`;

    // Background service worker cannot download page-scoped blob: URLs across origins
    if (typeof url === 'string' && url.startsWith('blob:')) {
      sendResponse({ success: false, isBlob: true, error: 'Blob URLs must be downloaded in tab context' });
      return true;
    }

    if (chrome.downloads) {
      chrome.downloads.download(
        {
          url,
          filename,
          saveAs: true
        },
        (downloadId) => {
          if (chrome.runtime.lastError) {
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
          } else {
            sendResponse({ success: true, downloadId });
          }
        }
      );
      return true;
    } else {
      sendResponse({ success: false, error: 'Downloads API unavailable' });
      return true;
    }
  }

  return false;
});
