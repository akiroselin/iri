const express = require('express');
const router = express.Router();
const db = require('../db');

router.post('/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const emailNorm = String(email).trim().toLowerCase();
    const passNorm = String(password).trim();
    let user = db.findUser(emailNorm);
    if (!user) {
        return res.status(401).json({ error: 'User not found. Please register.' });
    } 
    
    // Legacy: if user has no password stored, set it now
    if (typeof user.password !== 'string' || user.password.trim() === '') {
        const updated = db.updateUser(emailNorm, { password: passNorm });
        user = updated || user;
    }
    // Verify password
    if (String(user.password).trim() !== passNorm) {
        return res.status(401).json({ error: 'Invalid password' });
    }

    res.json({ message: 'Login successful', user });
});

router.post('/register', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const emailNorm = String(email).trim().toLowerCase();
    const passNorm = String(password).trim();
    if (db.findUser(emailNorm)) {
        return res.status(409).json({ error: 'User already exists' });
    }

    const user = { 
        email: emailNorm, 
        password: passNorm, // In production, hash this!
        joinedAt: new Date().toISOString(),
        moodHistory: [],
        petConfig: null,
        petGrowth: { level: 1, exp: 0, sizeMultiplier: 1.0 },
        schedule: []
    };
    db.saveUser(user);
    res.json({ message: 'Registration successful', user });
});

module.exports = router;
