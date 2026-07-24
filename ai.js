const STORAGE_KEY = "bami-ai-conversations-v1";
const form = document.getElementById("chat-form");
const input = document.getElementById("user-input");
const chatBox = document.getElementById("chat-box");
const historyList = document.getElementById("history-list");
const historyPanel = document.getElementById("history-panel");
const historyBackdrop = document.getElementById("history-backdrop");
const historyToggle = document.getElementById("history-toggle");
const refreshBtn = document.getElementById("refresh-btn");
const settingsBtn = document.getElementById("settings-btn");
const settingsPanel = document.getElementById("settings-panel");
const newChatBtn = document.getElementById("new-chat-btn");
const clearHistoryBtn = document.getElementById("clear-history-btn");
const resetSettingsBtn = document.getElementById("reset-settings-btn");
const modelSelect = document.getElementById("model-select");
const temperatureRange = document.getElementById("temperature-range");
const temperatureValue = document.getElementById("temperature-value");
const replyStyleSelect = document.getElementById("reply-style");
const imageToggle = document.getElementById("image-toggle");
const markdownToggle = document.getElementById("markdown-toggle");
const mediaInput = document.getElementById("media-input");
const uploadBtn = document.getElementById("upload-btn");
const mediaPreview = document.getElementById("media-preview");

const DEFAULT_SETTINGS = {
    model: "openrouter/free",
    temperature: 0.7,
    replyStyle: "balanced",
    imageEnabled: true,
    markdownEnabled: true
};

let conversations = loadConversations();
let activeConversationId = null;
let pendingAttachment = null;
let settings = loadSettings();

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

function loadSettings() {
    try {
        const stored = localStorage.getItem("bami-ai-settings-v1");
        return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : { ...DEFAULT_SETTINGS };
    } catch (error) {
        console.warn("Could not load settings", error);
        return { ...DEFAULT_SETTINGS };
    }
}

function saveSettings() {
    localStorage.setItem("bami-ai-settings-v1", JSON.stringify(settings));
}

function applySettingsUI() {
    if (modelSelect) modelSelect.value = settings.model || DEFAULT_SETTINGS.model;
    if (temperatureRange) temperatureRange.value = settings.temperature ?? DEFAULT_SETTINGS.temperature;
    if (temperatureValue) temperatureValue.textContent = Number(settings.temperature ?? DEFAULT_SETTINGS.temperature).toFixed(1);
    if (replyStyleSelect) replyStyleSelect.value = settings.replyStyle || DEFAULT_SETTINGS.replyStyle;
    if (imageToggle) imageToggle.checked = settings.imageEnabled !== false;
    if (markdownToggle) markdownToggle.checked = settings.markdownEnabled !== false;
    if (uploadBtn) {
        uploadBtn.disabled = settings.imageEnabled === false;
        uploadBtn.classList.toggle("disabled", settings.imageEnabled === false);
    }
    if (settings.imageEnabled === false) {
        clearAttachment();
    }
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function formatReplyContent(content) {
    let text = String(content || "").trim().replace(/\r/g, "");

    text = text.replace(/(^|\n)(Step\s+\d+|Answer|Final Answer|Solution|Explanation|Result)\s*:/gim, "$1**$2:**");
    text = text.replace(/(^|\n)(\d+)\.\s+/gm, "$1$2. ");
    text = text.replace(/\n{3,}/g, "\n\n");
    text = text.replace(/\n(?=\d+\.)/g, "\n");
    text = text.replace(/\|/g, " | ");

    return text;
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
            closeHistory();
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
            const content = message.content || "";
            if (settings.markdownEnabled !== false) {
                const cleaned = formatReplyContent(content);
                bubble.innerHTML = marked.parse(cleaned);
            } else {
                bubble.textContent = content;
            }
        }

        chatBox.appendChild(bubble);
    });

    chatBox.scrollTop = chatBox.scrollHeight;
}

function clearAttachment() {
    pendingAttachment = null;
    mediaInput.value = "";
    mediaPreview.innerHTML = "";
    mediaPreview.hidden = true;
}

function showAttachmentPreview(file, dataUrl, text) {
    pendingAttachment = {
        kind: file.type.startsWith("image/") ? "image" : "file",
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        dataUrl: dataUrl || null,
        text: text || ""
    };
    mediaPreview.hidden = false;

    if (file.type.startsWith("image/")) {
        mediaPreview.innerHTML = `
            <img src="${dataUrl}" alt="Selected image preview">
            <span>${escapeHtml(file.name)}</span>
        `;
    } else {
        mediaPreview.innerHTML = `
            <div style="font-size: 14px; font-weight: 600;">${escapeHtml(file.name)}</div>
            <div style="font-size: 12px; color: #b8c0ce;">${escapeHtml(text ? "Text attachment ready" : "File ready to send")}</div>
        `;
    }
}

function appendThinking() {
    const thinking = document.createElement("div");
    thinking.className = "bot";
    thinking.innerHTML = "BAMI AI is thinking... 🤖";
    chatBox.appendChild(thinking);
    chatBox.scrollTop = chatBox.scrollHeight;
    return thinking;
}

function openHistory() {
    historyPanel.classList.add("open");
    historyBackdrop.classList.add("show");
    historyToggle.setAttribute("aria-expanded", "true");
}

function closeHistory() {
    historyPanel.classList.remove("open");
    historyBackdrop.classList.remove("show");
    historyToggle.setAttribute("aria-expanded", "false");
}

function toggleHistory() {
    if (historyPanel.classList.contains("open")) {
        closeHistory();
    } else {
        openHistory();
    }
}

function openSettings() {
    settingsPanel.hidden = false;
    settingsPanel.classList.add("open");
    settingsBtn.setAttribute("aria-expanded", "true");
}

function closeSettings() {
    settingsPanel.classList.remove("open");
    settingsPanel.hidden = true;
    settingsBtn.setAttribute("aria-expanded", "false");
}

function toggleSettings() {
    if (settingsPanel.classList.contains("open")) {
        closeSettings();
    } else {
        openSettings();
    }
}

form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const conversation = ensureActiveConversation();
    const message = input.value.trim();
    if (!message && !pendingAttachment) return;

    const userText = message || (pendingAttachment ? (pendingAttachment.kind === "image" ? "Shared an image" : "Shared a file") : "");
    const userMessage = {
        role: "user",
        content: userText,
        image: pendingAttachment && pendingAttachment.kind === "image" ? pendingAttachment.dataUrl : null,
        attachment: pendingAttachment || null
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
                imageDataUrl: pendingAttachment && pendingAttachment.kind === "image" ? pendingAttachment.dataUrl : null,
                attachment: pendingAttachment,
                imageEnabled: settings.imageEnabled !== false,
                model: settings.model || DEFAULT_SETTINGS.model,
                temperature: Number(settings.temperature ?? DEFAULT_SETTINGS.temperature),
                responseStyle: settings.replyStyle || DEFAULT_SETTINGS.replyStyle,
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
    closeHistory();
    input.focus();
});

clearHistoryBtn.addEventListener("click", () => {
    if (confirm("Clear all chats?")) {
        conversations = [];
        activeConversationId = null;
        saveConversations();
        createConversation();
        closeHistory();
    }
});

resetSettingsBtn.addEventListener("click", () => {
    settings = { ...DEFAULT_SETTINGS };
    saveSettings();
    applySettingsUI();
});

modelSelect.addEventListener("change", (event) => {
    settings.model = event.target.value;
    saveSettings();
});

temperatureRange.addEventListener("input", (event) => {
    settings.temperature = Number(event.target.value);
    temperatureValue.textContent = Number(settings.temperature).toFixed(1);
    saveSettings();
});

replyStyleSelect.addEventListener("change", (event) => {
    settings.replyStyle = event.target.value;
    saveSettings();
});

imageToggle.addEventListener("change", (event) => {
    settings.imageEnabled = event.target.checked;
    saveSettings();
    applySettingsUI();
});

markdownToggle.addEventListener("change", (event) => {
    settings.markdownEnabled = event.target.checked;
    saveSettings();
    renderMessages();
});

refreshBtn.addEventListener("click", () => {
    window.location.reload();
});

settingsBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleSettings();
});

document.addEventListener("click", (event) => {
    if (!settingsPanel.contains(event.target) && !settingsBtn.contains(event.target)) {
        closeSettings();
    }
});

historyToggle.addEventListener("click", toggleHistory);
historyBackdrop.addEventListener("click", closeHistory);

uploadBtn.addEventListener("click", () => {
    if (settings.imageEnabled !== false) {
        mediaInput.click();
    }
});

mediaInput.addEventListener("change", () => {
    const file = mediaInput.files && mediaInput.files[0];
    if (!file) return;

    if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = function () {
            showAttachmentPreview(file, reader.result, "");
        };
        reader.readAsDataURL(file);
        return;
    }

    const isTextLike = file.type.startsWith("text/") || ["application/json", "application/xml", "application/javascript", "application/x-javascript", "application/pdf"].includes(file.type);
    if (isTextLike) {
        const reader = new FileReader();
        reader.onload = function () {
            showAttachmentPreview(file, null, reader.result);
        };
        reader.readAsText(file);
        return;
    }

    const reader = new FileReader();
    reader.onload = function () {
        showAttachmentPreview(file, reader.result, "");
    };
    reader.readAsDataURL(file);
});

applySettingsUI();

if (!conversations.length) {
    createConversation();
} else {
    activeConversationId = conversations[0].id;
}
renderHistory();
renderMessages();
