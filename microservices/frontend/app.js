// init robusto: se il DOM è già pronto esegue subito, altrimenti aspetta
const ready = (fn) =>
  document.readyState !== 'loading'
    ? fn()
    : document.addEventListener('DOMContentLoaded', fn);

ready(() => {
  // Apri remoti in nuova scheda
  document.querySelectorAll('.btn[data-link]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      const url = btn.getAttribute('data-link') || '#';
      window.open(url, '_blank', 'noopener');
    });
  });

  // Dropdown
  const infoBtn  = document.getElementById('infoBtn');
  const infoMenu = document.getElementById('infoMenu');
  if (!infoBtn || !infoMenu) return; // guard

  // ARIA di base per menu button
  infoBtn.setAttribute('role', 'button');
  infoBtn.setAttribute('aria-haspopup', 'true');
  infoBtn.setAttribute('aria-expanded', 'false');

  const openMenu = () => {
    infoMenu.classList.add('open');
    infoBtn.setAttribute('aria-expanded', 'true');
    // porta il focus sul primo elemento del menu
    infoMenu.querySelector('[role="menuitem"]')?.focus();
  };

  const closeMenu = () => {
    infoMenu.classList.remove('open');
    infoBtn.setAttribute('aria-expanded', 'false');
  };

  infoBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // evita la chiusura immediata dal click esterno
    infoMenu.classList.contains('open') ? closeMenu() : openMenu();
  });

  // ⬇️ fix: usa contains() per includere anche i figli del bottone
  document.addEventListener('click', (e) => {
    if (!infoMenu.contains(e.target) && !infoBtn.contains(e.target)) closeMenu();
  });

  document.addEventListener('keydown', (e) => {
    // ESC chiude
    if (e.key === 'Escape') {
      if (infoMenu.classList.contains('open')) {
        closeMenu();
        infoBtn.focus();
      }
    }

    // Navigazione con frecce nel menu aperto
    if (infoMenu.classList.contains('open') && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      const items = Array.from(infoMenu.querySelectorAll('[role="menuitem"]'));
      if (!items.length) return;
      const idx = items.indexOf(document.activeElement);
      let next = 0;
      if (e.key === 'ArrowDown') next = idx >= 0 ? (idx + 1) % items.length : 0;
      else next = idx > 0 ? idx - 1 : items.length - 1;
      items[next]?.focus();
      e.preventDefault();
    }

    // Invio/Space attivano il bottone del menu
    if ((e.key === 'Enter' || e.key === ' ') && document.activeElement === infoBtn) {
      e.preventDefault();
      infoMenu.classList.contains('open') ? closeMenu() : openMenu();
    }
  });

  // Sezioni
  const launcher   = document.getElementById('launcher');
  const infoWrap   = document.getElementById('infoPage');
  const pageTitle  = document.getElementById('pageTitle');
  const backLink   = document.getElementById('backLink');
  const brandLogo  = document.getElementById('brandLogo');
  const infoTitle  = document.getElementById('infoTitle');
  const infoDesc   = document.getElementById('infoDesc');

  const INFO_PAGES = {
    giardinetto: {
      pageTitle: 'Giardinetto',
      heading: 'La Cooperativa Giardinetto',
      text: `
      Dal 1982 la Società Cooperativa Giardinetto aggrega i migliori produttori agricoli del foggiano per portare sulle tavole e nelle cucine di tutto il mondo ortaggi di qualità, controllati e certificati.
Giardinetto è un vero e proprio sistema integrato che cura ogni aspetto: dalla semina al raccolto, dallo stoccaggio al condizionamento. Tutte le produzioni sono sottoposte a rigidi controlli per assicurare la completa adesione ai disciplinari e al manuale di produzione Qualità Certificata che contraddistinguono la nostra cooperativa.
Coltiviamo frutta e ortaggi con esperienza pluridecennale garantendo la concentrazione del prodotto ed affidando la commercializzazione all’Organizzazione di Produttori Ortofrutticoli “Consorzio APO Foggia s.c.” che è presente, con la propria struttura, sui mercati nazionali ed esteri.
`,
      logo: `<img src="img/giardinetto.jpg" alt="Giardinetto — Soc. Coop. Agricola">`
    },
    opnatura: {
      pageTitle: 'OPNatura',
      heading: 'La Cooperativa OPNatura',
      text: `
      Siamo una società cooperativa agricola nata nel 2012. Uniamo 400 produttori ortofrutticoli su circa 1.600 ettari.
Il nostro obiettivo è valorizzare le produzioni dei soci con attenzione a qualità e sostenibilità (molte colture certificate bio).
Grazie ai nostri stabilimenti di confezionamento e stoccaggio, offriamo all’ingrosso un’ampia gamma di prodotti certificati: kiwi, arance, kaki, clementine, cipolle, finocchi, angurie, pesche e altri ancora.
`,
      logo: `<img src="img/opnatura.png" alt="OPNatura — Soc. Coop. Agricola">`
    },
    ecofoodchain: {
      pageTitle: 'Progetto EcoFoodChain',
      heading: 'EcoFoodChain: piattaforma smart per la sostenibilità agricola',
      text: `
      EcoFoodChain è una piattaforma modulare che aiuta le filiere ortofrutticole a essere più sostenibili, trasparenti e inclusive. L’obiettivo è misurare con precisione l’impatto ambientale delle produzioni grazie a sensori IoT e analisi dati, garantire tracciabilità end-to-end con registri distribuiti, sperimentare strumenti innovativi come digital twin, VR e metaverso per formare e supportare gli operatori, e valorizzare gli invenduti così da ridurre lo spreco tramite canali etici e solidali.

Nel launcher trovi le applicazioni che compongono l’ecosistema: 
- Filiera360 cura la tracciabilità e la qualità: registra prodotti e lotti su un registro permissioned, storicizza le pratiche sostenibili e rende disponibili consultazioni sicure agli attori autorizzati, offrendo trasparenza al mercato e ai consumatori. 
- Refood si occupa delle eccedenze alimentari: identifica i lotti prossimi al deperimento, li gestisce con finestre temporali e consente prenotazione e ritiro tracciati, guidando in modo semplice verso vendita a prezzo ribassato, trasformazione o, se necessario, smaltimento.
- SmartField integra i dati dei campi: mette insieme sensori suolo/meteo e fonti esterne, calcola indici ambientali e propone raccomandazioni operative (ad esempio per un’irrigazione più mirata) tramite interfaccia e chatbot, così che le decisioni siano realmente data-driven. 
- VR Academy propone percorsi guidati e simulazioni, diffondendo buone pratiche di coltivazione per la formazione del personale specializzato.
- Il Metaverso costruisce un gemello digitale della farm: ambienti 3D connessi ai dati reali, utili per scenari “what-if” e momenti di community con cooperative, soci e visitatori. 
- Infine, la Guida 3D racconta in modo visivo il ciclo di vita dei prodotti e le fasi fenologiche (come nel caso di kiwi e asparago) rendendo più chiari processi e passaggi della filiera.

Ogni app è indipendente e non condivide dati senza consenso. Dalla home ti basta premere “Apri” sulla card del modulo che vuoi esplorare per entrare nella relativa esperienza, con i suoi strumenti e le sue dashboard.`,
      logo: `<img src="img/logo.png" alt="EcoFoodChain — Progetto di filiera">`
    }
  };

  function showLauncher(){
    if (launcher) launcher.style.display = '';
    if (infoWrap) infoWrap.classList.remove('active');
    if (pageTitle) pageTitle.textContent = 'Scegli un modulo dell’ecosistema';
    history.replaceState(null, '', '#');
    // Rimetti il focus sul pulsante info per accessibilità
    infoBtn?.focus();
  }

  function renderInfo(kind){
    const d = INFO_PAGES[kind];
    if(!d) return;
    if (launcher) launcher.style.display = 'none';
    if (infoWrap) infoWrap.classList.add('active');
    if (pageTitle) pageTitle.textContent = d.pageTitle || '';
    if (infoTitle) infoTitle.textContent = d.heading || d.pageTitle || '';
    if (infoDesc) infoDesc.innerHTML = (d.text || '').replace(/\n/g, '<br>');
    if (brandLogo) brandLogo.innerHTML = d.logo || '';
    backLink?.focus();
  }

  // Hook menu
  infoMenu.querySelectorAll('[role="menuitem"]').forEach(item => {
    item.addEventListener('click', () => {
      const target = item.getAttribute('data-target');
      closeMenu();
      location.hash = `info/${target}`;
    });
  });

  backLink?.addEventListener('click', (e) => { e.preventDefault(); showLauncher(); });

  // Router hash
  function onRoute(){
    const h = (location.hash || '').replace(/^#\/?|#/, '');
    if (!h){ showLauncher(); return; }
    const [seg, val] = h.split('/');
    if (seg === 'info' && val) renderInfo(val);
    else showLauncher();
  }

  window.addEventListener('hashchange', onRoute);
  onRoute();
});
