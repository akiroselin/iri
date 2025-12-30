require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const userRoutes = require('./routes/user');

const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// Serve Static Frontend
app.use(express.static(path.join(__dirname, '../FrontEnd')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/user', userRoutes);

// Fallback to index.html for SPA
// Exclude API requests and common static extensions to prevent returning HTML for missing files
app.get(/(.*)/, (req, res) => {
    if (req.path.startsWith('/api') || /\.(js|css|png|jpg|jpeg|gif|ico|svg)$/i.test(req.path)) {
        return res.status(404).send('Not Found');
    }
    res.sendFile(path.join(__dirname, '../FrontEnd/index.html'));
});

// Export for Vercel/Serverless
module.exports = app;

// Only listen if run directly
if (require.main === module) {
    const server = app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });

    server.on('error', (e) => {
        console.error('Server error:', e);
    });
}
