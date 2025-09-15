// Current active chat room
let currentRoom = 'general';
let currentUser = null; // In a real app, this would be set after login
let isAdmin = true; // For demo purposes, set to true to show admin controls
// In a real implementation, this would be determined by checking if user is in top 3 admins

// Tab switching functionality
document.addEventListener('DOMContentLoaded', function() {
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
                        'Content-Type': 'application/json'
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

// Load booking leads
async function loadBookingLeads() {
    try {
        const response = await fetch('/api/leads');
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
                    ${(isAdmin || lead.is_owner) ? 
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
                            method: 'DELETE'
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

// Show message in the registration form
function showMessage(message, type) {
    const messageElement = document.getElementById('register-message');
    messageElement.textContent = message;
    messageElement.className = type === 'success' ? 'message-success' : 'message-error';
    
    // Clear message after 5 seconds
    setTimeout(() => {
        messageElement.textContent = '';
        messageElement.className = '';
    }, 5000);
}

// Show info message in the registration form
function showInfoMessage(message) {
    const messageElement = document.getElementById('register-info');
    if (messageElement) {
        messageElement.textContent = message;
        messageElement.className = 'message-info';
        
        // Clear message after 10 seconds
        setTimeout(() => {
            messageElement.textContent = '';
            messageElement.className = '';
        }, 10000);
    } else {
        const infoElement = document.createElement('div');
        infoElement.id = 'register-info';
        infoElement.className = 'message-info';
        infoElement.textContent = message;
        infoElement.style.marginTop = '1rem';
        infoElement.style.padding = '1rem';
        infoElement.style.textAlign = 'center';
        infoElement.style.fontSize = '0.9rem';
        infoElement.style.color = '#34495e';
        
        const form = document.getElementById('register-form');
        if (form) {
            form.appendChild(infoElement);
            
            // Clear message after 10 seconds
            setTimeout(() => {
                if (infoElement && infoElement.parentNode === form) {
                    form.removeChild(infoElement);
                }
            }, 10000);
        }
    }
}

// Load news feed from API
async function loadNewsFeed() {
    try {
        const response = await fetch('/api/posts');
        const posts = await response.json();
        
        const newsPostsContainer = document.querySelector('.news-posts');
        newsPostsContainer.innerHTML = '';
        
        posts.forEach(post => {
            const postElement = document.createElement('div');
            postElement.className = 'news-post';
            const date = new Date(post.created_at || post.timestamp).toLocaleString();
            postElement.innerHTML = `
                <div class="post-header">
                    <h3>Community Post</h3>
                    ${isAdmin ? `<button class="delete-btn" data-post-id="${post.id}">Delete</button>` : ''}
                </div>
                <p>${post.content}</p>
                <small>Posted by ${post.users?.username || post.user || 'Anonymous'} on ${date}</small>
            `;
            newsPostsContainer.appendChild(postElement);
            
            // Add event listener to delete button if user is admin
            if (isAdmin) {
                const deleteBtn = postElement.querySelector('.delete-btn');
                deleteBtn.addEventListener('click', () => {
                    deletePost(post.id);
                });
            }
        });
    } catch (error) {
        console.error('Error loading news feed:', error);
    }
}

// Delete a post
async function deletePost(postId) {
    if (!isAdmin) return;
    
    try {
        const response = await fetch(`/api/posts/${postId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            loadNewsFeed(); // Reload posts
            alert('Post deleted successfully');
        } else {
            alert('Failed to delete post');
        }
    } catch (error) {
        console.error('Error deleting post:', error);
        alert('An error occurred while deleting the post');
    }
}

// Delete a message
async function deleteMessage(messageId) {
    if (!isAdmin) return;
    
    try {
        const response = await fetch(`/api/messages/${messageId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            // In a real app, you would remove the message from the UI
            // For now, we'll just show a message
            console.log('Message deleted');
        } else {
            alert('Failed to delete message');
        }
    } catch (error) {
        console.error('Error deleting message:', error);
        alert('An error occurred while deleting the message');
    }
}

// Load suggestions from API
async function loadSuggestions() {
    try {
        const response = await fetch('/api/suggestions');
        const suggestions = await response.json();
        
        const suggestionsContainer = document.querySelector('.suggestions-list');
        suggestionsContainer.innerHTML = '';
        
        suggestions.forEach(suggestion => {
            const suggestionElement = document.createElement('div');
            suggestionElement.className = 'suggestion-item';
            const date = new Date(suggestion.created_at || suggestion.timestamp).toLocaleDateString();
            suggestionElement.innerHTML = `
                <div class="suggestion-header">
                    <div class="suggestion-title">${suggestion.title}</div>
                    ${isAdmin ? `<button class="delete-btn" data-suggestion-id="${suggestion.id}">Delete</button>` : ''}
                </div>
                <p>${suggestion.description}</p>
                <div class="vote-info">
                    <div class="vote-count">Votes: ${suggestion.vote_count || suggestion.votes || 0}</div>
                    <small>Submitted by ${suggestion.users?.username || suggestion.user || 'Anonymous'} on ${date}</small>
                </div>
                <button class="support-btn" data-id="${suggestion.id}">Support</button>
                <button class="oppose-btn" data-id="${suggestion.id}">Oppose</button>
                <div class="voters-list">
                    <small>Voters: ${suggestion.voters ? suggestion.voters.join(', ') : 'None'}</small>
                </div>
            `;
            suggestionsContainer.appendChild(suggestionElement);
            
            // Add event listener to delete button if user is admin
            if (isAdmin) {
                const deleteBtn = suggestionElement.querySelector('.delete-btn');
                deleteBtn.addEventListener('click', () => {
                    deleteSuggestion(suggestion.id);
                });
            }
        });
        
        // Add event listeners to support buttons
        document.querySelectorAll('.support-btn').forEach(button => {
            button.addEventListener('click', function() {
                const id = this.getAttribute('data-id');
                voteOnSuggestion(id, 'support');
            });
        });
    } catch (error) {
        console.error('Error loading suggestions:', error);
    }
}

// Delete a suggestion
async function deleteSuggestion(suggestionId) {
    if (!isAdmin) return;
    
    try {
        const response = await fetch(`/api/suggestions/${suggestionId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            loadSuggestions(); // Reload suggestions
            alert('Suggestion deleted successfully');
        } else {
            alert('Failed to delete suggestion');
        }
    } catch (error) {
        console.error('Error deleting suggestion:', error);
        alert('An error occurred while deleting the suggestion');
    }
}

// Load referenda from API
async function loadReferenda() {
    try {
        const response = await fetch('/api/referenda');
        const referenda = await response.json();
        
        const referendaContainer = document.querySelector('.referenda-container');
        referendaContainer.innerHTML = '';
        
        referenda.forEach(referendum => {
            const totalVotes = (referendum.yes_votes || 0) + (referendum.no_votes || 0);
            const yesPercentage = totalVotes > 0 ? Math.round(((referendum.yes_votes || 0) / totalVotes) * 100) : 0;
            const noPercentage = totalVotes > 0 ? Math.round(((referendum.no_votes || 0) / totalVotes) * 100) : 0;
            
            const referendumElement = document.createElement('div');
            referendumElement.className = 'referendum-item';
            
            let statusClass = '';
            let statusText = '';
            
            switch(referendum.status) {
                case 'active':
                    statusClass = 'status-active';
                    statusText = 'Active';
                    break;
                case 'passed':
                    statusClass = 'status-passed';
                    statusText = 'Passed';
                    break;
                case 'failed':
                    statusClass = 'status-failed';
                    statusText = 'Failed';
                    break;
                default:
                    statusClass = 'status-active';
                    statusText = 'Active';
            }
            
            referendumElement.innerHTML = `
                <div class="referendum-header">
                    <div>
                        <div class="referendum-status ${statusClass}">${statusText}</div>
                        <h3>${referendum.title}</h3>
                    </div>
                    ${isAdmin ? `<button class="delete-btn" data-referendum-id="${referendum.id}">Delete</button>` : ''}
                </div>
                <p>${referendum.description}</p>
                <div class="vote-count">Votes: ${totalVotes}</div>
                <div class="vote-percentage">Yes: ${yesPercentage}% | No: ${noPercentage}%</div>
                ${referendum.status === 'active' ? `
                <div class="vote-buttons">
                    <button class="support-btn" data-id="${referendum.id}" data-vote="yes">Vote Yes</button>
                    <button class="oppose-btn" data-id="${referendum.id}" data-vote="no">Vote No</button>
                </div>` : ''}
                <div class="voters-list">
                    <small>
                        Yes voters: ${referendum.yes_voters ? referendum.yes_voters.join(', ') : 'None'}<br>
                        No voters: ${referendum.no_voters ? referendum.no_voters.join(', ') : 'None'}
                    </small>
                </div>
            `;
            referendaContainer.appendChild(referendumElement);
            
            // Add event listener to delete button if user is admin
            if (isAdmin) {
                const deleteBtn = referendumElement.querySelector('.delete-btn');
                deleteBtn.addEventListener('click', () => {
                    deleteReferendum(referendum.id);
                });
            }
            
            // Add event listeners to vote buttons
            if (referendum.status === 'active') {
                const voteButtons = referendumElement.querySelectorAll('.support-btn, .oppose-btn');
                voteButtons.forEach(button => {
                    button.addEventListener('click', function() {
                        const id = this.getAttribute('data-id');
                        const vote = this.getAttribute('data-vote');
                        voteOnReferendum(id, vote);
                    });
                });
            }
        });
        
        // Update chat tabs with referenda
        updateChatTabs(referenda);
    } catch (error) {
        console.error('Error loading referenda:', error);
    }
}

// Delete a referendum
async function deleteReferendum(referendumId) {
    if (!isAdmin) return;
    
    try {
        const response = await fetch(`/api/referenda/${referendumId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            loadReferenda(); // Reload referenda
            alert('Referendum deleted successfully');
        } else {
            alert('Failed to delete referendum');
        }
    } catch (error) {
        console.error('Error deleting referendum:', error);
        alert('An error occurred while deleting the referendum');
    }
}

// Load elections from API
async function loadElections() {
    try {
        const response = await fetch('/api/users');
        const users = await response.json();
        
        // Sort users by vote count (descending)
        users.sort((a, b) => (b.admin_votes || 0) - (a.admin_votes || 0));
        
        // Display current admins (top 3)
        const currentAdminsContainer = document.querySelector('.current-admins');
        currentAdminsContainer.innerHTML = '';
        
        const admins = users.slice(0, 3);
        admins.forEach((admin, index) => {
            const adminElement = document.createElement('div');
            adminElement.className = 'admin-card';
            adminElement.innerHTML = `
                <h4>Admin #${index + 1}</h4>
                <p>${admin.username}</p>
                <div class="vote-count">${admin.admin_votes || 0} votes</div>
                ${isAdmin ? `<button class="ban-btn" data-user-id="${admin.id}">Ban User</button>` : ''}
            `;
            currentAdminsContainer.appendChild(adminElement);
            
            // Add event listener to ban button if user is admin
            if (isAdmin) {
                const banBtn = adminElement.querySelector('.ban-btn');
                banBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent voting when clicking ban button
                    banUser(admin.id, admin.username);
                });
            }
        });
        
        // Display all users
        const usersContainer = document.querySelector('.users-container');
        usersContainer.innerHTML = '';
        
        users.forEach(user => {
            const userElement = document.createElement('div');
            userElement.className = 'user-card';
            userElement.setAttribute('data-id', user.id);
            userElement.innerHTML = `
                <h4>${user.username}</h4>
                <p>Member since: ${new Date(user.created_at).toLocaleDateString()}</p>
                <div class="vote-count">${user.admin_votes || 0} admin votes</div>
                ${isAdmin && user.id !== currentUser?.id ? `<button class="ban-btn" data-user-id="${user.id}">Ban User</button>` : ''}
            `;
            
            userElement.addEventListener('click', () => {
                voteForAdmin(user.id, user.username);
            });
            
            usersContainer.appendChild(userElement);
            
            // Add event listener to ban button if user is admin
            if (isAdmin && user.id !== currentUser?.id) {
                const banBtn = userElement.querySelector('.ban-btn');
                banBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent voting when clicking ban button
                    banUser(user.id, user.username);
                });
            }
        });
    } catch (error) {
        console.error('Error loading elections:', error);
    }
}

// Ban a user
async function banUser(userId, username) {
    if (!isAdmin) return;
    
    if (!confirm(`Are you sure you want to ban ${username}?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/users/${userId}/ban`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            alert(`User ${username} has been banned`);
            loadElections(); // Reload elections
        } else {
            const result = await response.json();
            alert(result.error || 'Failed to ban user');
        }
    } catch (error) {
        console.error('Error banning user:', error);
        alert('An error occurred while banning the user');
    }
}

// Vote for admin
async function voteForAdmin(userId, username) {
    try {
        const response = await fetch(`/api/users/${userId}/vote-admin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId })
        });
        
        if (response.ok) {
            // Show success message
            alert(`Successfully voted for ${username} as admin!`);
            // Reload elections
            loadElections();
        } else {
            const result = await response.json();
            alert(result.error || 'Failed to vote for admin');
        }
    } catch (error) {
        console.error('Error voting for admin:', error);
        alert('An error occurred while voting for admin');
    }
}

// Vote on a suggestion
async function voteOnSuggestion(id, voteType) {
    try {
        const response = await fetch(`/api/suggestions/${id}/vote`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ voteType })
        });
        
        if (response.ok) {
            // Reload suggestions
            loadSuggestions();
        }
    } catch (error) {
        console.error('Error voting on suggestion:', error);
    }
}

// Vote on a referendum
async function voteOnReferendum(id, vote) {
    try {
        const response = await fetch(`/api/referenda/${id}/vote`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ vote })
        });
        
        if (response.ok) {
            // Reload referenda
            loadReferenda();
        }
    } catch (error) {
        console.error('Error voting on referendum:', error);
    }
}

// Update chat tabs with referenda
function updateChatTabs(referenda) {
    const chatTabsContainer = document.querySelector('.chat-tabs');
    
    // Clear existing referendum tabs but keep the general tab
    const generalTab = chatTabsContainer.querySelector('[data-room="general"]');
    chatTabsContainer.innerHTML = '';
    chatTabsContainer.appendChild(generalTab);
    
    // Add tabs for each referendum
    referenda.forEach(referendum => {
        const tabElement = document.createElement('li');
        tabElement.className = 'chat-tab';
        tabElement.setAttribute('data-room', `referendum-${referendum.id}`);
        tabElement.textContent = referendum.title;
        chatTabsContainer.appendChild(tabElement);
    });
    
    // Add event listeners to new tabs
    document.querySelectorAll('.chat-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.chat-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            currentRoom = this.getAttribute('data-room') || 'general';
        });
    });
}