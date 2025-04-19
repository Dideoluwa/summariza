document.addEventListener("DOMContentLoaded", () => {
  const summaryEl = document.getElementById("summary");
  const summaryContainer = document.getElementById("summary-container");
  const loadingContainer = document.getElementById("loading-container");
  const clearBtn = document.getElementById("clear-btn");
  const copyBtn = document.getElementById("copy-btn");
  const wordCountEl = document.getElementById("word-count");

  summaryEl.style.display = "none";
  loadingContainer.style.display = "flex";
  clearBtn.style.display = "none";
  copyBtn.style.display = "none";

  function createSparkles(count) {
    const sparklesContainer = document.getElementById("sparkles");

    for (let i = 0; i < count; i++) {
      const sparkle = document.createElement("div");
      sparkle.className = "sparkle-dot";

      const x = Math.random() * window.innerWidth;
      const y = Math.random() * window.innerHeight;

      const size = Math.random() * 5 + 1;

      sparkle.style.width = `${size}px`;
      sparkle.style.height = `${size}px`;
      sparkle.style.left = `${x}px`;
      sparkle.style.top = `${y}px`;

      const duration = Math.random() * 1 + 0.5;
      sparkle.style.animation = `fadeInOut ${duration}s ease-in-out`;

      const colors = ["#6366f1", "#f43f5e", "#0ea5e9", "#10b981"];
      sparkle.style.background =
        colors[Math.floor(Math.random() * colors.length)];

      sparklesContainer.appendChild(sparkle);

      setTimeout(() => {
        sparkle.remove();
      }, duration * 1000);
    }
  }

  function updateTextStats(text) {
    if (
      !text ||
      text === "No summary available." ||
      text === "Summary cleared."
    ) {
      wordCountEl.textContent = "0";
      // charCountEl.textContent = "0";
      // sentenceCountEl.textContent = "0";
      return;
    }

    // Word count
    const words = text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0);
    wordCountEl.textContent = words.length.toString();

    // Character count
    // charCountEl.textContent = text.length.toString();

    // Sentence count (basic approximation)
    // const sentences = text.split(/[.!?]+/).filter(sentence => sentence.trim().length > 0);
    // sentenceCountEl.textContent = sentences.length.toString();
  }

  setTimeout(() => {
    chrome.storage.local.get(["summary"], (result) => {
      loadingContainer.style.display = "none";
      summaryEl.style.display = "block";

      if (result.summary) {
        summaryEl.innerText = result.summary;
        clearBtn.style.display = "inline-block";
        copyBtn.style.display = "inline-block";
        updateTextStats(result.summary);
        createSparkles(10);
      } else {
        summaryEl.innerText = "No summary available.";
        updateTextStats(null);
      }
    });
  }, 1500);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.summary) {
      const newSummary = changes.summary.newValue;

      summaryEl.style.display = "none";
      loadingContainer.style.display = "flex";

      setTimeout(() => {
        loadingContainer.style.display = "none";
        summaryEl.style.display = "block";

        summaryEl.innerText = newSummary || "No summary available.";
        clearBtn.style.display = newSummary ? "inline-block" : "none";
        copyBtn.style.display = newSummary ? "inline-block" : "none";

        updateTextStats(newSummary);

        summaryContainer.style.transition = "all 0.3s ease";
        summaryContainer.style.transform = "scale(0.98)";
        setTimeout(() => {
          summaryContainer.style.transform = "scale(1)";
          createSparkles(15);
        }, 300);
      }, 800);
      chrome.action.setBadgeText({ text: "" });
    }
  });

  clearBtn.addEventListener("click", () => {
    chrome.storage.local.remove("summary", () => {
      summaryEl.innerText = "Summary cleared.";
      clearBtn.style.display = "none";
      copyBtn.style.display = "none";
      updateTextStats(null);

      createSparkles(20);

      summaryContainer.style.transition = "all 0.3s ease";
      summaryContainer.style.transform = "scale(0.98)";
      setTimeout(() => {
        summaryContainer.style.transform = "scale(1)";
      }, 300);
    });
  });

  copyBtn.addEventListener("click", function () {
    const summary = summaryEl.textContent;
    navigator.clipboard.writeText(summary).then(() => {
      const originalText = this.innerHTML;
      this.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        Copied!
      `;
      setTimeout(() => {
        this.innerHTML = originalText;
      }, 2000);

      createSparkles(10);
    });
  });

  document
    .getElementById("theme-toggle")
    .addEventListener("click", function () {
      const root = document.documentElement;
      const currentPrimary = getComputedStyle(root)
        .getPropertyValue("--primary")
        .trim();

      if (currentPrimary === "#6366f1") {
        root.style.setProperty("--primary", "#10b981");
        root.style.setProperty("--primary-dark", "#059669");
        root.style.setProperty("--secondary", "#f97316");
        root.style.setProperty("--accent", "#8b5cf6");
      } else {
        root.style.setProperty("--primary", "#6366f1");
        root.style.setProperty("--primary-dark", "#4f46e5");
        root.style.setProperty("--secondary", "#f43f5e");
        root.style.setProperty("--accent", "#0ea5e9");
      }

      createSparkles(20);
    });

  setTimeout(() => {
    createSparkles(15);
  }, 500);

  if (!document.getElementById("sparkle-keyframes")) {
    const style = document.createElement("style");
    style.id = "sparkle-keyframes";
    style.textContent = `
      @keyframes fadeInOut {
        0% { transform: translateY(0) scale(0); opacity: 0; }
        50% { transform: translateY(-20px) scale(1); opacity: 1; }
        100% { transform: translateY(-40px) scale(0); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
});
