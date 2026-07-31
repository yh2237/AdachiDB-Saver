document.addEventListener('DOMContentLoaded', () => {
  const addedElement = document.getElementById('api-call-count');
  const duplicateElement = document.getElementById('duplicate-count');
  const errorElement = document.getElementById('error-count');
  const lastResultElement = document.getElementById('last-result');

  function formatLastResult(values) {
    if (!values.lastResult) {
      return 'まだ送信していません。';
    }

    if (values.lastResult === 'success') {
      return '最後の投稿を追加しました。';
    }

    if (values.lastResult === 'duplicate') {
      return '最後の投稿は登録済みでした。';
    }

    return `最後の送信に失敗しました：${values.lastError || '原因不明'}`;
  }

  async function renderStats() {
    const values = await chrome.storage.local.get([
      'apiCallCount',
      'duplicateCount',
      'errorCount',
      'lastResult',
      'lastError'
    ]);

    addedElement.textContent = Number(values.apiCallCount) || 0;
    duplicateElement.textContent = Number(values.duplicateCount) || 0;
    errorElement.textContent = Number(values.errorCount) || 0;
    lastResultElement.textContent = formatLastResult(values);
    lastResultElement.classList.toggle('error', values.lastResult === 'error');
  }

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && Object.keys(changes).length > 0) {
      renderStats().catch(console.error);
    }
  });

  renderStats().catch((error) => {
    lastResultElement.textContent = `保存状況を読み込めませんでした：${error.message}`;
    lastResultElement.classList.add('error');
  });
});
