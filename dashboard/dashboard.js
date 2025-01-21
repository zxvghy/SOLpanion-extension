document.addEventListener('DOMContentLoaded', async () => {
    const historyList = document.getElementById('historyList');
    const searchInput = document.getElementById('searchInput');
    const clearButton = document.getElementById('clearHistory');
    const confirmDialog = document.getElementById('confirmDialog');
    const confirmClearBtn = document.getElementById('confirmClear');
    const cancelClearBtn = document.getElementById('cancelClear');
  
    let allHistory = [];
  
    async function loadHistory() {
      try {
        const { promptHistory = [] } = await chrome.storage.sync.get('promptHistory');
        allHistory = promptHistory;
        renderHistory(allHistory);
      } catch (error) {
        console.error('Error loading history:', error);
        showError('Failed to load history');
      }
    }
  
    function renderHistory(history) {
      if (history.length === 0) {
        historyList.innerHTML = `
          <div class="empty-state">
            <h3>No prompts yet</h3>
            <p>Your prompt history will appear here</p>
          </div>
        `;
        return;
      }
  
      historyList.innerHTML = history
        .sort((a, b) => b.timestamp - a.timestamp)
        .map(item => `
          <div class="history-item">
            <div class="history-item-header">
              <span class="timestamp">
                ${new Date(item.timestamp).toLocaleString()}
              </span>
              <a href="${escapeHtml(item.url)}" class="url" target="_blank">
                ${new URL(item.url).hostname}
              </a>
            </div>
            <div class="prompt">
              ${escapeHtml(item.prompt)}
            </div>
            <div class="response">
              ${escapeHtml(item.response)}
            </div>
          </div>
        `)
        .join('');
    }
  
    function escapeHtml(unsafe) {
      return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }
  
    function filterHistory(searchTerm) {
      const normalizedSearch = searchTerm.toLowerCase();
      return allHistory.filter(item => 
        item.prompt.toLowerCase().includes(normalizedSearch) ||
        item.response.toLowerCase().includes(normalizedSearch)
      );
    }
  
    function showError(message) {
      historyList.innerHTML = `
        <div class="empty-state">
          <h3>Error</h3>
          <p>${escapeHtml(message)}</p>
        </div>
      `;
    }
  
    // Event Listeners
    searchInput.addEventListener('input', (e) => {
      const filtered = filterHistory(e.target.value);
      renderHistory(filtered);
    });
  
    clearButton.addEventListener('click', () => {
      confirmDialog.classList.remove('hidden');
    });
  
    confirmClearBtn.addEventListener('click', async () => {
      try {
        await chrome.storage.sync.set({ promptHistory: [] });
        allHistory = [];
        renderHistory([]);
        confirmDialog.classList.add('hidden');
      } catch (error) {
        console.error('Error clearing history:', error);
        showError('Failed to clear history');
      }
    });
  
    cancelClearBtn.addEventListener('click', () => {
      confirmDialog.classList.add('hidden');
    });
  
    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'sync' && changes.promptHistory) {
        allHistory = changes.promptHistory.newValue || [];
        renderHistory(allHistory);
      }
    });
  
    // Initial load
    await loadHistory();
  });