importScripts('url.js');

const API_ENDPOINT = 'https://adachidb.net/api/posts/add';
const X_ORIGINS = new Set(['https://x.com', 'https://twitter.com']);
const pendingRequests = new Map();
let requestQueue = Promise.resolve();
let storageQueue = Promise.resolve();

const DEFAULT_STATS = Object.freeze({
  apiCallCount: 0,
  duplicateCount: 0,
  errorCount: 0,
  lastResult: null,
  lastUrl: null,
  lastError: null,
  lastUpdatedAt: null
});

async function initializeStorage() {
  await chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  const stored = await chrome.storage.local.get(Object.keys(DEFAULT_STATS));
  const missing = {};

  for (const [key, value] of Object.entries(DEFAULT_STATS)) {
    if (stored[key] === undefined) {
      missing[key] = value;
    }
  }

  if (Object.keys(missing).length > 0) {
    await chrome.storage.local.set(missing);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  initializeStorage().catch((error) => {
    console.error('Failed to initialize extension storage:', error);
  });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }).catch((error) => {
    console.error('Failed to restrict extension storage:', error);
  });
});

function isAllowedSender(sender) {
  if (!sender?.url) {
    return false;
  }

  try {
    return X_ORIGINS.has(new URL(sender.url).origin);
  } catch {
    return false;
  }
}

async function readResponseBody(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function updateStats(result, url, errorMessage = null) {
  storageQueue = storageQueue.catch(() => undefined).then(async () => {
    const stored = await chrome.storage.local.get(Object.keys(DEFAULT_STATS));
    const next = {
      apiCallCount: Number(stored.apiCallCount) || 0,
      duplicateCount: Number(stored.duplicateCount) || 0,
      errorCount: Number(stored.errorCount) || 0,
      lastResult: result,
      lastUrl: url,
      lastError: errorMessage,
      lastUpdatedAt: new Date().toISOString()
    };

    if (result === 'success') {
      next.apiCallCount += 1;
    } else if (result === 'duplicate') {
      next.duplicateCount += 1;
    } else if (result === 'error') {
      next.errorCount += 1;
    }

    await chrome.storage.local.set(next);
    return next;
  });

  return storageQueue;
}

async function postUrl(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url }),
      signal: controller.signal
    });
    const body = await readResponseBody(response);

    if (response.status === 201) {
      const stats = await updateStats('success', url);
      return { status: 'success', count: stats.apiCallCount };
    }

    if (response.status === 409) {
      const stats = await updateStats('duplicate', url);
      return { status: 'duplicate', count: stats.duplicateCount };
    }

    const message = body?.error || `API request failed (${response.status})`;
    await updateStats('error', url, message);
    return {
      status: 'error',
      error: message,
      retryable: response.status === 429 || response.status >= 500
    };
  } catch (error) {
    const message = error.name === 'AbortError'
      ? 'API request timed out'
      : error.message;
    await updateStats('error', url, message);
    return { status: 'error', error: message, retryable: true };
  } finally {
    clearTimeout(timeoutId);
  }
}

function enqueuePost(url) {
  if (pendingRequests.has(url)) {
    return pendingRequests.get(url);
  }

  const task = requestQueue.then(() => postUrl(url));
  requestQueue = task.catch(() => undefined);
  pendingRequests.set(url, task);
  task.then(
    () => pendingRequests.delete(url),
    () => pendingRequests.delete(url)
  );
  return task;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request?.action !== 'sendToAPI') {
    return false;
  }

  if (!isAllowedSender(sender)) {
    sendResponse({ status: 'error', error: 'Message sender is not allowed', retryable: false });
    return false;
  }

  const postUrl = AdachiDbUrl.normalizeTargetPostUrl(request.url);
  if (!postUrl) {
    sendResponse({ status: 'error', error: 'Invalid Adachi Rei post URL', retryable: false });
    return false;
  }

  enqueuePost(postUrl)
    .then(sendResponse)
    .catch((error) => {
      console.error('Unexpected API error:', error);
      sendResponse({ status: 'error', error: error.message, retryable: true });
    });

  return true;
});
