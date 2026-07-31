(function initializeContentScript(chromeApi, urlHelpers) {
  const MAX_RETRIES = 2;
  const completedUrls = new Set();
  const inFlightUrls = new Set();
  const retryCounts = new Map();
  const pendingRoots = new Set();
  let scanScheduled = false;

  function extractPostUrl(article) {
    const timeElement = article.querySelector('time');
    const link = timeElement?.closest('a');
    return urlHelpers.normalizeTargetPostUrl(link?.href);
  }

  function scheduleRetry(url) {
    const retryCount = retryCounts.get(url) || 0;
    if (retryCount >= MAX_RETRIES) {
      completedUrls.add(url);
      retryCounts.delete(url);
      return;
    }

    retryCounts.set(url, retryCount + 1);
    const delay = 1000 * (2 ** retryCount);
    setTimeout(() => sendPostUrl(url), delay);
  }

  function sendPostUrl(url) {
    if (completedUrls.has(url) || inFlightUrls.has(url)) {
      return;
    }

    inFlightUrls.add(url);
    chromeApi.runtime.sendMessage({ action: 'sendToAPI', url }, (response) => {
      inFlightUrls.delete(url);

      if (chromeApi.runtime.lastError) {
        console.error('AdachiDB Saver runtime error:', chromeApi.runtime.lastError.message);
        scheduleRetry(url);
        return;
      }

      if (response?.status === 'success' || response?.status === 'duplicate') {
        completedUrls.add(url);
        retryCounts.delete(url);
        return;
      }

      console.error('AdachiDB Saver failed to save:', url, response?.error || 'Unknown error');
      if (response?.retryable) {
        scheduleRetry(url);
      } else {
        completedUrls.add(url);
      }
    });
  }

  function inspectArticle(article) {
    const postUrl = extractPostUrl(article);
    if (postUrl) {
      sendPostUrl(postUrl);
    }
  }

  function scanRoot(root) {
    if (!(root instanceof Element)) {
      return;
    }

    const parentArticle = root.closest('article');
    if (parentArticle) {
      inspectArticle(parentArticle);
    }

    if (root.matches('article')) {
      inspectArticle(root);
    }

    root.querySelectorAll('article').forEach(inspectArticle);
  }

  function flushPendingRoots() {
    scanScheduled = false;
    const roots = Array.from(pendingRoots);
    pendingRoots.clear();
    roots.forEach(scanRoot);
  }

  function queueScan(root) {
    pendingRoots.add(root);
    if (!scanScheduled) {
      scanScheduled = true;
      queueMicrotask(flushPendingRoots);
    }
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes') {
        queueScan(mutation.target);
      } else {
        mutation.addedNodes.forEach(queueScan);
      }
    }
  });

  document.querySelectorAll('article').forEach(inspectArticle);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['href']
  });
})(chrome, AdachiDbUrl);
