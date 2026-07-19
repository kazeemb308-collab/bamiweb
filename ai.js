const form = document.getElementById("chat-form");
const input = document.getElementById("user-input");
const chatBox = document.getElementById("chat-box");


form.addEventListener("submit", async function(e){

    e.preventDefault();


    const message = input.value.trim();

    if(message === "") return;


    // Show user message
    chatBox.innerHTML += `
        <div class="user">
            ${message}
        </div>
    `;


    input.value = "";


    // Show thinking message
    const thinking = document.createElement("div");
    thinking.className = "bot";
    thinking.innerHTML = "BAMI AI is thinking... 🤖";

    chatBox.appendChild(thinking);


    chatBox.scrollTop = chatBox.scrollHeight;


    try {


        const response = await fetch("/api/chat", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },


            body: JSON.stringify({

                message: message

            })

        });



        const data = await response.json();



        // Remove thinking message
        thinking.remove();



        // Show AI reply
        chatBox.innerHTML += `

            <div class="bot">

                ${data.reply}

            </div>

        `;



    } catch(error){


        thinking.remove();


        chatBox.innerHTML += `

            <div class="bot">

                Sorry, I can't connect right now ❌

            </div>

        `;


        console.log(error);

    }


    chatBox.scrollTop = chatBox.scrollHeight;


});