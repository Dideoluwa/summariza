document.addEventListener("DOMContentLoaded", () => {
  const summaryEl = document.getElementById("summary");
  const summaryContainer = document.getElementById("summary-container");
  const loadingContainer = document.getElementById("loading-container");
  const emptyState = document.getElementById("empty-state");
  const clearBtn = document.getElementById("clear-btn");
  const copyBtn = document.getElementById("copy-btn");
  const retryBtn = document.getElementById("retry-btn");
  const wordCountEl = document.getElementById("word-count");
  const themeToggle = document.getElementById("theme-toggle");
  const themeIcon = document.getElementById("theme-icon");
  const settingsToggle = document.getElementById("settings-toggle");
  const settingsPanel = document.getElementById("settings-panel");
  const languageSelect = document.getElementById("language-select");
  const formatSelect = document.getElementById("format-select");
  const lengthSelect = document.getElementById("length-select");
  const toneSelect = document.getElementById("tone-select");
  const apiKeyInput = document.getElementById("api-key-input");
  const privacyModeToggle = document.getElementById("privacy-mode-toggle");
  const historyBtn = document.getElementById("history-btn");
  const historyPanel = document.getElementById("history-panel");
  const historyList = document.getElementById("history-list");
  const historySearch = document.getElementById("history-search");
  const clearHistoryBtn = document.getElementById("clear-history-btn");
  const exportHistoryBtn = document.getElementById("export-history-btn");
  const closeHistoryBtn = document.getElementById("close-history-btn");

  // Theme management
  function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    
    // Update icon based on theme
    if (theme === "light") {
      themeIcon.innerHTML = `
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
      `;
      themeToggle.title = "Switch to dark mode";
    } else {
      themeIcon.innerHTML = `
        <circle cx="12" cy="12" r="5"></circle>
        <line x1="12" y1="1" x2="12" y2="3"></line>
        <line x1="12" y1="21" x2="12" y2="23"></line>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
        <line x1="1" y1="12" x2="3" y2="12"></line>
        <line x1="21" y1="12" x2="23" y2="12"></line>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
      `;
      themeToggle.title = "Switch to light mode";
    }
    
    // Save preference
    chrome.storage.local.set({ theme: theme });
  }

  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute("data-theme") || "dark";
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    setTheme(newTheme);
  }

  // Load saved theme preference
  chrome.storage.local.get(["theme"], (result) => {
    const savedTheme = result.theme || "dark";
    setTheme(savedTheme);
  });

  // Language management
  function setLanguage(language) {
    languageSelect.value = language;
    chrome.storage.local.set({ preferredLanguage: language });
  }

  function getLanguageName(code) {
    const option = languageSelect.querySelector(`option[value="${code}"]`);
    return option ? option.textContent : code;
  }

  // Load saved language preference
  chrome.storage.local.get(["preferredLanguage"], (result) => {
    const savedLanguage = result.preferredLanguage || "auto";
    setLanguage(savedLanguage);
  });

  // Format management
  function setFormat(format) {
    formatSelect.value = format;
    chrome.storage.local.set({ preferredFormat: format });
  }

  // Load saved format preference
  chrome.storage.local.get(["preferredFormat"], (result) => {
    const savedFormat = result.preferredFormat || "brief";
    setFormat(savedFormat);
  });

  // Format change handler - regenerate summary in new format
  formatSelect.addEventListener("change", async () => {
    const selectedFormat = formatSelect.value;
    setFormat(selectedFormat);
    
    // Get original text and language
    chrome.storage.local.get(["originalText", "preferredLanguage"], async (result) => {
      if (result.originalText) {
        showLoading();
        
        try {
          const newSummary = await generateSummaryInFormat(
            result.originalText,
            selectedFormat,
            result.preferredLanguage || "auto"
          );
          if (newSummary) {
            chrome.storage.local.set({ summary: newSummary });
            showSummary(newSummary);
            updateTextStats(newSummary);
          }
        } catch (error) {
          console.error("Format change error:", error);
        }
      }
    });
  });

  // Language change handler - translate existing summary
  languageSelect.addEventListener("change", async () => {
    const selectedLanguage = languageSelect.value;
    setLanguage(selectedLanguage);
    
    // Get current summary
    chrome.storage.local.get(["summary", "originalText"], async (result) => {
      if (result.summary && result.originalText && selectedLanguage !== "auto") {
        // Show loading
        showLoading();
        
        // Translate the summary
        try {
          const translatedSummary = await translateSummary(result.summary, selectedLanguage);
          if (translatedSummary) {
            chrome.storage.local.set({ summary: translatedSummary });
            showSummary(translatedSummary);
            updateTextStats(translatedSummary);
          }
        } catch (error) {
          console.error("Translation error:", error);
          showSummary(result.summary);
        }
      } else if (selectedLanguage === "auto" && result.originalText) {
        // Re-generate summary in original language
        showLoading();
        try {
          const originalSummary = await generateSummary(result.originalText, "auto");
          if (originalSummary) {
            chrome.storage.local.set({ summary: originalSummary });
            showSummary(originalSummary);
            updateTextStats(originalSummary);
          }
        } catch (error) {
          console.error("Summary generation error:", error);
        }
      }
    });
  });

  // Function to get API key from storage (default is set in background.js)
  async function getApiKey() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["apiKey"], (result) => {
        if (result.apiKey) {
          resolve(result.apiKey);
        } else {
          // If not in storage, request default from background and store it
          chrome.runtime.sendMessage({ type: "GET_DEFAULT_API_KEY" }, (response) => {
            const apiKey = response?.apiKey || "";
            if (apiKey) {
              chrome.storage.local.set({ apiKey });
            }
            resolve(apiKey);
          });
        }
      });
    });
  }

  // Function to translate summary
  async function translateSummary(text, targetLanguage) {
    const GEMINI_API_KEY = await getApiKey();
    const languageName = getLanguageName(targetLanguage);
    
    const prompt = `Translate the following summary and explanation to ${languageName}. Maintain the same structure and format (SUMMARY: and EXPLANATION: sections). Keep the translation accurate and natural:

${text}`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt,
                  },
                ],
              },
            ],
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Translation failed");
      }

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || text;
    } catch (error) {
      console.error("Translation error:", error);
      return text;
    }
  }

  // Function to generate summary in specific format
  async function generateSummaryInFormat(text, format, language) {
    const GEMINI_API_KEY = await getApiKey();
    
    const languageNames = {
      "en": "English", "es": "Spanish", "fr": "French", "de": "German",
      "it": "Italian", "pt": "Portuguese", "ru": "Russian", "ja": "Japanese",
      "ko": "Korean", "zh": "Chinese (Simplified)", "zh-TW": "Chinese (Traditional)",
      "ar": "Arabic", "hi": "Hindi", "tr": "Turkish", "pl": "Polish",
      "nl": "Dutch", "sv": "Swedish", "da": "Danish", "no": "Norwegian",
      "fi": "Finnish", "el": "Greek", "he": "Hebrew", "th": "Thai",
      "vi": "Vietnamese", "id": "Indonesian", "ms": "Malay", "cs": "Czech",
      "ro": "Romanian", "hu": "Hungarian", "uk": "Ukrainian", "bg": "Bulgarian",
      "hr": "Croatian", "sk": "Slovak", "sl": "Slovenian", "sr": "Serbian",
      "et": "Estonian", "lv": "Latvian", "lt": "Lithuanian", "ga": "Irish",
      "mt": "Maltese", "is": "Icelandic", "mk": "Macedonian", "sq": "Albanian",
      "bs": "Bosnian", "sw": "Swahili", "af": "Afrikaans", "az": "Azerbaijani",
      "bn": "Bengali", "ca": "Catalan", "eu": "Basque", "fa": "Persian",
      "gl": "Galician", "gu": "Gujarati", "ha": "Hausa", "iw": "Hebrew",
      "ka": "Georgian", "kk": "Kazakh", "km": "Khmer", "lo": "Lao",
      "ml": "Malayalam", "mr": "Marathi", "my": "Myanmar", "ne": "Nepali",
      "pa": "Punjabi", "si": "Sinhala", "ta": "Tamil", "te": "Telugu",
      "ur": "Urdu", "uz": "Uzbek"
    };
    
    const targetLanguageName = language === "auto" ? null : (languageNames[language] || language);
    
    let formatInstruction = "";
    let formatStructure = "";
    
    switch(format) {
      case "brief":
        formatInstruction = `Provide a very brief summary (2-3 sentences) and a short explanation (max 100 words).`;
        formatStructure = `SUMMARY:\n[2-3 sentences maximum, including ALL key points]\n\nEXPLANATION:\n[Simple explanation in 100 words or less]`;
        break;
      case "detailed":
        formatInstruction = `Provide a comprehensive detailed summary (5-7 sentences) and an in-depth explanation (200-300 words) covering all aspects.`;
        formatStructure = `SUMMARY:\n[5-7 sentences with comprehensive coverage of all key points and details]\n\nEXPLANATION:\n[Detailed explanation in 200-300 words covering all main aspects and nuances]`;
        break;
      case "bullet":
        formatInstruction = `Provide the summary and explanation in bullet point format. Use clear, concise bullet points.`;
        formatStructure = `SUMMARY:\n• [Bullet point 1]\n• [Bullet point 2]\n• [Bullet point 3]\n...\n\nEXPLANATION:\n• [Explanation point 1]\n• [Explanation point 2]\n• [Explanation point 3]\n...`;
        break;
      case "key-points":
        formatInstruction = `Extract and list only the key points. No full sentences, just essential points.`;
        formatStructure = `KEY POINTS:\n• [Key point 1]\n• [Key point 2]\n• [Key point 3]\n• [Key point 4]\n...`;
        break;
      case "qa":
        formatInstruction = `Format the output as questions and answers. Create 3-5 relevant questions about the content and provide clear answers.`;
        formatStructure = `Q: [Question 1]\nA: [Answer 1]\n\nQ: [Question 2]\nA: [Answer 2]\n\nQ: [Question 3]\nA: [Answer 3]\n...`;
        break;
    }
    
    const context = `You are an expert AI assistant skilled in text analysis and summarization. A user has highlighted text from a webpage.${targetLanguageName ? ` IMPORTANT: Generate the response in ${targetLanguageName}.` : " Auto-detect the language of the source text and respond in the same language."}`;

    const instruction = `${formatInstruction}${targetLanguageName ? ` Write in ${targetLanguageName}.` : ""}`;

    const define = `Structure the output as follows:\n\n${formatStructure}\n\nNote: Ensure ALL important points are covered. No key information should be omitted.`;

    const input = `--- START OF HIGHLIGHTED TEXT ---\n${text}\n--- END OF HIGHLIGHTED TEXT ---`;

    const prompt = `${context}\n\n${instruction}\n\n${define}\n\n${input}\n\nGenerate the output below:`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt,
                  },
                ],
              },
            ],
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Summary generation failed");
      }

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
    } catch (error) {
      console.error("Summary generation error:", error);
      return null;
    }
  }

  // Function to generate summary (for auto-detect)
  async function generateSummary(text, language) {
    const GEMINI_API_KEY = await getApiKey();
    
    const context = `You are an expert AI assistant skilled in text analysis and summarization. A user has highlighted text from a webpage. Provide two brief outputs, ensuring no important points are omitted:
    1. A very concise summary (2-3 sentences max) of the main points, capturing ALL key information.
    2. A short, simple explanation (max 100 words) for someone unfamiliar with the topic.`;

    const instruction = `Your tasks are to:
    1. **Summarize:** Create an extremely brief summary (2-3 sentences) that MUST include all essential points. Focus on core message and ensure no key information is left out.
    2. **Explain:** Provide a simple, jargon-free explanation (max 100 words) that covers all main points. Use basic terms and keep it concise while being comprehensive.`;

    const define = `Structure the output as follows:
    
    SUMMARY:
    [2-3 sentences maximum, including ALL key points without exception]
    
    EXPLANATION:
    [Simple explanation in 100 words or less, covering all main aspects]
    
    Note: Keep both sections as brief as possible while ensuring ALL important points are covered. No key information should be omitted.`;

    const input = `--- START OF HIGHLIGHTED TEXT ---
    ${text}
    --- END OF HIGHLIGHTED TEXT ---`;

    const prompt = `${context}\n\n${instruction}\n\n${define}\n\n${input}\n\nGenerate the output below:`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt,
                  },
                ],
              },
            ],
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Summary generation failed");
      }

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
    } catch (error) {
      console.error("Summary generation error:", error);
      return null;
    }
  }

  // Initialize UI state
  function showLoading() {
    loadingContainer.style.display = "flex";
    summaryEl.style.display = "none";
    emptyState.style.display = "none";
    clearBtn.style.display = "none";
    copyBtn.style.display = "none";
    if (retryBtn) retryBtn.style.display = "none";
    const readingTimeCard = document.getElementById("reading-time-card");
    if (readingTimeCard) readingTimeCard.style.display = "none";
    
    // Show progress indicator
    const progressContainer = document.getElementById("progress-container");
    const progressFill = document.getElementById("progress-fill");
    const progressText = document.getElementById("progress-text");
    if (progressContainer) {
      progressContainer.classList.add("active");
      // Simulate progress
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress > 90) progress = 90;
        if (progressFill) progressFill.style.width = `${progress}%`;
        if (progressText) {
          const eta = Math.max(1, Math.ceil((100 - progress) / 10));
          progressText.textContent = `Generating summary... ~${eta}s remaining`;
        }
        if (progress >= 90) clearInterval(interval);
      }, 500);
    }
  }

  function showSummary(text) {
    loadingContainer.style.display = "none";
    emptyState.style.display = "none";
    summaryEl.style.display = "block";
    summaryEl.textContent = text;
    clearBtn.style.display = "flex";
    copyBtn.style.display = "flex";
    if (retryBtn) retryBtn.style.display = "flex";
    const readingTimeCard = document.getElementById("reading-time-card");
    if (readingTimeCard) readingTimeCard.style.display = "flex";
    summaryContainer.classList.add("fade-in");
    
    // Hide progress
    const progressContainer = document.getElementById("progress-container");
    if (progressContainer) progressContainer.classList.remove("active");
  }

  function showEmptyState() {
    loadingContainer.style.display = "none";
    summaryEl.style.display = "none";
    emptyState.style.display = "flex";
    clearBtn.style.display = "none";
    copyBtn.style.display = "none";
  }

  function updateTextStats(text) {
    if (!text || text === "No summary available." || text === "Summary cleared.") {
      wordCountEl.textContent = "0";
      return;
    }

    const words = text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0);
    wordCountEl.textContent = words.length.toLocaleString();
    
    // Calculate reading time (average 200 words per minute)
    const readingTime = Math.ceil(words.length / 200);
    const readingTimeEl = document.getElementById("reading-time");
    if (readingTimeEl) {
      readingTimeEl.textContent = readingTime === 1 ? "1 min read" : `${readingTime} min read`;
    }
  }

  // Load initial summary
  setTimeout(() => {
    chrome.storage.local.get(["summary"], (result) => {
      if (result.summary) {
        showSummary(result.summary);
        updateTextStats(result.summary);
      } else {
        showEmptyState();
        updateTextStats(null);
      }
    });
  }, 500);

  // Listen for summary updates
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.summary) {
      const newSummary = changes.summary.newValue;

      if (newSummary) {
        showLoading();
        
        setTimeout(() => {
          showSummary(newSummary);
          updateTextStats(newSummary);
        }, 600);
      } else {
        showEmptyState();
        updateTextStats(null);
      }
      
      chrome.action.setBadgeText({ text: "" });
    }
  });

  // Clear button handler
  clearBtn.addEventListener("click", () => {
    chrome.storage.local.remove("summary", () => {
      showEmptyState();
      updateTextStats(null);
      summaryContainer.classList.add("fade-in");
    });
  });

  // Copy button handler
  copyBtn.addEventListener("click", function () {
    const summary = summaryEl.textContent;
    if (!summary || summary === "No summary available.") return;

    navigator.clipboard.writeText(summary).then(() => {
      const originalHTML = this.innerHTML;
      this.innerHTML = `
        <svg class="btn-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        Copied!
      `;
      this.style.background = "var(--success)";
      
      setTimeout(() => {
        this.innerHTML = originalHTML;
        this.style.background = "";
      }, 2000);
    }).catch((err) => {
      console.error("Failed to copy:", err);
    });
  });

  // Theme toggle handler
  themeToggle.addEventListener("click", toggleTheme);

  // Settings toggle handler
  settingsToggle.addEventListener("click", () => {
    settingsPanel.classList.toggle("active");
    // Update icon to show active state
    if (settingsPanel.classList.contains("active")) {
      settingsToggle.style.background = "var(--bg-tertiary)";
      settingsToggle.style.borderColor = "var(--primary)";
      } else {
      settingsToggle.style.background = "";
      settingsToggle.style.borderColor = "";
    }
  });

  // Length and Tone handlers
  if (lengthSelect) {
    chrome.storage.local.get(["preferredLength"], (result) => {
      lengthSelect.value = result.preferredLength || "medium";
    });
    lengthSelect.addEventListener("change", () => {
      chrome.storage.local.set({ preferredLength: lengthSelect.value });
    });
  }

  if (toneSelect) {
    chrome.storage.local.get(["preferredTone"], (result) => {
      toneSelect.value = result.preferredTone || "neutral";
    });
    toneSelect.addEventListener("change", () => {
      chrome.storage.local.set({ preferredTone: toneSelect.value });
    });
  }

  // API Key handler
  if (apiKeyInput) {
    chrome.storage.local.get(["apiKey"], (result) => {
      if (result.apiKey) {
        apiKeyInput.value = result.apiKey;
      }
    });
    apiKeyInput.addEventListener("blur", () => {
      const apiKey = apiKeyInput.value.trim();
      if (apiKey) {
        chrome.storage.local.set({ apiKey: apiKey });
      } else {
        chrome.storage.local.remove("apiKey");
      }
    });
  }

  // Privacy Mode handler
  if (privacyModeToggle) {
    chrome.storage.local.get(["privacyMode"], (result) => {
      privacyModeToggle.checked = result.privacyMode === true;
    });
    privacyModeToggle.addEventListener("change", () => {
      chrome.storage.local.set({ privacyMode: privacyModeToggle.checked });
      // If privacy mode is enabled, clear history
      if (privacyModeToggle.checked) {
        chrome.storage.local.remove("summaryHistory");
        if (historyList) historyList.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-tertiary);">Privacy mode enabled - no history saved</div>';
      }
    });
  }

  // History functionality
  function loadHistory() {
    if (!historyList) {
      console.error("History list element not found");
      return;
    }
    
    chrome.storage.local.get(["summaryHistory", "privacyMode"], (result) => {
      if (result.privacyMode === true) {
        if (historyList) {
          historyList.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-tertiary);">Privacy mode enabled - no history available</div>';
        }
        return;
      }
      const history = result.summaryHistory || [];
      console.log("Loading history:", history.length, "items");
      displayHistory(history);
    });
  }

  function displayHistory(history, filter = "") {
    if (!historyList) return;
    
    historyList.innerHTML = "";
    
    // Check if history is empty
    if (!history || history.length === 0) {
      historyList.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-tertiary);">No history found</div>';
      return;
    }
    
    const filtered = filter 
      ? history.filter(item => 
          item.summary && item.summary.toLowerCase().includes(filter.toLowerCase()) ||
          (item.url && item.url.toLowerCase().includes(filter.toLowerCase()))
        )
      : history;

    if (filtered.length === 0) {
      historyList.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-tertiary);">No matching history found</div>';
      return;
    }

    filtered.forEach(item => {
      if (!item.summary) return; // Skip invalid entries
      
      const historyItem = document.createElement("div");
      historyItem.className = "history-item";
      
      let urlDisplay = "";
      try {
        if (item.url) {
          const urlObj = new URL(item.url);
          urlDisplay = `<span>${urlObj.hostname}</span>`;
        }
      } catch (e) {
        // Invalid URL, skip
      }
      
      historyItem.innerHTML = `
        <div class="history-item-header">
          <div class="history-item-date">${formatDate(item.timestamp || Date.now())}</div>
        </div>
        <div class="history-item-preview">${item.summary.substring(0, 150)}${item.summary.length > 150 ? '...' : ''}</div>
        <div class="history-item-meta">
          <span>${item.wordCount || 0} words</span>
          ${urlDisplay}
        </div>
      `;
      historyItem.addEventListener("click", () => {
        chrome.storage.local.set({ summary: item.summary }, () => {
          showSummary(item.summary);
          updateTextStats(item.summary);
          historyPanel.style.display = "none";
        });
      });
      historyList.appendChild(historyItem);
    });
  }

  function formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  }

  if (historyBtn) {
    historyBtn.addEventListener("click", () => {
      if (historyPanel) {
        historyPanel.style.display = "flex";
        // Small delay to ensure panel is visible before loading
  setTimeout(() => {
          loadHistory();
        }, 100);
      }
    });
  }

  if (closeHistoryBtn) {
    closeHistoryBtn.addEventListener("click", () => {
      historyPanel.style.display = "none";
    });
  }

  if (historySearch) {
    historySearch.addEventListener("input", (e) => {
      chrome.storage.local.get(["summaryHistory"], (result) => {
        displayHistory(result.summaryHistory || [], e.target.value);
      });
    });
  }

  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener("click", () => {
      if (confirm("Are you sure you want to clear all history? This action cannot be undone.")) {
        chrome.storage.local.remove("summaryHistory", () => {
          if (historyList) {
            historyList.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-tertiary);">History cleared</div>';
          }
        });
      }
    });
  }

  if (exportHistoryBtn) {
    exportHistoryBtn.addEventListener("click", () => {
      chrome.storage.local.get(["summaryHistory"], (result) => {
        const history = result.summaryHistory || [];
        if (history.length === 0) {
          alert("No history to export");
          return;
        }
        const exportData = JSON.stringify(history, null, 2);
        const blob = new Blob([exportData], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `summary-history-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      });
    });
  }

  // Retry functionality
  if (retryBtn) {
    retryBtn.addEventListener("click", async () => {
      chrome.storage.local.get(["originalText", "preferredLanguage", "preferredFormat"], async (result) => {
        if (result.originalText) {
          showLoading();
          try {
            const newSummary = await generateSummaryInFormat(
              result.originalText,
              result.preferredFormat || "brief",
              result.preferredLanguage || "auto"
            );
            if (newSummary) {
              chrome.storage.local.set({ summary: newSummary });
              showSummary(newSummary);
              updateTextStats(newSummary);
            }
          } catch (error) {
            console.error("Retry error:", error);
            showEmptyState();
          }
        }
      });
    });
  }

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    // Ctrl+Shift+H for history
    if (e.ctrlKey && e.shiftKey && e.key === "H") {
      e.preventDefault();
      if (historyBtn) historyBtn.click();
    }
    // Ctrl+Shift+C for copy
    if (e.ctrlKey && e.shiftKey && e.key === "C" && copyBtn.style.display !== "none") {
      e.preventDefault();
      copyBtn.click();
    }
    // Ctrl+Shift+R for retry
    if (e.ctrlKey && e.shiftKey && e.key === "R" && retryBtn && retryBtn.style.display !== "none") {
      e.preventDefault();
      retryBtn.click();
    }
    // Ctrl+Shift+S for settings
    if (e.ctrlKey && e.shiftKey && e.key === "S") {
      e.preventDefault();
      if (settingsToggle) settingsToggle.click();
    }
    // Escape to close history
    if (e.key === "Escape" && historyPanel.style.display === "flex") {
      historyPanel.style.display = "none";
    }
  });

  // Initialize history on startup (but don't display until button is clicked)
  // History will be loaded when history button is clicked
});