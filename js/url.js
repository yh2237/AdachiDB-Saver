(function initializeUrlHelpers(root) {
  const SUPPORTED_HOSTS = new Set(['x.com', 'twitter.com']);
  const DEFAULT_TARGET_USERNAME = 'adachirei0';

  function normalizeTargetPostUrl(value, targetUsername = DEFAULT_TARGET_USERNAME) {
    if (typeof value !== 'string' || value.trim() === '') {
      return null;
    }

    let url;
    try {
      url = new URL(value);
    } catch {
      return null;
    }

    const hostname = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || !SUPPORTED_HOSTS.has(hostname)) {
      return null;
    }

    const pathParts = url.pathname.split('/').filter(Boolean);
    if (
      pathParts.length !== 3 ||
      pathParts[0].toLowerCase() !== targetUsername.toLowerCase() ||
      pathParts[1] !== 'status' ||
      !/^\d+$/.test(pathParts[2])
    ) {
      return null;
    }

    return `https://x.com/${targetUsername}/status/${pathParts[2]}`;
  }

  const helpers = Object.freeze({
    DEFAULT_TARGET_USERNAME,
    normalizeTargetPostUrl
  });

  root.AdachiDbUrl = helpers;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = helpers;
  }
})(globalThis);
