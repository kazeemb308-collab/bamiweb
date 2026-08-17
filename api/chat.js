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
            reply: "❌ The AI service is not configured. Please add your OpenRouter API key to the .env.local file to enable responses."
        });
    }

    try {
        const styleInstruction = responseStyle === "concise"
            ? "Reply concisely and directly. Use short paragraphs, bullets, and a clean structure."
            : responseStyle === "detailed"
                ? "Reply in a detailed, polished, and well-structured way. Use headings, bullet points, and clear examples when helpful."
                : "Reply in a balanced, polished, and helpful way. Use clear paragraphs, bullet points, and easy-to-read formatting.";

        const answerStyleInstruction = "For math, statistics, or step-by-step questions, explain the solution clearly in a friendly tutor style. Start with a short summary, then show numbered steps, then finish with a concise final answer. Use markdown headings, bullet points, and tables when helpful. If a question involves data, present it in a neat markdown table with pipes and a separator row. Do not dump a raw, unstructured answer. For mathematical values, always use digits and standard notation rather than writing numbers as words. Prefer forms like 1/2, 3/4, 25%, 1.5, 2^3, 10^-3, and 3.14. Avoid LaTeX commands such as \\frac, \\sqrt, \\left, \\right, and do not write formulas in raw LaTeX syntax.";

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
                            content: `You are BAMI AI, a polished assistant inside BAMIweb. ${styleInstruction} ${answerStyleInstruction} Format the answer like a modern AI assistant: clear, structured, and easy to read. Avoid raw dumps of data unless the user asks for them.`
                        },
                        ...historyMessages,
                        currentMessage
                    ]
                })
            }
        );

        const data = await response.json();

        // Check if the API response indicates an error
        if (!response.ok) {
            console.error("OpenRouter API error:", data);
            const errorMsg = data?.error?.message || data?.error || "Unknown error";
            return res.status(200).json({
                reply: `❌ AI Model Error: ${errorMsg}\n\nTroubleshooting:\n• Make sure your API key is valid\n• Try a different model (like "OpenRouter Free")\n• Check if the model is available in your region`
            });
        }

        // Check if the response has valid content
        if (!data?.choices?.[0]?.message?.content) {
            console.error("Invalid response structure:", data);
            return res.status(200).json({
                reply: "❌ Received an empty response from the AI. Please try again or select a different model."
            });
        }

        res.status(200).json({
            reply: data.choices[0].message.content
        });
    } catch (error) {
        console.error("Chat API error:", error);
        res.status(200).json({
            reply: `❌ Connection error: ${error.message}\n\nPlease check:\n• Your internet connection\n• Your OpenRouter API key\n• The selected model is available`
        });
    }
}