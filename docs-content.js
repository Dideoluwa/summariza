console.log("Summarize It! extension loaded in Google Docs");

// Note: Automatic text selection handling has been disabled.
// Users should use the context menu (right-click > "Summarize this text") to summarize text.

// Add a visible element to confirm the script is running
// window.addEventListener("load", function() {
//   // Wait a moment for the page to fully load
//   setTimeout(() => {
//     const indicator = document.createElement("div");
//     indicator.textContent = "Summarize It! Active";
//     indicator.style.position = "fixed";
//     indicator.style.bottom = "10px";
//     indicator.style.right = "10px";
//     indicator.style.backgroundColor = "#4285F4";
//     indicator.style.color = "white";
//     indicator.style.padding = "5px 10px";
//     indicator.style.borderRadius = "4px";
//     indicator.style.zIndex = "9999";
//     indicator.style.fontSize = "12px";
//     indicator.style.boxShadow = "0 2px 5px rgba(0,0,0,0.2)";

//     document.body.appendChild(indicator);

//     // Remove after 5 seconds
//     setTimeout(() => {
//       indicator.style.opacity = "0";
//       indicator.style.transition = "opacity 0.5s";
//       setTimeout(() => {
//         if (indicator.parentNode) {
//           document.body.removeChild(indicator);
//         }
//       }, 500);
//     }, 5000);
//   }, 1000);
// });