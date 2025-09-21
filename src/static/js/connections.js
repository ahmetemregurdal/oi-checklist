window.onload = async () => {
  check_session();
  const username = localStorage.getItem('username');
  window.currentUsername = username;
  document.getElementById('welcome-message').textContent = `Welcome, ${username}`;
};

document.addEventListener('DOMContentLoaded', function () {
  const connectButtons = document.querySelectorAll('.connect-button');
  connectButtons.forEach(button => {
    const card = button.closest('.connection-card');
    const rawName =
      (card?.dataset?.provider) ||
      (card?.querySelector('.connection-name')?.textContent) ||
      '';
    const providerName = rawName.trim().toLowerCase();

    if (providerName === 'github') {
      button.addEventListener('click', () => handleGithubClick());
    } else if (providerName === 'oj.uz') {
      button.addEventListener('click', () => showOjuzPopup());
    } else if (providerName === 'qoj.ac') {
      button.addEventListener('click', () => showQojPopup());
    } else if (providerName === 'discord') {
      button.addEventListener('click', () => handleDiscordClick());
    } else if (providerName === 'google') {
      button.addEventListener('click', () => handleGoogleClick());
    }
  });

  document.getElementById('submit-cookie-button')
    ?.addEventListener('click', onSubmitOjuzCookie);
});

function closeProviderPopup() {
  const popup = document.getElementById('provider-popup');
  popup.classList.remove('active');
  popup.addEventListener('transitionend', function () {
    if (!popup.classList.contains('active')) {
      popup.style.display = 'none';
    }
  }, { once: true });
}

function showProviderPopup(title, contentHTML) {
  const popup = document.getElementById('provider-popup');
  const body = document.getElementById('provider-popup-body');
  const titleElem = document.getElementById('popup-title');

  titleElem.textContent = title;
  body.innerHTML = contentHTML;

  popup.style.display = 'flex';
  setTimeout(() => popup.classList.add('active'), 10);
}

// Fetch user settings helper for username
async function fetchUserSettings() {
  try {
    const res = await fetch(`${apiUrl}/user/settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token: localStorage.getItem('sessionToken') })
    });
    if (!res.ok) {
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error('Failed to fetch user settings:', e);
    return null;
  }
}

function showOjuzPopup() {
  showProviderPopup('Connect to oj.uz', `
      <div class="tab-switcher">
        <button id="ojuz-tab-cookie" class="tab active">Link via cookie</button>
        <button id="ojuz-tab-username" class="tab">Username only</button>
      </div>
      <div id="ojuz-cookie-pane">
        <p>
          Connect your <strong>oj.uz</strong> account to automatically update your OI checklist.
        </p>
        <p>
          This performs a <strong>one-time fetch</strong> of your solved problems to sync them with your checklist.
        </p>
        <p>
          Please log in to oj.uz in your browser, and paste the following cookie value here:
        </p>
        <div class="cookie-instruction">
          <code>Type: COOKIE &nbsp;&nbsp; Domain: oj.uz &nbsp;&nbsp; Name: oidc-auth</code>
        </div>
        <input type="text" class="cookie-input" id="oidc-input"
          placeholder="Paste your 'oidc-auth' cookie value here" required>
        <div id="popup-message-cookie" class="popup-inline-message"></div>
        <button class="primary-button" id="submit-cookie-button">Submit</button>
      </div>
      <div id="ojuz-username-pane" style="display:none;">
        <p>Optionally, just set your oj.uz username.</p>
        <div class="ojuz-section" id="ojuz-section" style="display: block;">
          <div class="form-row">
            <label for="ojuz-username">oj.uz Username</label>
            <input type="text" id="ojuz-username" class="vc-input" placeholder="Enter your oj.uz username">
          </div>
          <div class="form-note" id="ojuz-username-note">Not set yet.</div>
        </div>
        <div id="popup-message-username" class="popup-inline-message"></div>
        <button class="primary-button" id="submit-ojuz-username-button">Submit</button>
      </div>
    `);

  const tabCookie = document.getElementById('ojuz-tab-cookie');
  const tabUsername = document.getElementById('ojuz-tab-username');
  const paneCookie = document.getElementById('ojuz-cookie-pane');
  const paneUsername = document.getElementById('ojuz-username-pane');

  function activate(tab) {
    if (tab === 'cookie') {
      tabCookie.classList.add('active');
      tabUsername.classList.remove('active');
      paneCookie.style.display = '';
      paneUsername.style.display = 'none';
    } else {
      tabUsername.classList.add('active');
      tabCookie.classList.remove('active');
      paneUsername.style.display = '';
      paneCookie.style.display = 'none';
    }
  }

  tabCookie.addEventListener('click', () => activate('cookie'));
  tabUsername.addEventListener('click', () => activate('username'));

  document.getElementById('submit-cookie-button')
    .addEventListener('click', onSubmitOjuzCookie);

  document.getElementById('submit-ojuz-username-button')
    .addEventListener('click', onSubmitOjuzUsername);

  // Load and display any saved oj.uz username for the current user
  (async () => {
    try {
      const uname = window.currentUsername;
      if (!uname) return;
      const settings = await fetchUserSettings();
      const existing = settings && settings.platformUsernames && settings.platformUsernames['oj.uz'];
      const input = document.getElementById('ojuz-username');
      const note = document.getElementById('ojuz-username-note');
      if (existing) {
        if (input) input.value = existing;
        if (note) note.textContent = `Currently set to @${existing}`;
      } else {
        if (note) note.textContent = 'Not set yet.';
      }
    } catch (e) {
      console.error('Failed to load saved oj.uz username', e);
    }
  })();
}

async function handleGithubClick() {
  const token = localStorage.getItem('sessionToken');
  if (!token) {
    showGithubError('You are not logged in.');
    return;
  }

  // Immediately show popup with loading spinner
  showProviderPopup(
    'GitHub Connection',
    `
    <p>
      GitHub is currently linked to
      <strong>
        <a id="github-link" href="https://github.com/" target="_blank" rel="noopener noreferrer">
          <span id="github-placeholder">@<span class="spinner"></span></span>
        </a>
      </strong>.
    </p>
    <div id="popup-message"></div>
    <button class="primary-button" id="unlink-github-button">Unlink</button>
  `
  );

  try {
    const res = await fetch(`${apiUrl}/auth/github/status`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.status === 200) {
      const { username } = await res.json();
      const linkEl = document.getElementById('github-link');
      const placeholderEl = document.getElementById('github-placeholder');
      if (linkEl && placeholderEl) {
        linkEl.href = `https://github.com/${username}`;
        placeholderEl.textContent = `@${username}`;
      }

      document.getElementById('unlink-github-button').onclick = async () => {
        const messageBox = document.getElementById('popup-message');
        messageBox.style.display = 'block';
        try {
          const unlinkRes = await fetch(`${apiUrl}/auth/github/unlink`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
          });

          const resBody = await unlinkRes.json();

          if (unlinkRes.ok) {
            messageBox.textContent =
              resBody.message || 'GitHub unlinked successfully.';
            messageBox.style.color = 'green';
            setTimeout(closeProviderPopup, 1000);
          } else {
            messageBox.textContent =
              resBody.error || 'Failed to unlink GitHub.';
            messageBox.style.color = 'red';
          }
        } catch (err) {
          console.error(err);
          messageBox.textContent = 'Unexpected error occurred.';
          messageBox.style.color = 'red';
        }
      };
    } else {
      showProviderPopup(
        'Link GitHub',
        `
        <p>You have not linked your GitHub account yet.</p>
        <div id="popup-message"></div>
        <button class="primary-button" id="link-github-button">Link GitHub</button>
      `
      );

      document.getElementById('link-github-button').onclick = () => {
        const state = crypto.randomUUID();
        localStorage.setItem('oauth_github_state', state);
        const sessionToken = localStorage.getItem('sessionToken');
        if (!sessionToken) {
          showGithubError('You are not logged in.');
          return;
        }
        const currentPage = encodeURIComponent(window.location.pathname);
        window.location.href = `${apiUrl}/auth/github/link?state=${state}&token=${sessionToken}&redirectTo=${currentPage}`;
      };
    }
  } catch (err) {
    console.error('Error checking GitHub status:', err);
    showGithubError('Error checking GitHub status.');
  }
}

async function handleDiscordClick() {
  const token = localStorage.getItem('sessionToken');
  if (!token) {
    showDiscordError('You are not logged in.');
    return;
  }

  showProviderPopup(
    'Discord Connection',
    `
    <p>
      Discord is currently linked to
      <strong>
        <a id="discord-link" href="https://discord.com/" target="_blank" rel="noopener noreferrer">
          <span id="discord-placeholder">@<span class="spinner"></span></span>
        </a>
      </strong>.
    </p>
    <div id="popup-message"></div>
    <button class="primary-button" id="unlink-discord-button">Unlink</button>
  `
  );

  try {
    const res = await fetch(`${apiUrl}/auth/discord/status`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.status === 200) {
      const { username, providerUserId } = await res.json();
      const linkEl = document.getElementById('discord-link');
      const placeholderEl = document.getElementById('discord-placeholder');
      if (linkEl && placeholderEl) {
        if (providerUserId) linkEl.href = `https://discord.com/users/${providerUserId}`;
        placeholderEl.textContent = username || 'Linked';
      }

      document.getElementById('unlink-discord-button').onclick = async () => {
        const messageBox = document.getElementById('popup-message');
        messageBox.style.display = 'block';
        try {
          const unlinkRes = await fetch(`${apiUrl}/auth/discord/unlink`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
          });

          const resBody = await unlinkRes.json();

          if (unlinkRes.ok) {
            messageBox.textContent = resBody.message || 'Discord unlinked successfully.';
            messageBox.style.color = 'green';
            setTimeout(closeProviderPopup, 1000);
          } else {
            messageBox.textContent = resBody.error || 'Failed to unlink Discord.';
            messageBox.style.color = 'red';
          }
        } catch (err) {
          console.error(err);
          const messageBox = document.getElementById('popup-message');
          messageBox.textContent = 'Unexpected error occurred.';
          messageBox.style.color = 'red';
        }
      };
    } else {
      showProviderPopup(
        'Link Discord',
        `
        <p>You have not linked your Discord account yet.</p>
        <div id="popup-message"></div>
        <button class="primary-button" id="link-discord-button">Link Discord</button>
      `
      );

      document.getElementById('link-discord-button').onclick = () => {
        const state = crypto.randomUUID();
        localStorage.setItem('oauth_discord_state', state);
        const sessionToken = localStorage.getItem('sessionToken');
        if (!sessionToken) {
          showDiscordError('You are not logged in.');
          return;
        }
        const currentPage = encodeURIComponent(window.location.pathname);
        window.location.href = `${apiUrl}/auth/discord/link?state=${state}&session_id=${sessionToken}&redirect_to=${currentPage}`;
      };
    }
  } catch (err) {
    console.error('Error checking Discord status:', err);
    showDiscordError('Error checking Discord status.');
  }
}

async function handleGoogleClick() {
  const token = localStorage.getItem('sessionToken');
  if (!token) {
    showGoogleError('You are not logged in.');
    return;
  }

  // Immediately show popup with loading spinner
  showProviderPopup(
    'Google Connection',
    `
    <p>
      Google is currently linked to
      <strong>
        <span id="google-placeholder">@<span class="spinner"></span></span>
      </strong>.
    </p>
    <div id="popup-message"></div>
    <button class="primary-button" id="unlink-google-button">Unlink</button>
  `
  );

  try {
    const res = await fetch(`${apiUrl}/api/google/status`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.status === 200) {
      const { username } = await res.json();
      const placeholderEl = document.getElementById('google-placeholder');
      if (placeholderEl) {
        placeholderEl.textContent = username ? `${username}` : 'Linked';
      }

      document.getElementById('unlink-google-button').onclick = async () => {
        const messageBox = document.getElementById('popup-message');
        messageBox.style.display = 'block';
        try {
          const unlinkRes = await fetch(`${apiUrl}/api/google/unlink`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });

          const resBody = await unlinkRes.json();

          if (unlinkRes.ok) {
            messageBox.textContent =
              resBody.message || 'Google unlinked successfully.';
            messageBox.style.color = 'green';
            setTimeout(closeProviderPopup, 1000);
          } else {
            messageBox.textContent =
              resBody.error || 'Failed to unlink Google.';
            messageBox.style.color = 'red';
          }
        } catch (err) {
          console.error(err);
          const messageBox = document.getElementById('popup-message');
          messageBox.textContent = 'Unexpected error occurred.';
          messageBox.style.color = 'red';
        }
      };
    } else {
      // Not linked yet — show link button
      showProviderPopup(
        'Link Google',
        `
        <p>You have not linked your Google account yet.</p>
        <div id="popup-message"></div>
        <button class="primary-button" id="link-google-button">Link Google</button>
      `
      );

      document.getElementById('link-google-button').onclick = () => {
        const state = crypto.randomUUID();
        localStorage.setItem('oauth_google_state', state);
        const sessionToken = localStorage.getItem('sessionToken');
        const currentPage = encodeURIComponent(window.location.pathname);
        window.location.href = `${apiUrl}/auth/google/link?state=${state}&session_id=${sessionToken}&redirect_to=${currentPage}`;
      };
    }
  } catch (err) {
    console.error('Error checking Google status:', err);
    showGoogleError('Error checking Google status.');
  }
}

function showGithubError(message) {
  const messageBox = document.getElementById('popup-message');
  if (!messageBox) return;
  messageBox.style.display = 'block';
  messageBox.textContent = `Error: ${message}`;
  messageBox.style.color = 'red';
}

function showDiscordError(message) {
  const messageBox = document.getElementById('popup-message');
  if (!messageBox) return;
  messageBox.style.display = 'block';
  messageBox.textContent = `Error: ${message}`;
  messageBox.style.color = 'red';
}

function showGoogleError(message) {
  const messageBox = document.getElementById('popup-message');
  if (!messageBox) return;
  messageBox.style.display = 'block';
  messageBox.textContent = message;
  messageBox.style.color =
    (localStorage.getItem('theme') || 'light-mode') === 'light-mode' ?
      'black' :
      'white';
}

async function onSubmitOjuzCookie(e) {
  e.preventDefault();

  const oidcAuth = document.getElementById('oidc-input').value.trim();
  const messageBox = document.getElementById('popup-message-cookie');
  messageBox.style.display = 'block';
  messageBox.textContent = 'Validating cookie...';
  messageBox.style.color =
    (localStorage.getItem('theme') || 'light-mode') === 'light-mode' ?
      'black' :
      'white';

  if (!oidcAuth) {
    messageBox.textContent = 'Please paste your oidc-auth cookie value.';
    messageBox.style.color = 'red';
    return;
  }

  const sessionToken = localStorage.getItem('sessionToken');
  if (!sessionToken) {
    messageBox.textContent = 'You are not logged in.';
    messageBox.style.color = 'red';
    return;
  }

  try {
    const verifyRes = await fetch(`${apiUrl}/api/verify-ojuz`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      },
      body: JSON.stringify({ cookie: oidcAuth })
    });

    if (!verifyRes.ok) {
      const text = await verifyRes.text();
      messageBox.textContent = `Cookie validation failed: ${text}`;
      messageBox.style.color = 'red';
      return;
    }

    const verifyResult = await verifyRes.json();
    if (verifyResult.valid) {
      messageBox.textContent = `Cookie is valid. Username: ${verifyResult.username}. Your problems will be updated shortly.`;
      messageBox.style.color = 'green';

      fetch(`${apiUrl}/api/update-ojuz`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ cookie: oidcAuth })
      })
        .then(res => res.json())
        .then(result => {
          console.log('Problems updated in the background.');
        })
        .catch(err => {
          console.error('Error updating problems in the background:', err);
        });
    } else {
      messageBox.textContent = `Invalid cookie. Please check and try again.`;
      messageBox.style.color = 'red';
    }
  } catch (err) {
    console.error(err);
    messageBox.textContent =
      'Something went wrong while validating the cookie.';
    messageBox.style.color = 'red';
  }
}

// Handler for saving oj.uz username only (merge-based update)
async function onSubmitOjuzUsername(e) {
  e.preventDefault();
  const username = document.getElementById('ojuz-username').value.trim();
  const messageBox = document.getElementById('popup-message-username');
  messageBox.style.display = 'block';
  messageBox.textContent = 'Saving username...';
  messageBox.style.color =
    (localStorage.getItem('theme') || 'light-mode') === 'light-mode' ?
      'black' :
      'white';

  if (!username) {
    messageBox.textContent = 'Please enter your oj.uz username.';
    messageBox.style.color = 'red';
    return;
  }

  const sessionToken = localStorage.getItem('sessionToken');
  if (!sessionToken) {
    messageBox.textContent = 'You are not logged in.';
    messageBox.style.color = 'red';
    return;
  }

  try {
    const res = await fetch(`${apiUrl}/user/settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        token: sessionToken, platformUsernames: { 'oj.uz': username }
      })
    });

    const body = await res.json();
    if (!res.ok || body.success !== true) {
      messageBox.textContent = (body && (body.error || body.message)) || 'Failed to save username.';
      messageBox.style.color = 'red';
      return;
    }

    messageBox.textContent = 'oj.uz username saved.';
    messageBox.style.color = 'green';
    setTimeout(closeProviderPopup, 800);
  } catch (err) {
    console.error(err);
    messageBox.textContent = 'Unexpected error saving username.';
    messageBox.style.color = 'red';
  }
}

// QOJ connection popup and handlers
function showQojPopup() {
  showProviderPopup('Connect to qoj.ac', `
      <div class="tab-switcher">
        <button id="qoj-tab-cookie" class="tab active">Link via cookie</button>
        <button id="qoj-tab-username" class="tab">Username only</button>
      </div>
      <div id="qoj-cookie-pane">
        <p>
          Connect your <strong>qoj.ac</strong> account to automatically update your OI checklist.
        </p>
        <p>
          This performs a <strong>one-time fetch</strong> of your solved problems to sync them with your checklist.
        </p>
        <p>
          Please log in to qoj.ac in your browser, and paste the following cookie value here:
        </p>
        <div class="cookie-instruction">
          <code>Type: COOKIE &nbsp;&nbsp; Domain: qoj.ac &nbsp;&nbsp; Name: UOJSESSID</code>
        </div>
        <input type="text" class="cookie-input" id="qoj-cookie-input"
          placeholder="Paste your 'UOJSESSID' cookie value here" required>
        <div id="popup-message-qoj-cookie" class="popup-inline-message"></div>
        <button class="primary-button" id="submit-qoj-cookie-button">Submit</button>
      </div>
      <div id="qoj-username-pane" style="display:none;">
        <p>Optionally, just set your qoj.ac username.</p>
        <div class="qoj-section" id="qoj-section" style="display: block;">
          <div class="form-row">
            <label for="qoj-username">qoj.ac Username</label>
            <input type="text" id="qoj-username" class="vc-input" placeholder="Enter your qoj.ac username">
          </div>
          <div class="form-note" id="qoj-username-note">Not set yet.</div>
        </div>
        <div id="popup-message-qoj-username" class="popup-inline-message"></div>
        <button class="primary-button" id="submit-qoj-username-button">Submit</button>
      </div>
    `);

  const tabCookie = document.getElementById('qoj-tab-cookie');
  const tabUsername = document.getElementById('qoj-tab-username');
  const paneCookie = document.getElementById('qoj-cookie-pane');
  const paneUsername = document.getElementById('qoj-username-pane');

  function activate(tab) {
    if (tab === 'cookie') {
      tabCookie.classList.add('active');
      tabUsername.classList.remove('active');
      paneCookie.style.display = '';
      paneUsername.style.display = 'none';
    } else {
      tabUsername.classList.add('active');
      tabCookie.classList.remove('active');
      paneUsername.style.display = '';
      paneCookie.style.display = 'none';
    }
  }

  tabCookie.addEventListener('click', () => activate('cookie'));
  tabUsername.addEventListener('click', () => activate('username'));

  document.getElementById('submit-qoj-cookie-button')
    .addEventListener('click', onSubmitQojCookie);

  document.getElementById('submit-qoj-username-button')
    .addEventListener('click', onSubmitQojUsername);

  // Load and display any saved QOJ username for the current user
  (async () => {
    try {
      const uname = window.currentUsername;
      if (!uname) return;
      const settings = await fetchUserSettings();
      const existing = settings && settings.platformUsernames && settings.platformUsernames['qoj.ac'];
      const input = document.getElementById('qoj-username');
      const note = document.getElementById('qoj-username-note');
      if (existing) {
        if (input) input.value = existing;
        if (note) note.textContent = `Currently set to @${existing}`;
      } else {
        if (note) note.textContent = 'Not set yet.';
      }
    } catch (e) {
      console.error('Failed to load saved qoj username', e);
    }
  })();
}

async function onSubmitQojCookie(e) {
  e.preventDefault();

  const cookieVal = document.getElementById('qoj-cookie-input').value.trim();
  const messageBox = document.getElementById('popup-message-qoj-cookie');
  messageBox.style.display = 'block';
  messageBox.textContent = 'Validating cookie...';
  messageBox.style.color =
    (localStorage.getItem('theme') || 'light-mode') === 'light-mode' ? 'black' : 'white';

  if (!cookieVal) {
    messageBox.textContent = 'Please paste your qoj.ac session cookie value.';
    messageBox.style.color = 'red';
    return;
  }

  const sessionToken = localStorage.getItem('sessionToken');
  if (!sessionToken) {
    messageBox.textContent = 'You are not logged in.';
    messageBox.style.color = 'red';
    return;
  }

  try {
    const verifyRes = await fetch(`${apiUrl}/api/verify-qoj`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      },
      body: JSON.stringify({ cookie: cookieVal })
    });

    if (!verifyRes.ok) {
      const text = await verifyRes.text();
      messageBox.textContent = `Cookie validation failed: ${text}`;
      messageBox.style.color = 'red';
      return;
    }

    const verifyResult = await verifyRes.json();
    if (verifyResult.valid) {
      messageBox.textContent = `Cookie is valid. Username: ${verifyResult.username}. Your problems will be updated shortly.`;
      messageBox.style.color = 'green';

      fetch(`${apiUrl}/api/update-qoj`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ cookie: cookieVal })
      })
        .then(res => res.json())
        .then(result => {
          console.log('QOJ problems update triggered.');
        })
        .catch(err => {
          console.error('Error updating QOJ problems:', err);
        });
    } else {
      messageBox.textContent = `Invalid cookie. Please check and try again.`;
      messageBox.style.color = 'red';
    }
  } catch (err) {
    console.error(err);
    messageBox.textContent = 'Something went wrong while validating the cookie.';
    messageBox.style.color = 'red';
  }
}

async function onSubmitQojUsername(e) {
  e.preventDefault();
  const username = document.getElementById('qoj-username').value.trim();
  const messageBox = document.getElementById('popup-message-qoj-username');
  messageBox.style.display = 'block';
  messageBox.textContent = 'Saving username...';
  messageBox.style.color =
    (localStorage.getItem('theme') || 'light-mode') === 'light-mode' ? 'black' : 'white';

  if (!username) {
    messageBox.textContent = 'Please enter your qoj.ac username.';
    messageBox.style.color = 'red';
    return;
  }

  const sessionToken = localStorage.getItem('sessionToken');
  if (!sessionToken) {
    messageBox.textContent = 'You are not logged in.';
    messageBox.style.color = 'red';
    return;
  }

  try {
    const res = await fetch(`${apiUrl}/user/settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token: sessionToken, platformUsernames: { 'qoj.ac': username } })
    });

    const body = await res.json();
    if (!res.ok || body.success !== true) {
      messageBox.textContent = (body && (body.error || body.message)) || 'Failed to save username.';
      messageBox.style.color = 'red';
      return;
    }

    messageBox.textContent = 'qoj.ac username saved.';
    messageBox.style.color = 'green';
    setTimeout(closeProviderPopup, 800);
  } catch (err) {
    console.error(err);
    messageBox.textContent = 'Unexpected error saving username.';
    messageBox.style.color = 'red';
  }
}
