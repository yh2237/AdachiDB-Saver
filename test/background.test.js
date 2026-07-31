const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const urlHelpers = require('../js/url');

const backgroundSource = fs.readFileSync(
  path.join(__dirname, '..', 'js', 'background.js'),
  'utf8'
);

function loadBackground(fetchImpl) {
  const listeners = {};
  const store = {};
  const chrome = {
    runtime: {
      onInstalled: { addListener: (listener) => { listeners.installed = listener; } },
      onStartup: { addListener: (listener) => { listeners.startup = listener; } },
      onMessage: { addListener: (listener) => { listeners.message = listener; } }
    },
    storage: {
      local: {
        setAccessLevel: async () => undefined,
        get: async (keys) => Object.fromEntries(
          keys
            .filter((key) => store[key] !== undefined)
            .map((key) => [key, store[key]])
        ),
        set: async (values) => {
          Object.assign(store, values);
        }
      }
    }
  };
  const sandbox = {
    AbortController,
    Date,
    Map,
    Object,
    Set,
    URL,
    chrome,
    clearTimeout,
    console,
    fetch: fetchImpl,
    setTimeout
  };
  sandbox.importScripts = () => {
    sandbox.AdachiDbUrl = urlHelpers;
  };

  vm.runInContext(backgroundSource, vm.createContext(sandbox));
  return { listeners, store };
}

function sendMessage(listener, request, sender) {
  return new Promise((resolve) => {
    const keepChannelOpen = listener(request, sender, resolve);
    assert.equal(keepChannelOpen, true);
  });
}

test('rejects messages that do not originate from X', () => {
  let fetchCalls = 0;
  const { listeners } = loadBackground(async () => {
    fetchCalls += 1;
  });
  let response;

  const keepChannelOpen = listeners.message(
    { action: 'sendToAPI', url: 'https://x.com/adachirei0/status/123' },
    { url: 'https://example.com/' },
    (value) => { response = value; }
  );

  assert.equal(keepChannelOpen, false);
  assert.equal(response.status, 'error');
  assert.equal(fetchCalls, 0);
});

test('normalizes a post URL and treats HTTP 409 as an existing record', async () => {
  let requestBody;
  const { listeners, store } = loadBackground(async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return {
      status: 409,
      json: async () => ({ error: 'URL already exists in database' })
    };
  });

  const response = await sendMessage(
    listeners.message,
    {
      action: 'sendToAPI',
      url: 'https://twitter.com/AdachiRei0/status/123?s=20'
    },
    { url: 'https://x.com/home' }
  );

  assert.deepEqual(requestBody, {
    url: 'https://x.com/adachirei0/status/123'
  });
  assert.equal(response.status, 'duplicate');
  assert.equal(store.duplicateCount, 1);
  assert.equal(store.errorCount, 0);
});

test('records a successful addition', async () => {
  const { listeners, store } = loadBackground(async () => ({
    status: 201,
    json: async () => ({ id: 1 })
  }));

  const response = await sendMessage(
    listeners.message,
    { action: 'sendToAPI', url: 'https://x.com/adachirei0/status/456' },
    { url: 'https://x.com/adachirei0' }
  );

  assert.equal(response.status, 'success');
  assert.equal(response.count, 1);
  assert.equal(store.apiCallCount, 1);
  assert.equal(store.lastResult, 'success');
});

test('marks server failures as retryable', async () => {
  const { listeners, store } = loadBackground(async () => ({
    status: 503,
    json: async () => ({ error: 'Service unavailable' })
  }));

  const response = await sendMessage(
    listeners.message,
    { action: 'sendToAPI', url: 'https://x.com/adachirei0/status/789' },
    { url: 'https://twitter.com/home' }
  );

  assert.equal(response.status, 'error');
  assert.equal(response.retryable, true);
  assert.equal(store.errorCount, 1);
  assert.equal(store.lastError, 'Service unavailable');
});
