(function () {
  const channel = 'opencoode-terminal';
  let currentTheme;
  let restoreResize = false;
  let inputEnabled = true;
  const term = new Terminal({
    fontFamily: 'Menlo, Consolas, monospace',
    fontSize: 13,
    cursorBlink: true,
    scrollback: 2000,
    screenReaderMode: true,
  });
  const fit = new FitAddon.FitAddon();
  term.loadAddon(fit);
  term.open(document.getElementById('terminal'));
  term.attachCustomKeyEventHandler(() => inputEnabled);
  term.element.addEventListener('paste', event => {
    if (inputEnabled) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  function send(value) {
    const message = JSON.stringify({ channel, ...value });
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(message);
    else window.parent.postMessage(message, '*');
  }
  function receive(event) {
    if (!window.ReactNativeWebView && event.source !== window.parent) return;
    let message;
    try { message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; } catch { return; }
    if (!message || message.channel !== channel) return;
    if (message.type === 'output' && typeof message.data === 'string') term.write(message.data);
    if (message.type === 'focus' && inputEnabled) term.focus();
    if (message.type === 'inputEnabled' && typeof message.enabled === 'boolean') {
      inputEnabled = message.enabled;
      term.textarea.readOnly = !inputEnabled;
      term.textarea.tabIndex = inputEnabled ? 0 : -1;
      term.textarea.setAttribute('inputmode', inputEnabled ? 'text' : 'none');
      if (!inputEnabled) term.textarea.blur();
    }
    if (message.type === 'theme' && message.colors && typeof message.colors.background === 'string') {
      currentTheme = message.colors;
      term.options.theme = message.colors;
      document.documentElement.style.backgroundColor = message.colors.background;
      document.body.style.backgroundColor = message.colors.background;
      document.getElementById('terminal').style.visibility = 'visible';
    }
    if (message.type === 'restore' && typeof message.checkpoint === 'string' && Number.isInteger(message.cols) && Number.isInteger(message.rows)) {
      const bytes = Uint8Array.from(atob(message.checkpoint), char => char.charCodeAt(0));
      restoreResize = true;
      term.resize(message.cols, message.rows);
      restoreResize = false;
      const restored = new Uint8Array(bytes.byteLength + 2);
      restored.set([27, 99]);
      restored.set(bytes, 2);
      term.write(restored, () => { if (currentTheme) term.options.theme = currentTheme; });
    }
  }
  window.addEventListener('message', receive);
  document.addEventListener('message', receive);
  term.onData(data => send({ type: 'input', data }));
  term.onBinary(data => send({ type: 'input', data, binary: true }));
  term.onResize(size => { if (!restoreResize) send({ type: 'resize', ...size }); });
  const observer = new ResizeObserver(() => fit.fit());
  observer.observe(document.getElementById('terminal'));
  window.addEventListener('resize', () => fit.fit());
  window.visualViewport?.addEventListener('resize', () => fit.fit());
  requestAnimationFrame(() => {
    fit.fit();
    send({ type: 'ready' });
    send({ type: 'resize', cols: term.cols, rows: term.rows });
  });
})();
