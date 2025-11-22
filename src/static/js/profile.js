document.addEventListener('DOMContentLoaded', async () => {
    // Get username from URL path
    const pathParts = window.location.pathname.split('/');
    const username = pathParts[pathParts.length - 1];
    
    // Store stats for chart redraws
    let currentStats = { solved: 0, progress: 0, failed: 0 };
    
    if (!username) {
        showMessage('Invalid profile URL.', 'error');
        return;
    }

    // Check if user is authenticated
    const sessionToken = localStorage.getItem('sessionToken');
    const currentUsername = localStorage.getItem('username');
    
    // Always show navbar user section so dark mode toggle is visible
    document.getElementById('navbar-user').style.display = 'flex';

    if (currentUsername) {
        document.getElementById('welcome-message').textContent = `Welcome, ${currentUsername}`;
        document.getElementById('welcome-message').style.display = '';
        document.getElementById('logout-button').style.display = '';
    } else {
        document.getElementById('welcome-message').style.display = 'none';
        document.getElementById('logout-button').style.display = 'none';
    }

    // Show loading skeleton
    document.getElementById('profile-loading').style.display = 'block';
    document.getElementById('profile-container').style.display = 'none';

    try {
        // Fetch profile data
        const response = await fetch(`${apiUrl}/data/profile`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: username,
                token: sessionToken
            })
        });

        if (!response.ok) {
            if (response.status === 404) {
                showMessage('User not found.', 'error');
            } else {
                showMessage('Failed to load profile data.', 'error');
            }
            return;
        }

        const profileData = await response.json();
        
        // Hide loading and show content
        document.getElementById('profile-loading').style.display = 'none';
        document.getElementById('profile-container').style.display = 'block';

        // Update page title
        document.title = `${username} - Profile - OI Checklist`;
        document.getElementById('page-title').textContent = `${username}'s Profile`;

        // Update Open Graph tags
        const metaTitle = document.querySelector('meta[property="og:title"]');
        if (metaTitle) metaTitle.setAttribute('content', `${username}'s Profile - OI Checklist`);
        
        const metaDesc = document.querySelector('meta[property="og:description"]');
        if (metaDesc) metaDesc.setAttribute('content', `View ${username}'s progress and statistics on OI Checklist.`);

        // Populate profile data
        populateProfile(profileData, username);

        // Show follow button if user is logged in and viewing someone else's profile
        if (currentUsername && currentUsername !== username) {
            document.getElementById('follow-button').style.display = 'block';
            setupFollowButton(username, profileData.following === 1, profileData.followers);
        }

    } catch (error) {
        console.error('Error fetching profile:', error);
        showMessage('Failed to load profile data.', 'error');
    }

    // Message system functions
    function showMessage(text, type = 'error') {
        const messageContainer = document.getElementById('message-container');
        const messageContent = document.getElementById('message-content');
        const messageText = document.getElementById('message-text');

        messageText.textContent = text;
        messageContent.className = `message-content ${type}`;
        messageContainer.style.display = 'flex';

        setTimeout(() => {
            messageContainer.classList.add('show');
        }, 10);
    }

    function hideMessage() {
        const messageContainer = document.getElementById('message-container');
        messageContainer.classList.remove('show');

        setTimeout(() => {
            messageContainer.style.display = 'none';
        }, 300);
    }

    // Message close handler
    document.getElementById('message-close').addEventListener('click', hideMessage);
    document.getElementById('message-container').addEventListener('click', (e) => {
        if (e.target.id === 'message-container') {
            hideMessage();
        }
    });

    function populateProfile(data, username) {
        // Basic info
        document.getElementById('profile-username').textContent = username;
        document.getElementById('profile-user-id').textContent = '#' + data.userId;
        
        // Join date
        const joinDate = new Date(data.joinDate);
        document.getElementById('profile-join-date').textContent = joinDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Last activity
        if (data.lastActivityAt) {
            const lastActivity = new Date(data.lastActivityAt);
            document.getElementById('profile-last-activity').textContent = lastActivity.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } else {
            document.getElementById('last-activity-item').style.display = 'none';
        }

        // Followers
        document.getElementById('profile-followers').textContent = data.followers;

        // Stats
        const { solved, progress, failed } = data.solveStats;
        
        // Update stored stats
        currentStats = { solved, progress, failed };

        document.getElementById('solved-count').textContent = solved;
        document.getElementById('progress-count').textContent = progress;
        document.getElementById('failed-count').textContent = failed;

        const total = solved + progress + failed;
        document.getElementById('total-problems').textContent = total;

        // Connected accounts
        if (data.authIdentities && data.authIdentities.length > 0) {
            document.getElementById('profile-identities').style.display = 'block';
            populateIdentities(data.authIdentities);
        }

        // Checklist link
        document.getElementById('checklist-link').href = `/checklist/${username}`;

        // Draw chart
        drawProgressChart(solved, progress, failed);
    }

    // Listen for dark mode toggle to redraw chart with correct colors
    const darkModeSwitch = document.getElementById('dark-mode-switch');
    if (darkModeSwitch) {
        darkModeSwitch.addEventListener('change', () => {
            // Small delay to ensure class change has propagated
            setTimeout(() => {
                drawProgressChart(currentStats.solved, currentStats.progress, currentStats.failed);
            }, 50);
        });
    }

    function populateIdentities(identities) {
        const identitiesList = document.getElementById('identities-list');
        identitiesList.innerHTML = '';

        identities.forEach(identity => {
            const item = document.createElement('div');
            item.className = 'identity-item';
            
            const icon = getProviderIcon(identity.provider);
            const displayName = identity.displayName;
            
            item.innerHTML = `
                ${icon}
                <span>${displayName}</span>
            `;
            
            identitiesList.appendChild(item);
        });
    }

    function getProviderIcon(provider) {
        const icons = {
            github: `<svg class="identity-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>`,
            discord: `<svg class="identity-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 0 0-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 0 0-5.487 0 12.36 12.36 0 0 0-.617-1.23A.077.077 0 0 0 8.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 0 0 .031.055 20.03 20.03 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026 13.83 13.83 0 0 0 1.226-1.963.074.074 0 0 0-.041-.104 13.201 13.201 0 0 1-1.872-.878.075.075 0 0 1-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 0 1 .078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 0 1 .079.009c.12.098.245.195.372.288a.075.075 0 0 1-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 0 0-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.028 19.963 19.963 0 0 0 6.002-2.981.076.076 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028zM8.02 15.278c-1.182 0-2.157-1.069-2.157-2.38 0-1.312.956-2.38 2.157-2.38 1.201 0 2.176 1.068 2.157 2.38 0 1.311-.956 2.38-2.157 2.38zm7.975 0c-1.183 0-2.157-1.069-2.157-2.38 0-1.312.955-2.38 2.157-2.38 1.201 0 2.176 1.068 2.157 2.38 0 1.311-.956 2.38-2.157 2.38z"/>
            </svg>`,
            google: `<svg class="identity-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>`
        };
        
        return icons[provider] || '<div class="identity-icon"></div>';
    }

    function getThemeColor(className) {
        const temp = document.createElement('div');
        temp.className = className;
        temp.style.visibility = 'hidden';
        temp.style.position = 'absolute';
        // Ensure it's appended to body so it inherits dark mode if applicable
        document.body.appendChild(temp);
        const color = getComputedStyle(temp).backgroundColor;
        document.body.removeChild(temp);
        return color;
    }

    function drawProgressChart(solved, progress, failed) {
        const canvas = document.getElementById('progress-chart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        // Use a slightly smaller radius to ensure no clipping with thick strokes
        const radius = 160; 
        const lineWidth = 40;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const total = solved + progress + failed;
        
        // Fetch colors dynamically from style.css classes
        const colors = {
            solved: getThemeColor('green'),
            progress: getThemeColor('yellow'),
            failed: getThemeColor('red'),
            // Use the progress-segment white class for the track color
            track: getThemeColor('progress-segment white')
        };

        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'butt'; // Remove rounded ends for bent rectangles

        if (total === 0) {
            // Draw empty circle
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.strokeStyle = colors.track;
            ctx.stroke();
            return;
        }

        // Calculate angles
        const solvedAngle = (solved / total) * 2 * Math.PI;
        const progressAngle = (progress / total) * 2 * Math.PI;
        const failedAngle = (failed / total) * 2 * Math.PI;

        let currentAngle = -Math.PI / 2; // Start from top

        // Draw solved arc
        if (solved > 0) {
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + solvedAngle);
            ctx.strokeStyle = colors.solved;
            ctx.stroke();
            currentAngle += solvedAngle;
        }

        // Draw progress arc
        if (progress > 0) {
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + progressAngle);
            ctx.strokeStyle = colors.progress;
            ctx.stroke();
            currentAngle += progressAngle;
        }

        // Draw failed arc
        if (failed > 0) {
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + failedAngle);
            ctx.strokeStyle = colors.failed;
            ctx.stroke();
            currentAngle += failedAngle;
        }
    }

    function setupFollowButton(targetUsername, initialIsFollowing, initialFollowerCount) {
        const followButton = document.getElementById('follow-button');
        const followersElement = document.getElementById('profile-followers');
        
        let isFollowing = initialIsFollowing;
        let followerCount = initialFollowerCount;

        // Helper to update button appearance
        const updateButtonVisuals = (following) => {
            if (following) {
                followButton.textContent = 'Following';
                followButton.classList.add('following');
            } else {
                followButton.textContent = 'Follow';
                followButton.classList.remove('following');
            }
        };

        // Set initial state
        updateButtonVisuals(isFollowing);
        
        // Add hover effects for Unfollow text
        followButton.addEventListener('mouseenter', () => {
            if (isFollowing) {
                followButton.textContent = 'Unfollow';
            }
        });

        followButton.addEventListener('mouseleave', () => {
            if (isFollowing) {
                followButton.textContent = 'Following';
            }
        });
        
        followButton.addEventListener('click', async () => {
            if (followButton.disabled) return;
            followButton.disabled = true;
            
            try {
                const sessionToken = localStorage.getItem('sessionToken');
                const response = await fetch(`${apiUrl}/user/follow`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        username: targetUsername,
                        token: sessionToken
                    })
                });

                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.message || 'Failed to update follow status');
                }

                // Toggle state
                isFollowing = !isFollowing;
                updateButtonVisuals(isFollowing);
                
                // Update count
                if (isFollowing) {
                    followerCount++;
                } else {
                    followerCount--;
                }
                followersElement.textContent = followerCount;

            } catch (error) {
                console.error('Error toggling follow:', error);
                showMessage('Failed to update follow status.', 'error');
            } finally {
                followButton.disabled = false;
            }
        });
    }
});
