const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const MATCHES_FILE = path.join(__dirname, '../data/matches.json');

// Ensure file exists
if (!fs.existsSync(MATCHES_FILE)) {
    fs.writeFileSync(MATCHES_FILE, '[]');
}

const getMatches = () => {
    try {
        return JSON.parse(fs.readFileSync(MATCHES_FILE, 'utf8'));
    } catch (e) {
        return [];
    }
};

const saveMatches = (data) => fs.writeFileSync(MATCHES_FILE, JSON.stringify(data, null, 2));

// 1. Post a Match Request (寻找搭子)
router.post('/request', (req, res) => {
    const { email, activity, time, desc } = req.body;
    const matches = getMatches();
    
    const newRequest = {
        id: Date.now().toString(),
        requester: email,
        activity,
        time,
        desc,
        status: 'pending', 
        candidates: [], 
        partner: null,
        itinerary: null
    };

    // Simulate finding candidates (Mocking other users)
    // In a real app, this would query the DB for other users with similar requests
    const mockCandidates = [
        { id: "u1", name: "Alice", avatar: "👩", tags: ["爱聊天", "准时"], score: "98%" },
        { id: "u2", name: "Bob", avatar: "👨", tags: ["安静", "有车"], score: "85%" },
        { id: "u3", name: "Charlie", avatar: "🧑", tags: ["摄影达人"], score: "90%" }
    ];

    newRequest.candidates = mockCandidates;

    matches.push(newRequest);
    saveMatches(matches);
    
    res.json({ success: true, request: newRequest });
});

// 2. Confirm Match (确认搭子)
router.post('/confirm', (req, res) => {
    const { requestId, partnerId } = req.body;
    const matches = getMatches();
    const matchIndex = matches.findIndex(m => m.id === requestId);
    
    if (matchIndex === -1) return res.status(404).json({ error: "Request not found" });
    
    const match = matches[matchIndex];
    const partner = match.candidates.find(c => c.id === partnerId);
    
    if (!partner) return res.status(400).json({ error: "Partner not found" });

    match.status = 'matched';
    match.partner = partner;
    
    // Generate Mock Itinerary
    // 根据活动类型生成不同的行程
    let transport = "建议乘坐地铁3号线";
    let venue = "市中心公园";
    
    if (match.activity.includes("咖啡") || match.activity.includes("饮")) {
        transport = "步行或骑行前往";
        venue = "街角时光咖啡馆 (已预留窗边座位)";
    } else if (match.activity.includes("书") || match.activity.includes("静")) {
        transport = "打车前往 (约15元)";
        venue = "静谧书店 VIP室";
    }

    match.itinerary = {
        transport: transport,
        route: "出发地 -> " + venue,
        venue: venue,
        tips: "请提前10分钟到达，如遇雨天请带伞。",
        steps: [
            { time: match.time.split('-')[0], action: "在约定地点集合" },
            { time: "10分钟后", action: "到达目的地: " + venue },
            { time: "活动期间", action: "享受 " + match.activity },
            { time: match.time.split('-')[1], action: "活动结束，各自返程" }
        ]
    };
    
    saveMatches(matches);
    res.json({ success: true, match: match });
});

module.exports = router;
