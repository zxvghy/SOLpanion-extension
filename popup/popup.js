document.addEventListener('DOMContentLoaded', async () => {
  // Tab switching functionality
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Remove active class from all buttons and contents
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Add active class to clicked button and corresponding content
      button.classList.add('active');
      document.getElementById(`${button.dataset.tab}Tab`).classList.add('active');
    });
  });

  // Analyze tab functionality
  const promptInput = document.getElementById('promptInput');
  const charCount = document.getElementById('charCount');
  const analyzeButton = document.getElementById('analyzeButton');
  const loadingIndicator = document.getElementById('loadingIndicator');
  const resultDiv = document.getElementById('result');

  promptInput.addEventListener('input', () => {
    const length = promptInput.value.length;
    charCount.textContent = length;
    analyzeButton.disabled = length === 0;
  });

  // Settings tab functionality
  const apiKeyInput = document.getElementById('apiKey');
  const toggleVisibilityBtn = document.getElementById('toggleVisibility');
  const saveKeyBtn = document.getElementById('saveKey');
  const statusDiv = document.getElementById('status');

  // Load saved API key if it exists
  const { apiKey } = await chrome.storage.sync.get('apiKey');
  if (apiKey) {
    apiKeyInput.value = apiKey;
  }

  // Toggle API key visibility
  toggleVisibilityBtn.addEventListener('click', () => {
    const isPassword = apiKeyInput.type === 'password';
    apiKeyInput.type = isPassword ? 'text' : 'password';
    toggleVisibilityBtn.textContent = isPassword ? 'Hide' : 'Show';
  });

  // Save API key
  saveKeyBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
      showStatus('Please enter an API key', 'error');
      return;
    }

    try {
      await chrome.storage.sync.set({ apiKey });
      showStatus('API key saved successfully', 'success');
    } catch (error) {
      showStatus('Error saving API key', 'error');
    }
  });

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    setTimeout(() => {
      statusDiv.className = 'status hidden';
    }, 3000);
  }

  // Add history functionality
  const openDashboard = document.getElementById('openDashboard');
  const recentPrompts = document.getElementById('recentPrompts');

  // Function to load recent prompts
  async function loadRecentPrompts() {
    try {
      const { promptHistory = [] } = await chrome.storage.sync.get('promptHistory');
      
      recentPrompts.innerHTML = promptHistory
        .slice(0, 3) // Show only last 3 prompts
        .map(item => `
          <div class="history-item">
            <div class="history-prompt">${item.prompt}</div>
            <div class="history-timestamp">
              ${new Date(item.timestamp).toLocaleDateString()}
            </div>
          </div>
        `)
        .join('') || '<div class="empty-history">No recent prompts</div>';
    } catch (error) {
      console.error('Error loading recent prompts:', error);
      recentPrompts.innerHTML = '<div class="error">Error loading history</div>';
    }
  }

  openDashboard.addEventListener('click', () => {
    // This will open dashboard.html in a new tab, but not override all new tabs
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') });
  });

  // Analyze functionality
  analyzeButton.addEventListener('click', async () => {
    const prompt = promptInput.value.trim();
    if (!prompt) return;

    try {
      const { apiKey } = await chrome.storage.sync.get('apiKey');
      
      if (!apiKey) {
        throw new Error('Please set your OpenAI API key in the Settings tab');
      }

      loadingIndicator.classList.remove('hidden');
      resultDiv.textContent = '';
      resultDiv.classList.add('hidden');

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['libs/JSDOMParser.js', 'libs/Readability.js']
      });

      const [{ result: pageContent }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const documentClone = document.cloneNode(true);
          const readability = new Readability(documentClone);
          const article = readability.parse();
          return article ? article.textContent : document.body.innerText || '';
        },
      });

      const truncatedContent = pageContent.slice(0, config.MAX_CONTEXT_LENGTH);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: config.MODEL,
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that analyzes webpage content. Be concise and specific in your responses.'
            },
            {
              role: 'user',
              content: `Page Content: ${truncatedContent}\n\nPrompt: ${prompt}`
            }
          ],
          max_tokens: 500
        })
      });

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error.message);
      }

      const aiResponse = data.choices[0].message.content.trim();
      if (aiResponse) {
        // Save to history
        const { promptHistory = [] } = await chrome.storage.sync.get('promptHistory');
        const newHistory = [{
          prompt,
          response: aiResponse,
          url: tab.url,
          timestamp: Date.now()
        }, ...promptHistory].slice(0, 100); // Keep last 100 items

        await chrome.storage.sync.set({ promptHistory: newHistory });

        resultDiv.textContent = aiResponse;
        resultDiv.classList.remove('hidden');
        // Refresh recent prompts if on history tab
        if (document.querySelector('[data-tab="history"]').classList.contains('active')) {
          await loadRecentPrompts();
        }
      }

    } catch (error) {
      resultDiv.textContent = `Error: ${error.message}`;
      resultDiv.classList.remove('hidden');
    } finally {
      loadingIndicator.classList.add('hidden');
    }
  });

  // Load recent prompts when history tab is clicked
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      if (button.dataset.tab === 'history') {
        loadRecentPrompts();
      }
    });
  });

  // Initial load of recent prompts if starting on history tab
  if (document.querySelector('[data-tab="history"]').classList.contains('active')) {
    await loadRecentPrompts();
  }
});