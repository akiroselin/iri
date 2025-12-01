const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CHATS_FILE = path.join(DATA_DIR, 'chats.json');

// Ensure files exist
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]');
if (!fs.existsSync(CHATS_FILE)) fs.writeFileSync(CHATS_FILE, '[]');

function readJSON(file) {
    try {
        const data = fs.readFileSync(file, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

function writeJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

module.exports = {
    getUsers: () => readJSON(USERS_FILE),
    saveUser: (user) => {
        const users = readJSON(USERS_FILE);
        users.push(user);
        writeJSON(USERS_FILE, users);
    },
    updateUser: (email, updates) => {
        let users = readJSON(USERS_FILE);
        const idx = users.findIndex(u => u.email === email);
        if (idx !== -1) {
            users[idx] = { ...users[idx], ...updates };
            writeJSON(USERS_FILE, users);
            return users[idx];
        }
        return null;
    },
    findUser: (email) => {
        const users = readJSON(USERS_FILE);
        return users.find(u => u.email === email);
    },
    getChats: (email) => {
        const chats = readJSON(CHATS_FILE);
        return chats.filter(c => c.userEmail === email);
    },
    saveChat: (chat) => {
        const chats = readJSON(CHATS_FILE);
        chats.push(chat);
        writeJSON(CHATS_FILE, chats);
    }
};
