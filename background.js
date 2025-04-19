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
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async (selectedText, apiKey) => {
        const context = `You are an expert AI assistant skilled in text analysis, summarization, and explanation. A user has highlighted text from a webpage. They require two outputs based on this text:
        1.  A concise summary to quickly grasp the main points and core message.
        2.  A simple explanation of the text's meaning, concepts, or arguments, as if explaining it to someone intelligent but unfamiliar with the specific topic (think ELI5 - Explain Like I'm 5, or simplifying for a high school student). The goal is clarity and accessibility.`;

        // Instruction (I): Tell the AI exactly what to do for both tasks.
        const instruction = `Your tasks are to:
        1.  **Summarize:** Generate a brief, clear, and accurate summary focusing on the central theme, key arguments, and essential information presented *only* in the provided text snippet. Omit redundancy and minor details.
        2.  **Explain:** Break down the content of the text snippet into simple, easy-to-understand terms. Avoid jargon or explain it clearly if absolutely necessary. Use analogies or simpler concepts where helpful to clarify complex points. Ensure the explanation is based *only* on the provided text.`;

        // Define (D): Specify the desired output format, style, length, and tone for *both* sections.
        const define = `Structure the output clearly into two distinct sections, using Markdown headers exactly as follows:
        
        ### Summary:
        [Your concise summary here, typically 2-4 sentences, neutral and objective tone]
        
        ### Explanation:
        [Your simple explanation here, prioritizing clarity and accessibility over strict brevity, using a helpful and approachable tone]
        
        -   **Summary Section:** Present as a single, coherent paragraph. Aim for 2-4 sentences. Maintain a neutral, objective, and informative tone.
        -   **Explanation Section:** Present as one or more short paragraphs. Focus on simplicity and clarity. Use a helpful, approachable, and easy-to-understand tone.`;

        // Input (I): Provide the text to be processed, clearly demarcated.
        const input = `--- START OF HIGHLIGHTED TEXT ---
        ${selectedText}
        --- END OF HIGHLIGHTED TEXT ---`;

        // Combine the sections into the final prompt.
        const prompt = `${context}\n\n${instruction}\n\n${define}\n\n${input}\n\nGenerate the output below:`;

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: prompt
              }]
            }]
          }),
        });
        const data = await res.json();
        const summary = 
          data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "No summary returned.";

        chrome.runtime.sendMessage({ type: "SAVE_SUMMARY", summary });
      },
      args: [info.selectionText, GEMINI_API_KEY],
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SAVE_SUMMARY") {
    chrome.storage.local.set({ summary: message.summary });
  }
});
