document.addEventListener('DOMContentLoaded', async () => {
  const session_token = localStorage.getItem('sessionToken');

  /* -------- whoami + checklist visibility -------- */
  check_session();
  const username = localStorage.getItem('username');
  document.getElementById('welcome-message').textContent = `Welcome, ${username}`;
  document.getElementById('checklist-visibility-description').innerHTML =
    `Click to toggle your checklist's visibility at <a href='/profile/${username}' target='_blank' class='profile-link'>/profile/${username}</a>.`;

  const checklistVisibilityItem = document.getElementById('checklist-visibility-item');
  const visibilityBadge = document.getElementById('visibility-badge');

  try {
    const response = await fetch(`${apiUrl}/user/settings`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: session_token })
    });
    if (response.ok) {
      const data = await response.json();
      updateVisibilityUI(checklistVisibilityItem, visibilityBadge, data.checklistPublic);
    }
  } catch { }

  const handleVisibilityToggle = async () => {
    const current = checklistVisibilityItem.getAttribute('data-state') === 'public';
    const nextPublic = !current;
    updateVisibilityUI(checklistVisibilityItem, visibilityBadge, nextPublic);
    try {
      const response = await fetch(`${apiUrl}/user/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: session_token, updated: { checklistPublic: nextPublic } })
      });
      if (!response.ok) updateVisibilityUI(checklistVisibilityItem, visibilityBadge, current);
    } catch { updateVisibilityUI(checklistVisibilityItem, visibilityBadge, current); }
  };

  if (checklistVisibilityItem && visibilityBadge) {
    checklistVisibilityItem.addEventListener('click', (e) => {
      if (e.target.classList.contains('profile-link')) return;
      handleVisibilityToggle();
    });
    visibilityBadge.addEventListener('click', (e) => { e.stopPropagation(); handleVisibilityToggle(); });
  }

  /* -------- year sort -------- */
  const yearSortToggle = document.getElementById('year-sort-toggle');
  if (yearSortToggle) {
    const sortOrder = yearSortOrder;
    yearSortToggle.textContent = sortOrder === 'asc' ? 'Earlier first' : 'Later first';
    yearSortToggle.addEventListener('click', () => {
      const cur = yearSortOrder;
      const next = cur === 'asc' ? 'desc' : 'asc';
      yearSortOrder = next;
      yearSortToggle.textContent = next === 'asc' ? 'Earlier first' : 'Later first';
    });
  }

  /* -------- notes toggle -------- */
  const notesToggleBtn = document.getElementById('notes-toggle');
  if (notesToggleBtn) {
    const notesEnabled = (localStorage.getItem('notesEnabled') ?? 'true') === 'true';
    notesToggleBtn.textContent = notesEnabled ? 'Enabled' : 'Disabled';
    notesToggleBtn.addEventListener('click', () => {
      const current = (localStorage.getItem('notesEnabled') ?? 'true') === 'true';
      const next = !current;
      localStorage.setItem('notesEnabled', String(next));
      notesToggleBtn.textContent = next ? 'Enabled' : 'Disabled';
    });
  }

  /* -------- sync settings -------- */
  const syncSettingsButton = document.getElementById('sync-settings-button');
  if (syncSettingsButton) {
    syncSettingsButton.addEventListener('click', async () => {
      // Build endpoint payload
      const newPayload = {
        token: session_token,
        updated: {
          ascSort: (typeof yearSortOrder === 'string' ? yearSortOrder : '').toLowerCase() === 'asc',
          darkMode: localStorage.getItem('theme') == 'dark-mode'
        }
      };
      if (Array.isArray(platformPrefDraft) && platformPrefDraft.length > 0) {
        newPayload.updated.platformPref = platformPrefDraft;
      }

      try {
        const [newResSettled] = await Promise.allSettled([
          fetch(`${apiUrl}/user/settings`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(newPayload),
          })
        ]);

        const okNew = newResSettled.status === 'fulfilled' && newResSettled.value.ok;

        if (okNew && newPayload.updated.platformPref) {
          // Reflect platform prefs locally if server accepted them
          try { platformPref = [...newPayload.updated.platformPref]; } catch { }
        }

        syncSettingsButton.textContent =
          okNew ? 'Settings Synced!' : 'Sync Failed';
      } catch {
        syncSettingsButton.textContent = 'Sync Failed';
      } finally {
        setTimeout(() => {
          syncSettingsButton.textContent = 'Sync Settings to Account';
        }, 2000);
      }
    });
  }

  const knownPlatforms = [
    { key: 'oj.uz', label: 'oj.uz', icon: 'images/ojuz-logo.ico' },
    { key: 'qoj.ac', label: 'qoj.ac', icon: 'images/dummy-icon.svg' },
    { key: 'codeforces', label: 'Codeforces', icon: 'images/codeforces-icon.png' },
    { key: 'atcoder', label: 'AtCoder', icon: 'images/atcoder-icon.png' },
    { key: 'usaco', label: 'USACO', icon: 'images/usaco-icon.png' },
    { key: 'baekjoon', label: 'Baekjoon', icon: 'images/acmicpc-icon.png' },
    { key: 'cms', label: 'CMS', icon: 'images/cms-icon.ico' },
    { key: 'codebreaker', label: 'Codebreaker', icon: 'images/codebreaker-icon.ico' },
    { key: 'codechef', label: 'CodeChef', icon: 'images/codechef-icon.ico' },
    { key: 'codedrills', label: 'Codedrills', icon: 'images/codedrills-icon.ico' },
    { key: 'dmoj', label: 'DMOJ', icon: 'images/dmoj-icon.png' },
    { key: 'szkopuł', label: 'Szkopuł', icon: 'images/szkopul-icon.png' },
  ];

  const pfToggle = document.getElementById('platform-pref-toggle');
  const pfPanel = document.getElementById('platform-pref-panel');
  const pfList = document.getElementById('platform-pref-list');
  const pfBottom = document.getElementById('platform-pref-bottom-slot');

  // build a full-width row directly below the paragraph
  const pfItem = document.getElementById('platform-pref');
  const pfInfo = pfItem.querySelector('.settings-item-info-new');
  const pfRight = pfItem.querySelector('.settings-control-new');

  let pfBelowRow = document.getElementById('platform-pref-below-row');
  if (!pfBelowRow) {
    pfBelowRow = document.createElement('div');
    pfBelowRow.id = 'platform-pref-below-row';
    pfBelowRow.className = 'settings-below-row';
    pfInfo.insertAdjacentElement('afterend', pfBelowRow);
  }

  // park the button below the paragraph by default (desktop + collapsed)
  if (pfToggle.parentElement !== pfBelowRow) pfBelowRow.appendChild(pfToggle);

  const MOBILE_BP = 720;
  function placePFButton() {
    const mobile = window.innerWidth <= MOBILE_BP;
    const open = !pfPanel.hasAttribute('hidden');

    if (!mobile) {
      if (pfToggle.parentElement !== pfRight) pfRight.appendChild(pfToggle);
      return;
    }

    // Mobile: collapsed -> under paragraph; expanded -> bottom of list
    if (mobile && open) {
      if (pfToggle.parentElement !== pfBottom) pfBottom.appendChild(pfToggle);
    } else {
      if (pfToggle.parentElement !== pfBelowRow) pfBelowRow.appendChild(pfToggle);
    }
  }
  window.addEventListener('resize', placePFButton);

  // data
  let platformPref = [];
  let platformPrefDraft = [];

  // load saved order
  (async () => {
    try {
      const res = await fetch(`${apiUrl}/user/settings`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: session_token }) });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.platformPref)) platformPref = data.platformPref;
        if (typeof data.ascSort === "boolean") {
          yearSortOrder = data.ascSort ? "asc" : "desc";
          document.getElementById('year-sort-toggle').textContent = yearSortOrder === 'asc' ? 'Earlier first' : 'Later first';
        }
      }
    } catch { }
  })();

  // open/close
  pfToggle.addEventListener('click', () => {
    const isOpen = !pfPanel.hasAttribute('hidden');
    if (isOpen) {
      pfPanel.setAttribute('hidden', '');
      pfToggle.textContent = 'Edit';
    } else {
      if (platformPrefDraft.length === 0) {
        const local = safeParseJSON(localStorage.getItem('platformPref'));
        platformPrefDraft = Array.isArray(local) && local.length ? local : [...platformPref];
      }
      renderPlatformList(platformPrefDraft);
      pfPanel.removeAttribute('hidden');
      pfToggle.textContent = 'Done';
    }
    placePFButton();
  });

  // render + drag
  function renderPlatformList(orderKeys) {
    pfList.innerHTML = '';
    const seen = new Set(orderKeys);
    const ordered = [
      ...orderKeys.map(k => knownPlatforms.find(p => p.key === k)).filter(Boolean),
      ...knownPlatforms.filter(p => !seen.has(p.key))
    ];

    for (const p of ordered) {
      const li = document.createElement('li');
      li.className = 'platform-row';
      li.draggable = true;
      li.dataset.key = p.key;
      li.innerHTML = `
      <img src="${p.icon}" alt="${p.label}" class="platform-icon">
      <span class="platform-label">${p.label}</span>
      <svg class="drag-handle" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
        <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
      </svg>
    `;
      pfList.appendChild(li);
    }
    initDrag(pfList);
  }

  function initDrag(ul) {
    let dragEl = null;

    ul.querySelectorAll('li').forEach(li => {
      li.addEventListener('dragstart', () => { dragEl = li; li.classList.add('dragging'); });
      li.addEventListener('dragend', () => {
        li.classList.remove('dragging'); dragEl = null;
        platformPrefDraft = [...ul.querySelectorAll('li')].map(el => el.dataset.key);
        localStorage.setItem('platformPref', JSON.stringify(platformPrefDraft));
      });
    });

    ul.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (!dragEl) return;
      const after = getAfterElement(ul, e.clientY);
      if (!after) ul.appendChild(dragEl); else ul.insertBefore(dragEl, after);
    });
  }

  function getAfterElement(container, y) {
    const els = [...container.querySelectorAll('li:not(.dragging)')];
    let closest = { offset: Number.NEGATIVE_INFINITY, el: null };
    for (const child of els) {
      const box = child.getBoundingClientRect();
      const offset = y - (box.top + box.height / 2);
      if (offset < 0 && offset > closest.offset) closest = { offset, el: child };
    }
    return closest.el;
  }

  function safeParseJSON(s) { try { return JSON.parse(s); } catch { return null; } }

  // initial placement
  placePFButton();

  /* ------- helpers ------- */
  function updateVisibilityUI(itemElement, badgeElement, isPublic) {
    if (badgeElement) {
      badgeElement.textContent = isPublic ? 'Public' : 'Private';
      badgeElement.className = `status-badge-new ${isPublic ? 'public' : 'private'}`;
    }
    if (itemElement) itemElement.setAttribute('data-state', isPublic ? 'public' : 'private');
  }
});