const express = require('express');
const router = express.Router();
const db = require('../db');

// Update User Data (Pet, Schedule, etc.)
router.post('/update', (req, res) => {
    const { email, updates } = req.body;
    if (!email || !updates) return res.status(400).json({ error: 'Missing data' });

    const updatedUser = db.updateUser(email, updates);
    if (!updatedUser) return res.status(404).json({ error: 'User not found' });

    res.json({ message: 'User updated', user: updatedUser });
});

module.exports = router;