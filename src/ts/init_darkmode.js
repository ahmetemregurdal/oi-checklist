const theme = localStorage.getItem('theme');
if (theme === 'dark-mode') {
  document.documentElement.classList.add('dark-mode');
}
