chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['apiCallCount'], (result) => {
    if (!result.apiCallCount) {
      chrome.storage.local.set({ apiCallCount: 0 });
    }
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'sendToAPI') {
    (async () => {
      const postUrl = request.url;
      try {
        const response = await fetch('https://adachi.2237yh.net/api/posts/add', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ url: postUrl })
        });

        if (response.ok) {
          const result = await chrome.storage.local.get(['apiCallCount']);
          const count = (result.apiCallCount || 0) + 1;
          await chrome.storage.local.set({ apiCallCount: count });
          console.log('API call successful:', postUrl, 'Total calls:', count);
          sendResponse({ status: 'success', count: count });
        } else {
          console.error('API call failed:', response.status, response.statusText);
          sendResponse({ status: 'error', error: response.statusText });
        }
      } catch (error) {
        console.error('API call error:', error);
        sendResponse({ status: 'error', error: error.message });
      }
    })();

    return true;
  }
});
