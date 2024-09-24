'use strict';

// Function to localize elements based on data attributes
function localizeElement(selector, attribute, getMessageFn) {
  document.querySelectorAll(selector).forEach(element => {
    const ref = element.dataset[attribute];
    const translated = getMessageFn(ref);
    if (translated) {
      element[attribute] = translated;
    }
  });
}

// Localization mapping
const localizationMap = {
  value: 'localizedValue',
  title: 'localizedTitle',
  placeholder: 'localizedPlaceholder',
  content: 'localizedContent',
  textContent: 'localize'
};

// Apply localization to elements
Object.keys(localizationMap).forEach(attr => {
  localizeElement(`[data-${localizationMap[attr]}]`, attr, chrome.i18n.getMessage);
});

// Detect Android user agent and set a body data attribute
document.body.dataset.android = navigator.userAgent.includes('Android');

// Fetch current active tab and update UI accordingly
chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
  if (tabs.length) {
    const tab = tabs[0];
    if ('cookieStoreId' in tab) {
      const applyCmds = ['apply', 'window', 'reset'].map(cmd => document.querySelector(`[data-cmd="${cmd}"]`));
      applyCmds.forEach(button => {
        button.value = chrome.i18n.getMessage(`${button.dataset.cmd}Container`);
        button.title = chrome.i18n.getMessage(`${button.dataset.cmd}ContainerTitle`);
      });
    }
  }
});

// Utility function to fetch and cache JSON data
function getCachedJson(path) {
  const cf = Promise.resolve({
    match() { return Promise.resolve(); },
    add() { return Promise.resolve(); }
  });
  return (typeof caches !== 'undefined' ? caches : { open() { return cf; } })
    .open('agents').catch(() => cf)
    .then(cache => {
      const link = `https://cdn.jsdelivr.net/gh/ray-lothian/UserAgent-Switcher/v2/firefox/data/popup/${path}`;
      return cache.match(link).then(response => response || fetch(link));
    });
}

// Sort array based on browser version
function sortAgents(arr) {
  const compareVersions = (a = '', b = '') => {
    const [pa, pb] = [a.split('.'), b.split('.')];
    for (let i = 0; i < 3; i++) {
      const [na, nb] = [Number(pa[i]), Number(pb[i])];
      if (na !== nb) return na - nb;
    }
    return 0;
  };
  const sorted = arr.sort((a, b) => compareVersions(a.browser.version, b.browser.version));
  return document.getElementById('sort').value === 'descending' ? sorted.reverse() : sorted;
}

// Function to update the agent list in UI
function updateAgentList(ua) {
  const browser = document.getElementById('browser').value;
  const os = document.getElementById('os').value.replace(/\//g, '-');
  
  getCachedJson(`browsers/${browser.toLowerCase()}-${os.toLowerCase()}.json`)
    .then(response => response.json())
    .catch(() => [])
    .then(list => {
      const tbody = document.getElementById('list').querySelector('tbody');
      tbody.textContent = '';
      if (list.length) {
        const fragment = document.createDocumentFragment();
        list = sortAgents(list);
        list.forEach((agent, index) => {
          const row = document.querySelector('template').content.cloneNode(true);
          row.querySelector('td:nth-child(1)').textContent = index + 1;
          row.querySelector('td:nth-child(3)').textContent = `${agent.browser.name} ${agent.browser.version || ''}`;
          row.querySelector('td:nth-child(4)').textContent = `${agent.os.name} ${agent.os.version || ''}`;
          row.querySelector('td:nth-child(5)').textContent = agent.ua;
          if (agent.ua === ua) row.querySelector('input[type=radio]').checked = true;
          fragment.appendChild(row);
        });
        tbody.appendChild(fragment);
      }
    })
    .finally(() => document.getElementById('list').dataset.loading = false);
}

// Event listeners for updating UI and storing preferences
document.addEventListener('change', ({ target }) => {
  if (target.closest('#filter')) {
    chrome.storage.local.get({ ua: '' }, prefs => updateAgentList(prefs.ua || navigator.userAgent));
  }
});

document.addEventListener('DOMContentLoaded', () => {
  fetch('./map.json').then(response => response.json()).then(map => {
    // Populate dropdowns based on map data
    const populateDropdown = (elementId, items) => {
      const fragment = document.createDocumentFragment();
      items.forEach(item => {
        const option = document.createElement('option');
        option.textContent = item;
        fragment.appendChild(option);
      });
      document.getElementById(elementId).appendChild(fragment);
    };
    
    populateDropdown('browser', map.browser);
    populateDropdown('os', map.os);

    chrome.storage.local.get({
      'popup-browser': 'Chrome',
      'popup-os': 'Windows',
      'popup-sort': 'descending',
      'ua': ''
    }, prefs => {
      document.getElementById('browser').value = prefs['popup-browser'];
      document.getElementById('os').value = prefs['popup-os'];
      document.getElementById('sort').value = prefs['popup-sort'];
      updateAgentList(prefs.ua);
    });
  });
});
