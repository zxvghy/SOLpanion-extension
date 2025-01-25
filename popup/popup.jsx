import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const Popup = () => {
  const [activeTab, setActiveTab] = useState('analyze');
  const [prompt, setPrompt] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState({ message: '', type: '' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [recentPrompts, setRecentPrompts] = useState([]);

  // Load API key on mount
  useEffect(() => {
    const loadApiKey = async () => {
      const { apiKey } = await chrome.storage.sync.get('apiKey');
      if (apiKey) setApiKey(apiKey);
    };
    loadApiKey();
  }, []);

  // Load recent prompts when history tab is active
  useEffect(() => {
    if (activeTab === 'history') {
      loadRecentPrompts();
    }
  }, [activeTab]);

  const loadRecentPrompts = async () => {
    try {
      const { promptHistory = [] } = await chrome.storage.sync.get('promptHistory');
      setRecentPrompts(promptHistory.slice(0, 3));
    } catch (error) {
      console.error('Error loading prompts:', error);
    }
  };

  const handleAnalyze = async () => {
    if (!prompt.trim()) return;

    try {
      if (!apiKey) {
        throw new Error('Please set your OpenAI API key in the Settings tab');
      }

      setLoading(true);
      setResult('');

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

      const truncatedContent = pageContent.slice(0, 4000); // Use config.MAX_CONTEXT_LENGTH in your actual code

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo', // Use config.MODEL in your actual code
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
        }, ...promptHistory].slice(0, 100);

        await chrome.storage.sync.set({ promptHistory: newHistory });
        setResult(aiResponse);
        
        if (activeTab === 'history') {
          await loadRecentPrompts();
        }
      }
    } catch (error) {
      setResult(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const saveApiKey = async () => {
    if (!apiKey.trim()) {
      setStatus({ message: 'Please enter an API key', type: 'error' });
      return;
    }
    try {
      await chrome.storage.sync.set({ apiKey });
      setStatus({ message: 'API key saved successfully', type: 'success' });
    } catch (error) {
      setStatus({ message: 'Error saving API key', type: 'error' });
    }
    setTimeout(() => setStatus({ message: '', type: '' }), 3000);
  };

  return (
    <div className="w-96 min-h-[600px] bg-gray-50">
      {/* Header */}
      <div className="bg-white p-4 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">SolPanion</h1>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b bg-white">
        {['analyze', 'history', 'settings'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors
              ${activeTab === tab 
                ? 'text-purple-600 border-b-2 border-purple-600' 
                : 'text-gray-500 hover:text-gray-700'}`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Analyze Tab */}
        {activeTab === 'analyze' && (
          <div className="space-y-4">
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter your prompt..."
                className="w-full h-32 p-3 text-gray-700 border border-gray-200 rounded-xl resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <span className="absolute bottom-2 right-2 text-sm text-gray-400">
                {prompt.length}
              </span>
            </div>
            <button
              onClick={handleAnalyze}
              disabled={!prompt.trim() || loading}
              className={`w-full py-3 px-4 rounded-xl font-medium transition-colors
                ${prompt.trim() && !loading
                  ? 'bg-purple-600 hover:bg-purple-700 text-white'
                  : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
            >
              {loading ? 'Analyzing...' : 'Analyze'}
            </button>
            {result && (
              <div className="p-4 bg-white border border-gray-200 rounded-xl">
                {result}
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {recentPrompts.length > 0 ? (
              recentPrompts.map((item, index) => (
                <div key={index} className="p-4 bg-white border border-gray-200 rounded-xl">
                  <p className="text-gray-700 font-medium">{item.prompt}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {new Date(item.timestamp).toLocaleDateString()}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500 py-8">No recent prompts</p>
            )}
            <button
              onClick={() => {
                chrome.tabs.create({ 
                  url: chrome.runtime.getURL('dashboard/dashboard.html') 
                });
              }}
              className="w-full py-3 px-4 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition-colors"
            >
              View Full History
            </button>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Key
              </label>
              <div className="flex gap-2">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="flex-1 p-3 text-gray-700 border border-gray-200 rounded-xl"
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="p-3 text-gray-500 hover:text-gray-700"
                >
                  {showApiKey ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            <button
              onClick={saveApiKey}
              className="w-full py-3 px-4 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition-colors"
            >
              Save API Key
            </button>
            {status.message && (
              <div className={`p-3 rounded-xl text-center ${
                status.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {status.message}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Create root element and render
const container = document.getElementById('root');
const root = createRoot(container);
root.render(<Popup />);