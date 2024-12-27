const API_BASE_URL = 'https://ai-lf07.onrender.com/api';
let currentSession = null;
let isAuthenticated = false;
let isLogin = true;
let isTyping = false;

const authPage = document.getElementById('auth-page');
const chatPage = document.getElementById('chat-page');
const authForm = document.getElementById('auth-form');
const authError = document.getElementById('auth-error');
const authSwitchBtn = document.getElementById('auth-switch-btn');
const authSwitchText = document.getElementById('auth-switch-text');
const sidebar = document.getElementById('sidebar');
const menuToggle = document.getElementById('menu-toggle');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const messagesContainer = document.getElementById('messages-container');
const newChatBtn = document.getElementById('new-chat-btn');
const logoutBtn = document.getElementById('logout-btn');
const sessionsList = document.getElementById('sessions-list');
const statusIndicator = document.getElementById('status-indicator');

document.addEventListener('DOMContentLoaded', initialize);
authForm.addEventListener('submit', handleAuth);
authSwitchBtn.addEventListener('click', toggleAuthMode);
menuToggle.addEventListener('click', toggleSidebar);
sendButton.addEventListener('click', sendMessage);
newChatBtn.addEventListener('click', createNewSession);
logoutBtn.addEventListener('click', logout);
messageInput.addEventListener('input', handleInput);
messageInput.addEventListener('keypress', handleKeyPress);

function initialize() {
    checkAuth();
    setupMarkdown();
}

function setupMarkdown() {
    marked.setOptions({
        highlight: function(code, language) {
            const validLanguage = hljs.getLanguage(language) ? language : 'plaintext';
            return hljs.highlight(validLanguage, code).value;
        },
        breaks: true
    });
}

function checkAuth() {
    const token = localStorage.getItem('token');
    if (token) {
        isAuthenticated = true;
        showChat();
        loadSessions();
    } else {
        showAuth();
    }
}

function showAuth() {
    authPage.style.display = 'flex';
    chatPage.style.display = 'none';
    authError.style.display = 'none';
}

function showChat() {
    authPage.style.display = 'none';
    chatPage.style.display = 'flex';
}

function toggleAuthMode() {
    isLogin = !isLogin;
    authSwitchText.textContent = isLogin ? "Don't have an account?" : "Already have an account?";
    authSwitchBtn.textContent = isLogin ? "Sign Up" : "Sign In";
    document.querySelector('.auth-title').textContent = isLogin ? "Sign In to Groq Chat" : "Create Account";
    document.querySelector('#auth-submit').textContent = isLogin ? "Sign In" : "Sign Up";
    authError.style.display = 'none';
}

async function handleAuth(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch(`${API_BASE_URL}/${isLogin ? 'login' : 'register'}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('token', `Bearer ${data.token}`);
            isAuthenticated = true;
            showChat();
            loadSessions();
        } else {
            showError(data.detail || 'Authentication failed');
        }
    } catch (error) {
        console.error('Auth error:', error);
        showError('Failed to connect to server');
    }
}

function showError(message) {
    authError.textContent = message;
    authError.style.display = 'block';
}

async function makeAuthenticatedRequest(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    if (!token) {
        throw new Error('No authentication token');
    }

    const defaultOptions = {
        headers: {
            'Authorization': token,
            'Content-Type': 'application/json',
        },
    };

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers,
            },
        });

        if (response.status === 401) {
            logout();
            throw new Error('Authentication failed');
        }

        return response;
    } catch (error) {
        console.error('API request failed:', error);
        throw error;
    }
}
async function loadSessions() {
    try {
        const response = await makeAuthenticatedRequest('/sessions');
        if (!response.ok) throw new Error('Failed to load sessions');
        
        const sessions = await response.json();
        renderSessions(sessions);

        if (sessions.length > 0 && !currentSession) {
            setCurrentSession(sessions[0]._id);
        }
        updateStatusIndicator('Connected');
    } catch (error) {
        console.error('Failed to load sessions:', error);
        updateStatusIndicator('Failed to load sessions', true);
    }
}

function renderSessions(sessions) {
    sessionsList.innerHTML = sessions.map(session => `
        <div class="session-item ${session._id === currentSession ? 'active' : ''}"
             onclick="setCurrentSession('${session._id}')">
            ${session.name || `Chat ${session._id.slice(0, 8)}`}
        </div>
    `).join('');
}

async function setCurrentSession(sessionId) {
    currentSession = sessionId;
    await loadMessages(sessionId);
    document.querySelectorAll('.session-item').forEach(item => {
        item.classList.toggle('active', item.textContent.includes(sessionId.slice(0, 8)));
    });
    messageInput.focus();
}

async function loadMessages(sessionId) {
    try {
        updateStatusIndicator('Loading messages...');
        const response = await makeAuthenticatedRequest(`/messages/${sessionId}`);
        if (!response.ok) throw new Error('Failed to load messages');
        
        const messages = await response.json();
        renderMessages(messages);
        updateStatusIndicator('Messages loaded');
    } catch (error) {
        console.error('Failed to load messages:', error);
        updateStatusIndicator('Failed to load messages', true);
    }
}

function renderMessages(messages) {
    messagesContainer.innerHTML = messages.map(message => `
        <div class="message ${message.role}">
            ${marked.parse(message.content)}
        </div>
    `).join('');
    
    document.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightBlock(block);
    });
    
    scrollToBottom();
}



function appendMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.role}`;
    messageDiv.innerHTML = marked.parse(message.content);
    
    messageDiv.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightBlock(block);
    });
    
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

async function createNewSession() {
    try {
        updateStatusIndicator('Creating new chat...');
        const response = await makeAuthenticatedRequest('/sessions', {
            method: 'POST',
            body: JSON.stringify({}),
        });

        if (!response.ok) throw new Error('Failed to create session');
        
        const session = await response.json();
        await loadSessions();
        setCurrentSession(session._id);
        updateStatusIndicator('New chat created');
    } catch (error) {
        console.error('Failed to create new session:', error);
        updateStatusIndicator('Failed to create chat', true);
    }
}

function handleInput() {
    adjustTextareaHeight();
    sendButton.disabled = !messageInput.value.trim();
}

function handleKeyPress(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!sendButton.disabled) {
            sendMessage();
        }
    }
}

function adjustTextareaHeight() {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 200) + 'px';
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function disableInput(disabled) {
    messageInput.disabled = disabled;
    sendButton.disabled = disabled;
}

function updateStatusIndicator(message, isError = false) {
    statusIndicator.textContent = message;
    statusIndicator.style.color = isError ? 'var(--danger)' : 'var(--text-secondary)';
}
function createMessageElement(message, animate = false) {
    const messageDiv = document.createElement('div');
    const timestamp = new Date().toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
    });
    
    messageDiv.className = `message ${message.role}`;
    messageDiv.innerHTML = `
        <div class="message-container">
            
            <div class="message-content">
                <div class="message-header">
                    <span class="sender-name">${message.role === 'assistant' ? 'Ryn' : 'You'}</span>
                    <span class="timestamp">${timestamp}</span>
                </div>
                <div class="message-text"></div>
            </div>
        </div>
    `;
    
    if (animate && message.role === 'assistant') {
        typeMessage(messageDiv.querySelector('.message-text'), message.content);
    } else {
        messageDiv.querySelector('.message-text').innerHTML = marked.parse(message.content);
    }
    
    return messageDiv;
}

async function typeMessage(element, content) {
    const renderedContent = marked.parse(content);
    element.innerHTML = '';
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = renderedContent;
    const textContent = tempDiv.textContent;
    
    let i = 0;
    isTyping = true;
    
    const typeChar = () => {
        if (i < textContent.length && isTyping) {
            element.innerHTML = marked.parse(textContent.substring(0, i + 1));
            i++;
            setTimeout(typeChar, Math.random() * 30 + 20);
        } else {
            element.innerHTML = renderedContent;
            isTyping = false;
        }
    };
    
    typeChar();
}

async function sendMessage() {
    const content = messageInput.value.trim();
    if (!content || !currentSession || isTyping) return;

    try {
        updateStatusIndicator('Sending...');
        disableInput(true);
        
        const userMessage = {
            role: 'user',
            content: content
        };
        
        appendMessage(userMessage);
        messageInput.value = '';
        adjustTextareaHeight();
        
        showTypingIndicator();
        
        const response = await makeAuthenticatedRequest('/chat', {
            method: 'POST',
            body: JSON.stringify({
                content: content,
                sessionId: currentSession
            }),
        });

        if (!response.ok) throw new Error('Failed to send message');
        
        removeTypingIndicator();
        
        const data = await response.json();
        appendMessage({
            role: 'assistant',
            content: data.response
        }, true);
        
        updateStatusIndicator('Sent');
    } catch (error) {
        console.error('Failed to send message:', error);
        updateStatusIndicator('Failed to send message', true);
    } finally {
        disableInput(false);
    }
}

function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message assistant typing-message';
    typingDiv.innerHTML = `
        <div class="message-container">
            <div class="message-content">

                <div class="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        </div>
    `;
    messagesContainer.appendChild(typingDiv);
    scrollToBottom();
}



function logout() {
    localStorage.removeItem('token');
    isAuthenticated = false;
    currentSession = null;
    showAuth();
}

function removeTypingIndicator() {
    const indicator = document.querySelector('.typing-indicator');
    if (indicator) indicator.remove();
}

const sidebarOverlay = document.getElementById('sidebar-overlay');
function toggleSidebar() {
    sidebar.classList.toggle('open');
    sidebarOverlay.classList.toggle('active');
    document.body.style.overflow = sidebar.classList.contains('open') ? 'hidden' : '';
}

menuToggle.addEventListener('click', toggleSidebar);
sidebarOverlay.addEventListener('click', toggleSidebar);

initialize();
