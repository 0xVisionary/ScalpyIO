let currentAddress = null;

// Wait for the document to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Load saved quick links
    loadQuickLinks();

    // Quick Links Form Handling
    const addLinkBtn = document.getElementById('add-link-btn');
    const quickLinkForm = document.getElementById('quick-link-form');
    const linkNameInput = document.getElementById('link-name');
    const linkUrlInput = document.getElementById('link-url');
    const saveLinkBtn = document.getElementById('save-link');
    const cancelLinkBtn = document.getElementById('cancel-link');

    // Add click event listener to the quick links container for delete buttons
    document.getElementById('quick-links').addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-link')) {
            const index = e.target.dataset.index;
            deleteQuickLink(index);
        }
    });

    addLinkBtn.addEventListener('click', () => {
        quickLinkForm.classList.add('visible');
        addLinkBtn.style.display = 'none';
        linkNameInput.focus();
    });

    cancelLinkBtn.addEventListener('click', () => {
        quickLinkForm.classList.remove('visible');
        addLinkBtn.style.display = 'block';
        clearLinkForm();
    });

    saveLinkBtn.addEventListener('click', saveQuickLink);

    function saveQuickLink() {
        const name = linkNameInput.value.trim();
        const url = linkUrlInput.value.trim();
        
        if (name && url) {
            const savedLinks = JSON.parse(localStorage.getItem('quickLinks') || '[]');
            savedLinks.push({ name, url });
            localStorage.setItem('quickLinks', JSON.stringify(savedLinks));
            
            loadQuickLinks();
            clearLinkForm();
            quickLinkForm.classList.remove('visible');
            addLinkBtn.style.display = 'block';
        }
    }

    function clearLinkForm() {
        linkNameInput.value = '';
        linkUrlInput.value = '';
    }

    // Listen for messages from the content script
    chrome.runtime.onMessage.addListener((message, sender) => {
        if (message.type === 'ADDRESS_UPDATE') {
            updateContent(message.data);
        }
    });

    // Check current tab immediately and periodically
    checkCurrentTab();
    setInterval(checkCurrentTab, 2000);

    // Also check when the side panel gains focus
    window.addEventListener('focus', checkCurrentTab);

    // Chat functionality
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-button');
    const messagesContainer = document.getElementById('chat-messages');

    // Update send button text when enabling/disabling
    chatInput.addEventListener('input', () => {
        sendButton.disabled = !chatInput.value.trim();
        sendButton.textContent = '→';
    });

    // Send message on enter
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && chatInput.value.trim()) {
            sendMessage();
        }
    });

    // Send button click
    sendButton.addEventListener('click', () => {
        if (chatInput.value.trim()) {
            sendMessage();
        }
    });

    let agentPort = null;
    let agentId = null;

    // Initialize agent connection
    async function initializeAgent() {
        try {
            const response = await fetch('http://localhost:3000/create_agent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: 'test-user' // You may want to make this dynamic
                })
            });
            const data = await response.json();
            if (data.success) {
                agentPort = data.port;
                agentId = data.agentId;
                console.log(`Agent initialized on port ${agentPort} with ID ${agentId}`);
            }
        } catch (error) {
            console.error('Failed to initialize agent:', error);
        }
    }

    // Initialize agent when sidepanel loads
    initializeAgent();

    async function sendMessage() {
        const message = chatInput.value.trim();
        if (!message) return;

        // Show user message immediately
        addMessage(message, 'user');
        chatInput.value = '';
        sendButton.disabled = true;
        
        // Show typing indicator
        showTypingIndicator();

        try {
            if (!agentPort || !agentId) {
                throw new Error('Agent not initialized');
            }

            const response = await fetch(`http://localhost:${agentPort}/${agentId}/message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: message,
                    userId: 'test-user', // You may want to make this dynamic
                    roomId: 'test-room',
                    userName: 'Test User'
                })
            });

            const data = await response.json();
            const messageData = Array.isArray(data) ? data[0] : data;
            removeTypingIndicator();
            
            if (messageData.text) {
                addMessage(messageData.text, 'bot');
            } else {
                addMessage('Sorry, I encountered an error processing your message.', 'bot');
            }
        } catch (error) {
            console.error('Failed to send message:', error);
            removeTypingIndicator();
            addMessage('Sorry, I encountered an error processing your message.', 'bot');
        }
    }

    function addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        
        if (sender === 'bot') {
            // Format the analysis if it's from the bot
            messageDiv.innerHTML = formatAnalysis(text);
        } else {
            messageDiv.textContent = text;
        }
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function showTypingIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'typing-indicator';
        indicator.innerHTML = `
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        `;
        indicator.id = 'typing-indicator';
        messagesContainer.appendChild(indicator);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function removeTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) {
            indicator.remove();
        }
    }
});

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function checkCurrentTab() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'REQUEST_ADDRESS' });
        }
    });
}

function updateContent(tokenData) {
    if (!tokenData) return;
    
    currentAddress = tokenData.address;
    
    const addressItem = document.querySelector('.address-item');
    addressItem.innerHTML = `
        <div class="context-text">${tokenData.context}</div>
        <div class="address-text">${tokenData.address}</div>
        <div class="button-row">
            <button class="action-btn" onclick="copyAddress('${tokenData.address}', this)">Copy</button>
        </div>
    `;
}

function copyAddress(address, button) {
    navigator.clipboard.writeText(address);
    const originalText = button.innerText;
    button.innerText = 'Copied!';
    setTimeout(() => button.innerText = originalText, 1000);
}

function loadQuickLinks() {
    const savedLinks = JSON.parse(localStorage.getItem('quickLinks') || '[]');
    const linksContainer = document.getElementById('quick-links');
    linksContainer.innerHTML = ''; // Clear existing links
    
    savedLinks.forEach((link, index) => {
        addQuickLinkElement(link.name, link.url, index);
    });
}

function addQuickLinkElement(name, url, index) {
    const linksContainer = document.getElementById('quick-links');
    const linkElement = document.createElement('div');
    linkElement.className = 'link-item';
    linkElement.innerHTML = `
        <a href="${url}" class="link-btn" target="_blank">
            ${name}
            <span style="color: #9ca3af; font-size: 0.75rem;">→</span>
        </a>
        <button class="delete-link" data-index="${index}">x</button>
    `;
    linksContainer.appendChild(linkElement);
}

function deleteQuickLink(index) {
    const savedLinks = JSON.parse(localStorage.getItem('quickLinks') || '[]');
    savedLinks.splice(index, 1);
    localStorage.setItem('quickLinks', JSON.stringify(savedLinks));
    loadQuickLinks();
}

// Make deleteQuickLink available globally
window.deleteQuickLink = deleteQuickLink;

let isDarkTheme = true;
function toggleTheme() {
    isDarkTheme = !isDarkTheme;
    document.body.style.background = isDarkTheme ? '#1a1f2e' : '#ffffff';
    document.body.style.color = isDarkTheme ? '#e5e7eb' : '#1a1f2e';
    // Add more theme toggle logic as needed
}

// Add this to check if the panel is loaded
console.log('Sidepanel script loaded');

function formatAnalysis(rawText) {
    // Remove extra #s and clean up the text
    let formattedText = rawText
        // Replace markdown headers with HTML headers
        .replace(/#{1,6}\s?(.*?)(?=\n|$)/g, (match, content) => {
            const level = (match.match(/#/g) || []).length;
            return `<h${level}>${content.trim()}</h${level}>`;
        })
        // Replace bold text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Replace bullet points
        .replace(/- (.*?)(?=\n|$)/g, '<li>$1</li>')
        // Wrap bullet points in ul
        .replace(/(<li>.*?<\/li>\n?)+/g, '<ul>$&</ul>')
        // Add paragraph tags for regular text
        .replace(/(?<=\n|^)(?![<\s])(.*?)(?=\n|$)/g, '<p>$1</p>')
        // Clean up empty paragraphs
        .replace(/<p>\s*<\/p>/g, '')
        // Add spacing between sections
        .replace(/<\/h(\d)>/g, '</h$1><br>');

    return `<div class="analysis-container">${formattedText}</div>`;
}

// Add these styles to your CSS
const analysisCss = `
.analysis-container {
    padding: 1rem;
    color: var(--text);
}

.analysis-container h1 {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 1.5rem 0 1rem 0;
    color: var(--text);
}

.analysis-container h2 {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 1.25rem 0 1rem 0;
    color: var(--text-muted);
}

.analysis-container h3 {
    font-size: 1.1rem;
    font-weight: 600;
    margin: 1rem 0 0.75rem 0;
}

.analysis-container p {
    margin: 0.75rem 0;
    line-height: 1.6;
}

.analysis-container strong {
    color: var(--text);
    font-weight: 600;
}

.analysis-container ul {
    margin: 0.75rem 0;
    padding-left: 1.5rem;
}

.analysis-container li {
    margin: 0.5rem 0;
    line-height: 1.6;
}

.analysis-container br {
    display: block;
    content: "";
    margin: 0.5rem 0;
}`;