export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }

    const {
        message,
        imageDataUrl,
        imageEnabled = true,
        model = "openrouter/free",
        temperature = 0.7,
        responseStyle = "balanced",
        conversationHistory = []
    } = req.body;

    if (!process.env.OPENROUTER_API_KEY) {
        return res.status(200).json({
            reply: "The AI service is not configured yet. Add an OpenRouter key to enable responses."
        });
    }

    const styleInstruction = responseStyle === "concise"
        ? "Reply concisely and directly. Use short paragraphs, bullets, and a clean structure."
        : responseStyle === "detailed"
            ? "Reply in a detailed, polished, and well-structured way. Use headings, bullet points, and clear examples when helpful."
            : "Reply in a balanced, polished, and helpful way. Use clear paragraphs, bullet points, and easy-to-read formatting.";

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

    const useImage = Boolean(imageDataUrl) && imageEnabled !== false;

    const currentMessage = useImage
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
                model: model || "openrouter/free",
                temperature: Number(temperature ?? 0.7),
                messages: [
                    {
                        role: "system",
                        content: `You are BAMI AI, a polished assistant inside BAMIweb. ${styleInstruction} Format the answer like a modern AI assistant: clear, structured, and easy to read. Avoid raw dumps of data unless the user asks for them.`
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