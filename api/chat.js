export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }

    const { message, imageDataUrl, conversationHistory = [] } = req.body;

    if (!process.env.OPENROUTER_API_KEY) {
        return res.status(200).json({
            reply: "The AI service is not configured yet. Add an OpenRouter key to enable responses."
        });
    }

    const historyMessages = (conversationHistory || []).slice(-8).map((entry) => {
        if (entry.image) {
            return {
                role: entry.role,
                content: [
                    { type: "text", text: entry.content || "Describe this image" },
                    { type: "image_url", image_url: { url: entry.image } }
                ]
            };
        }
        return {
            role: entry.role,
            content: entry.content || ""
        };
    });

    const currentMessage = imageDataUrl
        ? {
            role: "user",
            content: [
                { type: "text", text: message || "Please describe this image" },
                { type: "image_url", image_url: { url: imageDataUrl } }
            ]
        }
        : {
            role: "user",
            content: message || ""
        };

    const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "openrouter/free",
                messages: [
                    {
                        role: "system",
                        content: "You are BAMI AI, a helpful assistant inside BAMIweb. Keep replies concise and practical."
                    },
                    ...historyMessages,
                    currentMessage
                ]
            })
        }
    );

    const data = await response.json();

    res.status(200).json({
        reply: data?.choices?.[0]?.message?.content || "I couldn't generate a response right now."
    });
}