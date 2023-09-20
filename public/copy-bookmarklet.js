document.addEventListener(
  'click',
  function (event) {
    // Only fire if the target has id copy
    if (!event.target.matches('#copy-bookmarklet')) return;
    // Clipboard API not available
    if (!navigator.clipboard) return;
    const text = event.target.value;
    try {
      navigator.clipboard.writeText(text);
      const statusEl = document.getElementById('copy-status');
      if (!statusEl) return;
      const originalTextContext = statusEl.textContent;
      statusEl.textContent = 'Copied to clipboard';
      setTimeout(function () {
        statusEl.innerText = originalTextContext;
      }, 1500);
    } catch (err) {
      console.error('Failed to copy!', err);
    }
  },
  false,
);
