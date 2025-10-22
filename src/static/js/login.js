document.getElementById('login-form')
  .addEventListener('submit', async (event) => {
    event.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    const errorBox = document.getElementById('error-message');

    try {
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok) {
        if (data.settings) {
          try {
            localStorage.setItem('yearSortOrder', data.settings.ascSort ? 'asc' : 'desc');
            localStorage.setItem('theme', data.settings.darkMode ? 'dark-mode' : 'light-mode');
            localStorage.setItem('platformPref', JSON.stringify(data.settings.platformPref));
          } catch (e) {
            console.warn('Failed to parse saved user settings from server:', e);
          }
        }
        localStorage.setItem('username', data.username);
        localStorage.setItem('sessionToken', data.token);
        window.location.href = '/';
      } else {
        errorBox.style.display = 'block';
        errorBox.innerText = data.message || 'Login failed';
      }
    } catch (error) {
      errorBox.style.display = 'block';
      console.error('Error during login:', error);
      errorBox.innerText = 'An error occurred. Please try again later.';
    }
  });

async function beginOAuth(provider) {
  try {
    const res = await fetch(`${apiUrl}/auth/${provider}/start`, {
      credentials: 'include'
    });
    const data = await res.json();
    if (res.ok && data?.redirect) {
      window.location.href = data.redirect;
    } else {
      throw new Error(data?.error || 'Unexpected response');
    }
  } catch (err) {
    console.error(`Failed to start ${provider} login:`, err);
    alert(`Failed to start ${provider} login. Please try again.`);
  }
}

document.getElementById('github-continue').addEventListener('click', () => {
  beginOAuth('github');
});

document.getElementById('discord-continue').addEventListener('click', () => {
  beginOAuth('discord');
});

document.getElementById('google-continue').addEventListener('click', () => {
  beginOAuth('google');
});