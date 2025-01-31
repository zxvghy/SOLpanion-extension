import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import ReactMarkdown from 'react-markdown';

const API_BASE_URL = 'https://dex-analyzer-api.avgtraderandyyy.workers.dev'; // Replace with your actual workers.dev URL

const Popup = () => {
  const [activeTab, setActiveTab] = useState('analyze');
  const [prompt, setPrompt] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState({ message: '', type: '' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [recentPrompts, setRecentPrompts] = useState([]);

  // DEX State
  const [dexStatus, setDexStatus] = useState('');
  const [dexStatusType, setDexStatusType] = useState('error');
  const [chainType, setChainType] = useState('');
  const [pairAddress, setPairAddress] = useState('');
  const [tokenInfo, setTokenInfo] = useState(null);
  const [isDexTokenVisible, setIsDexTokenVisible] = useState(false);
  const [dexAnalysis, setDexAnalysis] = useState('');
  const [isDexAnalyzing, setIsDexAnalyzing] = useState(false);
  const [pairDetails, setPairDetails] = useState(null);

  const markdownComponents = {
    h1: ({ ...props }) => <h1 className="text-lg font-bold text-gray-900" {...props} />,
    h2: ({ ...props }) => <h2 className="text-base font-semibold text-gray-900" {...props} />,
    p: ({ ...props }) => <p className="text-gray-600 leading-relaxed" {...props} />,
    ul: ({ ...props }) => <ul className="list-disc pl-5" {...props} />,
    li: ({ ...props }) => (
      <li className="text-gray-600 break-words">
        <span className="whitespace-pre-wrap block leading-tight py-0.5">
          {props.children}
        </span>
      </li>
    ),
  };

  // Utility function to validate DEX URL
  const validateDexUrl = (url) => {
    const dexScreenerRegex = /^https:\/\/dexscreener\.com\/(solana|ethereum)\/[a-zA-Z0-9]+$/;
    const photonSolRegex = /^https:\/\/photon-sol\.tinyastro\.io\/en\/lp\/[a-zA-Z0-9]+(\?handle=[a-zA-Z0-9]+)?$/;
    return dexScreenerRegex.test(url) || photonSolRegex.test(url);
  };

  // Function to extract DEX and chain details from URL
  const extractDexDetails = (url) => {
    const urlParts = url.split('/');
    if (url.includes('dexscreener.com')) {
      return {
        chainType: urlParts[3],
        pairAddress: urlParts[4]
      };
    } else {
      const pairAddress = urlParts[5].split('?')[0];
      return {
        chainType: pairAddress.startsWith('0x') ? 'Ethereum' : 'Solana',
        pairAddress: pairAddress
      };
    }
  };

  // Function to fetch token details
  const fetchTokenDetails = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log('Tab URL:', tab.url);
      const { chainType, pairAddress } = extractDexDetails(tab.url);
      console.log('Extracted details:', { chainType, pairAddress });

      const apiUrl = `https://api.dexscreener.io/latest/dex/pairs/${chainType.toLowerCase()}/${pairAddress}`;
      console.log('API URL:', apiUrl);

      const response = await fetch(apiUrl);
      console.log('Response status:', response.status);

      if (!response.ok) {
        setDexStatus(`Error fetching details for ${chainType} ${pairAddress}`);
        setDexStatusType('error');
        return;
      }

      const data = await response.json();
      console.log('API Response data:', data);

      if (!data.pair || !data.pair.baseToken) {
        setDexStatus('Unable to find token details');
        setDexStatusType('error');
        return;
      }

      setPairDetails(data.pair);
      const baseToken = data.pair.baseToken;
      console.log('Base token:', baseToken);

      const tokenInfoData = {
        name: baseToken.name,
        symbol: baseToken.symbol,
        address: baseToken.address
      };

      setTokenInfo(tokenInfoData);
      setChainType(chainType);
      setPairAddress(pairAddress);
      setIsDexTokenVisible(true);
      setDexStatus('');
    } catch (error) {
      console.error('Error in fetchTokenDetails:', error);
      setDexStatus(`${error}`);
      setDexStatusType('error');
    }
    console.log('States after setting:', {
      tokenInfo: tokenInfo, // Use state value instead of local variable
      isDexTokenVisible: true
    });
  };

  // Check DEX page when DEX tab is selected
  useEffect(() => {
    console.log('Tab changed to:', activeTab); // Add this
    const checkDexPage = async () => {
      if (activeTab !== 'dex') {
        // Reset states when leaving DEX tab
        setIsDexTokenVisible(false);
        setTokenInfo(null);
        return;
      }

      console.log('Checking DEX page on tab change');
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        console.log('Current tab:', tab);

        if (!tab.url || !validateDexUrl(tab.url)) {
          setDexStatus('Please visit a valid DexScreener or Photon Sol token page');
          setDexStatusType('error');
          setIsDexTokenVisible(false);
          return;
        }

        const { chainType, pairAddress } = extractDexDetails(tab.url);
        console.log('Extracted details:', { chainType, pairAddress }); // Debug log

        setChainType(chainType);
        setPairAddress(pairAddress);
        setDexStatus('');
        setDexStatusType('success');

        // Fetch token details
        await fetchTokenDetails();
      } catch (error) {
        console.error('Error in checkDexPage:', error); // Debug log
        setDexStatusType('error');
      }
    };

    checkDexPage();
  }, [activeTab]);

  // Modified analyze function with complete data
  const analyzeDexToken = async () => {
    if (!tokenInfo || !pairDetails) return;

    setIsDexAnalyzing(true);
    setDexAnalysis('');

    try {
      const formatNumber = (num) => {
        if (!num && num !== 0) return 'N/A';
        const number = parseFloat(num);
        return `$${number.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 8
        })}`;
      };

      const tokenDataString = `
        Token Address: \`${pairDetails.baseToken.address}\`
        Chain: ${chainType}
        Pair Address: \`${pairDetails.pairAddress}\`
        Price (USD): ${formatNumber(pairDetails.priceUsd)}
        Price (${pairDetails.quoteToken?.symbol}): ${pairDetails.priceNative}
        24H Change: ${pairDetails.priceChange?.h24?.toFixed(2)}%
        24H Volume: ${formatNumber(pairDetails.volume?.h24)}
        Liquidity: ${formatNumber(pairDetails.liquidity?.usd)}
        FDV: ${formatNumber(pairDetails.fdv)}
        Created: ${new Date(pairDetails.pairCreatedAt).toLocaleDateString()}
        Transactions (24H):
          Buys: ${pairDetails.txns?.h24?.buys || 0}
          Sells: ${pairDetails.txns?.h24?.sells || 0}
        Token Info:
          Name: ${pairDetails.baseToken.name}
          Symbol: ${pairDetails.baseToken.symbol}
          ${pairDetails.baseToken.verified ? '✓ Verified' : '⚠ Unverified'}
          Social Links: ${pairDetails.info?.socials?.join(', ') || 'None'}`;

      // Call your new API endpoint for token analysis
      const response = await fetch(`${API_BASE_URL}/api/analyze-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tokenData: tokenDataString
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const analysis = data.result;
      setDexAnalysis(analysis);

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const { promptHistory = [] } = await chrome.storage.sync.get('promptHistory');
      const newHistory = [{
        prompt: `Token Analysis: ${tokenInfo.name} (${tokenInfo.symbol})`,
        response: analysis,
        url: tab.url,
        timestamp: Date.now()
      }, ...promptHistory].slice(0, 100);

      await chrome.storage.sync.set({ promptHistory: newHistory });

      if (activeTab === 'history') {
        await loadRecentPrompts();
      }

    } catch (error) {
      setDexAnalysis(`Error analyzing token: ${error.message}`);
    } finally {
      setIsDexAnalyzing(false);
    }
  };

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

      const truncatedContent = pageContent.slice(0, 4000);

      // Call your new API endpoint
      const response = await fetch(`${API_BASE_URL}/api/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pageContent: truncatedContent,
          prompt: prompt
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const aiResponse = data.result;

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

  useEffect(() => {
    console.log('State changed:', {
      isDexTokenVisible,
      tokenInfo,
      activeTab
    });
  }, [isDexTokenVisible, tokenInfo, activeTab]);

  return (
    <div className="w-96 min-h-[600px] bg-gray-50">
      {/* Header
      <div className="bg-white p-4 shadow-sm flex justify-center items-center">
        <img 
          src={logo} 
          alt="SolPanion" 
          className="h-8 w-auto"
        />
      </div> */}

      {/* Tab Navigation */}
      <div className="flex border-b bg-white">
        {['analyze', 'dex', 'history'].map((tab) => ( // Removed 'settings'
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
                <div className="overflow-x-auto markdown-content2">
                  <ReactMarkdown className="space-y-4" components={markdownComponents}>
                    {result}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        )}

        {/* DEX Tab */}
        {activeTab === 'dex' && (
          <div className="p-4 space-y-4">
            {console.log('Rendering DEX tab with:', {
              isDexTokenVisible,
              tokenInfo,
              chainType,
              pairAddress
            })}

            {dexStatus && (
              <div className={`p-3 rounded-xl text-center ${dexStatusType === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                {dexStatus}
              </div>
            )}

            {chainType && pairAddress && (
              <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
                <div>
                  <strong>Chain:</strong> {chainType}
                </div>
                <div>
                  <strong>Pair Address:</strong> {' '}
                  <span className="font-mono break-words whitespace-pre-wrap">
                    {pairAddress}
                  </span>
                </div>
              </div>
            )}

            {tokenInfo && (
              <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
                <h3 className="font-semibold text-gray-900">Token Details</h3>
                <div>
                  <strong>Name:</strong> {tokenInfo.name}
                </div>
                <div>
                  <strong>Symbol:</strong> {tokenInfo.symbol}
                </div>
                <div className="overflow-x-auto">
                  <strong>Address:</strong>{' '}
                  <span className="font-mono break-words whitespace-pre-wrap">
                    {tokenInfo.address}
                  </span>
                </div>
              </div>
            )}

            {/* Show button separately */}
            {tokenInfo && (
              <button
                onClick={analyzeDexToken}
                disabled={isDexAnalyzing}
                className={`w-full py-3 px-4 rounded-xl font-medium transition-colors
              ${!isDexAnalyzing
                    ? 'bg-purple-600 hover:bg-purple-700 text-white'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
              >
                {isDexAnalyzing ? 'Analyzing...' : 'Analyze Token'}
              </button>
            )}

            {/* Show analysis if available */}
            {dexAnalysis && (
              <div className="p-4 bg-white border border-gray-200 rounded-xl">
                <h3 className="font-semibold text-gray-900 mb-4">Analysis</h3>
                <div className="overflow-x-auto markdown-content">
                  <ReactMarkdown className="space-y-4" components={markdownComponents}>
                    {dexAnalysis}
                  </ReactMarkdown>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200 text-sm text-gray-500 italic">
                  Always conduct your own research before making investment decisions.
                </div>
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
                  <p className="text-gray-700 font-medium mb-2">{item.prompt}</p>
                  <div className="markdown-content">
                    <ReactMarkdown
                      components={{
                        h1: ({ node, ...props }) => (
                          <h1 className="text-lg font-bold text-gray-900 mb-2" {...props} />
                        ),
                        h2: ({ node, ...props }) => (
                          <h2 className="text-base font-semibold text-gray-900 mb-2" {...props} />
                        ),
                        p: ({ node, ...props }) => (
                          <p className="text-gray-600 mb-2" {...props} />
                        ),
                        ul: ({ node, ...props }) => (
                          <ul className="list-disc pl-5 space-y-1" {...props} />
                        ),
                        li: ({ node, ...props }) => (
                          <li className="text-gray-600 break-words -my-0.5">
                            <span className="whitespace-pre-wrap block leading-tight py-0.5">
                              {props.children}
                            </span>
                          </li>
                        ),
                        code: ({ node, inline, ...props }) => (
                          <code
                            className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-sm break-words"
                            {...props}
                          />
                        ),
                      }}
                    >
                      {item.response}
                    </ReactMarkdown>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
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
                  url: chrome.runtime.getURL('dashboard/dashboard.html'),
                  active: false
                });
              }}
              className="w-full py-3 px-4 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition-colors"
            >
              View Full History
            </button>
          </div>
        )}

        {/* Settings Tab 
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
              <div className={`p-3 rounded-xl text-center ${status.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                {status.message}
              </div>
            )}
          </div>
          
        )}
          */}
      </div>
    </div>
  );
};


// Create root element and render
const container = document.getElementById('root');
const root = createRoot(container);
root.render(<Popup />);