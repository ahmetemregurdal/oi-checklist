// Demo login functionality
document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('demo-login-btn');
    const errorMessage = document.getElementById('error-message');

    // Show error message
    function showError(message) {
        const errorParagraph = errorMessage.querySelector('p');
        errorParagraph.textContent = message;
        errorMessage.style.display = 'block';
    }

    // Hide error message
    function hideError() {
        errorMessage.style.display = 'none';
    }

    // Handle demo login
    loginBtn.addEventListener('click', async () => {
        hideError();

        // Disable button and show loading state
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<div class="loading-text"><span>Launching Demo</span><span class="loading-dots"></span></div>';

        try {
            localStorage.setItem('username', 'demo-user');
            localStorage.setItem('sessionToken', 'demo-session-fixed-token-123456789');
            window.location.href = '/';
        } catch (error) {
            console.error('Demo login error:', error);
            showError('Failed to launch demo. Please try again.');

            // Re-enable button
            loginBtn.disabled = false;
            loginBtn.innerHTML = 'Launch Demo';
        }
    });
});