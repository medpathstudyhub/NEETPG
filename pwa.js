/* MEDPATH PWA registration and optional install prompt. No existing app logic is modified. */
(() => {
  if (!('serviceWorker' in navigator)) return;
  const isLocal = location.protocol === 'http:' && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  if (location.protocol !== 'https:' && !isLocal) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(error => {
      console.warn('MEDPATH offline support could not be enabled:', error);
    });
  });

  let installPrompt = null;
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    if (document.getElementById('medpathInstallPrompt')) return;

    const panel = document.createElement('aside');
    panel.id = 'medpathInstallPrompt';
    panel.setAttribute('aria-label', 'Install MEDPATH app');
    panel.style.cssText = 'position:fixed;z-index:9999;left:16px;right:16px;bottom:16px;max-width:440px;margin-left:auto;background:#fff;color:#183c63;border:1px solid #d5e0e8;border-radius:14px;padding:14px 16px;box-shadow:0 8px 30px #102d4c28;font:14px system-ui,sans-serif;display:flex;gap:12px;align-items:center';
    panel.innerHTML = '<div style="flex:1"><strong>Install MEDPATH STUDY HUB</strong><div style="margin-top:3px;color:#526679">Add the study hub to your home screen.</div></div><button type="button" id="medpathInstallNow" style="border:0;border-radius:8px;background:#168c86;color:white;padding:10px 13px;font-weight:700">Install</button><button type="button" id="medpathInstallClose" aria-label="Close" style="border:0;background:transparent;color:#526679;font-size:20px">×</button>';
    document.body.appendChild(panel);
    panel.querySelector('#medpathInstallNow').addEventListener('click', async () => {
      if (!installPrompt) return;
      installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
      panel.remove();
    });
    panel.querySelector('#medpathInstallClose').addEventListener('click', () => panel.remove());
  });
  window.addEventListener('appinstalled', () => {
    const panel = document.getElementById('medpathInstallPrompt');
    if (panel) panel.remove();
    installPrompt = null;
  });
})();
