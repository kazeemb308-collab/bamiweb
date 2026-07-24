const STORAGE_KEY = "bami-ai-conversations-v1";
const form = document.getElementById("chat-form");
const input = document.getElementById("user-input");
const chatBox = document.getElementById("chat-box");
const historyList = document.getElementById("history-list");
const newChatBtn = document.getElementById("new-chat-btn");
const mediaInput = document.getElementById("media-input");
const uploadBtn = document.getElementById("upload-btn");
const mediaPreview = document.getElementById("media-preview");

let conversations = loadConversations();
let activeConversationId = null;
let pendingImageData = null;

function loadConversations() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (error) {
        console.warn("Could not load conversations", error);
        return [];
    }
}

function saveConversations() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function createConversation() {
    const conversation = {
        id: window.crypto && crypto.randomUUID ? crypto.randomUUID() : `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title: "New chat",
        pinned: false,
        updatedAt: Date.now(),
        messages: []
    };
    conversations.unshift(conversation);
    activeConversationId = conversation.id;
    saveConversations();
    renderHistory();
    renderMessages();
    return conversation;
}

function getActiveConversation() {
    return conversations.find((conversation) => conversation.id === activeConversationId) || conversations[0] || null;
}

function ensureActiveConversation() {
    if (!conversations.length) {
        createConversation();
    }
    if (!activeConversationId) {
        activeConversationId = conversations[0].id;
    }
    return getActiveConversation();
}

function updateConversationTitle(conversation, text) {
    const trimmed = (text || "").trim();
    if (!trimmed) {
        conversation.title = conversation.title === "New chat" ? "Shared image" : conversation.title;
        return;
    }
    if (conversation.title === "New chat") {
        conversation.title = trimmed.slice(0, 36);
    }
}

function renderHistory() {
    const sortedConversations = [...conversations].sort((a, b) => {
        if (a.pinned !== b.pinned) return Number(b.pinned) - Number(a.pinned);
        return b.updatedAt - a.updatedAt;
    });

    historyList.innerHTML = "";

    if (!sortedConversations.length) {
        historyList.innerHTML = '<div class="history-empty">No chats yet. Start a new conversation.</div>';
        return;
    }

    sortedConversations.forEach((conversation) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = `history-item${conversation.id === activeConversationId ? " active" : ""}`;
        item.innerHTML = `
            <div class="history-row">
                <span class="history-title">${escapeHtml(conversation.title || "New chat")}</span>
                <button class="pin-btn${conversation.pinned ? " pinned" : ""}" type="button" title="Pin chat">📌</button>
            </div>
            <div class="history-meta">${escapeHtml(conversation.messages.length ? `${conversation.messages.length} messages` : "Just started")}</div>
        `;

        item.addEventListener("click", (event) => {
            if (event.target.closest(".pin-btn")) return;
            activeConversationId = conversation.id;
            renderHistory();
            renderMessages();
        });

        item.querySelector(".pin-btn").addEventListener("click", (event) => {
            event.stopPropagation();
            conversation.pinned = !conversation.pinned;
            conversation.updatedAt = Date.now();
            saveConversations();
            renderHistory();
        });

        historyList.appendChild(item);
    });
}

function renderMessages() {
    const conversation = ensureActiveConversation();
    chatBox.innerHTML = "";

    if (!conversation.messages.length) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.innerHTML = "<h3>Start a new chat</h3><p>Send a message or share an image and it will appear here.</p>";
        chatBox.appendChild(empty);
        return;
    }

    conversation.messages.forEach((message) => {
        const bubble = document.createElement("div");
        bubble.className = message.role === "user" ? "user" : "bot";

        if (message.role === "user") {
            bubble.innerHTML = escapeHtml(message.content || "");
            if (message.image) {
                const imageWrap = document.createElement("div");
                imageWrap.className = "media-attachment";
                const img = document.createElement("img");
                img.src = message.image;
                img.alt = "Uploaded media";
                imageWrap.appendChild(img);
                bubble.appendChild(imageWrap);
            }
        } else {
            bubble.innerHTML = marked.parse(message.content || "");
        }

        chatBox.appendChild(bubble);
    });

    chatBox.scrollTop = chatBox.scrollHeight;
}

function clearAttachment() {
    pendingImageData = null;
    mediaInput.value = "";
    mediaPreview.innerHTML = "";
    mediaPreview.hidden = true;
}

function showAttachmentPreview(dataUrl) {
    pendingImageData = dataUrl;
    mediaPreview.hidden = false;
    mediaPreview.innerHTML = `
        <img src="${dataUrl}" alt="Selected image preview">
        <span>Image ready to send</span>
    `;
}

function appendThinking() {
    const thinking = document.createElement("div");
    thinking.className = "bot";
    thinking.innerHTML = "BAMI AI is thinking... 🤖";
    chatBox.appendChild(thinking);
    chatBox.scrollTop = chatBox.scrollHeight;
    return thinking;
}

form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const conversation = ensureActiveConversation();
    const message = input.value.trim();
    if (!message && !pendingImageData) return;

    const userText = message || (pendingImageData ? "Shared an image" : "");
    const userMessage = {
        role: "user",
        content: userText,
        image: pendingImageData || null
    };

    conversation.messages.push(userMessage);
    conversation.updatedAt = Date.now();
    updateConversationTitle(conversation, userText);
    saveConversations();
    renderHistory();
    renderMessages();

    input.value = "";
    const thinking = appendThinking();

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: userText,
                imageDataUrl: pendingImageData,
                conversationHistory: conversation.messages.slice(-8)
            })
        });

        const data = await response.json();
        thinking.remove();

        const assistantMessage = {
            role: "assistant",
            content: data.reply || "I couldn't generate a reply right now."
        };

        conversation.messages.push(assistantMessage);
        conversation.updatedAt = Date.now();
        saveConversations();
        renderHistory();
        renderMessages();
    } catch (error) {
        thinking.remove();
        const botMessage = document.createElement("div");
        botMessage.className = "bot";
        botMessage.textContent = "Sorry, I can't connect right now ❌";
        chatBox.appendChild(botMessage);
        chatBox.scrollTop = chatBox.scrollHeight;
        console.log(error);
    }

    clearAttachment();
});

newChatBtn.addEventListener("click", () => {
    createConversation();
    input.focus();
});

uploadBtn.addEventListener("click", () => mediaInput.click());

mediaInput.addEventListener("change", () => {
    const file = mediaInput.files && mediaInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function () {
        showAttachmentPreview(reader.result);
    };
    reader.readAsDataURL(file);
});

if (!conversations.length) {
    createConversation();
} else {
    activeConversationId = conversations[0].id;
}
renderHistory();
renderMessages();
