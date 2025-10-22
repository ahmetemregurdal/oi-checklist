const params = new URLSearchParams(window.location.search);
const token = params.get('token');
const username = params.get('username');
const redirectTo = params.get('redirect_to') || '/';
if (token && username) {
  localStorage.setItem('sessionToken', token);
  localStorage.setItem('username', username);
  window.location.href = redirectTo;
} else {
  document.body.innerText = 'Login failed: no token received.';
}