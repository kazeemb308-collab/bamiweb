export default async function handler(req, res) {

    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }


    const { message } = req.body;


    const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
            method: "POST",

            headers: {
                "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                "Content-Type": "application/json"
            },

            body: JSON.stringify({

                model: "openrouter/free",

                messages: [
                    {
                        role: "system",
                        content: "You are BAMI AI, a helpful assistant inside BAMIweb."
                    },

                    {
                        role: "user",
                        content: message
                    }
                ]

            })
        }
    );


    const data = await response.json();


    res.status(200).json({
        reply: data.choices[0].message.content
    });

}