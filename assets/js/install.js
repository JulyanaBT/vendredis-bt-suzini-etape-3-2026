const iconUrl = new URL('../img/vendredis-suzini-192-v2.png', import.meta.url).href;
// One suggestion per browser session; permanent refusal stays local.
const sessionKey="suzini-e3-install-offered";
const sessionOffered=()=>{try{return sessionStorage.getItem(sessionKey)==='1';}catch{return false;}};
function later(){document.querySelector("#install-suggestion")?.remove();}
const refusalKey = 'suzini-etape3-install-declined';
let deferredPrompt = null;
let offered = false;
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isPublic = () => document.body.dataset.space === 'public';
const declined = () => { try { return localStorage.getItem(refusalKey) === '1'; } catch { return false; } };
function refuse() {
  try { localStorage.setItem(refusalKey, '1'); } catch { /* Storage unavailable: this visit only. */ }
  document.querySelector('#install-suggestion')?.remove();
}
function suggest() {
  if (!isPublic()) { document.querySelector('#install-suggestion')?.remove(); return; }
  if (offered || standalone() || declined() || sessionOffered()) return;
  offered = true;
  try{sessionStorage.setItem(sessionKey,'1');}catch{}
  const banner = document.createElement('aside');
  banner.id = 'install-suggestion';
  banner.setAttribute('aria-label', 'Ajouter à l’écran d’accueil');
  banner.innerHTML = `<img src="${iconUrl}" alt=""><div><strong>Vendredis Suzini sur votre écran d’accueil</strong><div class="install-actions"><button type="button" data-install>Ajouter</button><button type="button" class="install-later">Plus tard</button><button type="button" class="install-decline">Ne plus proposer</button></div></div>`;
  banner.querySelector('.install-decline').addEventListener('click', refuse);
  banner.querySelector('.install-later').addEventListener('click',later);
  document.body.append(banner);
}
function guide() {
  let dialog = document.querySelector('#install-guide');
  if (!dialog) {
    dialog = document.createElement('dialog'); dialog.id = 'install-guide';
    dialog.setAttribute('aria-labelledby', 'install-title'); document.body.append(dialog);
  }
  const apple = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(navigator.userAgent);
  const steps = standalone() ? '<p>Vous utilisez déjà Vendredis Suzini en mode application.</p>' : apple
    ? '<ol><li>Ouvrez ce site dans <strong>Safari</strong>.</li><li>Touchez <strong>Partager</strong> (le carré avec une flèche vers le haut).</li><li>Choisissez <strong>Sur l’écran d’accueil</strong>.</li><li>Activez <strong>Ouvrir comme app web</strong> si proposé, puis touchez <strong>Ajouter</strong>.</li></ol>'
    : android ? '<ol><li>Ouvrez ce site dans <strong>Chrome</strong>.</li><li>Ouvrez le menu <strong>⋮</strong>.</li><li>Choisissez <strong>Installer l’application</strong> ou <strong>Ajouter à l’écran d’accueil</strong>, puis confirmez.</li></ol>'
    : '<p>Sur téléphone, ouvrez le site dans Safari (iPhone) ou Chrome (Android), puis choisissez <strong>Sur l’écran d’accueil</strong> ou <strong>Installer l’application</strong> dans le menu du navigateur.</p><p>Sur ordinateur, utilisez l’option d’installation de votre navigateur si elle est disponible.</p>';
  dialog.innerHTML = `<img class="install-guide-icon" src="${iconUrl}" alt="Logo Vendredis Suzini TC Suzini"><h2 id="install-title">Vendredis Suzini, comme une appli</h2>${steps}<p class="install-note">Ouvrez ensuite l’icône Vendredis Suzini pour profiter du site sans les barres du navigateur. Une connexion Internet reste nécessaire.</p><form method="dialog"><button>Compris</button></form>`;
  if (!dialog.open) dialog.showModal();
}
async function install() {
  document.querySelector('#install-suggestion')?.remove();
  if (deferredPrompt && !standalone()) {
    const prompt = deferredPrompt; deferredPrompt = null;
    try { await prompt.prompt(); const choice = await prompt.userChoice; if (choice.outcome === 'dismissed') refuse(); }
    catch { guide(); }
  } else guide();
}
document.addEventListener('click', event => { if (event.target.closest('[data-install]')) install(); });
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferredPrompt = event; });
window.addEventListener('appinstalled', () => { deferredPrompt = null; document.querySelector('#install-suggestion')?.remove(); });
window.addEventListener('hashchange', suggest);
window.addEventListener('storage', event => { if (event.key === refusalKey && declined()) document.querySelector('#install-suggestion')?.remove(); });
matchMedia('(display-mode: standalone)').addEventListener('change', () => { if (standalone()) document.querySelector('#install-suggestion')?.remove(); });
suggest();
