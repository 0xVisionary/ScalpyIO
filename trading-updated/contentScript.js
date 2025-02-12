(function() {
    let sidebar = null;
    let isInitialized = false;

    function extractAddressFromUrl() {
        const url = window.location.href;
        
        // For Photon - look for the Solscan link in HTML
        if (url.includes('photon-sol.tinyastro.io')) {
            const solscanLink = document.querySelector('.p-show__bar__link[href*="solscan.io/account/"]');
            if (solscanLink) {
                const address = solscanLink.href.split('/account/').pop();
                if (address) {
                    return {
                        address: address,
                        context: 'Photon Token'
                    };
                }
            }
        }
        
        // For BullX
        if (url.includes('bullx.io/terminal')) {
            const params = new URLSearchParams(window.location.search);
            const address = params.get('address');
            if (address) {
                return {
                    address: address,
                    context: 'BullX Token'
                };
            }
        }
        
        return null;
    }

    function extractAddressFromScript() {
        const scripts = document.getElementsByTagName('script');
        
        for (const script of scripts) {
            const content = script.textContent;
            if (!content) continue;

            // Look only for token-address
            const tokenAddressMatch = content.match(/'token-address':\s*"([^"]+)"/);
            
            if (tokenAddressMatch) {
                return {
                    address: tokenAddressMatch[1],
                    context: 'Token Address'
                };
            }
        }
        return null;
    }

    function createSidebar() {
        if (isInitialized) return;
        
        sidebar = document.createElement('div');
        sidebar.id = 'my-chat-sidebar';
    
        const header = document.createElement('div');
        header.className = 'sidebar-header';
        
        const title = document.createElement('span');
        title.innerText = 'Token Address';
        
        const closeBtn = document.createElement('button');
        closeBtn.innerText = '×';
        closeBtn.className = 'sidebar-close';
        closeBtn.onclick = toggleSidebar;
        
        header.appendChild(title);
        header.appendChild(closeBtn);
    
        const contentArea = document.createElement('div');
        contentArea.className = 'sidebar-content';

        sidebar.appendChild(header);
        sidebar.appendChild(contentArea);
        document.body.appendChild(sidebar);
        
        isInitialized = true;
        updateSidebarContent();
    }

    function updateSidebarContent() {
        if (!sidebar) return;

        const contentArea = sidebar.querySelector('.sidebar-content');
        if (!contentArea) return;

        contentArea.innerHTML = '';

        const tokenAddress = extractAddressFromUrl() || extractAddressFromScript();
        
        if (!tokenAddress) {
            // Show empty state
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            
            const icon = document.createElement('div');
            icon.className = 'empty-state-icon';
            icon.innerText = '🔍';
            
            const text = document.createElement('div');
            text.className = 'empty-state-text';
            text.innerText = 'No token address found on this page';
            
            emptyState.appendChild(icon);
            emptyState.appendChild(text);
            contentArea.appendChild(emptyState);
            return;
        }

        // Create address item if token found
        const addressDiv = document.createElement('div');
        addressDiv.className = 'address-item';
        
        const addressText = document.createElement('div');
        addressText.className = 'address-text';
        addressText.innerText = tokenAddress.address;
        
        const contextText = document.createElement('div');
        contextText.className = 'context-text';
        contextText.innerText = tokenAddress.context;
        
        const copyBtn = document.createElement('button');
        copyBtn.innerText = 'Copy';
        copyBtn.className = 'copy-btn';
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(tokenAddress.address);
            copyBtn.innerText = 'Copied!';
            setTimeout(() => copyBtn.innerText = 'Copy', 1000);
        };
        
        addressDiv.appendChild(contextText);
        addressDiv.appendChild(addressText);
        addressDiv.appendChild(copyBtn);
        contentArea.appendChild(addressDiv);
    }

    // Create sidebar immediately and store state in localStorage instead of sessionStorage
    window.addEventListener('load', () => {
        createSidebar();
        if (localStorage.getItem('sidebarVisible') === 'true') {
            setTimeout(() => {
                sidebar.classList.add('visible');
                document.documentElement.classList.add('sidebar-open');
            }, 100);
        }
    });

    function toggleSidebar() {
        if (sidebar) {
            sidebar.classList.toggle('visible');
            document.documentElement.classList.toggle('sidebar-open');
            localStorage.setItem('sidebarVisible', sidebar.classList.contains('visible'));
        }
    }

    // Photon-specific logic
    function extractPhotonAddress() {
        const scripts = document.getElementsByTagName('script');
        for (const script of scripts) {
            const content = script.textContent;
            if (!content) continue;

            const tokenAddressMatch = content.match(/'token-address':\s*'([^']+)'/);
            if (tokenAddressMatch) {
                return {
                    address: tokenAddressMatch[1],
                    context: 'Photon Token'
                };
            }
        }
        return null;
    }

    // BullX-specific logic (to be implemented later)
    function extractBullXAddress() {
        return null;
    }

    // Send updates to the side panel
    function updateSidePanel() {
        const tokenAddress = extractAddressFromUrl();
        if (tokenAddress) {
            chrome.runtime.sendMessage({
                type: 'ADDRESS_UPDATE',
                data: tokenAddress
            });
        }
    }

    // Listen for requests from the side panel
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'REQUEST_ADDRESS') {
            updateSidePanel();
            sendResponse({ received: true });
            return true;
        }
    });

    // Update when URL changes
    let lastUrl = location.href;
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            setTimeout(updateSidePanel, 1000);
        }
    }).observe(document, { subtree: true, childList: true });

    // Initial update with a longer delay to ensure page is loaded
    setTimeout(updateSidePanel, 2000);
})();