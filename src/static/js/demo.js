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
            const response = await fetch(`${apiUrl}/api/demo-login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Store the session token in localStorage
                localStorage.setItem('sessionToken', data.token);
                
                // Redirect to main dashboard
                window.location.href = '/';
            } else {
                throw new Error(data.error || 'Demo login failed');
            }
        } catch (error) {
            console.error('Demo login error:', error);
            showError('Failed to launch demo. Please try again.');
            
            // Re-enable button
            loginBtn.disabled = false;
            loginBtn.innerHTML = 'Launch Demo';
        }
    });
});