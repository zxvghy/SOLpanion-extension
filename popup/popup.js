document.addEventListener('DOMContentLoaded', () => {
  const promptInput = document.getElementById('promptInput');
  const charCount = document.getElementById('charCount');
  const analyzeButton = document.getElementById('analyzeButton');
  const loadingIndicator = document.getElementById('loadingIndicator');
  const resultDiv = document.getElementById('result');

  resultDiv.classList.add('hidden');

  promptInput.addEventListener('input', () => {
    const length = promptInput.value.length;
    charCount.textContent = length;
    analyzeButton.disabled = length === 0;
  });

  analyzeButton.addEventListener('click', async () => {
    const prompt = promptInput.value.trim();
    if (!prompt) return;

    try {
      loadingIndicator.classList.remove('hidden');
      resultDiv.textContent = '';
      resultDiv.classList.add('hidden');

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const [{ result: pageContent }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: getPageContent,
      });

      const truncatedContent = pageContent.slice(0, config.MAX_CONTEXT_LENGTH);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: config.MODEL,
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that analyzes webpage content based on user prompts. Be concise and specific in your responses.'
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
        resultDiv.textContent = aiResponse;
        resultDiv.classList.remove('hidden');
      }

    } catch (error) {
      resultDiv.textContent = `Error: ${error.message}`;
      resultDiv.classList.remove('hidden');
    } finally {
      loadingIndicator.classList.add('hidden');
    }
  });
});

function getPageContent() {
  const clone = document.body.cloneNode(true);
  const scripts = clone.getElementsByTagName('script');
  const styles = clone.getElementsByTagName('style');
  
  while (scripts[0]) {
    scripts[0].parentNode.removeChild(scripts[0]);
  }
  while (styles[0]) {
    styles[0].parentNode.removeChild(styles[0]);
  }
  
  return clone.innerText;
}