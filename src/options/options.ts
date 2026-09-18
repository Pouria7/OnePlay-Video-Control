/**
 * Options Dashboard Logic: Settings, Domain Management & Theme Builder
 */

import { storageManager } from '../storage/storage-manager';
import { BUILTIN_THEMES } from '../themes/default-themes';
import { CustomThemeDefinition, DefaultSitePolicy, StorageSchema } from '../storage/types';
import { normalizeDomain } from '../utils/url';
import { adapterManager } from '../content/adapters/adapter-manager';

document.addEventListener('DOMContentLoaded', async () => {
  // Navigation Tabs
  const navItems = document.querySelectorAll<HTMLAnchorElement>('.nav-item');
  const sections = document.querySelectorAll<HTMLElement>('.content-section');

  navItems.forEach((nav) => {
    nav.addEventListener('click', (e) => {
      e.preventDefault();
      const targetTab = nav.getAttribute('data-tab');
      navItems.forEach((item) => item.classList.remove('active'));
      nav.classList.add('active');

      sections.forEach((sec) => {
        if (sec.id === `section-${targetTab}`) {
          sec.classList.add('active');
        } else {
          sec.classList.remove('active');
        }
      });
    });
  });

  // Load Manifest Version
  if (typeof chrome !== 'undefined' && chrome.runtime?.getManifest) {
    const versionLabel = document.getElementById('optVersion');
    if (versionLabel) {
      versionLabel.textContent = `Version ${chrome.runtime.getManifest().version}`;
    }
  }

  // Load Storage Data
  let storageData: StorageSchema = await storageManager.getAll();

  // General Settings Elements
  const optGlobalEnabled = document.getElementById('optGlobalEnabled') as HTMLInputElement;
  const policyUniversal = document.getElementById('policyUniversal') as HTMLInputElement;
  const policySelective = document.getElementById('policySelective') as HTMLInputElement;
  const optDefaultTheme = document.getElementById('optDefaultTheme') as HTMLSelectElement;
  const optDefaultPosition = document.getElementById('optDefaultPosition') as HTMLSelectElement;
  const optDefaultLayout = document.getElementById('optDefaultLayout') as HTMLSelectElement;
  const optAllowMultiple = document.getElementById('optAllowMultiple') as HTMLInputElement;

  const optMinWidth = document.getElementById('optMinWidth') as HTMLInputElement;
  const valMinSize = document.getElementById('valMinSize') as HTMLElement;
  const optVisibility = document.getElementById('optVisibility') as HTMLInputElement;
  const valVisibility = document.getElementById('valVisibility') as HTMLElement;
  const optSeek = document.getElementById('optSeek') as HTMLInputElement;
  const valSeek = document.getElementById('valSeek') as HTMLElement;
  const optAutoHide = document.getElementById('optAutoHide') as HTMLInputElement;
  const valAutoHide = document.getElementById('valAutoHide') as HTMLElement;

  // Initialize General Settings values
  function initGeneralSettings() {
    const g = storageData.globalSettings;
    optGlobalEnabled.checked = g.enabled;

    if (g.defaultSitePolicy === 'selective') {
      policySelective.checked = true;
    } else {
      policyUniversal.checked = true;
    }

    optDefaultTheme.value = g.defaultTheme || 'minimal';
    optDefaultPosition.value = g.controllerPosition || 'bottom-inside';
    optDefaultLayout.value = g.controlsLayout || 'full';
    optAllowMultiple.checked = g.allowMultiple;

    optMinWidth.value = String(g.minWidth);
    valMinSize.textContent = `${g.minWidth} × ${g.minHeight} px`;

    optVisibility.value = String(Math.round(g.visibilityThreshold * 100));
    valVisibility.textContent = `${Math.round(g.visibilityThreshold * 100)}%`;

    optSeek.value = String(g.seekInterval);
    valSeek.textContent = `${g.seekInterval} seconds`;

    optAutoHide.value = String(g.autoHideDelay);
    valAutoHide.textContent = `${(g.autoHideDelay / 1000).toFixed(1)} seconds`;
  }
  initGeneralSettings();

  // General Settings Event Handlers
  optGlobalEnabled.addEventListener('change', async () => {
    await storageManager.setGlobalSettings({ enabled: optGlobalEnabled.checked });
  });

  const handlePolicyChange = async () => {
    const policy: DefaultSitePolicy = policySelective.checked ? 'selective' : 'universal';
    await storageManager.setGlobalSettings({ defaultSitePolicy: policy });
  };
  policyUniversal.addEventListener('change', handlePolicyChange);
  policySelective.addEventListener('change', handlePolicyChange);

  optDefaultTheme.addEventListener('change', async () => {
    await storageManager.setGlobalSettings({ defaultTheme: optDefaultTheme.value });
  });

  optDefaultPosition.addEventListener('change', async () => {
    await storageManager.setGlobalSettings({
      controllerPosition: optDefaultPosition.value as any
    });
  });

  optDefaultLayout.addEventListener('change', async () => {
    await storageManager.setGlobalSettings({
      controlsLayout: optDefaultLayout.value as any
    });
  });

  optAllowMultiple.addEventListener('change', async () => {
    await storageManager.setGlobalSettings({ allowMultiple: optAllowMultiple.checked });
  });

  optMinWidth.addEventListener('input', async () => {
    const w = parseInt(optMinWidth.value, 10);
    const h = Math.round((w * 3) / 4); // 4:3 aspect ratio guideline
    valMinSize.textContent = `${w} × ${h} px`;
    await storageManager.setGlobalSettings({ minWidth: w, minHeight: h });
  });

  optVisibility.addEventListener('input', async () => {
    const val = parseInt(optVisibility.value, 10);
    valVisibility.textContent = `${val}%`;
    await storageManager.setGlobalSettings({ visibilityThreshold: val / 100 });
  });

  optSeek.addEventListener('input', async () => {
    const s = parseInt(optSeek.value, 10);
    valSeek.textContent = `${s} seconds`;
    await storageManager.setGlobalSettings({ seekInterval: s });
  });

  optAutoHide.addEventListener('input', async () => {
    const ms = parseInt(optAutoHide.value, 10);
    valAutoHide.textContent = `${(ms / 1000).toFixed(1)} seconds`;
    await storageManager.setGlobalSettings({ autoHideDelay: ms });
  });

  // --- Sites Table Manager ---
  const sitesTableBody = document.getElementById('sitesTableBody') as HTMLElement;
  const siteSearchInput = document.getElementById('siteSearchInput') as HTMLInputElement;
  const newDomainInput = document.getElementById('newDomainInput') as HTMLInputElement;
  const addSiteBtn = document.getElementById('addSiteBtn') as HTMLButtonElement;

  function renderSitesTable(filter = '') {
    sitesTableBody.innerHTML = '';
    const sites = storageData.siteSettings;
    const domains = Object.keys(sites).sort();

    const filtered = domains.filter((d) => d.toLowerCase().includes(filter.toLowerCase()));

    if (filtered.length === 0) {
      const emptyRow = document.createElement('tr');
      emptyRow.innerHTML = `<td colspan="5" style="text-align:center; color: var(--text-secondary); padding: 24px;">No configured sites found.</td>`;
      sitesTableBody.appendChild(emptyRow);
      return;
    }

    filtered.forEach((domain) => {
      const cfg = sites[domain];
      const adapter = adapterManager.resolve(new URL(`https://${domain}`));

      const tr = document.createElement('tr');

      // Theme options HTML
      let themeOptions = `<option value="">(Inherit Global)</option>`;
      Object.keys(BUILTIN_THEMES).forEach((tKey) => {
        const sel = cfg.theme === tKey ? 'selected' : '';
        themeOptions += `<option value="${tKey}" ${sel}>${BUILTIN_THEMES[tKey].name}</option>`;
      });
      Object.keys(storageData.customThemes).forEach((cKey) => {
        const sel = cfg.theme === cKey ? 'selected' : '';
        themeOptions += `<option value="${cKey}" ${sel}>${storageData.customThemes[cKey].name} (Custom)</option>`;
      });

      // Position options HTML
      const positionOptions = `
        <option value="">(Inherit)</option>
        <option value="bottom-inside" ${cfg.controllerPosition === 'bottom-inside' ? 'selected' : ''}>Bottom (Inside)</option>
        <option value="bottom-outside" ${cfg.controllerPosition === 'bottom-outside' ? 'selected' : ''}>Bottom (Outside)</option>
        <option value="top-inside" ${cfg.controllerPosition === 'top-inside' ? 'selected' : ''}>Top (Inside)</option>
        <option value="top-outside" ${cfg.controllerPosition === 'top-outside' ? 'selected' : ''}>Top (Outside)</option>
      `;

      // Layout options HTML
      const layoutOptions = `
        <option value="">(Inherit)</option>
        <option value="full" ${cfg.controlsLayout === 'full' ? 'selected' : ''}>Full</option>
        <option value="minimal" ${cfg.controlsLayout === 'minimal' ? 'selected' : ''}>Minimal</option>
      `;

      const isEnabled = cfg.enabled !== undefined ? cfg.enabled : true;

      tr.innerHTML = `
        <td><span class="domain-badge">${domain}</span></td>
        <td><span class="adapter-tag">${adapter.name}</span></td>
        <td>
          <label class="toggle-switch">
            <input type="checkbox" class="site-toggle" data-domain="${domain}" ${isEnabled ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </td>
        <td>
          <select class="dashboard-select site-theme-select" data-domain="${domain}">
            ${themeOptions}
          </select>
        </td>
        <td>
          <select class="dashboard-select site-position-select" data-domain="${domain}">
            ${positionOptions}
          </select>
        </td>
        <td>
          <select class="dashboard-select site-layout-select" data-domain="${domain}">
            ${layoutOptions}
          </select>
        </td>
        <td>
          <button class="btn-danger remove-site-btn" data-domain="${domain}">Reset / Remove</button>
        </td>
      `;

      sitesTableBody.appendChild(tr);
    });

    // Attach table listeners
    sitesTableBody.querySelectorAll('.site-toggle').forEach((toggle) => {
      toggle.addEventListener('change', async (e) => {
        const target = e.target as HTMLInputElement;
        const dom = target.getAttribute('data-domain')!;
        await storageManager.setSiteSettings(dom, { enabled: target.checked });
      });
    });

    sitesTableBody.querySelectorAll('.site-theme-select').forEach((sel) => {
      sel.addEventListener('change', async (e) => {
        const target = e.target as HTMLSelectElement;
        const dom = target.getAttribute('data-domain')!;
        const val = target.value ? target.value : undefined;
        await storageManager.setSiteSettings(dom, { theme: val });
      });
    });

    sitesTableBody.querySelectorAll('.site-position-select').forEach((sel) => {
      sel.addEventListener('change', async (e) => {
        const target = e.target as HTMLSelectElement;
        const dom = target.getAttribute('data-domain')!;
        const val = target.value ? (target.value as any) : undefined;
        await storageManager.setSiteSettings(dom, { controllerPosition: val });
      });
    });

    sitesTableBody.querySelectorAll('.site-layout-select').forEach((sel) => {
      sel.addEventListener('change', async (e) => {
        const target = e.target as HTMLSelectElement;
        const dom = target.getAttribute('data-domain')!;
        const val = target.value ? (target.value as any) : undefined;
        await storageManager.setSiteSettings(dom, { controlsLayout: val });
      });
    });

    sitesTableBody.querySelectorAll('.remove-site-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const target = e.target as HTMLButtonElement;
        const dom = target.getAttribute('data-domain')!;
        delete storageData.siteSettings[dom];
        // persist removal
        await chrome.storage.sync.set({ siteSettings: storageData.siteSettings });
        renderSitesTable(siteSearchInput.value);
      });
    });
  }

  renderSitesTable();

  siteSearchInput.addEventListener('input', () => {
    renderSitesTable(siteSearchInput.value);
  });

  addSiteBtn.addEventListener('click', async () => {
    const raw = newDomainInput.value.trim();
    if (!raw) return;
    const domain = normalizeDomain(raw);
    if (!domain) return;

    await storageManager.setSiteSettings(domain, { enabled: true });
    storageData = await storageManager.getAll();
    newDomainInput.value = '';
    renderSitesTable(siteSearchInput.value);
  });

  // --- Visual Theme Builder & Live Preview ---
  const builderThemeSelect = document.getElementById('builderThemeSelect') as HTMLSelectElement;
  const builderThemeName = document.getElementById('builderThemeName') as HTMLInputElement;
  const builderBgColor = document.getElementById('builderBgColor') as HTMLInputElement;
  const builderTextColor = document.getElementById('builderTextColor') as HTMLInputElement;
  const builderAccentColor = document.getElementById('builderAccentColor') as HTMLInputElement;
  const builderBorderColor = document.getElementById('builderBorderColor') as HTMLInputElement;
  const builderOpacity = document.getElementById('builderOpacity') as HTMLInputElement;
  const valBuilderOpacity = document.getElementById('valBuilderOpacity') as HTMLElement;
  const builderBlur = document.getElementById('builderBlur') as HTMLInputElement;
  const valBuilderBlur = document.getElementById('valBuilderBlur') as HTMLElement;
  const builderRadius = document.getElementById('builderRadius') as HTMLInputElement;
  const valBuilderRadius = document.getElementById('valBuilderRadius') as HTMLElement;
  const builderScale = document.getElementById('builderScale') as HTMLInputElement;
  const valBuilderScale = document.getElementById('valBuilderScale') as HTMLElement;

  const saveThemeBtn = document.getElementById('saveThemeBtn') as HTMLButtonElement;
  const deleteThemeBtn = document.getElementById('deleteThemeBtn') as HTMLButtonElement;
  const mockBar = document.getElementById('mockBar') as HTMLElement;

  function hexToRgba(hex: string, alpha: number): string {
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
    const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
    const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
  }

  function updateLivePreview() {
    const opacity = parseInt(builderOpacity.value, 10) / 100;
    valBuilderOpacity.textContent = `${Math.round(opacity * 100)}%`;

    const blurVal = `${builderBlur.value}px`;
    valBuilderBlur.textContent = blurVal;

    const radiusVal = `${builderRadius.value}px`;
    valBuilderRadius.textContent = radiusVal;

    const scaleVal = (parseInt(builderScale.value, 10) / 100).toFixed(2);
    valBuilderScale.textContent = `${scaleVal}x`;

    const bgRgba = hexToRgba(builderBgColor.value, opacity);

    // Apply styles to mock bar
    mockBar.style.background = bgRgba;
    mockBar.style.color = builderTextColor.value;
    mockBar.style.border = `1px solid ${builderBorderColor.value}`;
    mockBar.style.borderRadius = radiusVal;
    mockBar.style.backdropFilter = `blur(${blurVal})`;
    mockBar.style.transform = `scale(${scaleVal})`;

    const progressBar = mockBar.querySelector('.mock-progress-bar') as HTMLElement;
    if (progressBar) {
      progressBar.style.backgroundColor = builderAccentColor.value;
    }

    const speedBtn = mockBar.querySelector('.mock-speed-btn') as HTMLElement;
    if (speedBtn) {
      speedBtn.style.backgroundColor = builderAccentColor.value;
      speedBtn.style.color = '#000000';
    }
  }

  function refreshThemeSelectOptions() {
    builderThemeSelect.innerHTML = `<option value="new">+ Create New Custom Theme</option>`;

    // Add builtin presets for reference
    Object.keys(BUILTIN_THEMES).forEach((key) => {
      builderThemeSelect.innerHTML += `<option value="builtin:${key}">${BUILTIN_THEMES[key].name} (Preset)</option>`;
    });

    // Add user custom themes
    Object.keys(storageData.customThemes).forEach((key) => {
      const theme = storageData.customThemes[key];
      builderThemeSelect.innerHTML += `<option value="custom:${key}">${theme.name}</option>`;
    });
  }
  refreshThemeSelectOptions();

  // Load theme values into inputs
  builderThemeSelect.addEventListener('change', () => {
    const val = builderThemeSelect.value;
    if (val === 'new') {
      builderThemeName.value = 'My Custom Theme';
      builderBgColor.value = '#121418';
      builderTextColor.value = '#f3f4f6';
      builderAccentColor.value = '#38bdf8';
      builderBorderColor.value = '#374151';
      builderOpacity.value = '85';
      builderBlur.value = '12';
      builderRadius.value = '12';
      builderScale.value = '100';
      deleteThemeBtn.style.display = 'none';
    } else if (val.startsWith('builtin:')) {
      const bKey = val.split(':')[1];
      const theme = BUILTIN_THEMES[bKey];
      builderThemeName.value = `${theme.name} Copy`;
      builderTextColor.value = '#f3f4f6';
      builderAccentColor.value = '#38bdf8';
      builderBorderColor.value = '#374151';
      builderOpacity.value = '90';
      builderBlur.value = '10';
      builderRadius.value = '10';
      builderScale.value = '100';
      deleteThemeBtn.style.display = 'none';
    } else if (val.startsWith('custom:')) {
      const cKey = val.split(':')[1];
      const theme = storageData.customThemes[cKey];
      if (theme) {
        builderThemeName.value = theme.name;
        builderTextColor.value = theme.textColor || '#f3f4f6';
        builderAccentColor.value = theme.accentColor || '#38bdf8';
        builderBorderColor.value = theme.borderColor || '#374151';
        builderOpacity.value = String(Math.round((theme.opacity || 0.85) * 100));
        builderBlur.value = theme.backdropBlur?.replace('px', '').replace('blur(', '') || '12';
        builderRadius.value = theme.borderRadius?.replace('px', '') || '12';
        builderScale.value = String(Math.round((theme.scale || 1.0) * 100));
        deleteThemeBtn.style.display = 'inline-block';
      }
    }
    updateLivePreview();
  });

  // Attach live preview input listeners
  [
    builderBgColor,
    builderTextColor,
    builderAccentColor,
    builderBorderColor,
    builderOpacity,
    builderBlur,
    builderRadius,
    builderScale
  ].forEach((input) => {
    input.addEventListener('input', updateLivePreview);
  });
  updateLivePreview();

  // Save Theme
  saveThemeBtn.addEventListener('click', async () => {
    const name = builderThemeName.value.trim() || 'Custom Theme';
    const id = `custom-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`;
    const opacity = parseInt(builderOpacity.value, 10) / 100;
    const bg = hexToRgba(builderBgColor.value, opacity);

    const customTheme: CustomThemeDefinition = {
      id,
      name,
      background: bg,
      textColor: builderTextColor.value,
      accentColor: builderAccentColor.value,
      borderColor: builderBorderColor.value,
      borderRadius: `${builderRadius.value}px`,
      backdropBlur: `blur(${builderBlur.value}px)`,
      opacity,
      scale: parseInt(builderScale.value, 10) / 100
    };

    await storageManager.saveCustomTheme(customTheme);
    storageData = await storageManager.getAll();
    refreshThemeSelectOptions();
    builderThemeSelect.value = `custom:${id}`;
    deleteThemeBtn.style.display = 'inline-block';
    renderSitesTable(siteSearchInput.value);

    // Provide visual feedback
    const originalText = saveThemeBtn.textContent;
    saveThemeBtn.textContent = 'Saved!';
    setTimeout(() => {
      saveThemeBtn.textContent = originalText;
    }, 1500);
  });

  // Delete Theme
  deleteThemeBtn.addEventListener('click', async () => {
    const val = builderThemeSelect.value;
    if (val.startsWith('custom:')) {
      const cKey = val.split(':')[1];
      delete storageData.customThemes[cKey];
      await chrome.storage.sync.set({ customThemes: storageData.customThemes });
      refreshThemeSelectOptions();
      builderThemeSelect.value = 'new';
      deleteThemeBtn.style.display = 'none';
      renderSitesTable(siteSearchInput.value);
    }
  });

  // --- Live Preview Controls (Position, Layout, Responsive Width) ---
  const mockPositionSelect = document.getElementById('mockPositionSelect') as HTMLSelectElement;
  const mockLayoutSelect = document.getElementById('mockLayoutSelect') as HTMLSelectElement;
  const mockWidthSelect = document.getElementById('mockWidthSelect') as HTMLSelectElement;
  const mockControllerHost = document.getElementById('mockControllerHost') as HTMLElement;

  if (mockPositionSelect && mockControllerHost) {
    mockPositionSelect.addEventListener('change', () => {
      mockControllerHost.className = `mock-floating-host pos-${mockPositionSelect.value}`;
    });
    mockControllerHost.className = `mock-floating-host pos-${mockPositionSelect.value}`;
  }

  if (mockLayoutSelect && mockBar) {
    mockLayoutSelect.addEventListener('change', () => {
      mockBar.classList.toggle('minimal-mode', mockLayoutSelect.value === 'minimal');
    });
  }

  if (mockWidthSelect && mockControllerHost && mockBar) {
    mockWidthSelect.addEventListener('change', () => {
      const isNarrow = mockWidthSelect.value === 'narrow';
      mockControllerHost.style.maxWidth = isNarrow ? '280px' : '380px';
      mockBar.classList.toggle('two-row', isNarrow);
    });
  }
});
