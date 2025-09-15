const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { initSupabase } = require('./supabaseClient');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// JWT secret - in production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'democratic_social_network_secret_key';

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

// Registration endpoint with email verification
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        // Validate input
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Username, email, and password are required' });
        }
        
        // Check if user already exists
        const { data: existingUsers, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .or(`email.eq.${email},username.eq.${username}`);
        
        if (fetchError) throw fetchError;
        
        if (existingUsers.length > 0) {
            return res.status(400).json({ error: 'Username or email already exists' });
        }
        
        // Hash password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        
        // Generate email verification token
        const emailVerificationToken = jwt.sign({ email }, JWT_SECRET, { expiresIn: '1d' });
        
        // Insert user into database
        const { data: newUser, error: insertError } = await supabase
            .from('users')
            .insert([
                {
                    username,
                    email,
                    password: hashedPassword,
                    email_verified: false,
                    email_verification_token: emailVerificationToken
                }
            ])
            .select()
            .single();
        
        if (insertError) throw insertError;
        
        // Send verification email
        await sendVerificationEmail(email, emailVerificationToken);
        
        res.status(201).json({ 
            message: 'User registered successfully. Please check your email for verification.' 
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Validate input
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        
        // Find user
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();
        
        if (error) throw error;
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        
        // Check if email is verified
        if (!user.email_verified) {
            return res.status(401).json({ error: 'Please verify your email before logging in' });
        }
        
        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        
        // Generate JWT token
        const token = jwt.sign(
            { id: user.id, username: user.username, email: user.email }, 
            JWT_SECRET, 
            { expiresIn: '7d' }
        );
        
        // Remove sensitive data
        const { password: _, ...userWithoutPassword } = user;
        
        res.json({ 
            user: userWithoutPassword, 
            token,
            message: 'Login successful' 
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Middleware to verify JWT token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
}

// Logout endpoint
app.post('/api/logout', authenticateToken, async (req, res) => {
    try {
        // In a real implementation, you might want to blacklist the token
        // For now, we'll just send a success response
        res.json({ message: 'Logout successful' });
    } catch (error) {
        console.error('Logout error:', error);
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
app.post('/api/leads', authenticateToken, async (req, res) => {
    try {
        const { date, duration, description } = req.body;
        
        // Validate input
        if (!date || !duration || !description) {
            return res.status(400).json({ error: 'Date, duration, and description are required' });
        }
        
        // Insert lead into database
        const { data: newLead, error } = await supabase
            .from('booking_leads')
            .insert([
                {
                    user_id: req.user.id,
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
app.delete('/api/leads/:id', authenticateToken, async (req, res) => {
    try {
        const leadId = req.params.id;
        
        // Check if user is admin or owner of the lead
        const { data: lead, error: fetchError } = await supabase
            .from('booking_leads')
            .select('user_id')
            .eq('id', leadId)
            .single();
        
        if (fetchError) throw fetchError;
        
        // In a real implementation, also check if user is admin
        if (lead.user_id !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized to delete this lead' });
        }
        
        // Delete from database
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

// Function to send email verification email
async function sendVerificationEmail(email, token) {
    try {
        const verificationUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/api/verify-email?token=${token}`;
        
        const mailOptions = {
            from: process.env.EMAIL_USER || 'noreply@democratic-social-network.com',
            to: email,
            subject: 'Email Verification - Democratic Social Network',
            html: `
                <h2>Email Verification</h2>
                <p>Thank you for registering with Democratic Social Network.</p>
                <p>Please click the link below to verify your email address:</p>
                <a href="${verificationUrl}">Verify Email</a>
                <p>This link will expire in 24 hours.</p>
            `
        };
        
        // In a real implementation, send the email
        // For now, we'll just log it
        console.log('Would send verification email:', mailOptions);
        
        // Uncomment the following line in a real implementation:
        // await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Error sending verification email:', error);
    }
}

// Function to send email notifications when a suggestion is approved for referendum
async function sendReferendumApprovalNotification(suggestion) {
    try {
        // Get all users to send notifications to
        const { data: users, error } = await supabase
            .from('users')
            .select('email');
        
        if (error) throw error;
        
        const mailOptions = {
            from: process.env.EMAIL_USER || 'noreply@democratic-social-network.com',
            to: users.map(user => user.email).join(','),
            subject: 'New Referendum Approved - Democratic Social Network',
            html: `
                <h2>New Referendum Approved</h2>
                <p>A suggestion has reached the required quorum and has been approved for a referendum:</p>
                <h3>${suggestion.title}</h3>
                <p>${suggestion.description}</p>
                <p>Log in to the Democratic Social Network to vote on this referendum.</p>
            `
        };
        
        // In a real implementation, send the email
        // For now, we'll just log it
        console.log('Would send referendum approval notification:', mailOptions);
        
        // Uncomment the following line in a real implementation:
        // await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Error sending referendum approval notification:', error);
    }
}

// Function to send email notifications when a referendum is approved
async function sendReferendumPassedNotification(referendum) {
    try {
        // Get all users to send notifications to
        const { data: users, error } = await supabase
            .from('users')
            .select('email');
        
        if (error) throw error;
        
        const mailOptions = {
            from: process.env.EMAIL_USER || 'noreply@democratic-social-network.com',
            to: users.map(user => user.email).join(','),
            subject: 'Referendum Approved - Democratic Social Network',
            html: `
                <h2>Referendum Approved</h2>
                <p>A referendum has been approved with a two-thirds majority:</p>
                <h3>${referendum.title}</h3>
                <p>${referendum.description}</p>
                <p>Yes votes: ${referendum.yes_votes}</p>
                <p>No votes: ${referendum.no_votes}</p>
            `
        };
        
        // In a real implementation, send the email
        // For now, we'll just log it
        console.log('Would send referendum passed notification:', mailOptions);
        
        // Uncomment the following line in a real implementation:
        // await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Error sending referendum passed notification:', error);
    }
}

// Add periodic cleanup task for old referendums (more than 2 weeks old)
setInterval(async () => {
    try {
        // Calculate the date 2 weeks ago
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
        
        // Find referendums older than 2 weeks that haven't ended
        const { data: oldReferendums, error: fetchError } = await supabase
            .from('referenda')
            .select('*')
            .lt('created_at', twoWeeksAgo.toISOString())
            .is('ended_at', null);
        
        if (fetchError) throw fetchError;
        
        // Delete old referendums
        if (oldReferendums.length > 0) {
            const { error: deleteError } = await supabase
                .from('referenda')
                .delete()
                .in('id', oldReferendums.map(r => r.id));
            
            if (deleteError) throw deleteError;
            
            console.log(`Deleted ${oldReferendums.length} old referendums`);
        }
        
        // Also clean up old leads (existing code)
        const { error: leadError } = await supabase
            .from('booking_leads')
            .delete()
            .lt('date', twoWeeksAgo.toISOString().split('T')[0]);
        
        if (leadError) throw leadError;
        
        console.log('Old leads cleanup completed');
    } catch (error) {
        console.error('Error during cleanup:', error);
    }
}, 24 * 60 * 60 * 1000); // Run once per day

// Check for referendums that should be approved (every hour)
setInterval(async () => {
    try {
        // Find active referendums
        const { data: referendums, error } = await supabase
            .from('referenda')
            .select('*')
            .eq('status', 'active');
        
        if (error) throw error;
        
        for (const referendum of referendums) {
            // Check if referendum has been active for at least 24 hours
            const createdTime = new Date(referendum.created_at);
            const now = new Date();
            const hoursDifference = (now - createdTime) / (1000 * 60 * 60);
            
            if (hoursDifference >= 24) {
                // Calculate total votes
                const totalVotes = referendum.yes_votes + referendum.no_votes;
                
                // Check if there's a two-thirds majority
                if (referendum.yes_votes >= totalVotes * 2/3) {
                    // Update referendum as passed
                    const { error: updateError } = await supabase
                        .from('referenda')
                        .update({ 
                            status: 'passed',
                            ended_at: new Date().toISOString()
                        })
                        .eq('id', referendum.id);
                    
                    if (updateError) throw updateError;
                    
                    // Send notification that referendum passed
                    await sendReferendumPassedNotification(referendum);
                } else if (referendum.no_votes >= totalVotes * 2/3) {
                    // Update referendum as failed
                    const { error: updateError } = await supabase
                        .from('referenda')
                        .update({ 
                            status: 'failed',
                            ended_at: new Date().toISOString()
                        })
                        .eq('id', referendum.id);
                    
                    if (updateError) throw updateError;
                }
            }
        }
    } catch (error) {
        console.error('Error during referendum check:', error);
    }
}, 60 * 60 * 1000); // Run every hour

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});