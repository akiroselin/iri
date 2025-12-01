const express = require('express');
const router = express.Router();
const db = require('../db');

router.post('/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    let user = db.findUser(email);
    if (!user) {
        return res.status(401).json({ error: 'User not found. Please register.' });
    } 
    
    // Verify password
    if (user.password !== password) {
        return res.status(401).json({ error: 'Invalid password' });
    }

    res.json({ message: 'Login successful', user });
});

router.post('/register', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    if (db.findUser(email)) {
        return res.status(409).json({ error: 'User already exists' });
    }

    const user = { 
        email, 
        password, // In production, hash this!
        joinedAt: new Date().toISOString(),
        moodHistory: [],
        petConfig: null,
        schedule: []
    };
    db.saveUser(user);
    res.json({ message: 'Registration successful', user });
});

module.exports = router;
