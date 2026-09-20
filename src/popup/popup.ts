/**
 * Popup Script for Universal Video Controls
 */

import { storageManager } from '../storage/storage-manager';
import { DEFAULT_SHORTCUTS } from '../storage/types';
import { getDomainFromUrl } from '../utils/url';
import { formatShortcutForDisplay } from '../utils/shortcuts';

document.addEventListener('DOMContentLoaded', async () => {
  const versionBadge = document.getElementById('versionBadge') as HTMLElement;
  const siteDomainName = document.getElementById('siteDomainName') as HTMLElement;
  const activeSiteBadge = document.getElementById('activeSiteBadge') as HTMLElement;
  const siteAdapterName = document.getElementById('siteAdapterName') as HTMLElement;
  const activeVideoCount = document.getElementById('activeVideoCount') as HTMLElement;

  const globalEnableToggle = document.getElementById('globalEnableToggle') as HTMLInputElement;
  const globalThemeSelect = document.getElementById('globalThemeSelect') as HTMLSelectElement;
  const globalPositionSelect = document.getElementById('globalPositionSelect') as HTMLSelectElement;
  const globalLayoutSelect = document.getElementById('globalLayoutSelect') as HTMLSelectElement;

  const siteEnableToggle = document.getElementById('siteEnableToggle') as HTMLInputElement;
  const siteThemeSelect = document.getElementById('siteThemeSelect') as HTMLSelectElement;
  const sitePositionSelect = document.getElementById('sitePositionSelect') as HTMLSelectElement;
  const siteLayoutSelect = document.getElementById('siteLayoutSelect') as HTMLSelectElement;
  const openOptionsBtn = document.getElementById('openOptionsBtn') as HTMLButtonElement;

  // Set manifest version
  if (typeof chrome !== 'undefined' && chrome.runtime?.getManifest) {
    const manifest = chrome.runtime.getManifest();
    versionBadge.textContent = `v${manifest.version}`;
  }

  // Open Options Page button
  if (openOptionsBtn) {
    openOptionsBtn.addEventListener('click', () => {
      if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        window.open('options/options.html');
      }
    });
  }

  // Determine current active tab domain
  let currentDomain = '';
  let activeTabId: number | undefined;

  if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url) {
        activeTabId = tab.id;
        currentDomain = getDomainFromUrl(tab.url);
      }
    } catch (err) {
      console.warn('[UFVC Popup] Could not query active tab:', err);
    }
  }

  siteDomainName.textContent = currentDomain || 'Web';

  // Load configuration from storage
  const storageData = await storageManager.getAll();
  const globalSettings = storageData.globalSettings;
  const siteSettings = currentDomain ? storageData.siteSettings[currentDomain] || {} : {};

  // Append custom themes to selectors if any
  Object.keys(storageData.customThemes).forEach((id) => {
    const custom = storageData.customThemes[id];
    const optGlobal = document.createElement('option');
    optGlobal.value = custom.id;
    optGlobal.textContent = `${custom.name} (Custom)`;
    globalThemeSelect.appendChild(optGlobal);

    const optSite = document.createElement('option');
    optSite.value = custom.id;
    optSite.textContent = `${custom.name} (Custom)`;
    siteThemeSelect.appendChild(optSite);
  });

  globalEnableToggle.checked = globalSettings.enabled;
  globalThemeSelect.value = globalSettings.defaultTheme || 'classic-dark';
  globalPositionSelect.value = globalSettings.controllerPosition || 'bottom-inside';
  globalLayoutSelect.value = globalSettings.controlsLayout || 'full';

  siteEnableToggle.checked = siteSettings.enabled !== undefined ? siteSettings.enabled : true;
  siteThemeSelect.value = siteSettings.theme || '';
  sitePositionSelect.value = siteSettings.controllerPosition || '';
  siteLayoutSelect.value = siteSettings.controlsLayout || '';

  // Render Shortcuts Cheatsheet values
  const popScPlay = document.getElementById('popScPlay');
  const popScSeek = document.getElementById('popScSeek');
  const popScVol = document.getElementById('popScVol');
  const popScMute = document.getElementById('popScMute');
  const shortcuts = globalSettings.shortcuts || DEFAULT_SHORTCUTS;

  if (popScPlay) popScPlay.textContent = formatShortcutForDisplay(shortcuts.togglePlay);
  if (popScSeek) popScSeek.textContent = `${formatShortcutForDisplay(shortcuts.seekBackward)} / ${formatShortcutForDisplay(shortcuts.seekForward)}`;
  if (popScVol) popScVol.textContent = `${formatShortcutForDisplay(shortcuts.volumeUp)} / ${formatShortcutForDisplay(shortcuts.volumeDown)}`;
  if (popScMute) popScMute.textContent = formatShortcutForDisplay(shortcuts.toggleMute);

  // Query content script for live status
  if (activeTabId) {
    try {
      chrome.tabs.sendMessage(activeTabId, { type: 'GET_STATUS' }, (response) => {
        if (chrome.runtime.lastError || !response) {
          activeSiteBadge.textContent = 'Standby';
          activeSiteBadge.style.color = '#9ca3af';
          activeSiteBadge.style.borderColor = '#374151';
          return;
        }

        activeSiteBadge.textContent = 'Active';
        if (response.adapterName) {
          siteAdapterName.textContent = `Adapter: ${response.adapterName}`;
        }
        if (response.activeCount !== undefined) {
          activeVideoCount.textContent = String(response.activeCount);
        }
      });
    } catch (err) {
      console.warn('[UFVC Popup] Content script message failed:', err);
    }
  }

  // Handle setting updates
  globalEnableToggle.addEventListener('change', async () => {
    await storageManager.setGlobalSettings({ enabled: globalEnableToggle.checked });
  });

  globalThemeSelect.addEventListener('change', async () => {
    await storageManager.setGlobalSettings({ defaultTheme: globalThemeSelect.value });
  });

  globalPositionSelect.addEventListener('change', async () => {
    await storageManager.setGlobalSettings({
      controllerPosition: globalPositionSelect.value as any
    });
  });

  globalLayoutSelect.addEventListener('change', async () => {
    await storageManager.setGlobalSettings({
      controlsLayout: globalLayoutSelect.value as any
    });
  });

  if (currentDomain) {
    siteEnableToggle.addEventListener('change', async () => {
      await storageManager.setSiteSettings(currentDomain, {
        enabled: siteEnableToggle.checked
      });
    });

    siteThemeSelect.addEventListener('change', async () => {
      const selectedTheme = siteThemeSelect.value ? siteThemeSelect.value : undefined;
      await storageManager.setSiteSettings(currentDomain, {
        theme: selectedTheme
      });
    });

    sitePositionSelect.addEventListener('change', async () => {
      const selectedPos = sitePositionSelect.value ? (sitePositionSelect.value as any) : undefined;
      await storageManager.setSiteSettings(currentDomain, {
        controllerPosition: selectedPos
      });
    });

    siteLayoutSelect.addEventListener('change', async () => {
      const selectedLayout = siteLayoutSelect.value ? (siteLayoutSelect.value as any) : undefined;
      await storageManager.setSiteSettings(currentDomain, {
        controlsLayout: selectedLayout
      });
    });
  } else {
    siteEnableToggle.disabled = true;
    siteThemeSelect.disabled = true;
    sitePositionSelect.disabled = true;
    siteLayoutSelect.disabled = true;
  }
});
