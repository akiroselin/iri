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
    let activities = [
        { title: "冥想放松", time: "20:00-20:30", desc: "放空大脑，专注呼吸。" },
        { title: "温暖沐浴", time: "21:00-21:30", desc: "热水澡能缓解疲劳。" }
    ];
    
    const petNames = { buffalo: "水牛", corgi: "柯基", rabbit: "小白兔", cat: "小猫" };
    const pName = petNames[petType] || "宠物";

    // 1. 宠物相关问题
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
    }
    // 2. 心情/读心
    else if (text.includes("累") || text.includes("烦") || text.includes("难过") || text.includes("压力")) {
        reply = "看起来你最近承担了很多。请允许自己停下来休息一会儿，你已经做得很好了。抱抱自己。";
        weather = "night";
    } else if (text.includes("开心") || text.includes("好") || text.includes("棒") || text.includes("顺")) {
        reply = "真为你感到高兴！保持这种积极的状态，世界也会变得明亮起来。";
        weather = "sunny";
        activities = [{ title: "记录美好", time: "Now", desc: "写下此刻的开心瞬间。" }];
    } else if (text.includes("无聊") || text.includes("没事")) {
        reply = `有时候无聊也是一种放松。不如观察一下${pName}，或者读一本一直想读的书？`;
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
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                model: "llama3", // Default to llama3, user can change
                prompt: prompt,
                stream: false,
                format: "json"
            })
        });

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

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    
    if (!response.ok) throw new Error('Gemini API Error');

    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;
    const jsonStr = text.replace(/```json|```/g, '').trim();
    return JSON.parse(jsonStr);
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
