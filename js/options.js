function saveOptions(e) {
  e.preventDefault();
  const action = document.querySelector('input[name="action"]:checked').value;

  chrome.storage.sync.set({
    buttonAction: action
  }, () => {
    const status = document.getElementById('status');
    status.textContent = '設定を保存しました。';
    setTimeout(() => {
      status.textContent = '';
    }, 1500);
  });
}

function restoreOptions() {
  chrome.storage.sync.get({
    buttonAction: 'save'
  }, (items) => {
    document.querySelector(`input[name="action"][value="${items.buttonAction}"]`).checked = true;
  });
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.querySelectorAll('input[name="action"]').forEach(radio => {
  radio.addEventListener('change', saveOptions);
});
