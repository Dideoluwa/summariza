const GEMINI_API_KEY = ``;

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "darasimi-dideoluwa-oni-summarize-text",
    title: "Summarize this text for me!",
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (
    info.menuItemId === "darasimi-dideoluwa-oni-summarize-text" &&
    info.selectionText
  ) {
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
        func: async (selectedText, apiKey) => {
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
          ${selectedText}
          --- END OF HIGHLIGHTED TEXT ---`;

          const prompt = `${context}\n\n${instruction}\n\n${define}\n\n${input}\n\nGenerate the output below:`;

          try {
            const res = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
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
        args: [info.selectionText, GEMINI_API_KEY],
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

const saveAndStoreSummary = (summary) => {
  chrome.storage.local.set({ summary }, () => {
    chrome.action.openPopup();
  });
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SAVE_SUMMARY") {
    saveAndStoreSummary(message.summary);
  }
});
