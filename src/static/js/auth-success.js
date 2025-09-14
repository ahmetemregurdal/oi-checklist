const params = new URLSearchParams(window.location.search);
const token = params.get('token');
const redirectTo = params.get('redirect_to') || '/';
if (token) {
  localStorage.setItem('sessionToken', token);
  window.location.href = redirectTo;
} else {
  document.body.innerText = 'Login failed: no token received.';
}
