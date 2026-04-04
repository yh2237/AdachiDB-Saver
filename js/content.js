(function(chrome) {
  const TARGET_USER_ID = 'adachirei0';

  function checkAndSendPostToAPI(post) {
    if (post.dataset.apiSent === 'true') {
      return;
    }

    const userNameElement = post.querySelector('[data-testid="User-Name"]');
    if (userNameElement) {
      const spans = userNameElement.querySelectorAll('span');
      const accountId = Array.from(spans).find(span => span.textContent.startsWith('@'))?.textContent.substring(1);

      if (accountId === TARGET_USER_ID) {
        const timeElement = post.querySelector('time');
        if (timeElement) {
          const link = timeElement.closest('a');
          if (link && link.href) {
            const postUrl = link.href;
            post.dataset.apiSent = 'true';
            chrome.runtime.sendMessage({ action: 'sendToAPI', url: postUrl }, (response) => {
              if (chrome.runtime.lastError) {
                console.error('Runtime error:', chrome.runtime.lastError.message);
                return;
              }
              if (response && response.status === 'success') {
                console.log('Post sent to API:', postUrl, 'Total API calls:', response.count);
              } else {
                console.error('Failed to send post to API:', postUrl, response?.error);
              }
            });
          }
        }
      }
    }
  }

  function observeTimeline() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            const posts = node.querySelectorAll('article');
            posts.forEach(checkAndSendPostToAPI);
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  setTimeout(() => {
    const initialPosts = document.querySelectorAll('article');
    initialPosts.forEach(checkAndSendPostToAPI);
  }, 2000);

  observeTimeline();

})(chrome);
