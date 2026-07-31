const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const urlHelpers = require('../js/url');

const contentSource = fs.readFileSync(
  path.join(__dirname, '..', 'js', 'content.js'),
  'utf8'
);

class FakeElement {
  constructor(tagName, options = {}) {
    this.tagName = tagName;
    this.href = options.href;
    this.parentArticle = options.parentArticle || null;
    this.descendantArticles = options.descendantArticles || [];
    this.timeLink = options.timeLink || null;
  }

  matches(selector) {
    return selector === 'article' && this.tagName === 'article';
  }

  closest(selector) {
    if (selector === 'article') {
      return this.tagName === 'article' ? this : this.parentArticle;
    }
    return null;
  }

  querySelector(selector) {
    if (selector !== 'time' || !this.timeLink) {
      return null;
    }
    return {
      closest: (closestSelector) => closestSelector === 'a' ? this.timeLink : null
    };
  }

  querySelectorAll(selector) {
    return selector === 'article' ? this.descendantArticles : [];
  }
}

function makeArticle(url) {
  const article = new FakeElement('article');
  const link = new FakeElement('a', { href: url, parentArticle: article });
  article.timeLink = link;
  return { article, link };
}

function loadContent(initialArticles = []) {
  const sentUrls = [];
  let observerCallback;
  const chrome = {
    runtime: {
      lastError: null,
      sendMessage: (message, callback) => {
        sentUrls.push(message.url);
        callback({ status: 'success' });
      }
    }
  };
  class FakeMutationObserver {
    constructor(callback) {
      observerCallback = callback;
    }

    observe() {}
  }
  const document = {
    body: new FakeElement('body'),
    querySelectorAll: (selector) => selector === 'article' ? initialArticles : []
  };

  vm.runInContext(contentSource, vm.createContext({
    AdachiDbUrl: urlHelpers,
    Array,
    Element: FakeElement,
    Map,
    MutationObserver: FakeMutationObserver,
    Set,
    chrome,
    console,
    document,
    queueMicrotask,
    setTimeout
  }));

  return { getObserver: () => observerCallback, sentUrls };
}

function waitForMicrotasks() {
  return new Promise((resolve) => setImmediate(resolve));
}

test('saves only the target account from the initial timeline', () => {
  const target = makeArticle('https://twitter.com/AdachiRei0/status/123?s=20');
  const other = makeArticle('https://x.com/other/status/456');
  const { sentUrls } = loadContent([target.article, other.article]);

  assert.deepEqual(sentUrls, ['https://x.com/adachirei0/status/123']);
});

test('detects an article added directly and a URL changed inside a reused article', async () => {
  const first = makeArticle('https://x.com/adachirei0/status/100');
  const { getObserver, sentUrls } = loadContent([]);
  const observer = getObserver();

  observer([{
    type: 'childList',
    addedNodes: [first.article]
  }]);
  await waitForMicrotasks();

  first.link.href = 'https://x.com/adachirei0/status/200';
  observer([{
    type: 'attributes',
    target: first.link
  }]);
  await waitForMicrotasks();

  assert.deepEqual(sentUrls, [
    'https://x.com/adachirei0/status/100',
    'https://x.com/adachirei0/status/200'
  ]);
});
