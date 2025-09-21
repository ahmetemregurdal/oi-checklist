document.getElementById('register-form')
    .addEventListener('submit', async (e) => {
      e.preventDefault();

      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;
      const errorBox = document.getElementById('error-message');

      const sessionToken = localStorage.getItem('sessionToken');
      try {
        const res = await fetch(apiUrl + '/auth/register', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`
          },
          body: JSON.stringify({username, password})
        });

        const result = await res.json();

        if (res.ok) {
          window.location.href = 'login';
        } else {
          errorBox.style.display = 'block';
          errorBox.innerText = result.message || 'Registration failed';
        }
      } catch (error) {
        errorBox.style.display = 'block';
        errorBox.innerText = 'An unexpected error occurred';
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
  window.location.href = `${apiUrl}/auth/google/start`;
});
