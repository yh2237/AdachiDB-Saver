document.addEventListener('DOMContentLoaded', () => {
  const apiCallCountElement = document.getElementById('api-call-count');

  function loadApiCallCount() {
    chrome.storage.local.get(['apiCallCount'], (result) => {
      const count = result.apiCallCount || 0;
      apiCallCountElement.textContent = count;
    });
  }

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.apiCallCount) {
      loadApiCallCount();
    }
  });

  loadApiCallCount();
});
