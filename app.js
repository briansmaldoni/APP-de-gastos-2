    const API_URL = "https://script.google.com/macros/s/AKfycbxqMkqNgYqcdliQkmz4foC-g6RvI9OGOw-Kai3fnltL-A9dpZC4frGYDsX7TIMxzW0R/exec"; 
    
    let currentUser = "Brian";
    let state = { hb: 0, bs: 0, movements: [], config: { paydate: "", themeBrian: "", themeVirginia: "", lastProcessedDate: "" } };
    
    let currentProyMonth = "Enero";
    let proyeccionesData = [];
    let dolarUSD = 1200;
    let sueldoBaseBrian = 1559009.85;
    let sueldoBaseVirginia = 0;
    let serviciosGlobales = [];

    const ALL_MESES = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo [Premio]", "Junio [SAC]",
      "Julio", "Agosto [Premio]", "Septiembre", "Octubre", "Noviembre [Premio]", "Diciembre [SAC]"
    ];

    const CATEGORIAS_GASTOS = [
      { id: "transporte", name: "🚌 Transporte" },
      { id: "tarjeta", name: "💳 Tarjetas & Créditos" },
      { id: "salud", name: "🏥 Salud & Bienestar" },
      { id: "hogar", name: "🏠 Hogar & Servicios" },
      { id: "otros", name: "📌 Varios / Otros" }
    ];

    let feriadosOficiales = ["2026-01-01", "2026-03-24", "2026-04-02", "2026-05-01", "2026-05-25", "2026-06-20", "2026-07-09", "2026-08-17", "2026-10-12", "2026-11-20", "2026-12-25"];
    let pendingRolloverAmount = 0;
    let pendingRolloverDate = "";

    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }

    function handleInputFocus(input) {
      let val = input.value.toString().trim();
      if (val === '0' || val === '0.00' || val === '0,00' || val === '$ 0,00' || val === '$ 0.00') {
        input.value = '';
      }
    }

    function handleInputBlur(input) {
      let val = input.value.toString().trim();
      if (val === '' || val === '-') {
        input.value = '0';
      }
    }

    function formatLiveCurrencyInput(input) {
      let rawVal = input.value;
      rawVal = rawVal.replace(/\.(?=\d{0,2}$)/, ',');
      let isNegative = rawVal.trim().startsWith('-');
      let parts = rawVal.split(',');
      let integerPart = parts[0].replace(/\D/g, ''); 
      if (integerPart === '') {
        input.value = (isNegative ? '-' : '') + (parts.length > 1 ? '0,' + parts[1].replace(/\D/g, '') : '');
        return;
      }
      let formattedInteger = new Intl.NumberFormat('es-AR').format(parseInt(integerPart));
      let finalVal = (isNegative ? '-' : '') + formattedInteger;
      if (parts.length > 1) {
        finalVal += ',' + parts[1].replace(/\D/g, '').slice(0, 2);
      }
      input.value = finalVal;
    }

    function parseAmountInput(val) {
      if (!val) return 0;
      let clean = val.toString().trim();
      let isNeg = clean.startsWith('-');
      clean = clean.replace(/[^\d,]/g, '').replace(',', '.'); 
      let parsed = parseFloat(clean); 
      if (isNaN(parsed)) return 0;
      return isNeg ? -parsed : parsed;
    }

    function toggleDrawer() { document.getElementById('drawer-menu').classList.toggle('hidden'); }

    function switchView(view) {
      document.getElementById('view-diario').classList.add('hidden');
      document.getElementById('view-proyeccion').classList.add('hidden');
      const btnD = document.getElementById('nav-btn-diario');
      const btnP = document.getElementById('nav-btn-proyeccion');

      if (view === 'diario') {
        document.getElementById('view-diario').classList.remove('hidden');
        btnD.className = "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-xs bg-accent text-white shadow";
        btnP.className = "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-xs text-muted hover:bg-slate-800/50 transition-all";
      } else {
        document.getElementById('view-proyeccion').classList.remove('hidden');
        btnP.className = "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-xs bg-accent text-white shadow";
        btnD.className = "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-xs text-muted hover:bg-slate-800/50 transition-all";
        fetchProyecciones();
        
        setTimeout(() => {
          const container = document.getElementById('month-swipe-container');
          if(container) {
             let activeBtn = container.querySelector('.bg-accent');
             if (activeBtn) activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          }
        }, 50);
      }
      toggleDrawer();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function guardarEnCache() {
      let cacheData = { user: currentUser, config: state.config };
      localStorage.setItem('cfg_fast_cache', JSON.stringify(cacheData));
    }

    function cargarDesdeCache() {
      const cacheStr = localStorage.getItem('cfg_fast_cache');
      if (cacheStr) {
         let cache = JSON.parse(cacheStr);
         state.config = cache.config || { paydate: "", themeBrian: "", themeVirginia: "", lastProcessedDate: "" };
         
         if (state.config.paydate && state.config.paydate.length > 10) state.config.paydate = state.config.paydate.substring(0, 10);
         if (state.config.lastProcessedDate && state.config.lastProcessedDate.length > 10) state.config.lastProcessedDate = state.config.lastProcessedDate.substring(0, 10);

         setUser(cache.user || 'Brian');
      } else {
         const savedUser = localStorage.getItem('cfg_user');
         setUser(savedUser ? savedUser : 'Brian');
      }
    }

    async function cargarFeriadosAPI() {
      try {
        let year = new Date().getFullYear();
        let res = await fetch(`https://nolaborables.com.ar/api/v2/feriados/${year}`); let data = await res.json();
        feriadosOficiales = data.map(f => { let m = ('0' + f.mes).slice(-2); let d = ('0' + f.dia).slice(-2); return `${year}-${m}-${d}`; });
      } catch(e) { console.log("Feriados Offline"); }
    }

    // 50 TEMAS RECALIBRADOS CON LEGIBILIDAD GARANTIZADA
    const THEME_GROUPS = [
      {
        label: "Escala de Grises & Oscuros Sobrios",
        options: [
          { id: "dark-obsidian", name: "🖤 Obsidiana Minimal", vals: { accent: "#38bdf8", bg: "#090d16", card: "#111726", border: "#1e293b", isLight: false } },
          { id: "dark-slate", name: "📓 Pizarra Grafito", vals: { accent: "#60a5fa", bg: "#0f172a", card: "#1e293b", border: "#334155", isLight: false } },
          { id: "dark-charcoal", name: "🌑 Carbón Puro", vals: { accent: "#38bdf8", bg: "#121212", card: "#1e1e1e", border: "#333333", isLight: false } },
          { id: "dark-titanium", name: "⚙️ Titanio Nocturno", vals: { accent: "#94a3b8", bg: "#0a0a0c", card: "#141418", border: "#2e2e38", isLight: false } },
          { id: "dark-monochrome", name: "🏁 Monocromo Puro", vals: { accent: "#ffffff", bg: "#000000", card: "#141414", border: "#333333", isLight: false } },
          { id: "dark-zinc", name: "🪨 Cinc Profundo", vals: { accent: "#a1a1aa", bg: "#09090b", card: "#18181b", border: "#3f3f46", isLight: false } },
          { id: "dark-steel", name: "🗡️ Acero Oscuro", vals: { accent: "#cbd5e1", bg: "#0b0f19", card: "#161e2e", border: "#334155", isLight: false } },
          { id: "dark-ash", name: "🌋 Ceniza", vals: { accent: "#e2e8f0", bg: "#111315", card: "#1b1e22", border: "#373e47", isLight: false } },
          { id: "dark-midnight", name: "🌃 Medianoche Clean", vals: { accent: "#38bdf8", bg: "#020617", card: "#0f172a", border: "#1e293b", isLight: false } },
          { id: "dark-void", name: "🌌 Vacío Profundo", vals: { accent: "#818cf8", bg: "#030712", card: "#111827", border: "#374151", isLight: false } }
        ]
      },
      {
        label: "Minimalismo Azul & Frecuencias Frías",
        options: [
          { id: "blue-nordic", name: "❄️ Azul Nórdico", vals: { accent: "#38bdf8", bg: "#0b1329", card: "#132247", border: "#224180", isLight: false } },
          { id: "blue-sapphire", name: "🔷 Zafiro Elegante", vals: { accent: "#60a5fa", bg: "#07111e", card: "#0f1f38", border: "#214375", isLight: false } },
          { id: "blue-atlantic", name: "🌊 Atlántico", vals: { accent: "#22d3ee", bg: "#081a24", card: "#102a3a", border: "#22516d", isLight: false } },
          { id: "blue-cobalt", name: "🧿 Cobalto Profundo", vals: { accent: "#818cf8", bg: "#0d1127", card: "#171e40", border: "#2d3a7c", isLight: false } },
          { id: "blue-arctic", name: "🧊 Ártico Sobrio", vals: { accent: "#7dd3fc", bg: "#0c192c", card: "#162944", border: "#2e507d", isLight: false } },
          { id: "blue-indigo", name: "🪻 Índigo Soft", vals: { accent: "#a5b4fc", bg: "#0e132c", card: "#192147", border: "#314187", isLight: false } },
          { id: "blue-deepsky", name: "🌌 Cielo Profundo", vals: { accent: "#38bdf8", bg: "#06131e", card: "#0f2334", border: "#204666", isLight: false } },
          { id: "blue-denim", name: "👖 Denim Minimal", vals: { accent: "#93c5fd", bg: "#101726", card: "#1c2840", border: "#344a73", isLight: false } },
          { id: "blue-glacier", name: "🏔️ Glaciar", vals: { accent: "#a5f3fc", bg: "#0a192f", card: "#172a45", border: "#2a4a78", isLight: false } },
          { id: "blue-abyss", name: "⚓ Abismo", vals: { accent: "#60a5fa", bg: "#030a16", card: "#0a162b", border: "#1a3666", isLight: false } }
        ]
      },
      {
        label: "Verdes Orgánicos & Salvia",
        options: [
          { id: "green-sage", name: "🍃 Salvia Minimal", vals: { accent: "#4ade80", bg: "#09140e", card: "#12241b", border: "#264a38", isLight: false } },
          { id: "green-emerald", name: "💚 Esmeralda Mate", vals: { accent: "#34d399", bg: "#061510", card: "#0d261e", border: "#1f4f3f", isLight: false } },
          { id: "green-forest", name: "🌲 Bosque Sobrio", vals: { accent: "#22c55e", bg: "#05130b", card: "#0c2215", border: "#1d472d", isLight: false } },
          { id: "green-olive", name: "🫒 Olivo Profundo", vals: { accent: "#a3e635", bg: "#10140a", card: "#1b2212", border: "#374527", isLight: false } },
          { id: "green-mint", name: "🌿 Menta Oscuro", vals: { accent: "#2dd4bf", bg: "#061413", card: "#0e2523", border: "#214a46", isLight: false } },
          { id: "green-botanical", name: "🪴 Botánico", vals: { accent: "#86efac", bg: "#08130c", card: "#122317", border: "#274a31", isLight: false } },
          { id: "green-moss", name: "🪨 Musgo Mate", vals: { accent: "#a3e635", bg: "#0f130c", card: "#1a2215", border: "#35452b", isLight: false } },
          { id: "green-eucalyptus", name: "🌱 Eucalipto", vals: { accent: "#6ee7b7", bg: "#071411", card: "#102520", border: "#234c43", isLight: false } },
          { id: "green-pine", name: "🌲 Pino Nocturno", vals: { accent: "#4ade80", bg: "#041209", card: "#0a2012", border: "#1a4428", isLight: false } },
          { id: "green-tea", name: "🍵 Té Verde", vals: { accent: "#bef264", bg: "#101409", card: "#1c2411", border: "#3a4a24", isLight: false } }
        ]
      },
      {
        label: "Cálidos Elegantes, Ámbar & Moka",
        options: [
          { id: "warm-amber", name: "🟠 Ámbar Mate", vals: { accent: "#fbbf24", bg: "#141008", card: "#241d0f", border: "#4a3c1f", isLight: false } },
          { id: "warm-coffee", name: "☕ Café Latte", vals: { accent: "#f97316", bg: "#140e0a", card: "#241a12", border: "#4a3525", isLight: false } },
          { id: "warm-copper", name: "🥉 Cobre Pulido", vals: { accent: "#f97316", bg: "#160d08", card: "#26170e", border: "#4f311f", isLight: false } },
          { id: "warm-bronze", name: "🏺 Bronce Antiguo", vals: { accent: "#fbbf24", bg: "#130f0a", card: "#221a11", border: "#473623", isLight: false } },
          { id: "warm-terracotta", name: "🧱 Terracota Soft", vals: { accent: "#fb923c", bg: "#160e0a", card: "#271811", border: "#4f3123", isLight: false } },
          { id: "warm-sand", name: "🏖️ Arena Nocturna", vals: { accent: "#fde047", bg: "#14120a", card: "#232011", border: "#474223", isLight: false } },
          { id: "warm-cinnamon", name: "🫔 Canela Mate", vals: { accent: "#f97316", bg: "#160c07", card: "#26150c", border: "#4f2b19", isLight: false } },
          { id: "warm-mahogany", name: "🪵 Caoba Sobrio", vals: { accent: "#f97316", bg: "#130a07", card: "#22120b", border: "#472417", isLight: false } },
          { id: "warm-caramel", name: "🍯 Caramelo Profundo", vals: { accent: "#fbbf24", bg: "#151006", card: "#251c0b", border: "#4c3816", isLight: false } },
          { id: "warm-sepia", name: "📜 Sepia Elegante", vals: { accent: "#fde047", bg: "#12100a", card: "#201c12", border: "#423a25", isLight: false } }
        ]
      },
      {
        label: "Claros Minimalistas & Pulcros",
        options: [
          { id: "light-titanium", name: "🩶 Titanio Claro", vals: { accent: "#2563eb", bg: "#f1f5f9", card: "#ffffff", border: "#cbd5e1", isLight: true } },
          { id: "light-paper", name: "📄 Papel Blanco", vals: { accent: "#0284c7", bg: "#f8fafc", card: "#ffffff", border: "#cbd5e1", isLight: true } },
          { id: "light-cotton", name: "☁️ Algodón", vals: { accent: "#0284c7", bg: "#f1f5f9", card: "#ffffff", border: "#cbd5e1", isLight: true } },
          { id: "light-ivory", name: "🦴 Marfil Minimal", vals: { accent: "#d97706", bg: "#fefcf6", card: "#ffffff", border: "#e2d9be", isLight: true } },
          { id: "light-sand", name: "⌛ Arena Clara", vals: { accent: "#d97706", bg: "#fefbf3", card: "#ffffff", border: "#e2d6b5", isLight: true } },
          { id: "light-mint", name: "🍃 Menta Puro", vals: { accent: "#059669", bg: "#f0fdf4", card: "#ffffff", border: "#a7f3d0", isLight: true } },
          { id: "light-sky", name: "🌤️ Cielo Claro", vals: { accent: "#0284c7", bg: "#f0f9ff", card: "#ffffff", border: "#bae6fd", isLight: true } },
          { id: "light-lavender", name: "🪻 Lavanda Soft", vals: { accent: "#7c3aed", bg: "#fcfaff", card: "#ffffff", border: "#ddd6fe", isLight: true } },
          { id: "light-monochrome", name: "🔲 Monocromo Claro", vals: { accent: "#000000", bg: "#e2e8f0", card: "#ffffff", border: "#cbd5e1", isLight: true } },
          { id: "light-studio", name: "🎨 Estudio", vals: { accent: "#2563eb", bg: "#f1f5f9", card: "#ffffff", border: "#cbd5e1", isLight: true } }
        ]
      }
    ];

    function populateThemeSelect() {
      const select = document.getElementById('cfg-preset'); select.innerHTML = "";
      THEME_GROUPS.forEach(group => {
        let optgroup = document.createElement('optgroup'); optgroup.label = group.label;
        group.options.forEach(opt => {
          let option = document.createElement('option'); option.value = opt.id; option.innerText = opt.name; optgroup.appendChild(option);
        });
        select.appendChild(optgroup);
      });
      let customGroup = document.createElement('optgroup'); customGroup.label = "Personalizado";
      let customOpt = document.createElement('option'); customOpt.value = "custom"; customOpt.innerText = "🎨 Crear mi propio tema...";
      customGroup.appendChild(customOpt); select.appendChild(customGroup);
    }

    function getThemeValues(id) {
      for(let g of THEME_GROUPS) { let found = g.options.find(o => o.id === id); if(found) return found.vals; } return null;
    }

    function formatMoney(amount) {
      if (isNaN(amount) || amount === null) amount = 0;
      return `$ ${new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}`;
    }

    function toLocalISODate(d) {
      const z = n => ('0' + n).slice(-2); return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
    }

    function getSecondBusinessDay(year, month) {
      let count = 0; let day = 1;
      while (count < 2) {
        let date = new Date(year, month, day); let formatted = toLocalISODate(date);
        if (date.getDay() !== 0 && date.getDay() !== 6 && !feriadosOficiales.includes(formatted)) count++;
        if (count < 2) day++;
      }
      return new Date(year, month, day);
    }

    function getRemainingDates() {
      const today = new Date();
      let payDateStr = state.config.paydate; let payDate;
      if (payDateStr && payDateStr !== "") {
        let parts = payDateStr.split('-'); payDate = new Date(parts[0], parts[1] - 1, parts[2]);
        if (toLocalISODate(today) >= toLocalISODate(payDate)) {
          payDate = new Date(parts[0], parseInt(parts[1]), parts[2]);
        }
      } else {
        payDate = getSecondBusinessDay(today.getFullYear(), today.getMonth());
        if (toLocalISODate(today) >= toLocalISODate(payDate)) {
          payDate = getSecondBusinessDay(today.getFullYear(), today.getMonth() + 1);
        }
      }
      let dates = []; let currentDate = new Date(today);
      while(toLocalISODate(currentDate) < toLocalISODate(payDate)) { dates.push(toLocalISODate(currentDate)); currentDate.setDate(currentDate.getDate() + 1); }
      if(dates.length === 0) dates.push(toLocalISODate(today)); 
      return dates;
    }

    function getRemainingDatesFrom(startDateStr) {
      let parts = startDateStr.split('-');
      let startDate = new Date(parts[0], parts[1] - 1, parts[2]);
      
      let payDateStr = state.config.paydate; let payDate;
      if (payDateStr && payDateStr !== "") {
        let pParts = payDateStr.split('-'); 
        payDate = new Date(pParts[0], pParts[1] - 1, pParts[2]);
        
        while (toLocalISODate(startDate) >= toLocalISODate(payDate)) {
          payDate.setMonth(payDate.getMonth() + 1);
        }
      } else {
        payDate = getSecondBusinessDay(startDate.getFullYear(), startDate.getMonth());
        if (toLocalISODate(startDate) >= toLocalISODate(payDate)) {
          payDate = getSecondBusinessDay(startDate.getFullYear(), startDate.getMonth() + 1);
        }
      }
      let dates = []; let currentDate = new Date(startDate);
      while(toLocalISODate(currentDate) < toLocalISODate(payDate)) { dates.push(toLocalISODate(currentDate)); currentDate.setDate(currentDate.getDate() + 1); }
      if(dates.length === 0) dates.push(toLocalISODate(startDate)); 
      return dates;
    }

    async function init() {
      populateThemeSelect(); cargarDesdeCache();
      
      const curMonthIdx = new Date().getMonth();
      currentProyMonth = ALL_MESES[curMonthIdx];
      renderMonthSwipeSelector();

      const todayStr = toLocalISODate(new Date());
      document.getElementById('u-fecha').value = todayStr; document.getElementById('d-fecha').value = todayStr; document.getElementById('a-fecha').value = todayStr;
      setupEnterNavigation(); 
      await cargarFeriadosAPI(); 
      window.scrollTo(0,0);
      fetchData(true); 
    }

    function setUser(user) {
      currentUser = user; localStorage.setItem('cfg_user', user);
      const lblUser = document.getElementById('active-user');
      const btnB = document.getElementById('user-brian'); const btnV = document.getElementById('user-virginia');
      const lblUserTheme = document.getElementById('user-theme-label');

      if(user === "Brian") {
        lblUser.innerHTML = `<span class="t-accent font-semibold">Brian</span>`; 
        if(lblUserTheme) { lblUserTheme.innerText = "Brian"; lblUserTheme.className = "t-accent font-semibold"; }
        btnB.className = "px-4 py-1.5 text-xs rounded-full bg-accent text-white font-medium shadow-sm transition-all focus:outline-none";
        btnV.className = "px-4 py-1.5 text-xs rounded-full card-clean text-muted hover:bg-slate-800 transition-all font-medium focus:outline-none";
      } else {
        lblUser.innerHTML = `<span class="t-accent font-semibold">Virginia</span>`; 
        if(lblUserTheme) { lblUserTheme.innerText = "Virginia"; lblUserTheme.className = "t-accent font-semibold"; }
        btnV.className = "px-4 py-1.5 text-xs rounded-full bg-accent text-white font-medium shadow-sm transition-all focus:outline-none";
        btnB.className = "px-4 py-1.5 text-xs rounded-full card-clean text-muted hover:bg-slate-800 transition-all font-medium focus:outline-none";
      }
      applySavedConfig(); guardarEnCache();
    }

    function openConfigModal() {
      document.getElementById('modal-config').classList.remove('hidden');
      const isAuto = !state.config.paydate;
      document.getElementById('cfg-auto-date').checked = isAuto; document.getElementById('cfg-manual-date').value = isAuto ? "" : state.config.paydate; toggleAutoDate();

      let tStr = (currentUser === "Brian") ? state.config.themeBrian : state.config.themeVirginia;
      if(!tStr) { document.getElementById('cfg-preset').value = "dark-obsidian"; applyPreset(); }
      else if(tStr.startsWith("{")) {
         let tObj = JSON.parse(tStr);
         if(tObj.preset && getThemeValues(tObj.preset)) { document.getElementById('cfg-preset').value = tObj.preset; applyPreset(); }
         else {
           document.getElementById('cfg-preset').value = "custom";
           document.getElementById('col-accent').value = tObj.accent || "#38bdf8"; 
           document.getElementById('col-bg').value = tObj.bg || "#090d16";
           document.getElementById('col-card').value = tObj.card || "#111726";
           document.getElementById('col-border').value = tObj.border || "#1e293b";
           document.getElementById('col-islight').checked = tObj.isLight || false;
           applyPreset();
         }
      }
    }
    
    function closeConfigModal() { document.getElementById('modal-config').classList.add('hidden'); applySavedConfig(); }
    
    // Función actualizada para Headless UI Tabs style
    function switchCfgTab(tabId) {
      document.getElementById('cfg-fecha').classList.add('hidden'); document.getElementById('cfg-tema').classList.add('hidden'); document.getElementById(tabId).classList.remove('hidden');
      document.getElementById('btn-cfg-fecha').className = tabId === 'cfg-fecha' ? "w-full rounded-lg py-2 text-xs font-medium bg-accent text-white shadow transition-all focus:outline-none" : "w-full rounded-lg py-2 text-xs font-medium text-muted hover:bg-slate-800/40 hover:text-main transition-all focus:outline-none";
      document.getElementById('btn-cfg-tema').className = tabId === 'cfg-tema' ? "w-full rounded-lg py-2 text-xs font-medium bg-accent text-white shadow transition-all focus:outline-none" : "w-full rounded-lg py-2 text-xs font-medium text-muted hover:bg-slate-800/40 hover:text-main transition-all focus:outline-none";
    }

    function toggleAutoDate() { const isAuto = document.getElementById('cfg-auto-date').checked; document.getElementById('cfg-manual-box').classList.toggle('hidden', isAuto); }

    function applyPreset() {
      const preset = document.getElementById('cfg-preset').value; const cBox = document.getElementById('cfg-colors-box');
      if (preset === "custom") {
         cBox.classList.remove('hidden');
         updateDOMTheme({ accent: document.getElementById('col-accent').value, bg: document.getElementById('col-bg').value, card: document.getElementById('col-card').value, border: document.getElementById('col-border').value, isLight: document.getElementById('col-islight').checked });
      } else {
         cBox.classList.add('hidden'); updateDOMTheme(getThemeValues(preset));
      }
    }

    function updateDOMTheme(colors) {
      if(!colors) return;
      document.documentElement.style.setProperty('--c-accent', colors.accent); 
      document.documentElement.style.setProperty('--c-bg', colors.bg); 
      document.documentElement.style.setProperty('--c-card', colors.card);
      document.documentElement.style.setProperty('--c-card-border', colors.border);
      
      const body = document.getElementById('app-body');
      if(colors.isLight) { 
        body.classList.remove('dark'); 
        body.classList.add('theme-light'); 
      } else { 
        body.classList.add('dark'); 
        body.classList.remove('theme-light'); 
      }
    }

    function applySavedConfig() {
      let tStr = (currentUser === "Brian") ? state.config.themeBrian : state.config.themeVirginia;
      if(tStr && tStr.startsWith("{")) { 
         let tObj = JSON.parse(tStr); 
         if(tObj.preset && getThemeValues(tObj.preset)) updateDOMTheme(getThemeValues(tObj.preset)); 
         else updateDOMTheme(tObj);
      } else { updateDOMTheme(getThemeValues('dark-obsidian')); }
    }

    function saveConfiguration() {
      const isAuto = document.getElementById('cfg-auto-date').checked;
      const paydate = isAuto ? "" : document.getElementById('cfg-manual-date').value;
      const preset = document.getElementById('cfg-preset').value;
      let themeData = { preset: preset };
      if(preset === "custom") { 
        themeData = { 
          accent: document.getElementById('col-accent').value, 
          bg: document.getElementById('col-bg').value, 
          card: document.getElementById('col-card').value, 
          border: document.getElementById('col-border').value, 
          isLight: document.getElementById('col-islight').checked 
        }; 
      }

      let themeJson = JSON.stringify(themeData);
      state.config.paydate = paydate; 
      if(currentUser === "Brian") state.config.themeBrian = themeJson; else state.config.themeVirginia = themeJson;
      
      applySavedConfig(); guardarEnCache();
      syncBackend({ action: "updateConfig", user: currentUser, paydate: paydate, theme: themeJson });
      document.getElementById('modal-config').classList.add('hidden'); render();
    }

    function manualSync() { 
      document.getElementById('btn-top-sync').classList.add('hidden');
      document.getElementById('sync-status').classList.remove('hidden');
      fetchData(true); 
    }

    // Función actualizada para Headless UI Tabs style
    function switchTab(tabId) {
      document.querySelectorAll('.nav-form').forEach(f => f.classList.add('hidden')); document.getElementById(tabId).classList.remove('hidden');
      ['unico', 'divisible', 'ajuste'].forEach(t => {
        const btn = document.getElementById(`btn-tab-${t}`);
        if (`tab-${t}` === tabId) btn.className = "w-full rounded-lg py-2.5 text-xs font-medium leading-5 bg-accent text-white shadow transition-all focus:outline-none";
        else btn.className = "w-full rounded-lg py-2.5 text-xs font-medium leading-5 text-muted hover:bg-slate-800/40 hover:text-main transition-all focus:outline-none";
      });
    }

    function openCalendarModal() { renderCalendarModal(); document.getElementById('modal-calendario').classList.remove('hidden'); }
    function closeCalendarModal() { document.getElementById('modal-calendario').classList.add('hidden'); }
    function focusUpdateHB() { document.getElementById('hb-quick-modal').classList.remove('hidden'); document.getElementById('input-hb-update').value = ""; document.getElementById('input-hb-update').focus(); }
    function closeHBUpdate() { document.getElementById('hb-quick-modal').classList.add('hidden'); }

    function saveHBUpdate() {
      const val = parseAmountInput(document.getElementById('input-hb-update').value);
      if (val > 0) { state.hb = val; syncBackend({ action: "updateHB", hb: state.hb }); render(); }
      closeHBUpdate();
    }

    function toggleBolsaUnico(checkbox) { document.getElementById('u-fecha').value = toLocalISODate(new Date()); document.getElementById('u-fecha').disabled = checkbox.checked; }
    function redirectDivisibleToUnico(checkbox) { if (checkbox.checked) { checkbox.checked = false; switchTab('tab-unico'); document.getElementById('u-bolsa').checked = true; toggleBolsaUnico(document.getElementById('u-bolsa')); } }
    function toggleAjusteFields() { const extra = document.getElementById('a-extra-fields'); const val = document.getElementById('a-tipo').value; if (val === "7" || val === "8") extra.classList.remove('hidden'); else extra.classList.add('hidden'); }
    function clearForm(formId) { document.getElementById(formId).reset(); document.getElementById('u-fecha').value = toLocalISODate(new Date()); document.getElementById('d-fecha').value = toLocalISODate(new Date()); document.getElementById('u-fecha').disabled = false; toggleAjusteFields(); }
    
    function setupEnterNavigation() { 
      document.querySelectorAll('form').forEach(form => { 
        const inputs = Array.from(form.querySelectorAll('input:not([type="hidden"]), select, button[type="submit"]')); 
        inputs.forEach((input, index) => { 
          input.addEventListener('keydown', (e) => { 
            if (e.key === 'Enter') { 
              e.preventDefault(); 
              if (index < inputs.length - 1) { 
                 let nextInput = inputs[index + 1];
                 nextInput.focus(); 
                 if (nextInput.tagName.toLowerCase() === 'input' && (nextInput.type === 'text' || nextInput.type === 'number')) {
                     setTimeout(() => {
                         let len = nextInput.value.length;
                         if (nextInput.setSelectionRange) nextInput.setSelectionRange(len, len);
                     }, 10);
                 }
              }
              if (inputs[index + 1] && inputs[index + 1].type === 'submit') {
                 inputs[index + 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            } 
          }); 
        }); 
      }); 
    }

    function checkDayRollover() {
      const todayStr = toLocalISODate(new Date());
      const lastProcessed = state.config.lastProcessedDate;

      if (!lastProcessed) {
         syncBackend({ action: "updateConfig", user: currentUser, lastProcessedDate: todayStr });
         state.config.lastProcessedDate = todayStr;
         return;
      }

      if (todayStr > lastProcessed) {
         const pastDates = getRemainingDatesFrom(lastProcessed);
         const liquidHB = state.hb - state.bs;
         
         let gastosEnPeriodoPasado = 0; 
         let gastoExactoAyer = 0;

         state.movements.forEach(m => {
            if(m.fechas_afectadas && m.fechas_afectadas.length > 2) { 
              try { 
                let affectedDates = JSON.parse(m.fechas_afectadas);
                if(affectedDates.length > 0) { 
                   let montoParcial = parseFloat(m.monto) / affectedDates.length; 
                   affectedDates.forEach(ad => { 
                     if (pastDates.includes(ad)) { 
                         gastosEnPeriodoPasado += montoParcial; 
                     }
                     if (ad === lastProcessed) {
                         gastoExactoAyer += montoParcial;
                     }
                   }); 
                }
              } catch(e) {}
            }
         });

         let poolAyer = liquidHB + gastosEnPeriodoPasado;
         let baseDailyBudgetAyer = pastDates.length > 0 ? poolAyer / pastDates.length : 0;
         
         const unspentPreviousDay = baseDailyBudgetAyer - gastoExactoAyer;

         if (unspentPreviousDay > 0.05) { 
            pendingRolloverAmount = unspentPreviousDay;
            pendingRolloverDate = lastProcessed;
            document.getElementById('rollover-amount').innerText = formatMoney(unspentPreviousDay);
            document.getElementById('modal-rollover').classList.remove('hidden');
         } else {
            state.config.lastProcessedDate = todayStr;
            syncBackend({ action: "updateConfig", user: currentUser, lastProcessedDate: todayStr });
         }
      }
    }

    function confirmRollover(moveToBolsa) {
      const todayStr = toLocalISODate(new Date());
      document.getElementById('modal-rollover').classList.add('hidden');

      if (moveToBolsa && pendingRolloverAmount > 0) {
         state.bs += pendingRolloverAmount;
         let idUnico = new Date().toISOString() + Math.random().toString(36).substr(2, 5);
         
         let newMovement = { 
           action: "addMovement", id: idUnico, user: currentUser, type: "Ajuste T-5", 
           amount: pendingRolloverAmount, concept: `Sobrante del ${pendingRolloverDate} a Bolsa`, 
           target: "Bolsa", dates: [pendingRolloverDate], newHB: state.hb, newBS: state.bs,
           lastProcessedDate: todayStr
         };

         state.movements.push({ fecha: idUnico, usuario: currentUser, tipo: "Ajuste T-5", monto: pendingRolloverAmount, concepto: `Sobrante del ${pendingRolloverDate} a Bolsa`, target: "Bolsa", fechas_afectadas: JSON.stringify([pendingRolloverDate]) });
         state.config.lastProcessedDate = todayStr;
         syncBackend(newMovement);
      } else {
         state.config.lastProcessedDate = todayStr;
         syncBackend({ action: "updateConfig", user: currentUser, lastProcessedDate: todayStr });
      }
      render();
    }

    async function fetchData(showVisuals = true) {
      if(showVisuals) {
         document.getElementById('btn-top-sync').classList.add('hidden');
         document.getElementById('sync-status').classList.remove('hidden');
      }
      try {
        const cacheBuster = "?action=getDiario&t=" + new Date().getTime();
        const res = await fetch(API_URL + cacheBuster); const data = await res.json();
        state.hb = parseFloat(data.hb) || 0; state.bs = parseFloat(data.bs) || 0;
        state.movements = data.movements || []; 
        state.config = data.config || { paydate: "", themeBrian: "", themeVirginia: "", lastProcessedDate: "" };

        if (state.config.paydate && state.config.paydate.length > 10) state.config.paydate = state.config.paydate.substring(0, 10);
        if (state.config.lastProcessedDate && state.config.lastProcessedDate.length > 10) state.config.lastProcessedDate = state.config.lastProcessedDate.substring(0, 10);
        
        applySavedConfig(); guardarEnCache(); render();
        checkDayRollover();
      } catch (e) { console.error("Error", e); }
      finally { 
        document.getElementById('sync-status').classList.add('hidden'); 
        document.getElementById('btn-top-sync').classList.remove('hidden'); 
      }
    }

    async function syncBackend(payload) {
      document.getElementById('btn-top-sync').classList.add('hidden');
      document.getElementById('sync-status').classList.remove('hidden');
      try { 
        await fetch(API_URL, { 
          method: 'POST', 
          headers: { "Content-Type": "text/plain;charset=utf-8" }, 
          body: JSON.stringify(payload) 
        }); 
      } 
      catch (e) { console.error("Error al sincronizar con Google Sheets:", e); }
      finally {
        setTimeout(() => {
          document.getElementById('sync-status').classList.add('hidden'); 
          document.getElementById('btn-top-sync').classList.remove('hidden');
        }, 1200);
      }
    }

    function reverseMath(m) {
      let amt = parseFloat(m.monto);
      let isExpense = (m.tipo === "Gasto Único" || m.tipo === "Gasto Divisible" || m.tipo === "Ajuste T-3" || m.tipo === "Ajuste T-4" || m.tipo === "Ajuste T-5");
      let isIncome = (m.tipo === "Ajuste T-2"); let isInjection = (m.tipo === "Ajuste T-6" || m.tipo === "Ajuste T-7" || m.tipo === "Ajuste T-8");
      if (isExpense) { state.hb += amt; if(m.target === "Bolsa" || m.tipo === "Ajuste T-4" || m.tipo === "Ajuste T-5") state.bs += amt; } 
      else if (isIncome) { state.hb -= amt; state.bs -= amt; } 
      else if (isInjection) { if (m.tipo === "Ajuste T-8") state.bs += Math.abs(amt); }
      else if (m.tipo === "Ajuste T-1") { state.hb -= amt; }
    }
    function applyMath(m) {
      let amt = parseFloat(m.monto);
      let isExpense = (m.tipo === "Gasto Único" || m.tipo === "Gasto Divisible" || m.tipo === "Ajuste T-3" || m.tipo === "Ajuste T-4" || m.tipo === "Ajuste T-5");
      let isIncome = (m.tipo === "Ajuste T-2"); let isInjection = (m.tipo === "Ajuste T-6" || m.tipo === "Ajuste T-7" || m.tipo === "Ajuste T-8");
      if (isExpense) { state.hb -= amt; if(m.target === "Bolsa" || m.tipo === "Ajuste T-4" || m.tipo === "Ajuste T-5") state.bs -= amt; } 
      else if (isIncome) { state.hb += amt; state.bs += amt; } 
      else if (isInjection) { if (m.tipo === "Ajuste T-8") state.bs -= Math.abs(amt); }
      else if (m.tipo === "Ajuste T-1") { state.hb += amt; }
    }

    function openEditModal(id) {
       const m = state.movements.find(x => x.fecha === id); if(!m) return;
       document.getElementById('edit-id').value = m.fecha; document.getElementById('edit-concepto').value = m.concepto;
       document.getElementById('edit-monto').value = Math.abs(m.monto); document.getElementById('edit-mov-tipo').innerText = `${m.tipo} - Registrado por ${m.usuario}`;
       document.getElementById('modal-editar').classList.remove('hidden');
    }
    function closeEditModal() { document.getElementById('modal-editar').classList.add('hidden'); }
    function saveEdit() {
       const id = document.getElementById('edit-id').value; const newConcept = document.getElementById('edit-concepto').value;
       let newMonto = parseAmountInput(document.getElementById('edit-monto').value);
       let idx = state.movements.findIndex(x => x.fecha === id); if(idx === -1) return;
       let m = state.movements[idx];
       if (m.monto < 0) newMonto = -newMonto;
       reverseMath(m); m.concepto = newConcept; m.monto = newMonto; applyMath(m);
       syncBackend({ action: "editMovement", id: m.fecha, concept: newConcept, amount: newMonto, newHB: state.hb, newBS: state.bs });
       render(); closeEditModal();
    }
    function deleteMovementDirectly(id) {
       if(!confirm("¿Eliminar este movimiento de forma definitiva?")) return;
       let idx = state.movements.findIndex(x => x.fecha === id); if(idx === -1) return;
       reverseMath(state.movements[idx]); state.movements.splice(idx, 1); 
       syncBackend({ action: "deleteMovement", id: id, newHB: state.hb, newBS: state.bs }); render();
    }

    function calculateBudgets() {
      const dates = getRemainingDates(); const liquidHB = state.hb - state.bs;
      let gastosEnPeriodo = 0; let gastosPorDia = {}; dates.forEach(d => gastosPorDia[d] = 0);
      state.movements.forEach(m => {
        if(m.fechas_afectadas && m.fechas_afectadas.length > 2) { 
          try { let affectedDates = JSON.parse(m.fechas_afectadas);
            if(affectedDates.length > 0) { let montoParcial = parseFloat(m.monto) / affectedDates.length; affectedDates.forEach(ad => { if (gastosPorDia.hasOwnProperty(ad)) { gastosPorDia[ad] += montoParcial; gastosEnPeriodo += montoParcial; } }); }
          } catch(e) {}
        }
      });
      const baseDailyBudget = dates.length > 0 ? (liquidHB + gastosEnPeriodo) / dates.length : 0;
      return { dates, baseDailyBudget, gastosPorDia };
    }

    function enviarSaldoHoyABolsa() {
       const { baseDailyBudget, gastosPorDia } = calculateBudgets();
       const todayStr = toLocalISODate(new Date());
       const sobranteHoy = baseDailyBudget - (gastosPorDia[todayStr] || 0);

       if (sobranteHoy <= 0) { alert("¡No tenés saldo sobrante hoy para enviar a la Bolsa!"); return; }

       if(confirm(`¿Querés guardar los ${formatMoney(sobranteHoy)} que te sobraron hoy directo en tu Bolsa de Saldos?`)) {
          let amount = sobranteHoy; let idUnico = new Date().toISOString() + Math.random().toString(36).substr(2, 5);
          state.bs += amount;
          let newMovement = { action: "addMovement", id: idUnico, user: currentUser, type: "Ajuste T-5", amount: amount, concept: "Sobrante de hoy a Bolsa", target: "Bolsa", dates: [todayStr], newHB: state.hb, newBS: state.bs };
          state.movements.push({ fecha: idUnico, usuario: currentUser, tipo: "Ajuste T-5", monto: amount, concepto: "Sobrante de hoy a Bolsa", target: "Bolsa", fechas_afectadas: JSON.stringify([todayStr]) });
          syncBackend(newMovement); render();
       }
    }

    function render() {
      const { dates, baseDailyBudget, gastosPorDia } = calculateBudgets();
      let todayStr = toLocalISODate(new Date()); let tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); let tomorrowStr = toLocalISODate(tomorrow);
      let todayBudget = baseDailyBudget - (gastosPorDia[todayStr] || 0); let tomorrowBudget = baseDailyBudget - (gastosPorDia[tomorrowStr] || 0);

      document.getElementById('display-hb').innerText = formatMoney(state.hb); document.getElementById('display-bs').innerText = formatMoney(state.bs);
      
      let dToday = document.getElementById('display-today'); dToday.innerText = formatMoney(todayBudget);
      dToday.className = todayBudget < 0 ? "text-3xl font-bold text-red-400" : "text-3xl font-bold t-accent";

      let dTomorrow = document.getElementById('display-tomorrow'); dTomorrow.innerText = formatMoney(tomorrowBudget);
      dTomorrow.className = tomorrowBudget < 0 ? "text-base font-semibold text-red-400 mt-1 block" : "text-base font-semibold text-main mt-1 block";

      document.getElementById('display-days').innerText = `${dates.length} Días`;
      document.getElementById('modal-days-subtitle').innerText = `${dates.length} Días restantes hasta el cobro`;
      
      renderHistory(); if(!document.getElementById('modal-calendario').classList.contains('hidden')) renderCalendarModal();
    }

    function submitUnico(e) {
      e.preventDefault();
      const amount = parseAmountInput(document.getElementById('u-monto').value); const isBolsa = document.getElementById('u-bolsa').checked;
      const targetDate = document.getElementById('u-fecha').value; const concept = document.getElementById('u-concepto').value;
      if(!isBolsa) { const { baseDailyBudget, gastosPorDia } = calculateBudgets(); const limit = baseDailyBudget - (gastosPorDia[targetDate] || 0);
        if (amount > limit && !confirm(`¡Cuidado! Superás el presupuesto (${formatMoney(limit)}). ¿Guardar igual?`)) return;
      }
      if (isBolsa) { state.bs -= amount; state.hb -= amount; } else { state.hb -= amount; }
      let datesArr = isBolsa ? [] : [targetDate]; let idUnico = new Date().toISOString();
      let newMovement = { action: "addMovement", id: idUnico, user: currentUser, type: "Gasto Único", amount, concept, target: isBolsa ? "Bolsa" : "Diario", dates: datesArr, newHB: state.hb, newBS: state.bs };
      state.movements.push({ fecha: idUnico, usuario: currentUser, tipo: "Gasto Único", monto: amount, concepto: concept, target: isBolsa ? "Bolsa" : "Diario", fechas_afectadas: JSON.stringify(datesArr) });
      syncBackend(newMovement); clearForm('tab-unico'); render();
    }

    function submitDivisible(e) {
      e.preventDefault();
      const amount = parseAmountInput(document.getElementById('d-monto').value); let dias = document.getElementById('d-dias').value;
      let startDateStr = document.getElementById('d-fecha').value; const concept = document.getElementById('d-concepto').value;
      let datesArray = getRemainingDates(); let startIdx = datesArray.indexOf(startDateStr); if(startIdx === -1) startIdx = 0; 
      let affectedDates = []; dias = dias ? parseInt(dias) : (datesArray.length - startIdx);
      let partesFecha = startDateStr.split('-'); let curDate = new Date(partesFecha[0], partesFecha[1] - 1, partesFecha[2]);
      for(let i=0; i<dias; i++) { affectedDates.push(toLocalISODate(curDate)); curDate.setDate(curDate.getDate() + 1); }
      const { baseDailyBudget, gastosPorDia } = calculateBudgets();
      let chunk = amount / dias; let limit = baseDailyBudget - (gastosPorDia[affectedDates[0]] || 0);
      if (chunk > limit && !confirm(`La cuota diaria (${formatMoney(chunk)}) supera lo libre hoy (${formatMoney(limit)}). ¿Guardar?`)) return;
      state.hb -= amount; let idUnico = new Date().toISOString();
      let newMovement = { action: "addMovement", id: idUnico, user: currentUser, type: "Gasto Divisible", amount, concept, target: "Diario", dates: affectedDates, newHB: state.hb };
      state.movements.push({ fecha: idUnico, usuario: currentUser, tipo: "Gasto Divisible", monto: amount, concepto: concept, target: "Diario", fechas_afectadas: JSON.stringify(affectedDates) });
      syncBackend(newMovement); clearForm('tab-divisible'); render();
    }

    function submitAjuste(e) {
      e.preventDefault();
      let amount = parseAmountInput(document.getElementById('a-monto').value); const tipo = document.getElementById('a-tipo').value; const concept = document.getElementById('a-concepto').value;
      let fechasAfectadas = []; let targetName = "Ajuste Global";
      if (tipo === "6") { fechasAfectadas = [toLocalISODate(new Date())]; amount = -amount; targetName = "Inyección de Presupuesto"; } 
      else if (tipo === "7" || tipo === "8") {
          let startDate = document.getElementById('a-fecha').value; let dias = parseInt(document.getElementById('a-dias').value) || 1;
          let partesFecha = startDate.split('-'); let curDate = new Date(partesFecha[0], partesFecha[1] - 1, partesFecha[2]);
          for(let i=0; i<dias; i++) { fechasAfectadas.push(toLocalISODate(curDate)); curDate.setDate(curDate.getDate() + 1); }
          amount = -amount; targetName = "Inyección de Presupuesto"; if (tipo === "8") { state.bs -= Math.abs(amount); }
      } else {
          switch(tipo) { case "1": state.hb += amount; break; case "2": state.hb += amount; state.bs += amount; break; case "3": state.hb -= amount; break; case "4": state.hb -= amount; state.bs -= amount; break; case "5": state.bs += amount; break; }
      }
      let idUnico = new Date().toISOString();
      let newMovement = { action: "addMovement", id: idUnico, user: currentUser, type: `Ajuste T-${tipo}`, amount, concept, target: targetName, dates: fechasAfectadas, newHB: state.hb, newBS: state.bs };
      state.movements.push({ fecha: idUnico, usuario: currentUser, tipo: `Ajuste T-${tipo}`, monto: amount, concepto: concept, target: targetName, fechas_afectadas: JSON.stringify(fechasAfectadas) });
      syncBackend(newMovement); clearForm('tab-ajuste'); render();
    }

    function renderHistory() {
      const container = document.getElementById('bottom-movimientos'); container.innerHTML = "";
      if(state.movements.length === 0) { container.innerHTML = `<p class="text-xs text-muted text-center py-4">No hay movimientos registrados.</p>`; return; }
      let reversedMovs = [...state.movements].reverse();
      reversedMovs.forEach(m => {
        let isNegative = parseFloat(m.monto) < 0; let displayMonto = Math.abs(m.monto);
        let isIngreso = m.tipo.includes("T-1") || m.tipo.includes("T-2") || isNegative;
        let colorAmount = isIngreso ? 't-accent' : 'text-main'; let sign = isIngreso ? '+' : '-';
        let dateObj = m.fecha ? new Date(m.fecha) : new Date();
        let html = `
          <div class="card-clean p-3 flex justify-between items-center mb-2">
            <div class="flex flex-col flex-1 overflow-hidden pr-2">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-[9px] uppercase font-semibold border border-slate-700/80 px-1.5 py-0.5 rounded text-muted">${m.usuario || "App"}</span>
                <span class="text-[10px] text-muted">${dateObj.toLocaleDateString('es-AR', {day: '2-digit', month: 'short'})} ${dateObj.toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'})}</span>
              </div>
              <span class="text-xs font-medium text-main truncate">${m.concepto || "Sin detalle"}</span>
              <span class="text-[10px] text-muted italic">${m.tipo.replace("Ajuste ", "")}</span>
            </div>
            <div class="text-right flex flex-col items-end justify-center">
              <span class="text-sm font-bold ${colorAmount} mb-1.5">${sign}${formatMoney(displayMonto)}</span>
              <div class="flex gap-1">
                <button onclick="openEditModal('${m.fecha}')" class="text-[10px] card-clean text-muted px-2 py-1 hover:bg-slate-800">✏️</button>
                <button onclick="deleteMovementDirectly('${m.fecha}')" class="text-[10px] card-clean text-muted px-2 py-1 hover:bg-slate-800">🗑️</button>
              </div>
            </div>
          </div>`;
        container.innerHTML += html;
      });
    }

    function renderCalendarModal() {
      const cal = document.getElementById('modal-calendario-body'); cal.innerHTML = "";
      const { dates, baseDailyBudget, gastosPorDia } = calculateBudgets();
      dates.forEach(date => {
        let dailyBudget = baseDailyBudget - gastosPorDia[date]; let colorCls = dailyBudget < 0 ? "text-red-400 border-red-900/50" : "t-accent border-slate-800";
        let html = `<div class="card-clean p-3 mb-2">
             <div class="flex justify-between items-center border-b border-slate-800/80 pb-2 mb-2">
                <span class="font-semibold text-main text-xs">${date}</span>
                <span class="font-semibold text-xs ${colorCls} card-clean px-2 py-0.5">Disp: ${formatMoney(dailyBudget)}</span>
             </div>
             <div class="text-xs text-muted space-y-1 pl-1">`;
        let hasMovements = false;
        state.movements.forEach(m => {
           if(m.fechas_afectadas && m.fechas_afectadas.length > 2 && m.fechas_afectadas.includes(date) && m.target !== "Ajuste Global" && m.target !== "Bolsa") {
             hasMovements = true; let arr = JSON.parse(m.fechas_afectadas);
             let propMonto = parseFloat(m.monto) / arr.length; let isPositive = propMonto < 0; 
             let sign = isPositive ? "+" : "-"; let color = isPositive ? "t-accent font-semibold" : "text-main";
             html += `<p class="flex justify-between items-center text-[11px]">
               <span class="truncate w-3/4">• <strong class="${color}">${m.concepto}</strong> ${arr.length > 1 && !isPositive ? '<span class="text-[9px] text-muted">(Cuota)</span>' : ''}</span>
               <span class="${color}">${sign}${formatMoney(Math.abs(propMonto))}</span>
             </p>`;
           }
        });
        if(!hasMovements) html += `<p class="italic text-[11px] text-muted">Sin gastos computados.</p>`;
        html += `</div></div>`; cal.innerHTML += html;
      });
    }

    // ================= LÓGICA DEL MÓDULO DE PROYECCIÓN (MACRO) =================

    function generateId() {
       return 'g-' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    }

    function handleGastoMontoKeydown(e, el) {
      if (e.key === 'Enter') {
        e.preventDefault();
        let inputs = Array.from(document.querySelectorAll('.gasto-monto-input'));
        let idx = inputs.indexOf(el);
        if (idx !== -1 && idx < inputs.length - 1) {
            let nextInput = inputs[idx + 1];
            nextInput.focus();
            setTimeout(() => {
                let len = nextInput.value.length;
                if (nextInput.setSelectionRange) nextInput.setSelectionRange(len, len);
            }, 10);
        } else {
            let btns = document.querySelectorAll('.btn-update-action');
            if (btns.length > 0) {
                let lastBtn = btns[btns.length - 1]; 
                lastBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                lastBtn.focus();
            }
        }
      }
    }

    function renderMonthSwipeSelector() {
      const container = document.getElementById('month-swipe-container');
      container.innerHTML = "";
      ALL_MESES.forEach(m => {
        let isActive = m === currentProyMonth;
        let cls = isActive 
          ? "bg-accent text-white font-semibold shadow-sm" 
          : "card-clean text-muted font-medium hover:bg-slate-800/50";
        container.innerHTML += `<button onclick="changeMonth('${m}')" class="shrink-0 px-3 py-1.5 rounded-xl text-[11px] transition-all focus:outline-none ${cls}">${m}</button>`;
      });
      document.getElementById('proy-select-mes').value = currentProyMonth;

      setTimeout(() => {
        let activeBtn = container.querySelector('.bg-accent');
        if (activeBtn) activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }, 100);
    }

    function changeMonth(m) {
      currentProyMonth = m;
      renderMonthSwipeSelector();
      renderProyeccion();
    }

    async function fetchProyecciones() {
      try {
        const cacheBuster = "?action=getProyecciones&t=" + new Date().getTime();
        const res = await fetch(API_URL + cacheBuster);
        const data = await res.json();
        if (data.status === "ok") {
          dolarUSD = data.dolarUSD || 1200;
          sueldoBaseBrian = parseFloat(data.sueldoBaseBrian) || 1559009.85;
          sueldoBaseVirginia = parseFloat(data.sueldoBaseVirginia) || 0;
          if (data.serviciosGlobales && data.serviciosGlobales.length > 0) {
            serviciosGlobales = data.serviciosGlobales;
          }
          proyeccionesData = data.proyecciones || [];

          let conceptMap = {}; 
          proyeccionesData.forEach(mes => {
            ['gastosBrian', 'gastosVirginia'].forEach(key => {
              if(mes[key]) {
                mes[key].forEach(g => {
                  if (!g.id) {
                    if (g.concepto && conceptMap[g.concepto]) {
                      g.id = conceptMap[g.concepto];
                    } else {
                      g.id = generateId();
                      if (g.concepto) conceptMap[g.concepto] = g.id;
                    }
                  }
                });
              }
            });
          });

          renderProyeccion();
        }
      } catch (e) { console.error("Error cargando proyecciones", e); }
    }

    // Funciones actualizadas para el diseño de Headless UI Tabs de Servicios
    function openServiciosModal() {
      document.getElementById('cfg-dolar-usd').value = dolarUSD;
      document.getElementById('cfg-sueldo-brian').value = sueldoBaseBrian;
      document.getElementById('cfg-sueldo-virginia').value = sueldoBaseVirginia;
      formatLiveCurrencyInput(document.getElementById('cfg-dolar-usd'));
      formatLiveCurrencyInput(document.getElementById('cfg-sueldo-brian'));
      formatLiveCurrencyInput(document.getElementById('cfg-sueldo-virginia'));
      renderServiciosGlobales();
      document.getElementById('modal-servicios').classList.remove('hidden');
    }

    function closeServiciosModal() {
      document.getElementById('modal-servicios').classList.add('hidden');
    }

    function switchServTab(tabId) {
      document.getElementById('tab-serv-lista').classList.add('hidden');
      document.getElementById('tab-serv-sueldos').classList.add('hidden');
      document.getElementById(tabId).classList.remove('hidden');

      document.getElementById('btn-serv-lista').className = tabId === 'tab-serv-lista' ? "w-full rounded-lg py-2 text-xs font-medium bg-accent text-white shadow transition-all focus:outline-none" : "w-full rounded-lg py-2 text-xs font-medium text-muted hover:bg-slate-800/40 hover:text-main transition-all focus:outline-none";
      document.getElementById('btn-serv-sueldos').className = tabId === 'tab-serv-sueldos' ? "w-full rounded-lg py-2 text-xs font-medium bg-accent text-white shadow transition-all focus:outline-none" : "w-full rounded-lg py-2 text-xs font-medium text-muted hover:bg-slate-800/40 hover:text-main transition-all focus:outline-none";
    }

    function renderServiciosGlobales() {
      dolarUSD = parseAmountInput(document.getElementById('cfg-dolar-usd').value) || 1200;
      const list = document.getElementById('modal-servicios-list');
      list.innerHTML = "";
      let totalARS = 0;

      serviciosGlobales.forEach((serv, idx) => {
        let precioIndividual = parseFloat(serv.precio) || 0;
        let cant = parseInt(serv.cant) || 1;
        let costoSubtotal = serv.moneda === "USD" ? (precioIndividual * dolarUSD * cant) : (precioIndividual * cant);
        totalARS += costoSubtotal;

        let row = `
          <div class="card-clean p-2 text-xs space-y-1.5">
            <div class="flex gap-1.5 items-center">
              <input type="text" value="${serv.concepto}" placeholder="Servicio" onchange="serviciosGlobales[${idx}].concepto=this.value; renderServiciosGlobales();" class="flex-1 card-clean p-1 text-main font-medium outline-none rounded">
              <select onchange="serviciosGlobales[${idx}].moneda=this.value; renderServiciosGlobales();" class="card-clean text-main font-bold p-1 outline-none rounded appearance-none pr-4">
                <option value="ARS" ${serv.moneda === 'ARS' ? 'selected' : ''}>$ ARS</option>
                <option value="USD" ${serv.moneda === 'USD' ? 'selected' : ''}>$ USD</option>
              </select>
              <button onclick="serviciosGlobales.splice(${idx},1); renderServiciosGlobales();" class="text-muted hover:text-red-400 p-1 focus:outline-none">🗑️</button>
            </div>
            <div class="flex gap-2 items-center justify-between">
              <div class="flex items-center gap-1">
                <span class="text-[9px] text-muted">Cant:</span>
                <input type="number" value="${cant}" onchange="serviciosGlobales[${idx}].cant=parseInt(this.value)||1; renderServiciosGlobales();" class="w-12 card-clean p-1 text-center text-main font-bold outline-none rounded">
              </div>
              <div class="flex items-center gap-1">
                <span class="text-[9px] text-muted">Precio Unit:</span>
                <input type="text" inputmode="decimal" value="${new Intl.NumberFormat('es-AR').format(precioIndividual)}" onfocus="handleInputFocus(this)" onblur="handleInputBlur(this)" oninput="formatLiveCurrencyInput(this); serviciosGlobales[${idx}].precio=parseAmountInput(this.value); renderServiciosGlobales();" class="w-24 card-clean p-1 text-right text-main font-bold outline-none rounded">
              </div>
              <span class="font-semibold text-main text-xs">${formatMoney(costoSubtotal)}</span>
            </div>
          </div>`;
        list.innerHTML += row;
      });

      document.getElementById('modal-servicios-total').innerText = formatMoney(totalARS);
      calcProyTotales();
    }

    function addServicioGlobalRow() {
      serviciosGlobales.push({ concepto: "Nuevo Servicio", moneda: "ARS", cant: 1, precio: 0 });
      renderServiciosGlobales();
    }

    function saveServiciosConfig(btnElement) {
      if(btnElement) btnElement.innerText = "⏳ Guardando...";
      dolarUSD = parseAmountInput(document.getElementById('cfg-dolar-usd').value) || 1200;
      sueldoBaseBrian = parseAmountInput(document.getElementById('cfg-sueldo-brian').value);
      sueldoBaseVirginia = parseAmountInput(document.getElementById('cfg-sueldo-virginia').value);

      syncBackend({
        action: "saveConfigServicios",
        dolarUSD: dolarUSD,
        sueldoBaseBrian: sueldoBaseBrian,
        sueldoBaseVirginia: sueldoBaseVirginia,
        serviciosGlobales: serviciosGlobales
      });
      setTimeout(() => { if(btnElement) btnElement.innerText = "🔄 Guardado OK"; }, 1000);
      renderProyeccion();
    }

    // ================= FUNCIONES DE FILTRADO Y CHECKBOX DE SERVICIOS POR MES =================

    function openServiciosSelectorModal() {
      document.getElementById('servicios-selector-month-name').innerText = `Mes: ${currentProyMonth}`;
      renderServiciosSelectorList();
      document.getElementById('modal-servicios-selector').classList.remove('hidden');
    }

    function closeServiciosSelectorModal() {
      document.getElementById('modal-servicios-selector').classList.add('hidden');
    }

    function getDisabledServiciosForCurrentMonth() {
      let mesData = getOrCreateMesData(currentProyMonth);
      if (!mesData.serviciosDesactivados) {
        mesData.serviciosDesactivados = [];
      }
      return mesData.serviciosDesactivados;
    }

    function toggleServicioForCurrentMonth(servConcepto, isChecked) {
      let disabledList = getDisabledServiciosForCurrentMonth();
      if (isChecked) {
        let idx = disabledList.indexOf(servConcepto);
        if (idx !== -1) disabledList.splice(idx, 1);
      } else {
        if (!disabledList.includes(servConcepto)) {
          disabledList.push(servConcepto);
        }
      }
      calcProyTotales();
      renderServiciosSelectorList();
    }

    function toggleAllServiciosMonth(enableAll) {
      let mesData = getOrCreateMesData(currentProyMonth);
      if (enableAll) {
        mesData.serviciosDesactivados = [];
      } else {
        mesData.serviciosDesactivados = serviciosGlobales.map(s => s.concepto);
      }
      calcProyTotales();
      renderServiciosSelectorList();
    }

    function renderServiciosSelectorList() {
      const container = document.getElementById('modal-servicios-selector-list');
      container.innerHTML = "";
      
      let disabledList = getDisabledServiciosForCurrentMonth();
      let totalComputado = 0;

      if (serviciosGlobales.length === 0) {
        container.innerHTML = `<p class="text-xs text-muted text-center py-4">No hay servicios globales cargados en la configuración.</p>`;
        document.getElementById('modal-servicios-selector-total').innerText = formatMoney(0);
        return;
      }

      serviciosGlobales.forEach((serv) => {
        let p = parseFloat(serv.precio) || 0;
        let c = parseInt(serv.cant) || 1;
        let costoSubtotal = serv.moneda === "USD" ? (p * dolarUSD * c) : (p * c);
        
        let isEnabled = !disabledList.includes(serv.concepto);
        if (isEnabled) totalComputado += costoSubtotal;

        let row = `
          <label class="card-clean p-2.5 ${isEnabled ? 'bg-accent-light border-accent-light' : 'opacity-50'} flex justify-between items-center transition-all cursor-pointer rounded-lg hover:bg-slate-800/30">
            <div class="flex items-center gap-3">
              <div class="relative inline-flex items-center shrink-0">
                <input type="checkbox" ${isEnabled ? 'checked' : ''} onclick="event.stopPropagation(); toggleServicioForCurrentMonth('${serv.concepto.replace(/'/g, "\\'")}', this.checked)" class="sr-only peer">
                <div class="w-11 h-6 bg-slate-700/50 border border-slate-600 rounded-full peer peer-checked:bg-accent transition-colors duration-200 ease-in-out"></div>
                <div class="absolute left-[2px] top-[2px] bg-white w-5 h-5 rounded-full transition-transform duration-200 ease-in-out peer-checked:translate-x-5 shadow-sm"></div>
              </div>
              <div class="flex flex-col">
                <span class="text-xs font-semibold ${isEnabled ? 'text-main' : 'text-muted line-through'}">${serv.concepto}</span>
                <span class="text-[9px] text-muted">${serv.cant > 1 ? serv.cant + 'x ' : ''}${serv.moneda === 'USD' ? 'USD ' + serv.precio : '$ ' + serv.precio}</span>
              </div>
            </div>
            <span class="text-xs font-semibold ${isEnabled ? 'text-main' : 'text-muted line-through'}">${formatMoney(costoSubtotal)}</span>
          </label>`;
        container.innerHTML += row;
      });

      document.getElementById('modal-servicios-selector-total').innerText = formatMoney(totalComputado);
    }

    function getServiciosTotalCalculated() {
      let total = 0;
      let disabledList = getDisabledServiciosForCurrentMonth();

      serviciosGlobales.forEach(s => {
        if (!disabledList.includes(s.concepto)) {
          let p = parseFloat(s.precio) || 0;
          let c = parseInt(s.cant) || 1;
          total += s.moneda === "USD" ? (p * dolarUSD * c) : (p * c);
        }
      });
      return total;
    }

    function onExtraTypeChange(user) {
      const selectTipo = document.getElementById(user === 'Brian' ? 'p-tipo-extra-brian' : 'p-tipo-extra-virginia').value;
      const inputExtra = document.getElementById(user === 'Brian' ? 'p-extra-brian' : 'p-extra-virginia');
      const inputConcepto = document.getElementById(user === 'Brian' ? 'p-concepto-extra-brian' : 'p-concepto-extra-virginia');

      if (selectTipo === "SAC") {
        let base = user === 'Brian' ? sueldoBaseBrian : sueldoBaseVirginia;
        inputExtra.value = (base * 0.5).toFixed(2);
        inputConcepto.value = "SAC (Medio Aguinaldo)";
      } else if (selectTipo === "Premio") {
        inputConcepto.value = "Premio / Bono";
      } else {
        inputConcepto.value = "Otro Ingreso Extra";
      }
      formatLiveCurrencyInput(inputExtra);
      calcProyTotales();
    }

    function renderProyeccion() {
      const mesSelect = currentProyMonth;
      let mesData = proyeccionesData.find(p => p.mes === mesSelect);

      if (!mesData) {
        let defaultTipo = "Otro";
        if (mesSelect.includes("[SAC]")) defaultTipo = "SAC";
        else if (mesSelect.includes("[Premio]")) defaultTipo = "Premio";

        let defaultExtraB = defaultTipo === "SAC" ? (sueldoBaseBrian * 0.5).toFixed(2) : 0;
        let defaultExtraV = defaultTipo === "SAC" ? (sueldoBaseVirginia * 0.5).toFixed(2) : 0;

        mesData = {
          mes: mesSelect,
          extraBrian: defaultExtraB,
          tipoExtraBrian: defaultTipo,
          conceptoExtraBrian: defaultTipo === "SAC" ? "SAC" : (defaultTipo === "Premio" ? "Premio / Bono" : ""),
          extraVirginia: defaultExtraV,
          tipoExtraVirginia: defaultTipo,
          conceptoExtraVirginia: defaultTipo === "SAC" ? "SAC" : (defaultTipo === "Premio" ? "Premio / Bono" : ""),
          gastosBrian: [],
          gastosVirginia: [],
          serviciosDesactivados: []
        };
        proyeccionesData.push(mesData);
      }

      document.getElementById('p-tipo-extra-brian').value = mesData.tipoExtraBrian || "Otro";
      document.getElementById('p-concepto-extra-brian').value = mesData.conceptoExtraBrian || "";
      document.getElementById('p-extra-brian').value = new Intl.NumberFormat('es-AR').format(mesData.extraBrian || 0);

      document.getElementById('p-tipo-extra-virginia').value = mesData.tipoExtraVirginia || "Otro";
      document.getElementById('p-concepto-extra-virginia').value = mesData.conceptoExtraVirginia || "";
      document.getElementById('p-extra-virginia').value = new Intl.NumberFormat('es-AR').format(mesData.extraVirginia || 0);

      renderGastosList('Brian', mesData.gastosBrian || []);
      renderGastosList('Virginia', mesData.gastosVirginia || []);

      calcProyTotales();
    }

    function renderGastosList(user, list) {
      const container = document.getElementById(`container-gastos-${user.toLowerCase()}`);
      container.innerHTML = "";

      list.forEach((gasto, idx) => {
        let catId = gasto.categoria || "otros";
        let catOptionsHtml = CATEGORIAS_GASTOS.map(c => `<option value="${c.id}" ${c.id === catId ? 'selected' : ''}>${c.name}</option>`).join('');
        let displayPrecio = gasto.precio === 0 ? '' : (gasto.precio < 0 ? '-' : '') + new Intl.NumberFormat('es-AR').format(Math.abs(gasto.precio));

        let row = `
          <div class="card-clean p-2 space-y-2">
            <div class="flex gap-1.5 items-center">
              <div class="flex flex-col gap-0.5">
                <button onclick="moveGastoOrder('${user}', '${gasto.id}', -1)" ${idx === 0 ? 'disabled class="opacity-20"' : ''} title="Subir orden" class="text-[10px] card-clean p-0.5 leading-none hover:bg-slate-800 focus:outline-none">▲</button>
                <button onclick="moveGastoOrder('${user}', '${gasto.id}', 1)" ${idx === list.length - 1 ? 'disabled class="opacity-20"' : ''} title="Bajar orden" class="text-[10px] card-clean p-0.5 leading-none hover:bg-slate-800 focus:outline-none">▼</button>
              </div>

              <select onchange="updateGastoItem('${user}', '${gasto.id}', 'categoria', this.value)" class="card-clean text-[10px] text-main rounded p-1 outline-none appearance-none pr-4">
                ${catOptionsHtml}
              </select>
              <input type="text" value="${gasto.concepto || ''}" placeholder="Concepto" onchange="updateGastoItem('${user}', '${gasto.id}', 'concepto', this.value)" class="flex-1 card-clean p-1.5 rounded text-xs text-main outline-none min-w-0">
              <button onclick="removeGastoRow('${user}', '${gasto.id}')" class="text-muted hover:text-red-400 p-1.5 card-clean focus:outline-none">🗑️</button>
            </div>
            
            <div class="flex justify-between items-center gap-2 pl-4">
              <button type="button" onclick="replicateGastoValue('${user}', '${gasto.id}')" class="flex items-center gap-1.5 text-[10px] text-muted hover:text-main transition-colors focus:outline-none" title="Copiar este monto a todos los meses">
                <span class="p-1 rounded card-clean">🔁</span>
                <span>Copiar al resto del año</span>
              </button>
              <input type="text" inputmode="decimal" value="${displayPrecio}" placeholder="Monto ($)" onfocus="handleInputFocus(this)" onblur="handleInputBlur(this)" oninput="formatLiveCurrencyInput(this); updateGastoItem('${user}', '${gasto.id}', 'precio', this.value)" onkeydown="handleGastoMontoKeydown(event, this)" class="gasto-monto-input w-32 card-clean p-1.5 rounded text-xs text-main font-bold text-right outline-none">
            </div>
          </div>`;
        container.innerHTML += row;
      });
    }

    function moveGastoOrder(user, id, direction) {
      const mesSelect = currentProyMonth;
      let mesData = getOrCreateMesData(mesSelect);
      let listKey = user === 'Brian' ? 'gastosBrian' : 'gastosVirginia';
      let activeList = mesData[listKey];

      let idx = activeList.findIndex(g => g.id === id);
      let targetIdx = idx + direction;
      if (targetIdx < 0 || targetIdx >= activeList.length) return;

      let temp = activeList[idx];
      activeList[idx] = activeList[targetIdx];
      activeList[targetIdx] = temp;

      let orderedIds = activeList.map(g => g.id);

      ALL_MESES.forEach(mName => {
        if (mName !== mesSelect) {
          let mData = getOrCreateMesData(mName);
          if(mData[listKey]) {
            mData[listKey].sort((a, b) => {
              let indexA = orderedIds.indexOf(a.id);
              let indexB = orderedIds.indexOf(b.id);
              if(indexA === -1) indexA = 9999;
              if(indexB === -1) indexB = 9999;
              return indexA - indexB;
            });
          }
        }
      });

      renderGastosList(user, activeList);
      calcProyTotales();
    }

    function replicateGastoValue(user, id) {
      const mesSelect = currentProyMonth;
      let mesData = getOrCreateMesData(mesSelect);
      let listKey = user === 'Brian' ? 'gastosBrian' : 'gastosVirginia';
      let currGasto = mesData[listKey].find(g => g.id === id);
      if(!currGasto) return;

      let confirmMsg = `¿Copiar el monto de ${formatMoney(Math.abs(currGasto.precio))} a todos los demás meses?`;
      if(!confirm(confirmMsg)) return;

      ALL_MESES.forEach(mName => {
        if (mName !== mesSelect) {
          let mData = getOrCreateMesData(mName);
          let target = mData[listKey].find(g => g.id === id);
          if (target) {
            target.precio = currGasto.precio; 
          }
        }
      });

      alert("✅ Valor replicado a los 11 meses restantes.\nRecordá presionar 'Guardar' para subir los cambios a la base de datos.");
    }

    function addGastoRow(user) {
      const mesSelect = currentProyMonth;
      let key = user === 'Brian' ? 'gastosBrian' : 'gastosVirginia';
      let newId = generateId();

      ALL_MESES.forEach(mName => {
        let mData = getOrCreateMesData(mName);
        mData[key].push({ id: newId, concepto: "", precio: 0, categoria: "otros" });
      });

      let mesData = getOrCreateMesData(mesSelect);
      renderGastosList(user, mesData[key]);
      calcProyTotales();
    }

    function removeGastoRow(user, id) {
      let key = user === 'Brian' ? 'gastosBrian' : 'gastosVirginia';

      ALL_MESES.forEach(mName => {
        let mData = getOrCreateMesData(mName);
        let idx = mData[key].findIndex(g => g.id === id);
        if (idx !== -1) mData[key].splice(idx, 1);
      });

      const mesSelect = currentProyMonth;
      let mesData = getOrCreateMesData(mesSelect);
      renderGastosList(user, mesData[key]);
      calcProyTotales();
    }

    function updateGastoItem(user, id, keyStr, value) {
      const mesSelect = currentProyMonth;
      let listKey = user === 'Brian' ? 'gastosBrian' : 'gastosVirginia';
      
      let parsedValue = keyStr === 'precio' ? parseAmountInput(value) : value;
      let mesData = getOrCreateMesData(mesSelect);
      let currGasto = mesData[listKey].find(g => g.id === id);
      if(!currGasto) return;

      currGasto[keyStr] = parsedValue;

      if (keyStr === 'concepto' || keyStr === 'categoria') {
        ALL_MESES.forEach(mName => {
          if(mName === mesSelect) return;
          let mData = getOrCreateMesData(mName);
          let targetGasto = mData[listKey].find(g => g.id === id);
          if (targetGasto) {
             targetGasto[keyStr] = parsedValue;
          }
        });
      }
      calcProyTotales();
    }

    function getOrCreateMesData(mes) {
      let found = proyeccionesData.find(p => p.mes === mes);
      if (!found) {
        found = { mes: mes, extraBrian: 0, tipoExtraBrian: "Otro", conceptoExtraBrian: "", extraVirginia: 0, tipoExtraVirginia: "Otro", conceptoExtraVirginia: "", gastosBrian: [], gastosVirginia: [], serviciosDesactivados: [] };
        proyeccionesData.push(found);
      }
      if (!found.serviciosDesactivados) {
        found.serviciosDesactivados = [];
      }
      return found;
    }

    function calcProyTotales() {
      let extraB = parseAmountInput(document.getElementById('p-extra-brian').value);
      let extraV = parseAmountInput(document.getElementById('p-extra-virginia').value);
      const mesSelect = currentProyMonth;
      let mesData = getOrCreateMesData(mesSelect);

      let totalBrianNormal = 0; let tercerosBrian = 0;
      (mesData.gastosBrian || []).forEach(g => {
        let p = parseFloat(g.precio) || 0;
        if (p < 0) tercerosBrian += Math.abs(p); else totalBrianNormal += p;
      });

      let totalVirginiaNormal = 0; let tercerosVirginia = 0;
      (mesData.gastosVirginia || []).forEach(g => {
        let p = parseFloat(g.precio) || 0;
        if (p < 0) tercerosVirginia += Math.abs(p); else totalVirginiaNormal += p;
      });

      let totalServicios = getServiciosTotalCalculated();
      let totalTerceros = tercerosBrian + tercerosVirginia;

      let totalGastosFijos = totalBrianNormal + totalVirginiaNormal + totalServicios;
      let totalIngresos = sueldoBaseBrian + sueldoBaseVirginia + extraB + extraV + totalTerceros;
      
      let nosQueda = totalIngresos - totalGastosFijos;

      document.getElementById('subtotal-brian').innerText = formatMoney(totalBrianNormal);
      document.getElementById('subtotal-virginia').innerText = formatMoney(totalVirginiaNormal);
      
      const lblServBottom = document.getElementById('subtotal-servicios-globales-bottom');
      if (lblServBottom) lblServBottom.innerText = formatMoney(totalServicios);

      const statusBadge = document.getElementById('servicios-status-badge');
      if (statusBadge) {
        let disabledCount = getDisabledServiciosForCurrentMonth().length;
        if (disabledCount > 0) {
          statusBadge.innerText = `${serviciosGlobales.length - disabledCount}/${serviciosGlobales.length} activos`;
          statusBadge.className = "text-[9px] card-clean px-1.5 py-0.5 font-semibold text-muted transition-all";
        } else {
          statusBadge.innerText = "Ver / Filtrar";
          statusBadge.className = "text-[9px] card-clean px-1.5 py-0.5 font-semibold text-muted transition-all";
        }
      }

      document.querySelectorAll('.proy-total-ingresos').forEach(el => el.innerText = formatMoney(totalIngresos));
      document.querySelectorAll('.proy-total-gastos').forEach(el => el.innerText = formatMoney(totalGastosFijos));
      document.querySelectorAll('.proy-total-terceros').forEach(el => el.innerText = formatMoney(totalTerceros));
      document.querySelectorAll('.proy-nos-queda').forEach(el => el.innerText = formatMoney(nosQueda));
    }

    function saveProyeccionCurrent(btnElement) {
      if (btnElement) {
        btnElement.innerText = "⏳ Guardando...";
      }

      const mesSelect = currentProyMonth;
      let mesData = getOrCreateMesData(mesSelect);

      mesData.extraBrian = parseAmountInput(document.getElementById('p-extra-brian').value);
      mesData.tipoExtraBrian = document.getElementById('p-tipo-extra-brian').value;
      mesData.conceptoExtraBrian = document.getElementById('p-concepto-extra-brian').value;

      mesData.extraVirginia = parseAmountInput(document.getElementById('p-extra-virginia').value);
      mesData.tipoExtraVirginia = document.getElementById('p-tipo-extra-virginia').value;
      mesData.conceptoExtraVirginia = document.getElementById('p-concepto-extra-virginia').value;

      syncBackend({
        action: "saveProyeccionesAll",
        proyecciones: proyeccionesData
      });

      setTimeout(() => {
        if (btnElement) {
          btnElement.innerText = "🔄 Guardado OK";
          setTimeout(() => { btnElement.innerText = "🔄 Actualizar Extras"; }, 1500);
        }
      }, 1000);

      calcProyTotales();
    }

    window.onload = init;