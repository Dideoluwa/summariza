// Default API Key - defined in one place
const DEFAULT_API_KEY = "";

// Get API key from storage or use default
const getApiKey = async () => {
  const result = await chrome.storage.local.get(["apiKey"]);
  return result.apiKey || DEFAULT_API_KEY;
};

chrome.runtime.onInstalled.addListener(() => {
  // Initialize default API key in storage if not already set
  chrome.storage.local.get(["apiKey"], (result) => {
    if (!result.apiKey) {
      chrome.storage.local.set({ apiKey: DEFAULT_API_KEY });
    }
  });

  chrome.contextMenus.create({
    id: "darasimi-dideoluwa-oni-summarize-text",
    title: "Summarize this text for me!",
    contexts: ["selection"],
  });

  chrome.contextMenus.create({
    id: "summarizeDocsSelection",
    title: "Summarize Doc Selection",
    contexts: ["selection"],
    documentUrlPatterns: ["*://docs.google.com/*"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (
    info.menuItemId === "darasimi-dideoluwa-oni-summarize-text" &&
    info.selectionText
  ) {
    // Store original text for translation
    chrome.storage.local.set({ originalText: info.selectionText });
    
    // Get preferred language, format, length, tone, and API key
    const result = await chrome.storage.local.get(["preferredLanguage", "preferredFormat", "preferredLength", "preferredTone", "apiKey"]);
    const targetLanguage = result.preferredLanguage || "auto";
    const targetFormat = result.preferredFormat || "brief";
    const targetLength = result.preferredLength || "medium";
    const targetTone = result.preferredTone || "neutral";
    const apiKey = result.apiKey || DEFAULT_API_KEY;
    
    let port;
    try {
      port = chrome.tabs.connect(tab.id, { name: "summarize" });
    } catch (error) {
      console.error("Failed to establish connection:", error);
      saveAndStoreSummary("Unable to establish connection with the page.");
      return;
    }

    try {
      const canInject = await chrome.scripting
        .executeScript({
          target: { tabId: tab.id },
          func: () => true,
        })
        .catch(() => false);

      if (!canInject) {
        saveAndStoreSummary(
          "Unable to summarize text on this page. The page may have restrictions that prevent text selection."
        );
        return;
      }

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async (selectedText, apiKey, targetLanguage, targetFormat, targetLength, targetTone) => {
          // Get language name mapping
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
          
          const targetLanguageName = targetLanguage === "auto" ? null : (languageNames[targetLanguage] || targetLanguage);
          
          // Length adjustments
          let lengthMultiplier = 1;
          let lengthDescription = "";
          switch(targetLength) {
            case "short":
              lengthMultiplier = 0.7;
              lengthDescription = "Keep it concise and brief.";
              break;
            case "medium":
              lengthMultiplier = 1;
              lengthDescription = "Provide a balanced, moderate length.";
              break;
            case "long":
              lengthMultiplier = 1.5;
              lengthDescription = "Provide a comprehensive, detailed response.";
              break;
          }

          // Tone instructions
          let toneInstruction = "";
          switch(targetTone) {
            case "formal":
              toneInstruction = "Use a formal, professional tone with proper grammar and structure.";
              break;
            case "casual":
              toneInstruction = "Use a casual, conversational tone that's easy to read.";
              break;
            case "technical":
              toneInstruction = "Use a technical tone with appropriate terminology and precision.";
              break;
            case "simple":
              toneInstruction = "Use simple language that's easy to understand, avoiding jargon.";
              break;
            default:
              toneInstruction = "Use a neutral, balanced tone.";
          }

          // Format-specific instructions
          let formatInstruction = "";
          let formatStructure = "";
          
          switch(targetFormat) {
            case "brief":
              formatInstruction = `Provide a very brief summary (${Math.round(2 * lengthMultiplier)}-${Math.round(3 * lengthMultiplier)} sentences) and a short explanation (max ${Math.round(100 * lengthMultiplier)} words). ${lengthDescription} ${toneInstruction}`;
              formatStructure = `SUMMARY:\n[${Math.round(2 * lengthMultiplier)}-${Math.round(3 * lengthMultiplier)} sentences maximum, including ALL key points]\n\nEXPLANATION:\n[Simple explanation in ${Math.round(100 * lengthMultiplier)} words or less]`;
              break;
            case "detailed":
              formatInstruction = `Provide a comprehensive detailed summary (${Math.round(5 * lengthMultiplier)}-${Math.round(7 * lengthMultiplier)} sentences) and an in-depth explanation (${Math.round(200 * lengthMultiplier)}-${Math.round(300 * lengthMultiplier)} words) covering all aspects. ${lengthDescription} ${toneInstruction}`;
              formatStructure = `SUMMARY:\n[${Math.round(5 * lengthMultiplier)}-${Math.round(7 * lengthMultiplier)} sentences with comprehensive coverage of all key points and details]\n\nEXPLANATION:\n[Detailed explanation in ${Math.round(200 * lengthMultiplier)}-${Math.round(300 * lengthMultiplier)} words covering all main aspects and nuances]`;
              break;
            case "bullet":
              formatInstruction = `Provide the summary and explanation in bullet point format. Use clear, concise bullet points. ${lengthDescription} ${toneInstruction}`;
              formatStructure = `SUMMARY:\n• [Bullet point 1]\n• [Bullet point 2]\n• [Bullet point 3]\n...\n\nEXPLANATION:\n• [Explanation point 1]\n• [Explanation point 2]\n• [Explanation point 3]\n...`;
              break;
            case "key-points":
              formatInstruction = `Extract and list only the key points. No full sentences, just essential points. ${lengthDescription} ${toneInstruction}`;
              formatStructure = `KEY POINTS:\n• [Key point 1]\n• [Key point 2]\n• [Key point 3]\n• [Key point 4]\n...`;
              break;
            case "qa":
              formatInstruction = `Format the output as questions and answers. Create ${Math.round(3 * lengthMultiplier)}-${Math.round(5 * lengthMultiplier)} relevant questions about the content and provide clear answers. ${lengthDescription} ${toneInstruction}`;
              formatStructure = `Q: [Question 1]\nA: [Answer 1]\n\nQ: [Question 2]\nA: [Answer 2]\n\nQ: [Question 3]\nA: [Answer 3]\n...`;
              break;
          }
          
          const context = `You are an expert AI assistant skilled in text analysis and summarization. A user has highlighted text from a webpage.${targetLanguageName ? ` IMPORTANT: Generate the response in ${targetLanguageName}.` : " Auto-detect the language of the source text and respond in the same language."}`;

          const instruction = `${formatInstruction}${targetLanguageName ? ` Write in ${targetLanguageName}.` : ""}`;

          const define = `Structure the output as follows:\n\n${formatStructure}\n\nNote: Ensure ALL important points are covered. No key information should be omitted.`;

          const input = `--- START OF HIGHLIGHTED TEXT ---
          ${selectedText}
          --- END OF HIGHLIGHTED TEXT ---`;

          const prompt = `${context}\n\n${instruction}\n\n${define}\n\n${input}\n\nGenerate the output below:`;

          try {
            const res = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
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

            if (!res.ok) {
              throw new Error("API request failed");
            }

            const data = await res.json();
            const summary =
              data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
              "No summary returned.";

            chrome.runtime.sendMessage({ 
              type: "SAVE_SUMMARY", 
              summary,
              originalText: selectedText
            });
          } catch (error) {
            chrome.runtime.sendMessage({
              type: "SAVE_SUMMARY",
              summary: "Failed to generate summary. Please try again later.",
            });
          }
        },
        args: [info.selectionText, apiKey, targetLanguage, targetFormat, targetLength, targetTone],
      });
    } catch (error) {
      saveAndStoreSummary("Unable to process your request. Please try again.");
    } finally {
      if (port) {
        port.disconnect();
      }
    }
  }
});

const saveAndStoreSummary = async (summary, originalText = null, url = null) => {
  // Save current summary
  chrome.storage.local.set({ summary }, () => {
    // Open popup automatically when summary is ready (triggered by menu click)
    chrome.action.openPopup();
  });

  // Check privacy mode before saving to history
  chrome.storage.local.get(["privacyMode"], async (privacyResult) => {
    const isPrivacyMode = privacyResult.privacyMode === true;
    
    // Save to history only if privacy mode is disabled
    if (!isPrivacyMode && summary && summary !== "No summary available." && summary !== "Failed to generate summary. Please try again later.") {
      const historyEntry = {
        id: Date.now().toString(),
        summary: summary,
        originalText: originalText || "",
        url: url || "",
        timestamp: Date.now(),
        wordCount: summary.split(/\s+/).filter(word => word.length > 0).length,
        date: new Date().toISOString()
      };

      chrome.storage.local.get(["summaryHistory"], (result) => {
        const history = result.summaryHistory || [];
        history.unshift(historyEntry); // Add to beginning
        
        // Keep only last 100 entries to manage storage
        const limitedHistory = history.slice(0, 100);
        
        chrome.storage.local.set({ summaryHistory: limitedHistory });
      });
    }
  });
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SAVE_SUMMARY") {
    const originalText = message.originalText || null;
    const url = sender.tab ? sender.tab.url : null;
    saveAndStoreSummary(message.summary, originalText, url);
  }

  if (message.type === "GET_DEFAULT_API_KEY") {
    sendResponse({ apiKey: DEFAULT_API_KEY });
    return true;
  }

  // Add this new handler for Google Docs text selection
  if (message.type === "DOCS_TEXT_SELECTED" && message.text) {
    console.log(message);
    // Process the selected text from Google Docs
    // Remove the alert as it can cause issues
    // alert(message.text)

    // Send a response immediately
    // Then process the text
    console.log("okay");
    processSummaryForDocs(message.text, sender.tab.id);

    // Return true to indicate you'll respond asynchronously
    return true;
  }

  // Return true for all message types that will be handled asynchronously
  return true;
});

// New function to process Google Docs text
async function processSummaryForDocs(selectedText, tabId) {
  // Store original text for translation
  chrome.storage.local.set({ originalText: selectedText });
  
  // Get preferred language, format, length, tone, and API key
  const result = await chrome.storage.local.get(["preferredLanguage", "preferredFormat", "preferredLength", "preferredTone", "apiKey"]);
  const targetLanguage = result.preferredLanguage || "auto";
  const targetFormat = result.preferredFormat || "brief";
  const targetLength = result.preferredLength || "medium";
  const targetTone = result.preferredTone || "neutral";
  const apiKey = result.apiKey || DEFAULT_API_KEY; // Default fallback
  
  console.log(selectedText);
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: async (selectedText, apiKey, targetLanguage, targetFormat, targetLength, targetTone) => {
        // Get language name mapping
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
        
        const targetLanguageName = targetLanguage === "auto" ? null : (languageNames[targetLanguage] || targetLanguage);
        
        // Length adjustments
        let lengthMultiplier = 1;
        let lengthDescription = "";
        switch(targetLength) {
          case "short":
            lengthMultiplier = 0.7;
            lengthDescription = "Keep it concise and brief.";
            break;
          case "medium":
            lengthMultiplier = 1;
            lengthDescription = "Provide a balanced, moderate length.";
            break;
          case "long":
            lengthMultiplier = 1.5;
            lengthDescription = "Provide a comprehensive, detailed response.";
            break;
        }

        // Tone instructions
        let toneInstruction = "";
        switch(targetTone) {
          case "formal":
            toneInstruction = "Use a formal, professional tone with proper grammar and structure.";
            break;
          case "casual":
            toneInstruction = "Use a casual, conversational tone that's easy to read.";
            break;
          case "technical":
            toneInstruction = "Use a technical tone with appropriate terminology and precision.";
            break;
          case "simple":
            toneInstruction = "Use simple language that's easy to understand, avoiding jargon.";
            break;
          default:
            toneInstruction = "Use a neutral, balanced tone.";
        }

        // Format-specific instructions
        let formatInstruction = "";
        let formatStructure = "";
        
        switch(targetFormat) {
          case "brief":
            formatInstruction = `Provide a very brief summary (${Math.round(2 * lengthMultiplier)}-${Math.round(3 * lengthMultiplier)} sentences) and a short explanation (max ${Math.round(100 * lengthMultiplier)} words). ${lengthDescription} ${toneInstruction}`;
            formatStructure = `SUMMARY:\n[${Math.round(2 * lengthMultiplier)}-${Math.round(3 * lengthMultiplier)} sentences maximum, including ALL key points]\n\nEXPLANATION:\n[Simple explanation in ${Math.round(100 * lengthMultiplier)} words or less]`;
            break;
          case "detailed":
            formatInstruction = `Provide a comprehensive detailed summary (${Math.round(5 * lengthMultiplier)}-${Math.round(7 * lengthMultiplier)} sentences) and an in-depth explanation (${Math.round(200 * lengthMultiplier)}-${Math.round(300 * lengthMultiplier)} words) covering all aspects. ${lengthDescription} ${toneInstruction}`;
            formatStructure = `SUMMARY:\n[${Math.round(5 * lengthMultiplier)}-${Math.round(7 * lengthMultiplier)} sentences with comprehensive coverage of all key points and details]\n\nEXPLANATION:\n[Detailed explanation in ${Math.round(200 * lengthMultiplier)}-${Math.round(300 * lengthMultiplier)} words covering all main aspects and nuances]`;
            break;
          case "bullet":
            formatInstruction = `Provide the summary and explanation in bullet point format. Use clear, concise bullet points. ${lengthDescription} ${toneInstruction}`;
            formatStructure = `SUMMARY:\n• [Bullet point 1]\n• [Bullet point 2]\n• [Bullet point 3]\n...\n\nEXPLANATION:\n• [Explanation point 1]\n• [Explanation point 2]\n• [Explanation point 3]\n...`;
            break;
          case "key-points":
            formatInstruction = `Extract and list only the key points. No full sentences, just essential points. ${lengthDescription} ${toneInstruction}`;
            formatStructure = `KEY POINTS:\n• [Key point 1]\n• [Key point 2]\n• [Key point 3]\n• [Key point 4]\n...`;
            break;
          case "qa":
            formatInstruction = `Format the output as questions and answers. Create ${Math.round(3 * lengthMultiplier)}-${Math.round(5 * lengthMultiplier)} relevant questions about the content and provide clear answers. ${lengthDescription} ${toneInstruction}`;
            formatStructure = `Q: [Question 1]\nA: [Answer 1]\n\nQ: [Question 2]\nA: [Answer 2]\n\nQ: [Question 3]\nA: [Answer 3]\n...`;
            break;
        }
        
        const context = `You are an expert AI assistant skilled in text analysis and summarization. A user has highlighted text from a webpage.${targetLanguageName ? ` IMPORTANT: Generate the response in ${targetLanguageName}.` : " Auto-detect the language of the source text and respond in the same language."}`;

        const instruction = `${formatInstruction}${targetLanguageName ? ` Write in ${targetLanguageName}.` : ""}`;

        const define = `Structure the output as follows:\n\n${formatStructure}\n\nNote: Ensure ALL important points are covered. No key information should be omitted.`;

        const input = `--- START OF HIGHLIGHTED TEXT ---
        ${selectedText}
        --- END OF HIGHLIGHTED TEXT ---`;

        const prompt = `${context}\n\n${instruction}\n\n${define}\n\n${input}\n\nGenerate the output below:`;

        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
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

          if (!res.ok) {
            throw new Error("API request failed");
          }

          const data = await res.json();
          const summary =
            data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
            "No summary returned.";

          chrome.runtime.sendMessage({ type: "SAVE_SUMMARY", summary });
        } catch (error) {
          chrome.runtime.sendMessage({
            type: "SAVE_SUMMARY",
            summary: "Failed to generate summary. Please try again later.",
          });
        }
      },
      args: [selectedText, apiKey, targetLanguage, targetFormat, targetLength, targetTone],
    });
  } catch (error) {
    saveAndStoreSummary(
      "Unable to process your request from Google Docs. Please try again."
    );
  }
}
