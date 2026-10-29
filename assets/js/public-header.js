const EPREUVE_LABELS = {
  DM: "Double Messieurs",
  DD: "Double Dames",
  ALL: "Toutes les épreuves"
};

const EPREUVES = ["DM", "DD"];

const headerMount = document.getElementById("publicHeader");

const currentPage = location.pathname.split("/").pop() || "index.html";
const isPublicPage = location.pathname.includes("/public/");

const rootPath = isPublicPage ? "../" : "";
const publicPath = isPublicPage ? "" : "public/";

const needsZoneSelector = document.body.dataset.zoneSelector !== "none";

function navClass(page){
  return currentPage === page ? "public-nav-link primary" : "public-nav-link";
}

function getSavedZone(){
  let epreuve = "DM";

  try{
    const savedEpreuve = localStorage.getItem("suzini_etape3_public_epreuve");
    if(EPREUVES.includes(savedEpreuve)) epreuve = savedEpreuve;
  }catch(error){}

  return { categorie: "Seniors", epreuve };
}

function saveZone(epreuve){
  try{
    localStorage.setItem("suzini_etape3_public_epreuve", epreuve);
  }catch(error){}
}

function emitZoneChange(epreuve){
  document.dispatchEvent(new CustomEvent("publicZoneChange", {
    detail: {
      categorie: "Seniors",
      epreuve,
      label: EPREUVE_LABELS[epreuve] || "Toutes les épreuves"
    }
  }));
}

function injectStyles(){
  if(document.getElementById("publicHeaderStyles")) return;

  const style = document.createElement("style");
  style.id = "publicHeaderStyles";
  style.textContent = `
    :root{
      --palm:#0b7a3b;
      --palm-dark:#064d28;
      --palm-light:#15a658;
      --navy:#06284a;
      --navy-dark:#03172b;
      --sun:#ffd21f;
      --sun-dark:#f3b800;
      --sand:#f4d9a4;
      --container:1180px;

      --public-header-h:158px;
      --public-zone-gap:14px;
      --public-zone-h:58px;
      --public-total-top:230px;
    }

    .public-container{
      width:min(var(--container), calc(100% - 28px));
      margin:0 auto;
    }

    .public-site-header{
      position:fixed;
      top:0;
      left:0;
      right:0;
      z-index:1000;
      background:
        radial-gradient(circle at 8% 0%, rgba(255,210,31,.30), transparent 28%),
        radial-gradient(circle at 92% 0%, rgba(244,217,164,.22), transparent 28%),
        linear-gradient(135deg,var(--palm-dark),var(--palm),var(--palm-light));
      box-shadow:0 10px 26px rgba(6,77,40,.34);
      border-bottom:4px solid var(--sun);
    }

    .public-header-inner{
      min-height:var(--public-header-h);
      display:grid;
      grid-template-columns:80px 1fr 80px;
      grid-template-rows:auto auto;
      align-items:center;
      gap:10px 18px;
      padding:12px 0 14px;
    }

    .public-header-logo{
      width:80px;
      height:80px;
      display:flex;
      align-items:center;
      justify-content:center;
      background:transparent;
      border:none;
      box-shadow:none;
      border-radius:0;
    }

    .public-header-logo img{
      max-width:100%;
      max-height:100%;
      object-fit:contain;
      filter:drop-shadow(0 6px 10px rgba(0,0,0,.22));
    }

    .public-header-title{
      text-align:center;
      color:#fff;
      text-shadow:0 6px 18px rgba(0,0,0,.26);
    }

    .public-header-title strong{
      display:block;
      font-size:clamp(22px,4vw,42px);
      line-height:.95;
      letter-spacing:-.04em;
      text-transform:uppercase;
      font-weight:1000;
    }

    .public-header-title span{
      display:block;
      margin-top:6px;
      color:var(--sun);
      font-size:13px;
      font-weight:1000;
      text-transform:uppercase;
      letter-spacing:.08em;
    }

    .public-nav-wrap{
      grid-column:1 / 4;
      position:relative;
      overflow:hidden;
      padding:0 34px;
    }

    .public-nav-wrap::before{
      content:"";
      position:absolute;
      top:0;
      bottom:0;
      left:0;
      width:40px;
      z-index:2;
      pointer-events:none;
      background:linear-gradient(90deg, rgba(6,77,40,.98), rgba(6,77,40,0));
    }

    .public-nav-wrap::after{
      content:"";
      position:absolute;
      top:0;
      bottom:0;
      right:0;
      width:40px;
      z-index:2;
      pointer-events:none;
      background:linear-gradient(270deg, rgba(11,122,59,.98), rgba(11,122,59,0));
    }

    .public-nav-arrow{
      position:absolute;
      top:50%;
      transform:translateY(-50%);
      z-index:3;
      width:28px;
      height:28px;
      border-radius:999px;
      display:flex;
      align-items:center;
      justify-content:center;
      background:rgba(255,210,31,.96);
      color:var(--navy-dark);
      font-size:20px;
      font-weight:1000;
      box-shadow:0 6px 14px rgba(0,0,0,.20);
      pointer-events:none;
    }

    .public-nav-arrow.left{left:2px;}
    .public-nav-arrow.right{right:2px;}

    .public-nav{
      display:flex;
      gap:10px;
      overflow-x:auto;
      padding:2px 4px;
      scrollbar-width:none;
      -webkit-overflow-scrolling:touch;
      scroll-behavior:smooth;
    }

    .public-nav::-webkit-scrollbar{display:none;}

    .public-nav-link{
      flex:0 0 auto;
      min-height:42px;
      padding:10px 17px;
      border-radius:999px;
      background:rgba(255,255,255,.92);
      color:var(--navy);
      font-size:14px;
      font-weight:900;
      white-space:nowrap;
      box-shadow:0 8px 16px rgba(0,0,0,.14);
      text-decoration:none;
    }

    .public-nav-link.primary{
      background:linear-gradient(180deg,var(--sun),var(--sun-dark));
      color:var(--navy-dark);
      box-shadow:0 10px 20px rgba(255,210,31,.22);
    }

    .public-zonebar{
      position:fixed;
      top:calc(var(--public-header-h) + var(--public-zone-gap));
      left:0;
      right:0;
      z-index:998;
      background:
        radial-gradient(circle at 8% 0%, rgba(255,210,31,.28), transparent 28%),
        radial-gradient(circle at 92% 0%, rgba(244,217,164,.20), transparent 28%),
        linear-gradient(135deg,var(--navy-dark),var(--navy),var(--palm));
      box-shadow:0 8px 18px rgba(16,24,40,.12);
      border-bottom:2px solid var(--sun);
      padding:12px 0 14px;
    }

    .public-zone-inner{
      display:grid;
      gap:8px;
    }

    .public-zone-line{
      display:flex;
      justify-content:center;
      align-items:center;
      gap:10px;
      overflow-x:auto;
      scrollbar-width:none;
      -webkit-overflow-scrolling:touch;
      padding:3px 2px;
    }

    .public-zone-line::-webkit-scrollbar{display:none;}

    .public-zone-btn{
      flex:0 0 auto;
      min-height:34px;
      padding:7px 18px;
      border-radius:999px;
      border:1px solid rgba(255,255,255,.32);
      background:rgba(255,255,255,.88);
      color:var(--navy-dark);
      font-size:13px;
      font-weight:1000;
      cursor:pointer;
      box-shadow:0 5px 12px rgba(16,24,40,.10);
      touch-action:manipulation;
      text-align:center;
      white-space:nowrap;
      font-family:inherit;
    }

    .public-zone-btn[aria-selected="true"],
    .public-zone-btn.all-active,
    .public-zone-btn.all-active[aria-selected="true"]{
      background:linear-gradient(180deg,var(--sun),var(--sun-dark));
      color:var(--navy-dark);
      border-color:var(--sun);
      box-shadow:0 8px 18px rgba(255,210,31,.22);
    }

    .public-zone-btn:disabled{
      cursor:default;
      opacity:1;
    }

    @media (min-width:760px){
      .public-header-inner{
        grid-template-columns:100px 1fr 100px;
      }

      .public-header-logo{
        width:96px;
        height:80px;
      }
    }

    @media (max-width:759px){
      :root{
        --public-header-h:150px;
        --public-zone-gap:14px;
        --public-zone-h:58px;
        --public-total-top:222px;
      }

      .public-zone-line{
        justify-content:flex-start;
      }
    }
  `;
  document.head.appendChild(style);
}

function centerActiveNav(){
  const nav = document.querySelector(".public-nav");
  const active = document.querySelector(".public-nav-link.primary");

  if(!nav || !active) return;

  const navRect = nav.getBoundingClientRect();
  const activeRect = active.getBoundingClientRect();
  const activeCenter = active.offsetLeft + (activeRect.width / 2);
  const target = activeCenter - (navRect.width / 2);

  nav.scrollTo({
    left: Math.max(0, target),
    behavior: "auto"
  });
}

function centerActiveNavAfterLoad(){
  centerActiveNav();
  requestAnimationFrame(centerActiveNav);
  setTimeout(centerActiveNav, 80);
  setTimeout(centerActiveNav, 250);
  setTimeout(centerActiveNav, 600);
}

function renderHeader(){
  if(!headerMount) return;

  const zone = getSavedZone();

  headerMount.innerHTML = `
    <header class="public-site-header">
      <div class="public-container public-header-inner">
        <div class="public-header-logo">
          <img src="${rootPath}assets/img/logo-suzini.png" alt="Tennis Club de Suzini">
        </div>

        <div class="public-header-title">
          <strong>Vendredis BT Suzini</strong>
          <span>6 nov. 2026 · Étape 3</span>
        </div>

        <div class="public-header-logo">
          <img src="${rootPath}assets/img/logo-julyana.png" alt="Jul’Yana BT">
        </div>

        <div class="public-nav-wrap">
          <span class="public-nav-arrow left">‹</span>
          <nav class="public-nav" aria-label="Navigation publique">
            <a class="${currentPage === "index.html" ? "public-nav-link primary" : "public-nav-link"}" href="${rootPath}index.html">🏠 Accueil</a>
            <a class="${navClass("inscriptions.html")}" href="${publicPath}inscriptions.html">📝 Inscription</a>
            <a class="${navClass("equipes.html")}" href="${publicPath}equipes.html">👥 Équipes</a>
            <a class="${navClass("animations.html")}" href="${publicPath}animations.html">🎉 Animations</a>
            <a class="${navClass("programmation.html")}" href="${publicPath}programmation.html">📅 Programmation</a>
            <a class="${navClass("matchs-direct.html")}" href="${publicPath}matchs-direct.html">🔴 Match en direct</a>
            <a class="${navClass("reglement.html")}" href="${publicPath}reglement.html">📘 Règlement</a>
            <a class="${navClass("tirage.html")}" href="${publicPath}tirage.html">🎲 Tirage</a>
            <a class="${navClass("restauration.html")}" href="${publicPath}restauration.html">🍽️ Restauration</a>
            <a class="${navClass("contact.html")}" href="${publicPath}contact.html">📩 Contact</a>
          </nav>
          <span class="public-nav-arrow right">›</span>
        </div>
      </div>
    </header>

    <section class="public-zonebar">
      <div class="public-container public-zone-inner">
        <div class="public-zone-line" aria-label="Sélection épreuve">
          <button
            class="public-zone-btn ${needsZoneSelector ? "" : "all-active"}"
            type="button"
            data-public-epreuve="DM"
            aria-selected="${needsZoneSelector ? String(zone.epreuve === "DM") : "true"}"
            ${needsZoneSelector ? "" : "disabled"}
          >👨 Double Messieurs</button>

          <button
            class="public-zone-btn ${needsZoneSelector ? "" : "all-active"}"
            type="button"
            data-public-epreuve="DD"
            aria-selected="${needsZoneSelector ? String(zone.epreuve === "DD") : "true"}"
            ${needsZoneSelector ? "" : "disabled"}
          >👩 Double Dames</button>
        </div>
      </div>
    </section>
  `;

  if(needsZoneSelector){
    bindZoneButtons(zone.epreuve);
  }else{
    emitZoneChange("ALL");
  }

  centerActiveNavAfterLoad();

  window.addEventListener("resize", () => {
    centerActiveNavAfterLoad();
  });
}

function bindZoneButtons(initialEpreuve){
  let epreuve = initialEpreuve;

  const epreuveBtns = [...document.querySelectorAll("[data-public-epreuve]")];

  function refresh(){
    epreuveBtns.forEach(btn => {
      btn.setAttribute("aria-selected", btn.dataset.publicEpreuve === epreuve ? "true" : "false");
    });

    saveZone(epreuve);
    emitZoneChange(epreuve);
  }

  epreuveBtns.forEach(btn => {
    btn.onclick = () => {
      epreuve = btn.dataset.publicEpreuve;
      refresh();
    };
  });

  refresh();
}

injectStyles();
renderHeader();
