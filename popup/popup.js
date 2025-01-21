document.addEventListener('DOMContentLoaded', () => {
  const promptInput = document.getElementById('promptInput');
  const charCount = document.getElementById('charCount');
  const analyzeButton = document.getElementById('analyzeButton');
  const loadingIndicator = document.getElementById('loadingIndicator');
  const resultDiv = document.getElementById('result');

  // Hide the result area initially
  resultDiv.classList.add('hidden');

  // Update char count and disable button if no input
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

      // 1) Get active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // 2) Inject Readability library files into the webpage
      //    (Adjust filenames/paths to match your extension)
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['libs/JSDOMParser.js', 'libs/Readability.js']
      });

      // 3) Run an inline function that uses Readability to parse the DOM
      const [{ result: pageContent }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // This runs in the page context, where Readability is now injected
          // (from the previous call)
          const documentClone = document.cloneNode(true);
          const readability = new Readability(documentClone);
          const article = readability.parse();

          // Return extracted text or fallback to innerText
          return article ? article.textContent : document.body.innerText || '';
        },
      });

      // 4) Send truncated content and user prompt to OpenAI
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

      // 5) Display AI response
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