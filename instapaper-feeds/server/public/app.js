document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const elUsername = document.getElementById('username');
    const elPassword = document.getElementById('password');
    const btnTestAuth = document.getElementById('btn-test-auth');
    const authStatus = document.getElementById('auth-status');

    const feedList = document.getElementById('feed-list');
    const newFeedUrl = document.getElementById('new-feed-url');
    const btnAddFeed = document.getElementById('btn-add-feed');
    const feedStatus = document.getElementById('feed-status');

    const elFrequency = document.getElementById('frequency');
    const btnSaveConfig = document.getElementById('btn-save-config');
    
    const logsOutput = document.getElementById('logs-output');
    const btnRefreshLogs = document.getElementById('btn-refresh-logs');

    // State
    let config = {
        instapaper: { username: '', password: '' },
        feeds: [],
        frequency: 60
    };

    // Initialization
    loadConfig();
    loadLogs();
    
    // Auto-refresh logs every 10s
    setInterval(loadLogs, 10000);

    // Event Listeners
    btnTestAuth.addEventListener('click', testAuth);
    btnAddFeed.addEventListener('click', addFeed);
    btnSaveConfig.addEventListener('click', saveConfig);
    btnRefreshLogs.addEventListener('click', loadLogs);

    // Functions
    async function loadConfig() {
        try {
            const res = await fetch('/api/config');
            config = await res.json();
            
            elUsername.value = config.instapaper.username || '';
            elPassword.value = config.instapaper.password || '';
            elFrequency.value = config.frequency || 60;
            
            renderFeeds();
        } catch (error) {
            console.error('Failed to load config', error);
        }
    }

    async function loadLogs() {
        try {
            const res = await fetch('/api/logs');
            const text = await res.text();
            logsOutput.textContent = text;
            logsOutput.scrollTop = logsOutput.scrollHeight;
        } catch (error) {
            logsOutput.textContent = 'Failed to load logs.';
        }
    }

    async function testAuth() {
        const username = elUsername.value.trim();
        const password = elPassword.value.trim();

        if (!username || !password) {
            showMessage(authStatus, 'Please enter username and password', 'error');
            return;
        }

        const originalText = btnTestAuth.innerHTML;
        btnTestAuth.innerHTML = '<svg class="loading" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Testing...';
        btnTestAuth.disabled = true;

        try {
            const res = await fetch('/api/validate-instapaper', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();

            if (data.success) {
                showMessage(authStatus, 'Authentication successful!', 'success');
            } else {
                showMessage(authStatus, data.error || 'Authentication failed', 'error');
            }
        } catch (error) {
            showMessage(authStatus, 'Network error testing authentication', 'error');
        } finally {
            btnTestAuth.innerHTML = originalText;
            btnTestAuth.disabled = false;
        }
    }

    async function addFeed() {
        const url = newFeedUrl.value.trim();
        if (!url) return;

        if (config.feeds.includes(url)) {
            showMessage(feedStatus, 'Feed is already in the list', 'error');
            return;
        }

        const originalText = btnAddFeed.innerHTML;
        btnAddFeed.innerHTML = '<svg class="loading" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Validating...';
        btnAddFeed.disabled = true;

        try {
            const res = await fetch('/api/validate-rss', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            const data = await res.json();

            if (data.success) {
                config.feeds.push(url);
                newFeedUrl.value = '';
                renderFeeds();
                showMessage(feedStatus, 'Feed added successfully! Remember to save.', 'success');
            } else {
                showMessage(feedStatus, data.error || 'Invalid feed URL', 'error');
            }
        } catch (error) {
            showMessage(feedStatus, 'Network error validating feed', 'error');
        } finally {
            btnAddFeed.innerHTML = originalText;
            btnAddFeed.disabled = false;
        }
    }

    function removeFeed(url) {
        config.feeds = config.feeds.filter(f => f !== url);
        renderFeeds();
    }

    function renderFeeds() {
        feedList.innerHTML = '';
        if (config.feeds.length === 0) {
            feedList.innerHTML = '<li style="color: var(--text-secondary); font-size: 0.875rem; padding: 0.5rem 0;">No feeds added yet.</li>';
            return;
        }

        config.feeds.forEach(url => {
            const li = document.createElement('li');
            li.className = 'feed-item';
            
            const span = document.createElement('span');
            span.className = 'feed-url';
            span.textContent = url;
            
            const btn = document.createElement('button');
            btn.className = 'btn-remove';
            btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
            btn.onclick = () => removeFeed(url);

            li.appendChild(span);
            li.appendChild(btn);
            feedList.appendChild(li);
        });
    }

    async function saveConfig() {
        config.instapaper.username = elUsername.value.trim();
        config.instapaper.password = elPassword.value.trim();
        config.frequency = parseInt(elFrequency.value, 10);

        const originalText = btnSaveConfig.innerHTML;
        btnSaveConfig.innerHTML = '<svg class="loading" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Saving...';
        btnSaveConfig.disabled = true;

        try {
            const res = await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            
            if (res.ok) {
                const btnOriginalBg = btnSaveConfig.style.backgroundColor;
                btnSaveConfig.innerHTML = 'Saved Successfully!';
                btnSaveConfig.style.backgroundColor = 'var(--success-color)';
                setTimeout(() => {
                    btnSaveConfig.innerHTML = originalText;
                    btnSaveConfig.style.backgroundColor = btnOriginalBg;
                    btnSaveConfig.disabled = false;
                }, 2000);
            }
        } catch (error) {
            console.error('Failed to save config', error);
            btnSaveConfig.innerHTML = originalText;
            btnSaveConfig.disabled = false;
        }
    }

    function showMessage(element, text, type) {
        element.textContent = text;
        element.className = `message ${type}`;
        setTimeout(() => {
            element.className = 'message';
        }, 5000);
    }
});
