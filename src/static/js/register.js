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

document.getElementById('github-continue').addEventListener('click', () => {
  window.location.href = `${apiUrl}/auth/github/start`;
});

document.getElementById('discord-continue').addEventListener('click', () => {
  window.location.href = `${apiUrl}/auth/discord/start`;
});

document.getElementById('google-continue').addEventListener('click', () => {
  window.location.href = `${apiUrl}/auth/google/start`;
});