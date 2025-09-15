// Current active chat room
let currentRoom = 'general';
let currentUser = null; // In a real app, this would be set after login
let isAdmin = true; // For demo purposes, set to true to show admin controls
let authToken = null;
// In a real implementation, this would be determined by checking if user is in top 3 admins

// Tab switching functionality
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is logged in (in a real app, you would check for a valid token)
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('token');
    
    if (storedUser && storedToken) {
        currentUser = JSON.parse(storedUser);
        authToken = storedToken;
    }
    
    const isLoggedIn = !!(currentUser && authToken);
    
    // Show appropriate tabs based on login status
    updateUIForAuthStatus(isLoggedIn);
    
    // Tab switching
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs and contents
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(tc => tc.classList.remove('active'));
            
            // Add active class to clicked tab
            tab.classList.add('active');
            
            // Show corresponding content
            const tabId = tab.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
            
            // Load data based on tab
            if (tabId === 'elections') {
                loadElections();
            } else if (tabId === 'booking-leads') {
                loadBookingLeads();
            }
        });
    });
    
    // Handle login form submission
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            const messageDiv = document.getElementById('login-message');
            
            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, password })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    // Save user data and token to localStorage
                    localStorage.setItem('user', JSON.stringify(data.user));
                    localStorage.setItem('token', data.token);
                    
                    // Update UI to show logged-in state
                    currentUser = data.user;
                    authToken = data.token;
                    updateUIForAuthStatus(true);
                    
                    messageDiv.innerHTML = '<p style="color: green;">Login successful! Redirecting...</p>';
                    
                    // Redirect to news feed after a short delay
                    setTimeout(() => {
                        document.querySelector('.tab[data-tab="news-feed"]').click();
                    }, 1000);
                } else {
                    messageDiv.innerHTML = `<p style="color: red;">${data.error}</p>`;
                }
            } catch (error) {
                console.error('Login error:', error);
                messageDiv.innerHTML = '<p style="color: red;">Login failed. Please try again.</p>';
            }
        });
    }
    
    // Handle registration form submission
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            const messageDiv = document.getElementById('register-message');
            
            // Check if passwords match
            if (password !== confirmPassword) {
                messageDiv.innerHTML = '<p style="color: red;">Passwords do not match</p>';
                return;
            }
            
            try {
                const response = await fetch('/api/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, email, password })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    messageDiv.innerHTML = '<p style="color: green;">Registration successful! Please check your email for verification.</p>';
                    // Reset form
                    registerForm.reset();
                } else {
                    messageDiv.innerHTML = `<p style="color: red;">${data.error}</p>`;
                }
            } catch (error) {
                console.error('Registration error:', error);
                messageDiv.innerHTML = '<p style="color: red;">Registration failed. Please try again.</p>';
            }
        });
    }
    
    // Handle logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                // Call logout endpoint
                const response = await fetch('/api/logout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    }
                });
                
                // Remove user data from localStorage regardless of server response
                localStorage.removeItem('user');
                localStorage.removeItem('token');
                
                // Update UI to show logged-out state
                currentUser = null;
                authToken = null;
                updateUIForAuthStatus(false);
                
                // Redirect to login page
                document.querySelector('.tab[data-tab="login"]').click();
            } catch (error) {
                console.error('Logout error:', error);
                // Still logout locally even if server call fails
                localStorage.removeItem('user');
                localStorage.removeItem('token');
                currentUser = null;
                authToken = null;
                updateUIForAuthStatus(false);
                document.querySelector('.tab[data-tab="login"]').click();
            }
        });
    }
    
    // Handle lead form submission
    const leadForm = document.getElementById('lead-form');
    if (leadForm) {
        leadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const date = document.getElementById('lead-date').value;
            const duration = document.getElementById('lead-duration').value;
            const description = document.getElementById('lead-description').value;
            
            try {
                const response = await fetch('/api/leads', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({ date, duration, description })
                });
                
                if (response.ok) {
                    // Reset form
                    leadForm.reset();
                    
                    // Reload leads
                    loadBookingLeads();
                    
                    alert('Lead created successfully!');
                } else {
                    const error = await response.json();
                    alert('Error creating lead: ' + error.error);
                }
            } catch (error) {
                console.error('Error creating lead:', error);
                alert('Error creating lead. Please try again.');
            }
        });
    }
    
    // Chat bar toggle functionality
    const chatBar = document.getElementById('chat-bar');
    const chatBarHeader = document.querySelector('.chat-bar-header');
    const toggleChatBtn = document.getElementById('toggle-chat');
    
    chatBarHeader.addEventListener('click', () => {
        chatBar.classList.toggle('collapsed');
        toggleChatBtn.textContent = chatBar.classList.contains('collapsed') ? '+' : '−';
    });
    
    // Chat tab switching
    const chatTabs = document.querySelectorAll('.chat-tab');
    chatTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            chatTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Set current room
            currentRoom = tab.getAttribute('data-room') || 'general';
        });
    });
    
    // Connect to Socket.IO server
    const socket = io();
    
    // Join the general chat room
    socket.emit('join room', 'general');
    
    // Chat functionality
    const messageInput = document.getElementById('message-input');
    const sendMessageBtn = document.getElementById('send-message');
    const messagesContainer = document.querySelector('.chat-messages .messages');
    
    sendMessageBtn.addEventListener('click', () => {
        const message = messageInput.value.trim();
        if (message) {
            socket.emit('chat message', {
                room: currentRoom,
                user: 'User', // In a real app, this would be the actual username
                content: message
            });
            messageInput.value = '';
        }
    });
    
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessageBtn.click();
        }
    });
    
    socket.on('chat message', (msg) => {
        const messageElement = document.createElement('div');
        messageElement.className = 'message';
        const timestamp = new Date(msg.created_at || msg.timestamp).toLocaleTimeString();
        messageElement.innerHTML = `
            <div class="message-header">
                <span class="message-author">${msg.users?.username || msg.user || 'Anonymous'}</span>
                <span class="message-time">${timestamp}</span>
                ${isAdmin ? `<button class="delete-btn" data-message-id="${msg.id}">Delete</button>` : ''}
            </div>
            <div class="message-content">${msg.content}</div>
        `;
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // Add event listener to delete button if user is admin
        if (isAdmin) {
            const deleteBtn = messageElement.querySelector('.delete-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => {
                    // Delete message functionality would go here
                });
            }
        }
    });
});

// Function to update UI based on authentication status
function updateUIForAuthStatus(isLoggedIn) {
    // Get all tabs
    const loginTab = document.querySelector('.tab[data-tab="login"]');
    const registerTab = document.querySelector('.tab[data-tab="register"]');
    const mainTabs = document.querySelectorAll('.tab:not([data-tab="login"]):not([data-tab="register"])');
    const mainContents = document.querySelectorAll('.tab-content:not(#login):not(#register)');
    const authContents = document.querySelectorAll('#login, #register');
    const logoutBtn = document.getElementById('logout-btn');
    
    if (isLoggedIn) {
        // Hide login and register tabs
        loginTab.style.display = 'none';
        registerTab.style.display = 'none';
        
        // Show main tabs
        mainTabs.forEach(tab => {
            tab.style.display = 'block';
        });
        
        // Show main content and hide auth content
        mainContents.forEach(content => {
            content.style.display = 'block';
        });
        authContents.forEach(content => {
            content.style.display = 'none';
        });
        
        // Show logout button
        logoutBtn.style.display = 'block';
        
        // Make sure news feed is active
        document.querySelector('.tab[data-tab="news-feed"]').classList.add('active');
        document.getElementById('news-feed').classList.add('active');
    } else {
        // Show login and register tabs
        loginTab.style.display = 'block';
        registerTab.style.display = 'block';
        
        // Hide main tabs
        mainTabs.forEach(tab => {
            tab.style.display = 'none';
        });
        
        // Hide main content and show auth content
        mainContents.forEach(content => {
            content.style.display = 'none';
        });
        authContents.forEach(content => {
            content.style.display = 'block';
        });
        
        // Hide logout button
        logoutBtn.style.display = 'none';
        
        // Make sure login is active
        loginTab.classList.add('active');
        document.getElementById('login').classList.add('active');
    }
}

// Load booking leads
async function loadBookingLeads() {
    try {
        const response = await fetch('/api/leads', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        const leads = await response.json();
        
        const leadsContainer = document.querySelector('.leads-container');
        if (!leadsContainer) return;
        
        // Sort leads by date (newest first)
        leads.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        if (leads.length === 0) {
            leadsContainer.innerHTML = '<p>No booking leads available.</p>';
            return;
        }
        
        leadsContainer.innerHTML = leads.map(lead => `
            <div class="lead-item" data-lead-id="${lead.id}">
                <div class="lead-header">
                    <span class="lead-date">${new Date(lead.date).toLocaleDateString()}</span>
                    <span class="lead-duration">${lead.duration}</span>
                </div>
                <div class="lead-description">${lead.description}</div>
                <div class="lead-author">Posted by: ${lead.author || 'Unknown'}</div>
                <div class="lead-actions">
                    ${(isAdmin || (currentUser && lead.user_id === currentUser.id)) ? 
                        `<button class="delete-lead-btn" data-lead-id="${lead.id}">Delete</button>` : 
                        `<button class="delete-lead-btn" data-lead-id="${lead.id}" disabled>Delete</button>`}
                </div>
            </div>
        `).join('');
        
        // Add event listeners to delete buttons
        document.querySelectorAll('.delete-lead-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const leadId = e.target.getAttribute('data-lead-id');
                if (confirm('Are you sure you want to delete this lead?')) {
                    try {
                        const response = await fetch(`/api/leads/${leadId}`, {
                            method: 'DELETE',
                            headers: {
                                'Authorization': `Bearer ${authToken}`
                            }
                        });
                        
                        if (response.ok) {
                            // Reload leads
                            loadBookingLeads();
                        } else {
                            const error = await response.json();
                            alert('Error deleting lead: ' + error.error);
                        }
                    } catch (error) {
                        console.error('Error deleting lead:', error);
                        alert('Error deleting lead. Please try again.');
                    }
                }
            });
        });
    } catch (error) {
        console.error('Error loading booking leads:', error);
        const leadsContainer = document.querySelector('.leads-container');
        if (leadsContainer) {
            leadsContainer.innerHTML = '<p>Error loading booking leads.</p>';
        }
    }
}