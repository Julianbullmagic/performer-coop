const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const nodemailer = require('nodemailer');
const { initSupabase } = require('./supabaseClient');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Initialize Supabase
const supabase = initSupabase();

// Configure nodemailer for email notifications
const transporter = nodemailer.createTransport({
  // In a real implementation, you would configure this with your email service
  // For development, you can use ethereal.email or similar services
  service: 'gmail', // Example service
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASS || 'your-email-password'
  }
});

// Serve static files
app.use(express.static(path.join(__dirname)));
app.use(express.json());

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Registration endpoint
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        // In a real implementation with Supabase Auth, you would do:
        // const { user, error } = await supabase.auth.signUp({
        //     email,
        //     password,
        //     options: {
        //         data: {
        //             username
        //         }
        //     }
        // });
        
        // For now, we'll just simulate the registration
        // In a real app, you would store the user in the database
        console.log(`New user registration: ${username}, ${email}`);
        
        // Check if username or email already exists (in a real app)
        // For now, we'll just simulate this check
        const userExists = false; // Replace with actual database check
        
        if (userExists) {
            return res.status(400).json({ error: 'Username or email already exists' });
        }
        
        // Simulate successful registration
        res.json({ message: 'User registered successfully' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all users for elections
app.get('/api/users', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        
        // In a real implementation, you would have a separate table for admin votes
        // For now, we'll simulate admin votes
        const usersWithVotes = data.map(user => ({
            ...user,
            admin_votes: Math.floor(Math.random() * 20) // Random votes for demo
        }));
        
        res.json(usersWithVotes);
    } catch (error) {
        console.error('Error fetching users:', error);
        // Fallback to mock data
        const mockUsers = [
            { id: 1, username: "Alice", email: "alice@example.com", created_at: new Date(Date.now() - 86400000*10).toISOString(), admin_votes: 15 },
            { id: 2, username: "Bob", email: "bob@example.com", created_at: new Date(Date.now() - 86400000*8).toISOString(), admin_votes: 12 },
            { id: 3, username: "Charlie", email: "charlie@example.com", created_at: new Date(Date.now() - 86400000*6).toISOString(), admin_votes: 8 },
            { id: 4, username: "Diana", email: "diana@example.com", created_at: new Date(Date.now() - 86400000*4).toISOString(), admin_votes: 5 },
            { id: 5, username: "Eve", email: "eve@example.com", created_at: new Date(Date.now() - 86400000*2).toISOString(), admin_votes: 3 }
        ];
        res.json(mockUsers);
    }
});

// Vote for admin
app.post('/api/users/:id/vote-admin', async (req, res) => {
    try {
        const userId = req.params.id;
        const { voterId } = req.body; // In a real app, this would come from auth
        
        // In a real implementation, you would:
        // 1. Check if the voter is a valid user
        // 2. Check if the user being voted for exists
        // 3. Record the vote in a separate table
        // 4. Update the admin_votes count for the user
        
        // For now, we'll just simulate the voting
        console.log(`User ${voterId} voted for user ${userId} as admin`);
        
        res.json({ message: 'Vote recorded successfully' });
    } catch (error) {
        console.error('Error voting for admin:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all booking leads
app.get('/api/leads', async (req, res) => {
    try {
        // Fetch leads from database with user information
        const { data: leads, error } = await supabase
            .from('booking_leads')
            .select('*, users(username)')
            .order('date', { ascending: false }); // Newest first
        
        if (error) throw error;
        
        // In a real implementation, you would check if the current user is the owner
        // For now, we'll simulate this
        const leadsWithOwnership = leads.map(lead => ({
            ...lead,
            author: lead.users?.username || 'Unknown',
            is_owner: Math.random() > 0.5 // Simulate ownership for demo
        }));
        
        res.json(leadsWithOwnership);
    } catch (error) {
        console.error('Error fetching leads:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create a new booking lead
app.post('/api/leads', async (req, res) => {
    try {
        const { date, duration, description } = req.body;
        
        // Validate input
        if (!date || !duration || !description) {
            return res.status(400).json({ error: 'Date, duration, and description are required' });
        }
        
        // In a real implementation, user ID would come from authentication
        // For now, we'll use a mock user ID
        const userId = '00000000-0000-0000-0000-000000000000'; // Mock user ID
        
        // Insert lead into database
        const { data: newLead, error } = await supabase
            .from('booking_leads')
            .insert([
                {
                    user_id: userId,
                    date,
                    duration,
                    description
                }
            ])
            .select()
            .single();
        
        if (error) throw error;
        
        // Send email notifications to all users
        await sendLeadNotification(newLead);
        
        res.status(201).json(newLead);
    } catch (error) {
        console.error('Error creating lead:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete a booking lead
app.delete('/api/leads/:id', async (req, res) => {
    try {
        const leadId = req.params.id;
        
        // In a real implementation, you would:
        // 1. Check if user is admin or owner of the lead
        // 2. Delete from database
        const { error } = await supabase
            .from('booking_leads')
            .delete()
            .eq('id', leadId);
        
        if (error) throw error;
        
        res.json({ message: 'Lead deleted successfully' });
    } catch (error) {
        console.error('Error deleting lead:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Function to send email notifications when a new lead is created
async function sendLeadNotification(lead) {
    try {
        // Get all users to send notifications to
        const { data: users, error } = await supabase
            .from('users')
            .select('email');
        
        if (error) throw error;
        
        // Create email content
        const mailOptions = {
            from: process.env.EMAIL_USER || 'noreply@democratic-social-network.com',
            to: users.map(user => user.email).join(','),
            subject: 'New Booking Lead Available',
            text: `A new booking lead has been posted:
            
Date: ${lead.date}
Duration: ${lead.duration}
Description: ${lead.description}

Log in to the Democratic Social Network to view more details.`
        };
        
        // In a real implementation, send the email
        // For now, we'll just log it
        console.log('Would send email notification:', mailOptions);
        
        // Uncomment the following line in a real implementation:
        // await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Error sending email notification:', error);
    }
}

// Add periodic cleanup task for old leads (more than 2 weeks old)
setInterval(async () => {
    try {
        // Calculate the date 2 weeks ago
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
        
        // Delete leads older than 2 weeks
        const { error } = await supabase
            .from('booking_leads')
            .delete()
            .lt('date', twoWeeksAgo.toISOString().split('T')[0]);
        
        if (error) throw error;
        
        console.log('Old leads cleanup completed');
    } catch (error) {
        console.error('Error during lead cleanup:', error);
    }
}, 24 * 60 * 60 * 1000); // Run once per day

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});