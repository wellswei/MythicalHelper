document.querySelectorAll(".share-copy-card").forEach((card) => {
  const button = card.querySelector(".copy-button");
  const text = card.querySelector("pre");
  if (!button || !text) {
    return;
  }

  button.addEventListener("click", async () => {
    const original = button.textContent;
    try {
      await navigator.clipboard.writeText(text.textContent.trim());
      button.textContent = "Copied";
      window.setTimeout(() => {
        button.textContent = original;
      }, 1400);
    } catch {
      button.textContent = "Select text";
      window.setTimeout(() => {
        button.textContent = original;
      }, 1600);
    }
  });
});
