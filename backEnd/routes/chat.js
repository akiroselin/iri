const express = require('express');
const router = express.Router();
const db = require('../db');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''; 

const PET_PERSONALITY_DESC = {
    buffalo: "性格温和憨厚，动作缓慢，喜欢发呆。它偶尔会好奇地闻闻你。",
    corgi: "性格活泼热情，精力充沛，喜欢到处闻闻和玩耍。它是话唠，喜欢求关注。",
    rabbit: "性格胆小害羞，警惕性高，喜欢安静。它需要温柔的对待。",
    cat: "性格高冷傲娇，以自我为中心，偶尔会求关注。它喜欢观察你。"
};

// Helper: Mock Response
function mockGeminiResponse(text, petType) {
    let reply = "我听到了你的心声。生活总会有起伏，试着深呼吸，感受当下的平静。";
    let weather = "sunset";
    let activities = [];
    
    const petNames = { buffalo: "水牛", corgi: "柯基", rabbit: "小白兔", cat: "小猫" };
    const pName = petNames[petType] || "宠物";

    // Emotion & Activity Mapping
    const emotions = [
        {
            keywords: ["累", "疲惫", "倦", "耗尽", "不动"],
            reply: "听起来你真的需要充电了。别硬撑，现在的任务就是好好休息。",
            weather: "night",
            activities: [
                { title: "热水澡", time: "21:00-21:30", desc: "洗去一身的疲惫。" },
                { title: "白噪音冥想", time: "22:00-22:15", desc: "听着雨声入睡。" }
            ]
        },
        {
            keywords: ["烦", "生气", "火", "气", "讨厌", "躁"],
            reply: "感受到你心里的火气了。这种时候，把情绪发泄出来或者转移注意力都是好的。",
            weather: "rain", // Rain usually cools down
            activities: [
                { title: "剧烈运动", time: "Now", desc: "做几个开合跳，释放压力。" },
                { title: "深呼吸", time: "Now", desc: "吸气4秒，憋气7秒，呼气8秒。" }
            ]
        },
        {
            keywords: ["焦虑", "担心", "怕", "压力", "慌", "紧张"],
            reply: "焦虑像一团乱麻，我们慢慢来解开。先关注当下这一刻，不要去想还没发生的事。",
            weather: "sunset",
            activities: [
                { title: "书写忧虑", time: "Now", desc: "把担心的事写下来，然后划掉。" },
                { title: "整理桌面", time: "Now", desc: "整理外部环境也能整理内心。" }
            ]
        },
        {
            keywords: ["难过", "伤心", "哭", "抑郁", "丧", "痛苦"],
            reply: "抱抱你。允许自己悲伤一会儿，这没关系。我会一直在这里陪着你。",
            weather: "rain",
            activities: [
                { title: "温暖热饮", time: "Now", desc: "一杯热可可或热牛奶。" },
                { title: "看部治愈电影", time: "20:00-22:00", desc: "比如《龙猫》或《小森林》。" }
            ]
        },
        {
            keywords: ["孤独", "寂寞", "没人", "空虚"],
            reply: `你不是一个人，${pName}正看着你呢。有时候独处也是一种享受，但如果感到孤单，试着建立一点连接。`,
            weather: "night",
            activities: [
                { title: "给朋友发消息", time: "Now", desc: "哪怕只是发个表情包。" },
                { title: "与宠物互动", time: "Now", desc: "摸摸它的头，给它喂点好吃的。" }
            ]
        },
        {
            keywords: ["无聊", "没劲", "闲", "没事"],
            reply: "无聊其实是创造力的开始。不如利用这段空白时间做点有趣的小事？",
            weather: "sunny",
            activities: [
                { title: "读几页书", time: "Now", desc: "随手翻开一本书读5分钟。" },
                { title: "断舍离", time: "Now", desc: "扔掉3件不需要的物品。" }
            ]
        },
        {
            keywords: ["开心", "高兴", "快乐", "棒", "顺", "爽", "好"],
            reply: "真棒！隔着屏幕都感受到了你的喜悦。一定要好好享受这个时刻！",
            weather: "sunny",
            activities: [
                { title: "记录美好", time: "Now", desc: "拍照或写下来，留住此刻。" },
                { title: "奖励自己", time: "Now", desc: "吃顿好的，或者买个小礼物。" }
            ]
        }
    ];

    // 1. Check for Pet Interaction first
    if (text.includes("它") || text.includes("宠物") || text.includes("狗") || text.includes("牛") || text.includes("兔") || text.includes("猫")) {
        if(text.includes("喜欢")) {
            reply = `${pName}最喜欢你的陪伴了，当然还有美味的零食和舒服的抚摸。`;
        } else if(text.includes("干什么") || text.includes("在做")) {
            reply = `${pName}正享受着悠闲的时光呢，可能在发呆，也可能在想你。`;
        } else {
            reply = `${pName}似乎很在意你，它会一直静静地陪着你。`;
        }
        weather = "sunny";
        activities = []; 
        return { reply, activities, weather };
    }

    // 2. Check Emotions
    for (const emotion of emotions) {
        if (emotion.keywords.some(k => text.includes(k))) {
            reply = emotion.reply;
            weather = emotion.weather;
            activities = emotion.activities;
            return { reply, activities, weather };
        }
    }

    return { reply, activities, weather };
}

// Helper: Local Ollama Call
async function callOllamaAPI(userText, petType) {
    const url = 'http://localhost:11434/api/generate';
    const petNames = { buffalo: "呆萌水牛", corgi: "柯基", rabbit: "小白兔", cat: "小花猫" };
    const petName = petNames[petType] || "宠物";
    const petTraits = PET_PERSONALITY_DESC[petType] || "性格温和";

    const prompt = `
    Role: You are a gentle, professional psychological healing therapist who also knows the user's virtual pet (${petName}) well.
    Pet Traits: ${petTraits}
    Goal: Make the user willing to talk more and in detail.
    Tasks:
    1. Listen to troubles, identify mood (happy, anxious, tired), provide warm, rational comfort.
    2. If asked about the pet (${petName}), answer vividly based on its habits and traits (${petTraits}).
    3. "Read the mind": Infer deep needs from short words.
    4. Encourage the user to share more details about their feelings or day.
    
    Tone: Peaceful, inclusive, professional but friendly.
    User Input: "${userText}"
    
    Output Format: JSON only (no markdown).
    {
        "reply": "Your response in Chinese",
        "activities": [
            {"title": "Activity Name", "time": "HH:MM-HH:MM", "desc": "Description"}
        ],
        "weather": "sunny"
    }
    (weather: sunny/sunset/night)
    `;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                model: "llama3", // Default to llama3, user can change
                prompt: prompt,
                stream: false,
                format: "json"
            }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error('Ollama API Error');
        const data = await response.json();
        return JSON.parse(data.response);
    } catch (e) {
        console.error("Ollama Error:", e.message);
        throw e;
    }
}

// Helper: Real Gemini Call
async function callGeminiAPI(userText, petType) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const petNames = { buffalo: "呆萌水牛", corgi: "柯基", rabbit: "小白兔", cat: "小花猫" };
    const petName = petNames[petType] || "宠物";
    const petTraits = PET_PERSONALITY_DESC[petType] || "性格温和";

    const prompt = `
    你是一位温柔、专业的心理疗愈师，同时也非常了解用户的虚拟宠物（当前是：${petName}）。
    宠物性格特点：${petTraits}
    你的目标是让用户愿意说得更多、更详细。
    任务：
    1. 倾听用户的烦恼，辨别用户当下的心情（开心、焦虑、疲惫等），给予温暖、理性的安慰和建议。
    2. 如果用户询问关于宠物（${petName}）的问题（如它在干什么、它喜欢什么），请根据它的习性(${petTraits})进行生动有趣的回答。
    3. 尝试"读心"，即从用户的简短话语中推测深层需求。
    4. 适当地追问或引导，鼓励用户表达更多细节。
    
    语气要平和、包容，保持专业但亲切的态度。
    
    用户输入: "${userText}"。
    请返回JSON格式（不含Markdown）：
    {
        "reply": "疗愈师的回复",
        "activities": [
            {"title": "建议活动", "time": "HH:MM-HH:MM", "desc": "简述"}
        ],
        "weather": "sunny" (sunny/sunset/night，根据情绪匹配)
    }
    `;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout for Gemini

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) throw new Error('Gemini API Error');

        const data = await response.json();
        const text = data.candidates[0].content.parts[0].text;
        const jsonStr = text.replace(/```json|```/g, '').trim();
        return JSON.parse(jsonStr);
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

router.post('/message', async (req, res) => {
    const { email, message, petType } = req.body;
    if (!email || !message) return res.status(400).json({ error: 'Missing data' });

    // Save User Message
    const userMsg = {
        userEmail: email,
        sender: 'user',
        text: message,
        timestamp: new Date().toISOString()
    };
    db.saveChat(userMsg);

    // Priority: Gemini -> Ollama -> Mock
    let aiResponse;
    try {
        if (GEMINI_API_KEY) {
            aiResponse = await callGeminiAPI(message, petType);
        } else {
            // Try Ollama if no Gemini key
            try {
                aiResponse = await callOllamaAPI(message, petType);
            } catch(e) {
                console.log("Falling back to Mock due to Ollama error");
                aiResponse = mockGeminiResponse(message, petType);
            }
        }
    } catch (e) {
        console.error("AI Service Error:", e);
        aiResponse = mockGeminiResponse(message, petType);
    }

    // Save AI Message
    const aiMsg = {
        userEmail: email,
        sender: 'ai',
        text: aiResponse.reply,
        weather: aiResponse.weather,
        activities: aiResponse.activities,
        timestamp: new Date().toISOString()
    };
    db.saveChat(aiMsg);

    res.json(aiResponse);
});

router.get('/history', (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'Email required' });
    const chats = db.getChats(email);
    res.json(chats);
});

module.exports = router;
