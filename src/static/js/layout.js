// Dynamically populate olympiad cards
const reorderList = document.getElementById('olympiad-reorder-list');
const hiddenList = document.getElementById('hidden-olympiad-list');

olympiadIds.forEach(id => {
  const card = document.createElement('div');
  card.className = 'connection-card';
  card.dataset.id = id.toLowerCase();
  const h3 = document.createElement('h3');
  h3.className = 'connection-name';
  h3.textContent = getFullOlympiadName(id);
  card.appendChild(h3);
  reorderList.appendChild(card);
});

window.onload = async () => {
  const sessionToken = localStorage.getItem('sessionToken');

  // Verify login
  check_session();
  const username = localStorage.getItem('username');
  document.getElementById('welcome-message').textContent = `Welcome, ${username}`;

  // Load user settings
  const user_settings = await fetch(`${apiUrl}/api/user-settings?username=${username}`, {
    method: 'GET',
    credentials: 'include',
    headers: { 'Authorization': `Bearer ${sessionToken}` }
  });

  if (user_settings.ok) {
    const data = await user_settings.json();
    if (data.olympiad_order && Array.isArray(data.olympiad_order)) {
      applyOlympiadOrder(data.olympiad_order);
    }
    if (data.hidden && Array.isArray(data.hidden)) {
      applyHiddenOlympiads(data.hidden);
    }
    if (typeof data.asc_order === "boolean") {
      localStorage.setItem('yearSortOrder', data.asc_order ? "asc" : "desc");
    }
  }

  // Unhide all H3s after DOM has been updated
  document.querySelectorAll('#olympiad-reorder-list h3, #hidden-olympiad-list h3').forEach(h3 => {
    h3.style.visibility = 'visible';
  });

  // Init Sortable for both lists
  new Sortable(reorderList, {
    group: 'olympiads',
    animation: 150,
    ghostClass: 'dragging'
  });
  new Sortable(hiddenList, {
    group: 'olympiads',
    animation: 150,
    ghostClass: 'dragging'
  });
};

// Reorders DOM based on saved order
function applyOlympiadOrder(order) {
  const container = document.getElementById('olympiad-reorder-list');
  const cards = Array.from(container.children);
  const cardMap = new Map(cards.map(card => [card.dataset.id, card]));

  container.innerHTML = '';

  const seen = new Set();
  for (const id of order) {
    const card = cardMap.get(id.toLowerCase());
    if (card) {
      container.appendChild(card);
      seen.add(id.toLowerCase());
    }
  }

  // Append any leftover cards not in order
  for (const [id, card] of cardMap.entries()) {
    if (!seen.has(id.toLowerCase())) {
      container.appendChild(card);
    }
  }
}

function applyHiddenOlympiads(hidden) {
  const allCards = document.querySelectorAll('.connection-card');
  const hiddenList = document.getElementById('hidden-olympiad-list');
  hiddenList.innerHTML = '';
  for (const id of hidden) {
    const card = Array.from(allCards).find(card => card.dataset.id === id.toLowerCase());
    if (card) {
      hiddenList.appendChild(card);
    }
  }
}

function saveOlympiadOrder() {
  const order = Array.from(document.querySelectorAll('#olympiad-reorder-list .connection-card'))
    .map(card => card.dataset.id);
  const hidden = Array.from(document.querySelectorAll('#hidden-olympiad-list .connection-card'))
    .map(card => card.dataset.id);
  const sessionToken = localStorage.getItem('sessionToken');
  const messageBox = document.getElementById('popup-message-oly-save');
  messageBox.style.display = 'block';
  let currentTheme = localStorage.getItem('theme') || 'light-mode';
  messageBox.color = currentTheme == 'light-mode' ? 'black' : 'white';
  fetch(apiUrl + '/api/user-settings', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sessionToken}`
    },
    body: JSON.stringify({
      olympiad_order: order,
      hidden: hidden
    })
  })
    .then(response => response.json())
    .then(result => {
      if (result.success) {
        messageBox.textContent = 'Olympiad order saved!';
        messageBox.style.color = 'green';
      } else {
        messageBox.textContent = `Error saving order: ${result.error || 'unknown error'}`;
        messageBox.style.color = 'red';
      }
    })
    .catch(err => {
      console.error('Save failed:', err);
      messageBox.textContent = `Error saving order: ${result.error || 'unknown error'}`;
      messageBox.style.color = 'red';
    });
}
