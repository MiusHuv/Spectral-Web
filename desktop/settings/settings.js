const form = document.querySelector('#settings-form');
const error = document.querySelector('#error');
const securityNote = document.querySelector('#security-note');
const saveButton = document.querySelector('#save');

window.spectralDesktop.getSettings().then((settings) => {
  for (const field of ['host', 'port', 'name', 'user', 'password']) {
    document.querySelector(`#${field}`).value = settings[field] ?? '';
  }
  securityNote.textContent = settings.encryptionAvailable
    ? 'The password is encrypted using the operating system credential service.'
    : 'Secure credential storage is unavailable. The password will be used for this session only.';
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  error.textContent = '';
  saveButton.disabled = true;
  saveButton.textContent = 'Connecting...';
  const result = await window.spectralDesktop.saveSettings({
    host: document.querySelector('#host').value,
    port: Number(document.querySelector('#port').value),
    name: document.querySelector('#name').value,
    user: document.querySelector('#user').value,
    password: document.querySelector('#password').value
  });
  if (!result.ok) {
    error.textContent = result.error;
    saveButton.disabled = false;
    saveButton.textContent = 'Connect';
  }
});

document.querySelector('#cancel').addEventListener('click', () => {
  window.spectralDesktop.cancelSettings();
});
