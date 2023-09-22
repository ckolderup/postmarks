window.addEventListener('load', () => {
  if (!navigator.clipboard) {
    return;
  }

  document.querySelectorAll('[data-copy]').forEach((el) => {
    el.addEventListener('click', () => {
      try {
        navigator.clipboard.writeText(el.dataset.copy);
        const statusSelector = el.dataset.copyStatus;

        if (!statusSelector) {
          return;
        }

        const statusEl = document.querySelector(el.dataset.copyStatus);

        if (!statusEl) {
          return;
        }

        if (!statusEl.dataset.copyOriginalText) {
          statusEl.dataset.copyOriginalText = statusEl.textContent;
        }

        statusEl.textContent = 'Copied to clipboard';

        setTimeout(function () {
          statusEl.textContent = statusEl.dataset.copyOriginalText;
        }, 1500);
      } catch (err) {
        console.error('Failed to copy!', err);
      }
    });
  });
});
