(function(){
  if(window.__storeTrackerModuleLoaded) return;
  window.__storeTrackerModuleLoaded = true;

  const MODULE_VERSION = 3;
  const STYLE_ID = 'shops-v2-styles';
  const STORE_COLORS = ['#2d5be3', '#22c55e', '#f97316', '#8b5cf6', '#ef4444', '#06b6d4', '#eab308', '#14b8a6'];
  const SHARE_TYPE_LABELS = {
    headcount: 'Podzial na osoby',
    percentage: 'Procent dochodu',
    fixed: 'Stala kwota'
  };
  const CALCULATION_MODE_LABELS = {
    gross_to_net: 'Netto liczone z brutto',
    manual_net: 'Netto wpisywane recznie'
  };
  const DEFAULT_SHOPIFY_API_VERSION = '2025-10';
  const runtime = {
    boundResize: false,
    wheelHost: null,
    silentSyncQueued: false,
    silentSyncRunning: false
  };

  function rootState(){
    if(typeof window.S !== 'object' || !window.S) window.S = {};
    return window.S;
  }

  function esc(value){
    const input = value === null || value === undefined ? '' : String(value);
    if(typeof window.escHtml === 'function') return window.escHtml(input);
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function toastMsg(message, type, duration){
    if(typeof window.toast === 'function') window.toast(message, type || 'info', duration || 2400);
    else if(typeof window.notify === 'function') window.notify(message);
  }

  function uid(prefix){
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function nowIso(){
    return new Date().toISOString();
  }

  function localDate(value){
    const date = value ? (value instanceof Date ? value : new Date(value)) : new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function monthKey(value){
    const date = value ? (value instanceof Date ? value : new Date(value)) : new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  function parseMonthKey(key){
    const match = String(key || '').match(/^(\d{4})-(\d{2})$/);
    const base = match ? new Date(Number(match[1]), Number(match[2]) - 1, 1) : new Date();
    const year = base.getFullYear();
    const monthIndex = base.getMonth();
    return {
      year,
      monthIndex,
      daysInMonth: new Date(year, monthIndex + 1, 0).getDate()
    };
  }

  function dateFromMonthDay(key, day){
    const meta = parseMonthKey(key);
    const month = String(meta.monthIndex + 1).padStart(2, '0');
    return `${meta.year}-${month}-${String(day).padStart(2, '0')}`;
  }

  function monthDays(key){
    const meta = parseMonthKey(key);
    return Array.from({length: meta.daysInMonth}, (_, index)=>dateFromMonthDay(key, index + 1));
  }

  function isDateInMonth(date, key){
    return String(date || '').slice(0, 7) === String(key || '');
  }

  function monthLabel(key){
    const meta = parseMonthKey(key);
    return new Intl.DateTimeFormat('pl-PL', {month:'long', year:'numeric'})
      .format(new Date(meta.year, meta.monthIndex, 1))
      .replace(/^./, value=>value.toUpperCase());
  }

  function shortDateLabel(dateStr){
    return new Intl.DateTimeFormat('pl-PL', {day:'numeric', month:'short'})
      .format(new Date(`${dateStr}T12:00:00`));
  }

  function fullDateLabel(dateStr){
    return new Intl.DateTimeFormat('pl-PL', {
      weekday:'long',
      day:'numeric',
      month:'long',
      year:'numeric'
    }).format(new Date(`${dateStr}T12:00:00`));
  }

  function weekdayShort(dateStr){
    return new Intl.DateTimeFormat('pl-PL', {weekday:'short'})
      .format(new Date(`${dateStr}T12:00:00`))
      .replace('.', '')
      .replace(/^./, value=>value.toUpperCase());
  }

  function numberValue(value){
    if(typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const normalized = String(value ?? '').trim().replace(/\s+/g, '').replace(',', '.');
    if(!normalized) return 0;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function maybeNumber(value){
    const normalized = String(value ?? '').trim().replace(/\s+/g, '').replace(',', '.');
    if(!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function nonNegative(value){
    return Math.max(0, numberValue(value));
  }

  function formatPLN(value){
    return new Intl.NumberFormat('pl-PL', {
      style:'currency',
      currency:'PLN',
      minimumFractionDigits:0,
      maximumFractionDigits:2
    }).format(numberValue(value));
  }

  function formatCompactPLN(value){
    const amount = numberValue(value);
    const abs = Math.abs(amount);
    if(abs >= 1000000) return `${(amount / 1000000).toLocaleString('pl-PL', {maximumFractionDigits:1})} mln zl`;
    if(abs >= 1000) return `${(amount / 1000).toLocaleString('pl-PL', {maximumFractionDigits:1})} tys. zl`;
    return formatPLN(amount);
  }

  function formatPct(value){
    if(value === null || value === undefined || Number.isNaN(Number(value))) return '-';
    return `${numberValue(value).toLocaleString('pl-PL', {maximumFractionDigits:1})}%`;
  }

  function formatInputNumber(value){
    if(value === null || value === undefined || value === '') return '';
    const parsed = Number(value);
    if(!Number.isFinite(parsed)) return '';
    return String(parsed);
  }

  function cssVar(name, fallback){
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  function defaultUi(){
    return {
      view: 'overview',
      monthKey: monthKey(new Date()),
      selectedDate: localDate(new Date()),
      summaryMode: 'today',
      companyId: null,
      storeId: null,
      modal: null
    };
  }

  function trackerSnapshot(data){
    return JSON.stringify({
      version: data?.version || null,
      companies: Array.isArray(data?.companies) ? data.companies : [],
      stores: Array.isArray(data?.stores) ? data.stores : [],
      dailyStats: Array.isArray(data?.dailyStats) ? data.dailyStats : [],
      ui: data?.ui || {},
      meta: data?.meta || {}
    });
  }

  function normalizeCompany(company, index){
    const now = nowIso();
    return {
      id: company?.id ? String(company.id) : uid(`company_${index || 0}`),
      name: String(company?.name || `Firma ${index + 1 || ''}`).trim() || `Firma ${index + 1 || ''}`,
      is_active: company?.is_active !== false,
      created_at: company?.created_at || now,
      updated_at: company?.updated_at || now
    };
  }

  function normalizeStore(store, index, fallbackCompanyId){
    const now = nowIso();
    const color = store?.color || STORE_COLORS[index % STORE_COLORS.length];
    return {
      id: store?.id ? String(store.id) : uid(`store_${index || 0}`),
      company_id: store?.company_id ? String(store.company_id) : String(fallbackCompanyId || ''),
      name: String(store?.name || `Sklep ${index + 1 || ''}`).trim() || `Sklep ${index + 1 || ''}`,
      is_active: store?.is_active !== false,
      color,
      vat_rate: Math.max(0, Math.min(99, numberValue(store?.vat_rate ?? 23))),
      headcount: Math.max(1, parseInt(store?.headcount ?? 1, 10) || 1),
      profit_share_type: ['headcount', 'percentage', 'fixed'].includes(store?.profit_share_type) ? store.profit_share_type : 'headcount',
      profit_share_value: numberValue(store?.profit_share_value || 0),
      calculation_mode: ['gross_to_net', 'manual_net'].includes(store?.calculation_mode) ? store.calculation_mode : 'gross_to_net',
      shopify_enabled: !!store?.shopify_enabled,
      shopify_domain: String(store?.shopify_domain || '').trim(),
      shopify_admin_token: String(store?.shopify_admin_token || '').trim(),
      shopify_api_version: String(store?.shopify_api_version || DEFAULT_SHOPIFY_API_VERSION).trim() || DEFAULT_SHOPIFY_API_VERSION,
      shopify_last_sync_at: store?.shopify_last_sync_at || null,
      created_at: store?.created_at || now,
      updated_at: store?.updated_at || now
    };
  }

  function normalizeStat(stat){
    if(!stat || !stat.store_id || !stat.date) return null;
    const now = nowIso();
    return {
      id: stat.id ? String(stat.id) : uid('stat'),
      store_id: String(stat.store_id),
      date: String(stat.date).slice(0, 10),
      revenue_gross: nonNegative(stat.revenue_gross),
      revenue_net: stat.revenue_net === null || stat.revenue_net === undefined || stat.revenue_net === '' ? null : nonNegative(stat.revenue_net),
      ad_cost_tiktok: nonNegative(stat.ad_cost_tiktok),
      refunds: nonNegative(stat.refunds),
      extra_costs: nonNegative(stat.extra_costs),
      notes: String(stat.notes || '').trim(),
      created_at: stat.created_at || now,
      updated_at: stat.updated_at || now
    };
  }

  function sumAmounts(items, field){
    return (items || []).reduce((total, item)=>total + numberValue(field ? item?.[field] : item), 0);
  }

  function migrateLegacyData(data){
    if(data.meta.migratedToCompanies) return;

    if(Array.isArray(data.companies) && data.companies.length){
      data.meta.migratedToCompanies = true;
      return;
    }

    if(Array.isArray(data.stores) && data.stores.length){
      const companyId = uid('company_import');
      data.companies = [normalizeCompany({id:companyId, name:'Zaimportowane', is_active:true}, 0)];
      data.stores = data.stores.map((store, index)=>normalizeStore({
        ...store,
        company_id: store.company_id || companyId
      }, index, companyId));
      data.meta.migratedToCompanies = true;
      return;
    }

    const state = rootState();
    if(Array.isArray(state.shops) && state.shops.length){
      const companyId = uid('company_legacy');
      data.companies = [normalizeCompany({id:companyId, name:'Zaimportowane', is_active:true}, 0)];
      const importedStats = [];
      data.stores = state.shops.map((shop, index)=>{
        const storeId = String(shop.id || uid('legacy_store'));
        (shop.entries || []).forEach(entry=>{
          importedStats.push(normalizeStat({
            id: entry.id ? `legacy_${shop.id}_${entry.id}` : uid('legacy_stat'),
            store_id: storeId,
            date: String(entry.date || '').slice(0, 10),
            revenue_gross: Array.isArray(entry.revenues) ? sumAmounts(entry.revenues, 'amount') : numberValue(entry.revenue),
            revenue_net: null,
            ad_cost_tiktok: Array.isArray(entry.adEntries) ? sumAmounts(entry.adEntries, 'amount') : 0,
            refunds: 0,
            extra_costs: 0,
            notes: ''
          }));
        });
        return normalizeStore({
          id: storeId,
          company_id: companyId,
          name: shop.name,
          is_active: shop.status !== 'inactive',
          vat_rate: shop.vatRate ?? 23,
          headcount: shop.people ?? 1,
          profit_share_type: 'headcount',
          profit_share_value: 0,
          calculation_mode: 'gross_to_net',
          color: STORE_COLORS[index % STORE_COLORS.length]
        }, index, companyId);
      });
      data.dailyStats = importedStats.filter(Boolean);
    }

    data.meta.migratedToCompanies = true;
  }

  function seedDemoData(data){
    if(window.__enableStoreTrackerDemoSeed !== true) return;
    if(data.meta.seeded) return;
    if(data.companies.length || data.stores.length || data.dailyStats.length) return;

    const firstCompanyId = uid('company');
    const secondCompanyId = uid('company');
    const companies = [
      normalizeCompany({id:firstCompanyId, name:'Forzone Commerce', is_active:true}, 0),
      normalizeCompany({id:secondCompanyId, name:'Nova Brands', is_active:true}, 1)
    ];
    const stores = [
      normalizeStore({id:uid('store'), company_id:firstCompanyId, name:'FashionDrop PL', vat_rate:23, headcount:2, profit_share_type:'headcount', profit_share_value:0, calculation_mode:'gross_to_net', color:'#2d5be3'}, 0, firstCompanyId),
      normalizeStore({id:uid('store'), company_id:firstCompanyId, name:'TechGear EU', vat_rate:23, headcount:3, profit_share_type:'headcount', profit_share_value:0, calculation_mode:'gross_to_net', color:'#22c55e'}, 1, firstCompanyId),
      normalizeStore({id:uid('store'), company_id:secondCompanyId, name:'GlowSkin Studio', vat_rate:23, headcount:2, profit_share_type:'percentage', profit_share_value:35, calculation_mode:'manual_net', color:'#f97316'}, 2, secondCompanyId),
      normalizeStore({id:uid('store'), company_id:secondCompanyId, name:'HomeCraft Lab', vat_rate:8, headcount:1, profit_share_type:'fixed', profit_share_value:850, calculation_mode:'gross_to_net', color:'#8b5cf6'}, 3, secondCompanyId)
    ];

    const currentMonth = monthKey(new Date());
    const stats = [
      {store_id:stores[0].id, date:dateFromMonthDay(currentMonth, 2), revenue_gross:15400, revenue_net:null, ad_cost_tiktok:2600, refunds:340, extra_costs:180, notes:'Wyprzedaz weekendowa'},
      {store_id:stores[0].id, date:dateFromMonthDay(currentMonth, 5), revenue_gross:18220, revenue_net:null, ad_cost_tiktok:3180, refunds:520, extra_costs:240, notes:'Nowe kreacje UGC'},
      {store_id:stores[0].id, date:dateFromMonthDay(currentMonth, 12), revenue_gross:16780, revenue_net:null, ad_cost_tiktok:2950, refunds:410, extra_costs:160, notes:''},
      {store_id:stores[1].id, date:dateFromMonthDay(currentMonth, 3), revenue_gross:12340, revenue_net:null, ad_cost_tiktok:2140, refunds:210, extra_costs:120, notes:'Start nowej kampanii'},
      {store_id:stores[1].id, date:dateFromMonthDay(currentMonth, 9), revenue_gross:14180, revenue_net:null, ad_cost_tiktok:2480, refunds:280, extra_costs:190, notes:''},
      {store_id:stores[1].id, date:dateFromMonthDay(currentMonth, 15), revenue_gross:13260, revenue_net:null, ad_cost_tiktok:2210, refunds:320, extra_costs:140, notes:'Dobra konwersja z Tiktoka'},
      {store_id:stores[2].id, date:dateFromMonthDay(currentMonth, 4), revenue_gross:9800, revenue_net:7967, ad_cost_tiktok:1690, refunds:120, extra_costs:80, notes:'Manualne netto z ERP'},
      {store_id:stores[2].id, date:dateFromMonthDay(currentMonth, 11), revenue_gross:11750, revenue_net:9552, ad_cost_tiktok:1910, refunds:180, extra_costs:130, notes:''},
      {store_id:stores[3].id, date:dateFromMonthDay(currentMonth, 6), revenue_gross:8340, revenue_net:null, ad_cost_tiktok:980, refunds:60, extra_costs:110, notes:'Niski koszt zwrotow'},
      {store_id:stores[3].id, date:dateFromMonthDay(currentMonth, 13), revenue_gross:9050, revenue_net:null, ad_cost_tiktok:1140, refunds:90, extra_costs:140, notes:'Nowa oferta pakietowa'}
    ].map((stat, index)=>normalizeStat({id:`seed_${index + 1}`, ...stat}));

    data.companies = companies;
    data.stores = stores;
    data.dailyStats = stats;
    data.meta.seeded = true;
  }

  function isBuiltInDemoData(data){
    const companyNames = (data.companies || []).map(company=>String(company.name || '').trim()).sort().join('|');
    const storeNames = (data.stores || []).map(store=>String(store.name || '').trim()).sort().join('|');
    const demoCompanies = ['Forzone Commerce', 'Nova Brands'].sort().join('|');
    const demoStores = ['FashionDrop PL', 'TechGear EU', 'GlowSkin Studio', 'HomeCraft Lab'].sort().join('|');
    if(companyNames !== demoCompanies || storeNames !== demoStores) return false;
    if(!(data.dailyStats || []).length) return false;
    return (data.dailyStats || []).every(stat=>String(stat.id || '').startsWith('seed_'));
  }

  function cleanupBuiltInDemoData(data){
    if(!isBuiltInDemoData(data)) return false;
    data.companies = [];
    data.stores = [];
    data.dailyStats = [];
    data.ui.companyId = null;
    data.ui.storeId = null;
    data.ui.view = 'overview';
    data.meta.seeded = false;
    data.meta.migratedToCompanies = true;
    data.meta.cleanedBuiltInDemo = true;
    return true;
  }

  function ensureData(){
    const state = rootState();
    if(!state.storeTracker || typeof state.storeTracker !== 'object') state.storeTracker = {};
    const data = state.storeTracker;
    const before = trackerSnapshot(data);
    if(!Array.isArray(data.companies)) data.companies = [];
    if(!Array.isArray(data.stores)) data.stores = [];
    if(!Array.isArray(data.dailyStats)) data.dailyStats = [];
    if(!data.ui || typeof data.ui !== 'object') data.ui = {};
    if(!data.meta || typeof data.meta !== 'object') data.meta = {};
    data.version = MODULE_VERSION;
    if(typeof data.meta.migratedToCompanies !== 'boolean') data.meta.migratedToCompanies = false;
    if(typeof data.meta.seeded !== 'boolean') data.meta.seeded = false;

    const defaults = defaultUi();
    Object.keys(defaults).forEach(key=>{
      if(data.ui[key] === undefined || data.ui[key] === null || data.ui[key] === '') data.ui[key] = defaults[key];
    });
    if(!['today', 'yesterday', 'week', 'month', 'year'].includes(String(data.ui.summaryMode || ''))){
      data.ui.summaryMode = defaults.summaryMode;
    }

    cleanupBuiltInDemoData(data);
    migrateLegacyData(data);
    seedDemoData(data);

    data.companies = data.companies.map((company, index)=>normalizeCompany(company, index));
    const companyIds = new Set(data.companies.map(company=>company.id));
    const fallbackCompanyId = data.companies[0]?.id || null;
    data.stores = data.stores
      .map((store, index)=>normalizeStore({
        ...store,
        company_id: companyIds.has(String(store.company_id || '')) ? String(store.company_id) : fallbackCompanyId
      }, index, fallbackCompanyId))
      .filter(store=>store.company_id);
    const storeIds = new Set(data.stores.map(store=>store.id));
    data.dailyStats = data.dailyStats
      .map(normalizeStat)
      .filter(Boolean)
      .filter(stat=>storeIds.has(stat.store_id))
      .sort((a, b)=>a.date.localeCompare(b.date));

    if(!data.ui.companyId || !data.companies.some(company=>company.id === data.ui.companyId)){
      data.ui.companyId = data.companies[0]?.id || null;
    }
    if(!data.ui.storeId || !data.stores.some(store=>store.id === data.ui.storeId)){
      data.ui.storeId = data.stores.find(store=>store.company_id === data.ui.companyId)?.id || data.stores[0]?.id || null;
    }
    if(data.ui.view === 'company' && !data.ui.companyId) data.ui.view = 'overview';
    if(data.ui.view === 'store' && !data.ui.storeId) data.ui.view = data.ui.companyId ? 'company' : 'overview';
    if(!isDateInMonth(data.ui.selectedDate, data.ui.monthKey)){
      const today = localDate(new Date());
      data.ui.selectedDate = isDateInMonth(today, data.ui.monthKey) ? today : dateFromMonthDay(data.ui.monthKey, 1);
    }
    syncLegacyMirror(data);
    if(before !== trackerSnapshot(data)) scheduleSilentPersist();
    return data;
  }

  function syncLegacyMirror(data){
    const companiesById = new Map((data.companies || []).map(company=>[company.id, company]));
    const statsByStore = new Map();
    (data.dailyStats || []).forEach(stat=>{
      const items = statsByStore.get(stat.store_id) || [];
      items.push({
        id: stat.id,
        date: stat.date,
        revenue_gross: nonNegative(stat.revenue_gross),
        ad_cost_tiktok: nonNegative(stat.ad_cost_tiktok)
      });
      statsByStore.set(stat.store_id, items);
    });
    rootState().shops = (data.stores || []).map(store=>{
      const company = companiesById.get(store.company_id);
      const entries = (statsByStore.get(store.id) || []).map(item=>({
        id: item.id,
        date: item.date,
        revenues: item.revenue_gross > 0 ? [{id:`${item.id}_gross`, amount:item.revenue_gross}] : [],
        adEntries: item.ad_cost_tiktok > 0 ? [{id:`${item.id}_ads`, amount:item.ad_cost_tiktok}] : []
      }));
      return {
        id: store.id,
        name: store.name,
        platform: company ? company.name : 'Firma',
        notes: '',
        adsOn: store.is_active,
        campaignOk: true,
        status: store.is_active ? 'active' : 'inactive',
        vatRate: store.vat_rate,
        people: store.headcount,
        entries
      };
    });
  }

  function scheduleSilentPersist(){
    if(runtime.silentSyncQueued) return;
    runtime.silentSyncQueued = true;
    setTimeout(()=>{
      runtime.silentSyncQueued = false;
      if(runtime.silentSyncRunning) return;
      runtime.silentSyncRunning = true;
      try{
        const data = rootState().storeTracker;
        if(data) syncLegacyMirror(data);
        if(typeof window.saveS === 'function') window.saveS();
      }catch(error){
        console.warn('storeTracker silent save failed', error);
      }finally{
        runtime.silentSyncRunning = false;
      }
    }, 0);
  }

  function persist(message, type){
    const data = ensureData();
    syncLegacyMirror(data);
    if(typeof window.saveS === 'function') window.saveS();
    if(message) toastMsg(message, type || 'success', 2200);
  }

  function getCompany(companyId){
    return ensureData().companies.find(company=>company.id === String(companyId)) || null;
  }

  function getStore(storeId){
    return ensureData().stores.find(store=>store.id === String(storeId)) || null;
  }

  function getStoreStat(storeId, date){
    return ensureData().dailyStats.find(stat=>stat.store_id === String(storeId) && stat.date === String(date)) || null;
  }

  function getStoresForCompany(companyId, includeInactive){
    return ensureData().stores
      .filter(store=>store.company_id === String(companyId))
      .filter(store=>includeInactive ? true : store.is_active)
      .sort((a, b)=>a.name.localeCompare(b.name, 'pl'));
  }

  function getStatsForStore(storeId){
    return ensureData().dailyStats.filter(stat=>stat.store_id === String(storeId));
  }

  function resolveRevenueNet(store, stat){
    const manual = maybeNumber(stat.revenue_net);
    if(store.calculation_mode === 'manual_net') return manual ?? 0;
    return manual ?? (nonNegative(stat.revenue_gross) / (1 + store.vat_rate / 100));
  }

  function calculatePerHead(store, income){
    if(store.profit_share_type === 'percentage') return income * (numberValue(store.profit_share_value) / 100);
    if(store.profit_share_type === 'fixed') return numberValue(store.profit_share_value);
    return income / Math.max(1, store.headcount || 1);
  }

  function computeStat(store, stat){
    const revenueGross = nonNegative(stat.revenue_gross);
    const revenueNetResolved = Math.max(0, resolveRevenueNet(store, stat));
    const adCostTiktok = nonNegative(stat.ad_cost_tiktok);
    const refunds = nonNegative(stat.refunds);
    const extraCosts = nonNegative(stat.extra_costs);
    const income = revenueNetResolved - adCostTiktok - refunds - extraCosts;
    const perHead = calculatePerHead(store, income);
    const adPct = revenueGross > 0 ? (adCostTiktok / revenueGross) * 100 : null;
    const hasManualNet = maybeNumber(stat.revenue_net) !== null;
    const hasAnyData = revenueGross > 0 || revenueNetResolved > 0 || adCostTiktok > 0 || refunds > 0 || extraCosts > 0 || !!String(stat.notes || '').trim();
    return {
      ...stat,
      revenue_gross: revenueGross,
      revenue_net_resolved: revenueNetResolved,
      ad_cost_tiktok: adCostTiktok,
      refunds,
      extra_costs: extraCosts,
      income,
      per_head: perHead,
      ad_pct: adPct,
      has_manual_net: hasManualNet,
      has_any_data: hasAnyData
    };
  }

  function dateAtNoon(value){
    return new Date(`${String(value).slice(0, 10)}T12:00:00`);
  }

  function addDays(date, days){
    const next = new Date(date.getTime());
    next.setDate(next.getDate() + Number(days || 0));
    return next;
  }

  function getRangePresetBounds(mode, selectedDate){
    const preset = ['today', 'yesterday', 'week', 'month', 'year'].includes(String(mode || '')) ? String(mode) : 'today';
    const base = dateAtNoon(selectedDate || localDate(new Date()));
    const year = base.getFullYear();
    const month = base.getMonth();

    if(preset === 'yesterday'){
      const day = addDays(base, -1);
      return {preset, start: localDate(day), end: localDate(day)};
    }
    if(preset === 'week'){
      const weekday = base.getDay() === 0 ? 6 : base.getDay() - 1;
      const start = addDays(base, -weekday);
      const end = addDays(start, 6);
      return {preset, start: localDate(start), end: localDate(end)};
    }
    if(preset === 'month'){
      return {
        preset,
        start: localDate(new Date(year, month, 1, 12)),
        end: localDate(new Date(year, month + 1, 0, 12))
      };
    }
    if(preset === 'year'){
      return {
        preset,
        start: localDate(new Date(year, 0, 1, 12)),
        end: localDate(new Date(year, 11, 31, 12))
      };
    }
    return {preset, start: localDate(base), end: localDate(base)};
  }

  function isDateInRange(date, bounds){
    const value = String(date || '').slice(0, 10);
    return value >= bounds.start && value <= bounds.end;
  }

  function statsForStoreInMonth(storeId, key){
    const store = getStore(storeId);
    if(!store) return [];
    return getStatsForStore(storeId)
      .filter(stat=>isDateInMonth(stat.date, key))
      .map(stat=>computeStat(store, stat))
      .sort((a, b)=>a.date.localeCompare(b.date));
  }

  function statsForStoreInDay(storeId, date){
    const store = getStore(storeId);
    const stat = getStoreStat(storeId, date);
    if(!store || !stat) return [];
    return [computeStat(store, stat)];
  }

  function statsForStoreInRange(storeId, mode, selectedDate){
    const store = getStore(storeId);
    if(!store) return [];
    const bounds = getRangePresetBounds(mode, selectedDate);
    return getStatsForStore(storeId)
      .filter(stat=>isDateInRange(stat.date, bounds))
      .map(stat=>computeStat(store, stat))
      .sort((a, b)=>a.date.localeCompare(b.date));
  }

  function summarizeStore(store, key, mode, selectedDate){
    const stats = statsForStoreInRange(store.id, mode, selectedDate);
    const gross = sumAmounts(stats, 'revenue_gross');
    const net = sumAmounts(stats, 'revenue_net_resolved');
    const ads = sumAmounts(stats, 'ad_cost_tiktok');
    const refunds = sumAmounts(stats, 'refunds');
    const extra = sumAmounts(stats, 'extra_costs');
    const income = sumAmounts(stats, 'income');
    return {
      store,
      stats,
      gross,
      net,
      ads,
      refunds,
      extra,
      income,
      perHead: calculatePerHead(store, income),
      adPct: gross > 0 ? (ads / gross) * 100 : null,
      filledDays: stats.filter(stat=>stat.has_any_data).length
    };
  }

  function aggregateSummaries(summaries){
    const gross = sumAmounts(summaries, 'gross');
    const net = sumAmounts(summaries, 'net');
    const ads = sumAmounts(summaries, 'ads');
    const refunds = sumAmounts(summaries, 'refunds');
    const extra = sumAmounts(summaries, 'extra');
    const income = sumAmounts(summaries, 'income');
    const perHead = sumAmounts(summaries, 'perHead');
    const ranking = summaries
      .filter(summary=>summary.gross > 0 || summary.income !== 0 || summary.ads > 0 || summary.refunds > 0 || summary.extra > 0)
      .sort((a, b)=>b.income - a.income);
    return {
      gross,
      net,
      ads,
      refunds,
      extra,
      income,
      perHead,
      adPct: gross > 0 ? (ads / gross) * 100 : null,
      ranking,
      best: ranking[0] || null,
      worst: ranking[ranking.length - 1] || null
    };
  }

  function summarizeCompany(company, key, mode, selectedDate){
    const stores = getStoresForCompany(company.id, true);
    const storeSummaries = stores.map(store=>summarizeStore(store, key, mode, selectedDate));
    return {
      company,
      stores,
      storeSummaries,
      ...aggregateSummaries(storeSummaries)
    };
  }

  function summarizeGlobal(key, mode, selectedDate){
    const companies = ensureData().companies;
    const companySummaries = companies.map(company=>summarizeCompany(company, key, mode, selectedDate));
    const storeSummaries = companySummaries.flatMap(summary=>summary.storeSummaries);
    return {
      companies: companySummaries,
      stores: storeSummaries,
      ...aggregateSummaries(storeSummaries)
    };
  }

  function ensureSelectedDateForStore(storeId){
    const data = ensureData();
    const store = getStore(storeId);
    if(!store) return;
    if(isDateInMonth(data.ui.selectedDate, data.ui.monthKey)) return;
    const monthStats = statsForStoreInMonth(storeId, data.ui.monthKey);
    const today = localDate(new Date());
    data.ui.selectedDate = monthStats[0]?.date || (isDateInMonth(today, data.ui.monthKey) ? today : dateFromMonthDay(data.ui.monthKey, 1));
  }

  function setMonth(key){
    if(!/^\d{4}-\d{2}$/.test(String(key || ''))) return;
    const data = ensureData();
    data.ui.monthKey = key;
    if(!isDateInMonth(data.ui.selectedDate, key)){
      const today = localDate(new Date());
      data.ui.selectedDate = isDateInMonth(today, key) ? today : dateFromMonthDay(key, 1);
    }
    if(data.ui.storeId) ensureSelectedDateForStore(data.ui.storeId);
    renderShops();
  }

  function shiftMonth(delta){
    const meta = parseMonthKey(ensureData().ui.monthKey);
    setMonth(monthKey(new Date(meta.year, meta.monthIndex + Number(delta || 0), 1)));
  }

  function setSummaryMode(mode){
    const data = ensureData();
    data.ui.summaryMode = ['today', 'yesterday', 'week', 'month', 'year'].includes(String(mode || '')) ? String(mode) : 'today';
    renderShops();
  }

  function setSelectedDate(date){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return;
    const data = ensureData();
    data.ui.selectedDate = date;
    data.ui.monthKey = String(date).slice(0, 7);
    renderShops();
  }

  function openOverview(){
    const data = ensureData();
    data.ui.view = 'overview';
    renderShops();
  }

  function openCompany(companyId){
    const data = ensureData();
    const company = getCompany(companyId);
    if(!company) return;
    data.ui.companyId = company.id;
    data.ui.storeId = getStoresForCompany(company.id, true)[0]?.id || null;
    data.ui.view = 'company';
    renderShops();
  }

  function openStore(storeId){
    const data = ensureData();
    const store = getStore(storeId);
    if(!store) return;
    data.ui.storeId = store.id;
    data.ui.companyId = store.company_id;
    data.ui.view = 'store';
    ensureSelectedDateForStore(store.id);
    renderShops();
  }

  function plural(value, one, few, many){
    const count = Math.abs(Number(value) || 0);
    const mod10 = count % 10;
    const mod100 = count % 100;
    if(count === 1) return one;
    if(mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return few;
    return many;
  }

  function rangeLabel(key, mode, selectedDate){
    const bounds = getRangePresetBounds(mode, selectedDate);
    if(bounds.preset === 'today') return `Dzisiaj • ${fullDateLabel(bounds.start)}`;
    if(bounds.preset === 'yesterday') return `Wczoraj • ${fullDateLabel(bounds.start)}`;
    if(bounds.preset === 'week') return `${shortDateLabel(bounds.start)} - ${shortDateLabel(bounds.end)}`;
    if(bounds.preset === 'month') return monthLabel(bounds.start.slice(0, 7));
    return String(dateAtNoon(bounds.start).getFullYear());
  }

  function companyAccent(companySummary){
    return companySummary?.storeSummaries?.[0]?.store?.color || cssVar('--accent', '#4f7ef8');
  }

  function statMapForStore(storeId, key){
    return new Map(statsForStoreInMonth(storeId, key).map(stat=>[stat.date, stat]));
  }

  function buildCalendarCells(key){
    const meta = parseMonthKey(key);
    const firstDate = new Date(meta.year, meta.monthIndex, 1);
    const firstWeekday = firstDate.getDay();
    const mondayIndex = firstWeekday === 0 ? 6 : firstWeekday - 1;
    const prevMonth = new Date(meta.year, meta.monthIndex - 1, 1);
    const nextMonth = new Date(meta.year, meta.monthIndex + 1, 1);
    const prevMeta = parseMonthKey(monthKey(prevMonth));
    const cells = [];

    for(let index = mondayIndex - 1; index >= 0; index -= 1){
      const day = prevMeta.daysInMonth - index;
      const date = dateFromMonthDay(monthKey(prevMonth), day);
      cells.push({
        date,
        day,
        otherMonth: true,
        weekend: [6, 0].includes(new Date(`${date}T12:00:00`).getDay())
      });
    }

    for(let day = 1; day <= meta.daysInMonth; day += 1){
      const date = dateFromMonthDay(key, day);
      cells.push({
        date,
        day,
        otherMonth: false,
        weekend: [6, 0].includes(new Date(`${date}T12:00:00`).getDay())
      });
    }

    let nextDay = 1;
    while(cells.length < 35 || cells.length % 7 !== 0){
      const date = dateFromMonthDay(monthKey(nextMonth), nextDay);
      cells.push({
        date,
        day: nextDay,
        otherMonth: true,
        weekend: [6, 0].includes(new Date(`${date}T12:00:00`).getDay())
      });
      nextDay += 1;
    }

    return cells;
  }

  function jumpToDate(date){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return;
    const data = ensureData();
    data.ui.monthKey = String(date).slice(0, 7);
    data.ui.selectedDate = date;
    renderShops();
  }

  function touchUpdated(entity){
    entity.updated_at = nowIso();
    return entity;
  }

  function openCompanyModal(companyId){
    const data = ensureData();
    data.ui.modal = {
      type: 'company',
      mode: companyId ? 'edit' : 'create',
      companyId: companyId ? String(companyId) : null
    };
    renderShops();
  }

  function openStoreModal(companyId, storeId){
    const data = ensureData();
    const store = storeId ? getStore(storeId) : null;
    const resolvedCompanyId = store?.company_id || companyId || data.ui.companyId || data.companies[0]?.id || null;
    if(!resolvedCompanyId){
      toastMsg('Najpierw dodaj firmę', 'info', 2200);
      return;
    }
    data.ui.modal = {
      type: 'store',
      mode: store ? 'edit' : 'create',
      storeId: store ? store.id : null,
      companyId: resolvedCompanyId
    };
    renderShops();
  }

  function openStatModal(storeId, date){
    const data = ensureData();
    const store = getStore(storeId || data.ui.storeId);
    if(!store){
      toastMsg('Najpierw wybierz sklep', 'info', 2200);
      return;
    }
    const resolvedDate = /^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))
      ? String(date)
      : (data.ui.selectedDate || dateFromMonthDay(data.ui.monthKey, 1));
    data.ui.storeId = store.id;
    data.ui.companyId = store.company_id;
    data.ui.selectedDate = resolvedDate;
    data.ui.modal = {
      type: 'stat',
      mode: getStoreStat(store.id, resolvedDate) ? 'edit' : 'create',
      storeId: store.id,
      date: resolvedDate
    };
    renderShops();
  }

  function confirmDeleteCompany(companyId){
    const company = getCompany(companyId);
    if(!company) return;
    const storeCount = getStoresForCompany(company.id, true).length;
    const data = ensureData();
    data.ui.modal = {
      type: 'confirm',
      entity: 'company',
      companyId: company.id,
      title: 'Usunąć firmę?',
      description: `Firma "${company.name}" oraz ${storeCount} ${plural(storeCount, 'sklep', 'sklepy', 'sklepów')} zostaną usunięte razem z danymi dziennymi.`
    };
    renderShops();
  }

  function confirmDeleteStore(storeId){
    const store = getStore(storeId);
    if(!store) return;
    const entries = getStatsForStore(store.id).length;
    const data = ensureData();
    data.ui.modal = {
      type: 'confirm',
      entity: 'store',
      storeId: store.id,
      title: 'Usunąć sklep?',
      description: `Sklep "${store.name}" oraz ${entries} ${plural(entries, 'dzień', 'dni', 'dni')} danych zostaną usunięte.`
    };
    renderShops();
  }

  function confirmDeleteStat(storeId, date){
    const store = getStore(storeId);
    const stat = getStoreStat(storeId, date);
    if(!store || !stat) return;
    const data = ensureData();
    data.ui.modal = {
      type: 'confirm',
      entity: 'stat',
      storeId: store.id,
      date: stat.date,
      title: 'Usunąć dane dnia?',
      description: `${store.name} • ${fullDateLabel(stat.date)}`
    };
    renderShops();
  }

  function closeModal(){
    ensureData().ui.modal = null;
    renderShops();
  }

  function saveCompanyForm(){
    const data = ensureData();
    const modal = data.ui.modal || {};
    const name = String(document.getElementById('shops-company-name')?.value || '').trim();
    const isActive = !!document.getElementById('shops-company-active')?.checked;
    if(!name){
      toastMsg('Podaj nazwę firmy', 'error', 2200);
      return;
    }

    let company = modal.companyId ? getCompany(modal.companyId) : null;
    if(company){
      company.name = name;
      company.is_active = isActive;
      touchUpdated(company);
    }else{
      company = normalizeCompany({
        id: uid('company'),
        name,
        is_active: isActive
      }, data.companies.length);
      data.companies.push(company);
      data.ui.companyId = company.id;
    }

    data.ui.modal = null;
    if(!data.ui.storeId){
      data.ui.view = 'company';
      data.ui.companyId = company.id;
    }
    persist(company.id === modal.companyId ? 'Zapisano firmę' : 'Dodano firmę');
    renderShops();
  }

  function saveStoreForm(){
    const data = ensureData();
    const modal = data.ui.modal || {};
    const companyId = String(document.getElementById('shops-store-company')?.value || '').trim();
    const name = String(document.getElementById('shops-store-name')?.value || '').trim();
    const isActive = !!document.getElementById('shops-store-active')?.checked;
    const vatRate = Math.max(0, Math.min(99, numberValue(document.getElementById('shops-store-vat')?.value)));
    const headcount = Math.max(1, parseInt(document.getElementById('shops-store-headcount')?.value || '1', 10) || 1);
    const profitShareType = String(document.getElementById('shops-store-share-type')?.value || 'headcount');
    const profitShareValue = numberValue(document.getElementById('shops-store-share-value')?.value);
    const calculationMode = String(document.getElementById('shops-store-calc-mode')?.value || 'gross_to_net');
    const color = String(document.getElementById('shops-store-color')?.value || cssVar('--accent', '#4f7ef8')).trim() || cssVar('--accent', '#4f7ef8');
    const shopifyEnabled = !!document.getElementById('shops-store-shopify-enabled')?.checked;
    const shopifyDomain = String(document.getElementById('shops-store-shopify-domain')?.value || '').trim();
    const shopifyAdminToken = String(document.getElementById('shops-store-shopify-token')?.value || '').trim();
    const shopifyApiVersion = String(document.getElementById('shops-store-shopify-version')?.value || DEFAULT_SHOPIFY_API_VERSION).trim() || DEFAULT_SHOPIFY_API_VERSION;

    if(!companyId || !getCompany(companyId)){
      toastMsg('Wybierz firmę', 'error', 2200);
      return;
    }
    if(!name){
      toastMsg('Podaj nazwę sklepu', 'error', 2200);
      return;
    }

    if(shopifyEnabled && (!shopifyDomain || !shopifyAdminToken)){
      toastMsg('Aby wlaczyc Shopify, podaj domene i Admin API token', 'error', 2600);
      return;
    }

    let store = modal.storeId ? getStore(modal.storeId) : null;
    if(store){
      store.company_id = companyId;
      store.name = name;
      store.is_active = isActive;
      store.vat_rate = vatRate;
      store.headcount = headcount;
      store.profit_share_type = ['headcount', 'percentage', 'fixed'].includes(profitShareType) ? profitShareType : 'headcount';
      store.profit_share_value = profitShareValue;
      store.calculation_mode = ['gross_to_net', 'manual_net'].includes(calculationMode) ? calculationMode : 'gross_to_net';
      store.color = color;
      store.shopify_enabled = shopifyEnabled;
      store.shopify_domain = shopifyDomain;
      store.shopify_admin_token = shopifyAdminToken;
      store.shopify_api_version = shopifyApiVersion;
      touchUpdated(store);
    }else{
      store = normalizeStore({
        id: uid('store'),
        company_id: companyId,
        name,
        is_active: isActive,
        vat_rate: vatRate,
        headcount,
        profit_share_type: profitShareType,
        profit_share_value: profitShareValue,
        calculation_mode: calculationMode,
        color,
        shopify_enabled: shopifyEnabled,
        shopify_domain: shopifyDomain,
        shopify_admin_token: shopifyAdminToken,
        shopify_api_version: shopifyApiVersion
      }, data.stores.length, companyId);
      data.stores.push(store);
    }

    data.ui.companyId = companyId;
    data.ui.storeId = store.id;
    data.ui.modal = null;
    data.ui.view = 'company';
    persist(store.id === modal.storeId ? 'Zapisano sklep' : 'Dodano sklep');
    renderShops();
  }

  function saveStatForm(){
    const data = ensureData();
    const modal = data.ui.modal || {};
    const store = getStore(modal.storeId || data.ui.storeId);
    if(!store){
      toastMsg('Najpierw wybierz sklep', 'error', 2200);
      return;
    }

    const date = String(document.getElementById('shops-stat-date')?.value || '').trim();
    const revenueGross = nonNegative(document.getElementById('shops-stat-gross')?.value);
    const revenueNet = maybeNumber(document.getElementById('shops-stat-net')?.value);
    const adCostTiktok = nonNegative(document.getElementById('shops-stat-ads')?.value);
    const refunds = nonNegative(document.getElementById('shops-stat-refunds')?.value);
    const extraCosts = nonNegative(document.getElementById('shops-stat-extra')?.value);
    const notes = String(document.getElementById('shops-stat-notes')?.value || '').trim();

    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){
      toastMsg('Wybierz poprawną datę', 'error', 2200);
      return;
    }

    if(revenueGross === 0 && revenueNet === null && adCostTiktok === 0 && refunds === 0 && extraCosts === 0 && !notes){
      toastMsg('Wpisz przynajmniej jedną wartość', 'info', 2200);
      return;
    }

    const current = modal.date ? getStoreStat(store.id, modal.date) : null;
    const duplicate = ensureData().dailyStats.find(stat=>stat.store_id === store.id && stat.date === date && stat.id !== current?.id) || null;
    const base = duplicate || current;
    const payload = normalizeStat({
      id: base?.id || uid('stat'),
      store_id: store.id,
      date,
      revenue_gross: revenueGross,
      revenue_net: revenueNet,
      ad_cost_tiktok: adCostTiktok,
      refunds,
      extra_costs: extraCosts,
      notes,
      created_at: base?.created_at || nowIso(),
      updated_at: nowIso()
    });

    if(current && current.id !== payload.id){
      data.dailyStats = data.dailyStats.filter(stat=>stat.id !== current.id);
    }

    const existingIndex = data.dailyStats.findIndex(stat=>stat.id === payload.id);
    if(existingIndex >= 0) data.dailyStats[existingIndex] = payload;
    else data.dailyStats.push(payload);

    data.dailyStats.sort((a, b)=>a.date.localeCompare(b.date));
    data.ui.selectedDate = payload.date;
    data.ui.monthKey = payload.date.slice(0, 7);
    data.ui.storeId = store.id;
    data.ui.companyId = store.company_id;
    data.ui.view = 'store';
    data.ui.modal = null;
    persist(existingIndex >= 0 ? 'Zapisano dzień' : 'Dodano dzień');
    renderShops();
  }

  async function syncShopifyRevenue(storeId, date){
    const data = ensureData();
    const store = getStore(storeId || data.ui.storeId);
    const targetDate = String(date || data.ui.selectedDate || localDate(new Date())).slice(0, 10);
    if(!store){
      toastMsg('Najpierw wybierz sklep', 'error', 2200);
      return;
    }
    if(!store.shopify_enabled || !store.shopify_domain || !store.shopify_admin_token){
      toastMsg('Najpierw uzupelnij ustawienia Shopify w sklepie', 'error', 2600);
      openStoreModal(store.company_id, store.id);
      return;
    }

    try{
      toastMsg('Pobieram obrot z Shopify...', 'info', 1800);
      const response = await fetch('/api/shopify-revenue', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          shopDomain: store.shopify_domain,
          accessToken: store.shopify_admin_token,
          apiVersion: store.shopify_api_version || DEFAULT_SHOPIFY_API_VERSION,
          date: targetDate
        })
      });
      const payload = await response.json().catch(()=>({error:'Nie udalo sie odczytac odpowiedzi Shopify'}));
      if(!response.ok) throw new Error(payload?.error || 'Nie udalo sie pobrac danych z Shopify');

      const current = getStoreStat(store.id, targetDate);
      const syncNote = `Shopify: ${payload.orderCount || 0} zam. • sync ${new Date().toLocaleString('pl-PL')}`;
      const nextStat = normalizeStat({
        id: current?.id || uid('stat'),
        store_id: store.id,
        date: targetDate,
        revenue_gross: numberValue(payload.revenueGross),
        revenue_net: current?.revenue_net ?? null,
        ad_cost_tiktok: current?.ad_cost_tiktok ?? 0,
        refunds: current?.refunds ?? 0,
        extra_costs: current?.extra_costs ?? 0,
        notes: [current?.notes || '', syncNote].filter(Boolean).join('\n'),
        created_at: current?.created_at || nowIso(),
        updated_at: nowIso()
      });

      data.dailyStats = data.dailyStats.filter(stat=>!(stat.store_id === store.id && stat.date === targetDate));
      data.dailyStats.push(nextStat);
      data.dailyStats.sort((a, b)=>a.date.localeCompare(b.date));
      data.ui.selectedDate = targetDate;
      data.ui.monthKey = targetDate.slice(0, 7);
      data.ui.storeId = store.id;
      data.ui.companyId = store.company_id;
      data.ui.view = 'store';
      store.shopify_last_sync_at = nowIso();
      touchUpdated(store);
      persist(`Pobrano obrot z Shopify dla ${shortDateLabel(targetDate)}`);
      renderShops();
    }catch(error){
      toastMsg(error?.message || 'Nie udalo sie pobrac danych z Shopify', 'error', 3200);
    }
  }

  function quickAddCompany(){
    const data = ensureData();
    const name = String(document.getElementById('shops-quick-company-name')?.value || '').trim();
    if(!name){
      toastMsg('Podaj nazwe firmy', 'error', 2200);
      return;
    }
    const company = normalizeCompany({
      id: uid('company'),
      name,
      is_active: true
    }, data.companies.length);
    data.companies.push(company);
    data.ui.companyId = company.id;
    data.ui.view = 'company';
    const input = document.getElementById('shops-quick-company-name');
    if(input) input.value = '';
    persist('Dodano firme');
    renderShops();
  }

  function quickAddStore(companyId){
    const data = ensureData();
    const resolvedCompanyId = String(companyId || data.ui.companyId || '');
    const name = String(document.getElementById('shops-quick-store-name')?.value || '').trim();
    if(!resolvedCompanyId || !getCompany(resolvedCompanyId)){
      toastMsg('Najpierw wybierz firme', 'error', 2200);
      return;
    }
    if(!name){
      toastMsg('Podaj nazwe sklepu', 'error', 2200);
      return;
    }
    const store = normalizeStore({
      id: uid('store'),
      company_id: resolvedCompanyId,
      name,
      is_active: true,
      vat_rate: 23,
      headcount: 1,
      profit_share_type: 'headcount',
      profit_share_value: 0,
      calculation_mode: 'gross_to_net',
      color: STORE_COLORS[data.stores.length % STORE_COLORS.length]
    }, data.stores.length, resolvedCompanyId);
    data.stores.push(store);
    data.ui.companyId = resolvedCompanyId;
    data.ui.storeId = store.id;
    const input = document.getElementById('shops-quick-store-name');
    if(input) input.value = '';
    persist('Dodano sklep');
    renderShops();
  }

  function saveInlineStat(storeId, originalDate){
    const data = ensureData();
    const store = getStore(storeId);
    if(!store){
      toastMsg('Najpierw wybierz sklep', 'error', 2200);
      return;
    }

    const date = String(document.getElementById('shops-inline-date')?.value || '').trim();
    const revenueGross = nonNegative(document.getElementById('shops-inline-gross')?.value);
    const revenueNet = maybeNumber(document.getElementById('shops-inline-net')?.value);
    const adCostTiktok = nonNegative(document.getElementById('shops-inline-ads')?.value);
    const refunds = nonNegative(document.getElementById('shops-inline-refunds')?.value);
    const extraCosts = nonNegative(document.getElementById('shops-inline-extra')?.value);
    const notes = String(document.getElementById('shops-inline-notes')?.value || '').trim();

    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){
      toastMsg('Wybierz poprawna date', 'error', 2200);
      return;
    }

    const current = getStoreStat(store.id, originalDate || date);
    const duplicate = data.dailyStats.find(stat=>stat.store_id === store.id && stat.date === date && stat.id !== current?.id) || null;
    const base = duplicate || current;

    if(revenueGross === 0 && revenueNet === null && adCostTiktok === 0 && refunds === 0 && extraCosts === 0 && !notes){
      if(base){
        data.dailyStats = data.dailyStats.filter(stat=>stat.id !== base.id);
        data.ui.selectedDate = date;
        persist('Usunieto pusty dzien');
        renderShops();
        return;
      }
      toastMsg('Wpisz przynajmniej jedna wartosc', 'info', 2200);
      return;
    }

    const payload = normalizeStat({
      id: base?.id || uid('stat'),
      store_id: store.id,
      date,
      revenue_gross: revenueGross,
      revenue_net: revenueNet,
      ad_cost_tiktok: adCostTiktok,
      refunds,
      extra_costs: extraCosts,
      notes,
      created_at: base?.created_at || nowIso(),
      updated_at: nowIso()
    });

    if(current && current.id !== payload.id){
      data.dailyStats = data.dailyStats.filter(stat=>stat.id !== current.id);
    }

    const existingIndex = data.dailyStats.findIndex(stat=>stat.id === payload.id);
    if(existingIndex >= 0) data.dailyStats[existingIndex] = payload;
    else data.dailyStats.push(payload);

    data.dailyStats.sort((a, b)=>a.date.localeCompare(b.date));
    data.ui.selectedDate = payload.date;
    data.ui.monthKey = payload.date.slice(0, 7);
    persist(existingIndex >= 0 ? 'Zapisano dzien' : 'Dodano dzien');
    renderShops();
  }

  function deleteCompanyConfirmed(companyId){
    const data = ensureData();
    const stores = getStoresForCompany(companyId, true).map(store=>store.id);
    const storeSet = new Set(stores);
    data.companies = data.companies.filter(company=>company.id !== String(companyId));
    data.stores = data.stores.filter(store=>store.company_id !== String(companyId));
    data.dailyStats = data.dailyStats.filter(stat=>!storeSet.has(stat.store_id));
    data.ui.modal = null;
    data.ui.companyId = data.companies[0]?.id || null;
    data.ui.storeId = data.stores.find(store=>store.company_id === data.ui.companyId)?.id || data.stores[0]?.id || null;
    data.ui.view = 'overview';
    persist('Usunięto firmę', 'success');
    renderShops();
  }

  function deleteStoreConfirmed(storeId){
    const data = ensureData();
    const store = getStore(storeId);
    if(!store) return;
    data.stores = data.stores.filter(item=>item.id !== String(storeId));
    data.dailyStats = data.dailyStats.filter(stat=>stat.store_id !== String(storeId));
    data.ui.modal = null;
    data.ui.storeId = data.stores.find(item=>item.company_id === store.company_id)?.id || data.stores[0]?.id || null;
    data.ui.companyId = store.company_id;
    data.ui.view = data.ui.storeId ? 'company' : 'overview';
    persist('Usunięto sklep', 'success');
    renderShops();
  }

  function deleteStatConfirmed(storeId, date){
    const data = ensureData();
    data.dailyStats = data.dailyStats.filter(stat=>!(stat.store_id === String(storeId) && stat.date === String(date)));
    data.ui.modal = null;
    if(data.ui.selectedDate === String(date)) data.ui.selectedDate = String(date);
    persist('Usunięto dane dnia', 'success');
    renderShops();
  }

  function confirmModalAction(){
    const modal = ensureData().ui.modal || {};
    if(modal.entity === 'company') deleteCompanyConfirmed(modal.companyId);
    else if(modal.entity === 'store') deleteStoreConfirmed(modal.storeId);
    else if(modal.entity === 'stat') deleteStatConfirmed(modal.storeId, modal.date);
  }

  function toggleCompanyActive(companyId){
    const company = getCompany(companyId);
    if(!company) return;
    company.is_active = !company.is_active;
    touchUpdated(company);
    persist(company.is_active ? 'Firma aktywna' : 'Firma zdezaktywowana', 'success');
    renderShops();
  }

  function toggleStoreActive(storeId){
    const store = getStore(storeId);
    if(!store) return;
    store.is_active = !store.is_active;
    touchUpdated(store);
    persist(store.is_active ? 'Sklep aktywny' : 'Sklep zdezaktywowany', 'success');
    renderShops();
  }

  function viewTitle(ui){
    if(ui.view === 'company'){
      const company = getCompany(ui.companyId);
      return company ? company.name : 'Firma';
    }
    if(ui.view === 'store'){
      const store = getStore(ui.storeId);
      return store ? store.name : 'Sklep';
    }
    return 'Sklepy';
  }

  function renderBreadcrumbs(data){
    const parts = [
      `<button type="button" class="shops-v2-crumb${data.ui.view === 'overview' ? ' active' : ''}" onclick="openShopsOverview()">Sklepy</button>`
    ];

    if(data.ui.companyId){
      const company = getCompany(data.ui.companyId);
      if(company){
        parts.push('<span class="shops-v2-crumb-sep">/</span>');
        parts.push(`<button type="button" class="shops-v2-crumb${data.ui.view === 'company' ? ' active' : ''}" onclick="openShopsCompany('${company.id}')">${esc(company.name)}</button>`);
      }
    }

    if(data.ui.view === 'store' && data.ui.storeId){
      const store = getStore(data.ui.storeId);
      if(store){
        parts.push('<span class="shops-v2-crumb-sep">/</span>');
        parts.push(`<button type="button" class="shops-v2-crumb active" onclick="openShopsStore('${store.id}')">${esc(store.name)}</button>`);
      }
    }

    return `<div class="shops-v2-breadcrumbs">${parts.join('')}</div>`;
  }

  function renderHeader(data){
    const ui = data.ui;
    const title = viewTitle(ui);
    const subtitle = ui.view === 'overview'
      ? 'Globalny widok firm i sklepów'
      : ui.view === 'company'
        ? 'Sklepy przypisane do wybranej firmy'
        : 'Dzienny kalendarz i tabela miesięczna sklepu';
    let actions = '';
    if(ui.view === 'overview'){
      actions = `<button class="btn btn-primary" type="button" onclick="openCompanyModal()">+ Dodaj firmę</button>`;
    }else if(ui.view === 'company'){
      actions = [
        `<button class="btn btn-ghost" type="button" onclick="openCompanyModal('${ui.companyId}')">Edytuj firmę</button>`,
        `<button class="btn btn-primary" type="button" onclick="openStoreModal('${ui.companyId}')">+ Dodaj sklep</button>`
      ].join('');
    }else if(ui.view === 'store'){
      actions = [
        `<button class="btn btn-ghost" type="button" onclick="openStoreModal('${ui.companyId}','${ui.storeId}')">Edytuj sklep</button>`,
        `<button class="btn btn-primary" type="button" onclick="openStatModal('${ui.storeId}','${ui.selectedDate}')">+ Dodaj / edytuj dzień</button>`
      ].join('');
    }

    return `
      <div class="card shops-v2-header-card">
        <div class="shops-v2-header-top">
          <div class="shops-v2-header-main">
            ${renderBreadcrumbs(data)}
            <div class="shops-v2-header-copy">
              <div class="shops-v2-title">${esc(title)}</div>
              <div class="shops-v2-subtitle">${esc(subtitle)}</div>
            </div>
          </div>
          <div class="shops-v2-actions">${actions}</div>
        </div>
        <div class="shops-v2-toolbar">
          <div class="shops-v2-date-pick">
            <label class="shops-v2-date-label">Data odniesienia</label>
            <input type="date" class="shops-v2-date-input" value="${esc(ui.selectedDate)}" onchange="jumpToShopsDate(this.value)" aria-label="Wybor dnia">
            <button class="cal-nav-btn" type="button" onclick="shiftShopsMonth(-1)">‹</button>
            <input type="month" value="${esc(ui.monthKey)}" onchange="setShopsMonth(this.value)" aria-label="Wybór miesiąca">
            <button class="cal-nav-btn" type="button" onclick="shiftShopsMonth(1)">›</button>
            <button class="btn btn-ghost btn-sm" type="button" onclick="setShopsMonth('${monthKey(new Date())}')">Dziś</button>
          </div>
          <div class="todo-filters shops-v2-filters">
            <button class="filter-btn${ui.summaryMode === 'today' ? ' active' : ''}" type="button" onclick="setShopsSummaryMode('today')">Dzis</button>
            <button class="filter-btn${ui.summaryMode === 'yesterday' ? ' active' : ''}" type="button" onclick="setShopsSummaryMode('yesterday')">Wczoraj</button>
            <button class="filter-btn${ui.summaryMode === 'week' ? ' active' : ''}" type="button" onclick="setShopsSummaryMode('week')">Tydzien</button>
            <button class="filter-btn${ui.summaryMode === 'month' ? ' active' : ''}" type="button" onclick="setShopsSummaryMode('month')">Miesiac</button>
            <button class="filter-btn${ui.summaryMode === 'year' ? ' active' : ''}" type="button" onclick="setShopsSummaryMode('year')">Rok</button>
            <button class="filter-btn${ui.summaryMode === 'month' ? ' active' : ''}" type="button" onclick="setShopsSummaryMode('month')">Miesiąc</button>
            <button class="filter-btn${ui.summaryMode === 'day' ? ' active' : ''}" type="button" onclick="setShopsSummaryMode('day')">Dzień</button>
            <button class="filter-btn${ui.view === 'overview' ? ' active' : ''}" type="button" onclick="openShopsOverview()">Wszystko</button>
          </div>
          <div class="shops-v2-range-badge badge badge-gray">${esc(rangeLabel(ui.monthKey, ui.summaryMode, ui.selectedDate))}</div>
        </div>
      </div>
    `;
  }

  function renderStatCard(label, value, meta, tone){
    return `
      <div class="stat-box shops-v2-stat shops-v2-stat-${tone || 'neutral'}">
        <div class="shops-v2-stat-label">${esc(label)}</div>
        <div class="shops-v2-stat-value">${value}</div>
        <div class="shops-v2-stat-meta">${meta}</div>
      </div>
    `;
  }

  function renderSummaryGrid(summary, options){
    const label = esc(options?.label || '');
    const filled = Number(options?.filledDays || 0);
    const cards = [
      renderStatCard('Przychód', formatPLN(summary.gross), `Netto: ${formatPLN(summary.net)}`, 'blue'),
      renderStatCard('Dochód', formatPLN(summary.income), label || 'Po odjęciu reklam i kosztów', summary.income >= 0 ? 'green' : 'red'),
      renderStatCard('Na głowę', formatPLN(summary.perHead), 'Według ustawień podziału', 'purple'),
      renderStatCard('Reklamy', formatPLN(summary.ads), `TikTok / przychód: ${formatPct(summary.adPct)}`, 'orange'),
      renderStatCard('Zwroty', formatPLN(summary.refunds), `Dodatkowe koszty: ${formatPLN(summary.extra)}${filled ? ` • dni z danymi: ${filled}` : ''}`, 'gray')
    ];
    return `
      <div class="shops-v2-summary-block">
        <div class="shops-v2-section-kicker">Podsumowanie</div>
        <div class="sec-title">Najważniejsze liczby</div>
        <div class="shops-v2-summary-grid">${cards.join('')}</div>
      </div>
    `;
  }

  function renderCentralHero(summary, options){
    const accent = options?.accent || cssVar('--accent', '#4f7ef8');
    const title = esc(options?.title || 'Zarobek');
    const sub = esc(options?.subtitle || '');
    return `
      <div class="card shops-v2-hero-card" style="--shops-hero:${accent}">
        <div class="shops-v2-hero-top">
          <div>
            <div class="shops-v2-section-kicker">${title}</div>
            <div class="shops-v2-hero-value">${formatPLN(summary.income)}</div>
            <div class="shops-v2-hero-sub">${sub}</div>
          </div>
          <div class="shops-v2-hero-meta">
            <div><span>Przychód</span><strong>${formatPLN(summary.gross)}</strong></div>
            <div><span>Reklamy</span><strong>${formatPLN(summary.ads)}</strong></div>
            <div><span>Zwroty</span><strong>${formatPLN(summary.refunds)}</strong></div>
          </div>
        </div>
      </div>
    `;
  }

  function renderCompanyMenuButton(companySummary){
    const company = companySummary.company;
    const color = companyAccent(companySummary);
    return `
      <button class="shops-v2-menu-btn" type="button" style="--shops-menu:${color}" onclick="openShopsCompany('${company.id}')">
        <span>${esc(company.name)}</span>
      </button>
    `;
  }

  function renderStoreMenuButton(storeSummary){
    const store = storeSummary.store;
    return `
      <button class="shops-v2-menu-btn shops-v2-store-menu-btn" type="button" style="--shops-menu:${store.color}" onclick="openShopsStore('${store.id}')">
        <span>${esc(store.name)}</span>
      </button>
    `;
  }

  function renderCompanyRow(companySummary){
    const company = companySummary.company;
    const stores = companySummary.stores || [];
    const activeStores = stores.filter(store=>store.is_active).length;
    return `
      <div class="shops-v2-list-row">
        <div class="shops-v2-row-titlebox">
          <button class="shops-v2-name-btn" type="button" onclick="openShopsCompany('${company.id}')">
            <span class="shops-v2-entity-dot" style="background:${companyAccent(companySummary)}"></span>
            <span>${esc(company.name)}</span>
          </button>
          <div class="shops-v2-row-subline">${stores.length} ${plural(stores.length, 'sklep', 'sklepy', 'sklepów')} • ${activeStores} aktywne</div>
        </div>
        <div class="shops-v2-row-meta">
          <div class="shops-v2-metric-grid">
            <div class="shops-v2-metric-pill"><small>Przychód</small><strong>${formatCompactPLN(companySummary.gross)}</strong></div>
            <div class="shops-v2-metric-pill"><small>Dochód</small><strong>${formatCompactPLN(companySummary.income)}</strong></div>
            <div class="shops-v2-metric-pill"><small>Na głowę</small><strong>${formatCompactPLN(companySummary.perHead)}</strong></div>
            <div class="shops-v2-metric-pill"><small>Reklamy</small><strong>${formatCompactPLN(companySummary.ads)}</strong></div>
          </div>
          <div class="shops-v2-row-actions">
            <span class="badge ${company.is_active ? 'badge-blue' : 'badge-gray'}">${company.is_active ? 'Aktywna' : 'Pauza'}</span>
            <button class="btn btn-ghost btn-sm" type="button" onclick="openCompanyModal('${company.id}')">Edytuj</button>
            <button class="btn btn-ghost btn-sm" type="button" onclick="toggleCompanyActive('${company.id}')">${company.is_active ? 'Ukryj' : 'Aktywuj'}</button>
            <button class="btn btn-danger btn-sm" type="button" onclick="confirmDeleteCompany('${company.id}')">Usuń</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderStoreRow(storeSummary){
    const store = storeSummary.store;
    return `
      <div class="shops-v2-list-row">
        <div class="shops-v2-row-titlebox">
          <button class="shops-v2-name-btn" type="button" onclick="openShopsStore('${store.id}')">
            <span class="shops-v2-entity-dot" style="background:${store.color}"></span>
            <span>${esc(store.name)}</span>
          </button>
          <div class="shops-v2-row-subline">VAT ${store.vat_rate}% • ${store.headcount} ${plural(store.headcount, 'osoba', 'osoby', 'osób')}</div>
        </div>
        <div class="shops-v2-row-meta">
          <div class="shops-v2-metric-grid">
            <div class="shops-v2-metric-pill"><small>Przychód</small><strong>${formatCompactPLN(storeSummary.gross)}</strong></div>
            <div class="shops-v2-metric-pill"><small>Dochód</small><strong>${formatCompactPLN(storeSummary.income)}</strong></div>
            <div class="shops-v2-metric-pill"><small>Reklamy</small><strong>${formatCompactPLN(storeSummary.ads)}</strong></div>
            <div class="shops-v2-metric-pill"><small>Na głowę</small><strong>${formatCompactPLN(storeSummary.perHead)}</strong></div>
          </div>
          <div class="shops-v2-row-actions">
            <span class="badge ${store.is_active ? 'badge-blue' : 'badge-gray'}">${store.is_active ? 'Aktywny' : 'Pauza'}</span>
            <button class="btn btn-ghost btn-sm" type="button" onclick="openStoreModal('${store.company_id}','${store.id}')">Edytuj</button>
            <button class="btn btn-ghost btn-sm" type="button" onclick="toggleStoreActive('${store.id}')">${store.is_active ? 'Ukryj' : 'Aktywuj'}</button>
            <button class="btn btn-danger btn-sm" type="button" onclick="confirmDeleteStore('${store.id}')">Usuń</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderInsightsCard(summary, isCompany){
    const ranking = isCompany
      ? (summary.ranking || [])
      : (summary.companies || [])
        .filter(item=>item.gross > 0 || item.income !== 0 || item.ads > 0 || item.refunds > 0 || item.extra > 0)
        .sort((a, b)=>b.income - a.income);
    const best = ranking[0] || null;
    const worst = ranking[ranking.length - 1] || null;
    return `
      <div class="shops-v2-overview-grid">
        <div class="card">
          <div class="sec-title">Ranking</div>
          ${ranking.length ? `
            <div class="shops-v2-ranking">
              ${ranking.slice(0, 5).map((item, index)=>`
                <button type="button" class="shops-v2-ranking-row" onclick="${isCompany ? `openShopsStore('${item.store.id}')` : `openShopsCompany('${item.company.id}')`}">
                  <span class="shops-v2-ranking-index">${index + 1}</span>
                  <span class="shops-v2-ranking-name">${esc(isCompany ? item.store.name : item.company.name)}</span>
                  <strong>${formatPLN(item.income)}</strong>
                </button>
              `).join('')}
            </div>
          ` : `<div class="shops-v2-empty-inline">Brak danych dla wybranego zakresu.</div>`}
        </div>
        <div class="card">
          <div class="sec-title">Szybki podgląd</div>
          <div class="shops-v2-highlight-grid">
            <div class="shops-v2-highlight">
              <span>Najlepszy wynik</span>
              <strong>${best ? esc(isCompany ? best.store.name : best.company.name) : '—'}</strong>
              <small>${best ? formatPLN(best.income) : 'Brak danych'}</small>
            </div>
            <div class="shops-v2-highlight">
              <span>Najniższy wynik</span>
              <strong>${worst ? esc(isCompany ? worst.store.name : worst.company.name) : '—'}</strong>
              <small>${worst ? formatPLN(worst.income) : 'Brak danych'}</small>
            </div>
            <div class="shops-v2-highlight">
              <span>Reklamy / przychód</span>
              <strong>${formatPct(summary.adPct)}</strong>
              <small>W całym zakresie</small>
            </div>
            <div class="shops-v2-highlight">
              <span>Zwroty + koszty</span>
              <strong>${formatPLN(summary.refunds + summary.extra)}</strong>
              <small>Refundy i dodatkowe koszty</small>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderOverview(data){
    const summary = summarizeGlobal(data.ui.monthKey, data.ui.summaryMode, data.ui.selectedDate);
    const filledDays = summary.stores.reduce((total, item)=>total + item.filledDays, 0);
    return `
      <div class="shops-v2-scroll">
        ${renderSummaryGrid(summary, {label: rangeLabel(data.ui.monthKey, data.ui.summaryMode, data.ui.selectedDate), filledDays})}
        ${renderInsightsCard(summary, false)}
        <div class="card shops-v2-section-card">
          <div class="shops-v2-section-head">
            <div>
              <div class="sec-title">Firmy</div>
              <div class="shops-v2-muted">Najpierw firma, potem sklepy i dane dnia. Bez chaosu i bez płaskiego Excela.</div>
            </div>
            <button class="btn btn-primary" type="button" onclick="openCompanyModal()">+ Dodaj firmę</button>
          </div>
          <div class="shops-v2-quickbar">
            <input id="shops-quick-company-name" placeholder="Szybko dodaj firme..." onkeydown="if(event.key==='Enter')quickAddCompany()">
            <button class="btn btn-primary" type="button" onclick="quickAddCompany()">Dodaj od razu</button>
          </div>
          <div class="shops-v2-list">
            ${summary.companies.length ? summary.companies.map(renderCompanyRow).join('') : `
              <div class="shops-v2-empty-block">
                <div class="es-icon">🏢</div>
                <div>Nie masz jeszcze żadnej firmy.</div>
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  }

  function renderCompanyView(data){
    const company = getCompany(data.ui.companyId);
    if(!company) return renderOverview(data);
    const summary = summarizeCompany(company, data.ui.monthKey, data.ui.summaryMode, data.ui.selectedDate);
    const filledDays = summary.storeSummaries.reduce((total, item)=>total + item.filledDays, 0);
    return `
      <div class="shops-v2-scroll">
        <div class="card shops-v2-company-head">
          <div class="shops-v2-company-copy">
            <span class="shops-v2-entity-dot" style="background:${companyAccent(summary)}"></span>
            <div>
              <div class="shops-v2-company-title">${esc(company.name)}</div>
              <div class="shops-v2-muted">${summary.stores.length} ${plural(summary.stores.length, 'sklep', 'sklepy', 'sklepów')} • ${rangeLabel(data.ui.monthKey, data.ui.summaryMode, data.ui.selectedDate)}</div>
            </div>
          </div>
          <div class="shops-v2-actions">
            <button class="btn btn-ghost" type="button" onclick="openCompanyModal('${company.id}')">Edytuj firmę</button>
            <button class="btn btn-primary" type="button" onclick="openStoreModal('${company.id}')">+ Dodaj sklep</button>
            <button class="btn btn-danger" type="button" onclick="confirmDeleteCompany('${company.id}')">Usuń firmę</button>
          </div>
        </div>
        ${renderSummaryGrid(summary, {label: rangeLabel(data.ui.monthKey, data.ui.summaryMode, data.ui.selectedDate), filledDays})}
        ${renderInsightsCard(summary, true)}
        <div class="card shops-v2-section-card">
          <div class="shops-v2-section-head">
            <div>
              <div class="sec-title">Sklepy w firmie</div>
              <div class="shops-v2-muted">Każdy sklep ma osobny kalendarz, tabelę miesiąca i swoje ustawienia liczenia.</div>
            </div>
            <button class="btn btn-primary" type="button" onclick="openStoreModal('${company.id}')">+ Dodaj sklep</button>
          </div>
          <div class="shops-v2-quickbar">
            <input id="shops-quick-store-name" placeholder="Szybko dodaj sklep..." onkeydown="if(event.key==='Enter')quickAddStore('${company.id}')">
            <button class="btn btn-primary" type="button" onclick="quickAddStore('${company.id}')">Dodaj od razu</button>
          </div>
          <div class="shops-v2-list">
            ${summary.storeSummaries.length ? summary.storeSummaries.map(renderStoreRow).join('') : `
              <div class="shops-v2-empty-block">
                <div class="es-icon">🏪</div>
                <div>Ta firma nie ma jeszcze sklepów.</div>
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  }

  function renderStoreCalendar(store, key, selectedDate){
    const statsMap = statMapForStore(store.id, key);
    const today = localDate(new Date());
    const cells = buildCalendarCells(key);
    return `
      <div class="shops-v2-panel shops-v2-calendar-panel">
        <div class="shops-v2-panel-head">
          <div class="sec-title">Kalendarz sklepu</div>
          <div class="shops-v2-muted">Kliknij dzień, a potem edytuj dane tego dnia.</div>
        </div>
        <div class="shops-v2-calendar-inner">
          <div class="cal-nav">
            <button class="cal-nav-btn" type="button" onclick="shiftShopsMonth(-1)">‹</button>
            <span class="cal-month-lbl">${esc(monthLabel(key))}</span>
            <button class="cal-nav-btn" type="button" onclick="shiftShopsMonth(1)">›</button>
          </div>
          <div class="cal-hdr">
            <div class="cal-day-name">Pon</div>
            <div class="cal-day-name">Wt</div>
            <div class="cal-day-name">Śr</div>
            <div class="cal-day-name">Czw</div>
            <div class="cal-day-name">Pt</div>
            <div class="cal-day-name" style="color:var(--orange)">Sob</div>
            <div class="cal-day-name" style="color:var(--red)">Nd</div>
          </div>
          <div class="cal-grid shops-v2-cal-grid">
            ${cells.map(cell=>{
              const stat = statsMap.get(cell.date);
              const isSelected = cell.date === selectedDate;
              const isToday = cell.date === today;
              const cls = [
                'cal-day',
                cell.otherMonth ? 'other-month' : '',
                cell.weekend ? 'weekend' : '',
                isToday ? 'today' : '',
                isSelected ? 'shops-v2-selected-day' : '',
                stat ? 'has-tasks shops-v2-has-data' : ''
              ].filter(Boolean).join(' ');
              const label = esc(shortDateLabel(cell.date));
              return `
                <button type="button" class="${cls}" onclick="jumpToShopsDate('${cell.date}')"
                  title="${label}${stat ? ' • dane zapisane' : ''}">
                  <span>${cell.day}</span>
                  ${stat ? `<span class="cal-badge">1</span>` : ''}
                </button>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }

  function renderSelectedDayPanel(store, selectedDate){
    const rawStat = getStoreStat(store.id, selectedDate);
    const stat = rawStat ? computeStat(store, rawStat) : null;
    const noteText = stat?.notes ? esc(stat.notes).replace(/\n/g, '<br>') : '';
    return `
      <div class="shops-v2-panel shops-v2-side-panel">
        <div class="shops-v2-panel-head">
          <div>
            <div class="sec-title">Wybrany dzień</div>
            <div class="shops-v2-side-title">${esc(fullDateLabel(selectedDate))}</div>
          </div>
          <span class="badge ${stat ? 'badge-blue' : 'badge-gray'}">${stat ? 'Dane wpisane' : 'Brak danych'}</span>
        </div>
        <div class="shops-v2-side-actions">
          <button class="btn btn-primary" type="button" onclick="openStatModal('${store.id}','${selectedDate}')">${stat ? 'Edytuj dzień' : 'Dodaj dane'}</button>
          ${stat ? `<button class="btn btn-danger" type="button" onclick="confirmDeleteStat('${store.id}','${selectedDate}')">Usuń</button>` : ''}
        </div>
        <div class="shops-v2-mini-grid">
          <div class="shops-v2-mini-stat"><span>Brutto</span><strong>${stat ? formatPLN(stat.revenue_gross) : '—'}</strong></div>
          <div class="shops-v2-mini-stat"><span>Netto</span><strong>${stat ? formatPLN(stat.revenue_net_resolved) : '—'}</strong></div>
          <div class="shops-v2-mini-stat"><span>Reklamy</span><strong>${stat ? formatPLN(stat.ad_cost_tiktok) : '—'}</strong></div>
          <div class="shops-v2-mini-stat"><span>Zwroty</span><strong>${stat ? formatPLN(stat.refunds) : '—'}</strong></div>
          <div class="shops-v2-mini-stat"><span>Dodatkowe</span><strong>${stat ? formatPLN(stat.extra_costs) : '—'}</strong></div>
          <div class="shops-v2-mini-stat"><span>Dochód</span><strong>${stat ? formatPLN(stat.income) : '—'}</strong></div>
          <div class="shops-v2-mini-stat"><span>Na głowę</span><strong>${stat ? formatPLN(stat.per_head) : '—'}</strong></div>
          <div class="shops-v2-mini-stat"><span>TikTok / przychód</span><strong>${stat ? formatPct(stat.ad_pct) : '—'}</strong></div>
        </div>
        <div class="shops-v2-note-box">
          <div class="sec-title">Notatki</div>
          <div class="shops-v2-note-content">${noteText || '<span class="shops-v2-empty-inline">Brak notatek dla tego dnia.</span>'}</div>
        </div>
        <div class="shops-v2-store-meta">
          <span class="badge badge-gray">VAT ${store.vat_rate}%</span>
          <span class="badge badge-gray">${store.headcount} ${plural(store.headcount, 'osoba', 'osoby', 'osób')}</span>
          <span class="badge badge-gray">${esc(CALCULATION_MODE_LABELS[store.calculation_mode] || '')}</span>
          <span class="badge badge-gray">${esc(SHARE_TYPE_LABELS[store.profit_share_type] || '')}</span>
        </div>
      </div>
    `;
  }

  function renderStoreTable(store, summary, key, selectedDate){
    const dates = monthDays(key);
    const stats = statMapForStore(store.id, key);
    const rows = [
      {key:'revenue_gross', label:'Przychód brutto', total:summary.gross, formatter:formatPLN},
      {key:'revenue_net_resolved', label:'Przychód netto', total:summary.net, formatter:formatPLN},
      {key:'ad_cost_tiktok', label:'Koszty TikTok', total:summary.ads, formatter:formatPLN},
      {key:'refunds', label:'Zwroty', total:summary.refunds, formatter:formatPLN},
      {key:'extra_costs', label:'Dodatkowe koszty', total:summary.extra, formatter:formatPLN},
      {key:'income', label:'Dochód', total:summary.income, formatter:formatPLN},
      {key:'per_head', label:'Na głowę', total:summary.perHead, formatter:formatPLN},
      {key:'ad_pct', label:'TikTok / przychód %', total:summary.adPct, formatter:formatPct}
    ];

    return `
      <div class="card shops-v2-table-card">
        <div class="shops-v2-table-toolbar">
          <div>
            <div class="shops-v2-section-kicker">Miesiąc</div>
            <div class="sec-title">Tabela miesięczna</div>
            <div class="shops-v2-muted">Przewijaj poziomo i klikaj komórki, żeby szybko edytować konkretny dzień.</div>
          </div>
          <button class="btn btn-ghost btn-sm" type="button" onclick="openStatModal('${store.id}','${selectedDate}')">Edytuj ${esc(shortDateLabel(selectedDate))}</button>
        </div>
        <div class="shops-v2-table-wrap">
          <div class="shops-v2-table-scroll">
            <table class="shops-v2-month-table">
              <thead>
                <tr>
                  <th class="shops-v2-sticky-col">Metryka</th>
                  <th>Suma</th>
                  ${dates.map(date=>`
                    <th class="${date === selectedDate ? 'shops-v2-selected-col' : ''}">
                      <button type="button" class="shops-v2-day-header${date === selectedDate ? ' active' : ''}" onclick="jumpToShopsDate('${date}')">
                        <span>${Number(date.slice(8, 10))}</span>
                        <small>${esc(weekdayShort(date))}</small>
                      </button>
                    </th>
                  `).join('')}
                </tr>
              </thead>
              <tbody>
                ${rows.map(row=>`
                  <tr>
                    <th class="shops-v2-sticky-col">${esc(row.label)}</th>
                    <td class="shops-v2-row-total">${row.formatter(row.total)}</td>
                    ${dates.map(date=>{
                      const stat = stats.get(date);
                      const value = stat ? row.formatter(stat[row.key]) : '—';
                      return `
                        <td class="${date === selectedDate ? 'shops-v2-selected-col' : ''}">
                          <button type="button" class="shops-v2-cell-btn${stat ? ' has-value' : ''}" onclick="openStatModal('${store.id}','${date}')">${value}</button>
                        </td>
                      `;
                    }).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  function renderStoreView(data){
    const store = getStore(data.ui.storeId);
    if(!store) return renderCompanyView(data);
    const company = getCompany(store.company_id);
    const summary = summarizeStore(store, data.ui.monthKey, data.ui.summaryMode, data.ui.selectedDate);
    return `
      <div class="shops-v2-store-view">
        <div class="card shops-v2-company-head">
          <div class="shops-v2-company-copy">
            <span class="shops-v2-entity-dot" style="background:${store.color}"></span>
            <div>
              <div class="shops-v2-company-title">${esc(store.name)}</div>
              <div class="shops-v2-muted">${company ? `${esc(company.name)} • ` : ''}${rangeLabel(data.ui.monthKey, 'month', data.ui.selectedDate)}</div>
            </div>
          </div>
          <div class="shops-v2-actions">
            <button class="btn btn-ghost" type="button" onclick="openShopsCompany('${store.company_id}')">Wróć do firmy</button>
            ${store.shopify_enabled ? `<button class="btn btn-ghost" type="button" onclick="syncShopifyRevenue('${store.id}','${data.ui.selectedDate}')">Pobierz obrot</button>` : ''}
            <button class="btn btn-primary" type="button" onclick="openStoreModal('${store.company_id}','${store.id}')">Ustawienia sklepu</button>
            <button class="btn btn-danger" type="button" onclick="confirmDeleteStore('${store.id}')">Usuń sklep</button>
          </div>
        </div>
        ${renderCentralHero(summary, {
          title: 'Zarobek sklepu',
          subtitle: `${store.name} • ${rangeLabel(data.ui.monthKey, data.ui.summaryMode, data.ui.selectedDate)}`,
          accent: store.color
        })}
        ${renderSummaryGrid(summary, {label: rangeLabel(data.ui.monthKey, data.ui.summaryMode, data.ui.selectedDate), filledDays: summary.filledDays})}
        <div class="shops-v2-store-top">
          ${renderSelectedDayPanel(store, data.ui.selectedDate)}
          ${renderStoreCalendar(store, data.ui.monthKey, data.ui.selectedDate)}
        </div>
        ${renderStoreTable(store, summary, data.ui.monthKey, data.ui.selectedDate)}
      </div>
    `;
  }

  function renderOverviewCentral(data){
    const summary = summarizeGlobal(data.ui.monthKey, data.ui.summaryMode, data.ui.selectedDate);
    const filledDays = summary.stores.reduce((total, item)=>total + item.filledDays, 0);
    return `
      <div class="shops-v2-scroll">
        ${renderCentralHero(summary, {
          title: 'Ile zarobilem',
          subtitle: rangeLabel(data.ui.monthKey, data.ui.summaryMode, data.ui.selectedDate),
          accent: cssVar('--accent', '#4f7ef8')
        })}
        <details class="card shops-v2-expand-card" open>
          <summary class="shops-v2-expand-summary">Rozwin statystyki ogolne</summary>
          <div class="shops-v2-expand-body">
            ${renderSummaryGrid(summary, {label: rangeLabel(data.ui.monthKey, data.ui.summaryMode, data.ui.selectedDate), filledDays})}
            ${renderInsightsCard(summary, false)}
          </div>
        </details>
        <div class="card shops-v2-section-card shops-v2-menu-section">
          <div class="shops-v2-section-head">
            <div>
              <div class="shops-v2-section-kicker">Firmy</div>
              <div class="sec-title">Wybierz firme</div>
            </div>
            <button class="btn btn-primary" type="button" onclick="openCompanyModal()">+ Dodaj firme</button>
          </div>
          <div class="shops-v2-centered-menu">
            ${summary.companies.length ? summary.companies.map(renderCompanyMenuButton).join('') : `
              <div class="shops-v2-empty-block">
                <div>Nie masz jeszcze zadnej firmy.</div>
              </div>
            `}
          </div>
        </div>
        <div class="card shops-v2-section-card">
          <div class="shops-v2-section-head">
            <div>
              <div class="shops-v2-section-kicker">Sklepy</div>
              <div class="sec-title">Wszystkie sklepy w wybranym zakresie</div>
            </div>
          </div>
          <div class="shops-v2-list">
            ${summary.stores.length ? summary.stores.map(renderStoreRow).join('') : `
              <div class="shops-v2-empty-block">
                <div>Brak wynikow sklepów dla tego zakresu.</div>
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  }

  function renderCompanyCentral(data){
    const company = getCompany(data.ui.companyId);
    if(!company) return renderOverviewCentral(data);
    const summary = summarizeCompany(company, data.ui.monthKey, data.ui.summaryMode, data.ui.selectedDate);
    const filledDays = summary.storeSummaries.reduce((total, item)=>total + item.filledDays, 0);
    return `
      <div class="shops-v2-scroll">
        ${renderCentralHero(summary, {
          title: 'Wynik firmy',
          subtitle: `${company.name} • ${rangeLabel(data.ui.monthKey, data.ui.summaryMode, data.ui.selectedDate)}`,
          accent: companyAccent(summary)
        })}
        <details class="card shops-v2-expand-card" open>
          <summary class="shops-v2-expand-summary">Rozwin statystyki firmy</summary>
          <div class="shops-v2-expand-body">
            ${renderSummaryGrid(summary, {label: rangeLabel(data.ui.monthKey, data.ui.summaryMode, data.ui.selectedDate), filledDays})}
            ${renderInsightsCard(summary, true)}
          </div>
        </details>
        <div class="card shops-v2-section-card shops-v2-menu-section">
          <div class="shops-v2-section-head">
            <div>
              <div class="shops-v2-section-kicker">Sklepy</div>
              <div class="sec-title">Wybierz sklep</div>
            </div>
            <div class="shops-v2-actions">
              <button class="btn btn-ghost" type="button" onclick="openCompanyModal('${company.id}')">Edytuj firme</button>
              <button class="btn btn-primary" type="button" onclick="openStoreModal('${company.id}')">+ Dodaj sklep</button>
            </div>
          </div>
          <div class="shops-v2-centered-menu">
            ${summary.storeSummaries.length ? summary.storeSummaries.map(renderStoreMenuButton).join('') : `
              <div class="shops-v2-empty-block">
                <div>Ta firma nie ma jeszcze sklepow.</div>
              </div>
            `}
          </div>
        </div>
        <div class="card shops-v2-section-card">
          <div class="shops-v2-section-head">
            <div>
              <div class="shops-v2-section-kicker">Wyniki</div>
              <div class="sec-title">Sklepy firmy w wybranym zakresie</div>
            </div>
          </div>
          <div class="shops-v2-list">
            ${summary.storeSummaries.length ? summary.storeSummaries.map(renderStoreRow).join('') : `
              <div class="shops-v2-empty-block">
                <div>Brak danych dla tego zakresu.</div>
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  }

  function renderContent(data){
    if(data.ui.view === 'company') return renderCompanyCentral(data);
    if(data.ui.view === 'store') return renderStoreView(data);
    return renderOverviewCentral(data);
  }

  function renderCompanyModal(modal){
    const company = modal.companyId ? getCompany(modal.companyId) : null;
    return `
      <div class="shops-v2-modal-overlay" onclick="closeShopsModal()">
        <div class="shops-v2-modal" onclick="event.stopPropagation()">
          <div class="shops-v2-modal-head">
            <div>
              <h3>${company ? 'Edytuj firmę' : 'Dodaj firmę'}</h3>
              <p>Firma to pierwszy poziom: potem podpinasz do niej sklepy.</p>
            </div>
            <button class="btn btn-ghost btn-sm" type="button" onclick="closeShopsModal()">✕</button>
          </div>
          <div class="shops-v2-modal-body">
            <div class="form-group">
              <label class="lbl">Nazwa firmy</label>
              <input id="shops-company-name" type="text" value="${esc(company?.name || '')}" placeholder="Np. Forzone Commerce">
            </div>
            <label class="toggle-row" style="margin-top:14px">
              <input id="shops-company-active" type="checkbox" ${company?.is_active !== false ? 'checked' : ''} style="width:auto">
              <span>Firma aktywna</span>
            </label>
          </div>
          <div class="shops-v2-modal-foot">
            <button class="btn btn-ghost" type="button" onclick="closeShopsModal()">Anuluj</button>
            <button class="btn btn-primary" type="button" onclick="saveShopsCompany()">Zapisz firmę</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderStoreModal(modal){
    const data = ensureData();
    const store = modal.storeId ? getStore(modal.storeId) : null;
    const companyId = store?.company_id || modal.companyId || data.companies[0]?.id || '';
    const companyOptions = data.companies.map(company=>`<option value="${company.id}" ${company.id === companyId ? 'selected' : ''}>${esc(company.name)}</option>`).join('');
    return `
      <div class="shops-v2-modal-overlay" onclick="closeShopsModal()">
        <div class="shops-v2-modal shops-v2-modal-wide" onclick="event.stopPropagation()">
          <div class="shops-v2-modal-head">
            <div>
              <h3>${store ? 'Edytuj sklep' : 'Dodaj sklep'}</h3>
              <p>Sklep ma własne ustawienia liczenia, kalendarz i dane dzienne.</p>
            </div>
            <button class="btn btn-ghost btn-sm" type="button" onclick="closeShopsModal()">✕</button>
          </div>
          <div class="shops-v2-modal-body">
            <div class="form-row">
              <div class="form-group">
                <label class="lbl">Firma</label>
                <select id="shops-store-company">${companyOptions}</select>
              </div>
              <div class="form-group">
                <label class="lbl">Nazwa sklepu</label>
                <input id="shops-store-name" type="text" value="${esc(store?.name || '')}" placeholder="Np. FashionDrop PL">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="lbl">VAT %</label>
                <input id="shops-store-vat" type="number" min="0" max="99" step="0.1" value="${formatInputNumber(store?.vat_rate ?? 23)}">
              </div>
              <div class="form-group">
                <label class="lbl">Liczba osób</label>
                <input id="shops-store-headcount" type="number" min="1" step="1" value="${formatInputNumber(store?.headcount ?? 1)}">
              </div>
              <div class="form-group">
                <label class="lbl">Kolor sklepu</label>
                <input id="shops-store-color" type="color" value="${esc(store?.color || cssVar('--accent', '#4f7ef8'))}" style="padding:4px;height:44px">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="lbl">Model podziału</label>
                <select id="shops-store-share-type">
                  <option value="headcount" ${store?.profit_share_type === 'headcount' || !store ? 'selected' : ''}>Podział na osoby</option>
                  <option value="percentage" ${store?.profit_share_type === 'percentage' ? 'selected' : ''}>Procent dochodu</option>
                  <option value="fixed" ${store?.profit_share_type === 'fixed' ? 'selected' : ''}>Stała kwota</option>
                </select>
              </div>
              <div class="form-group">
                <label class="lbl">Wartość modelu</label>
                <input id="shops-store-share-value" type="number" min="0" step="0.01" value="${formatInputNumber(store?.profit_share_value ?? 0)}">
              </div>
              <div class="form-group">
                <label class="lbl">Liczenie netto</label>
                <select id="shops-store-calc-mode">
                  <option value="gross_to_net" ${store?.calculation_mode === 'gross_to_net' || !store ? 'selected' : ''}>Automatycznie z brutto</option>
                  <option value="manual_net" ${store?.calculation_mode === 'manual_net' ? 'selected' : ''}>Wpisywane ręcznie</option>
                </select>
              </div>
            </div>
            <div class="shops-v2-integration-box">
              <div class="sec-title">Shopify API</div>
              <div class="shops-v2-muted">Po zapisaniu mozesz pobierac obrot dla wybranego dnia prosto do sklepu.</div>
              <label class="toggle-row" style="margin-top:10px">
                <input id="shops-store-shopify-enabled" type="checkbox" ${store?.shopify_enabled ? 'checked' : ''} style="width:auto">
                <span>Wlacz integracje Shopify</span>
              </label>
              <div class="form-row" style="margin-top:10px">
                <div class="form-group">
                  <label class="lbl">Domena sklepu</label>
                  <input id="shops-store-shopify-domain" type="text" value="${esc(store?.shopify_domain || '')}" placeholder="twoj-sklep.myshopify.com">
                </div>
                <div class="form-group">
                  <label class="lbl">Admin API token</label>
                  <input id="shops-store-shopify-token" type="password" value="${esc(store?.shopify_admin_token || '')}" placeholder="shpat_...">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="lbl">Wersja API</label>
                  <input id="shops-store-shopify-version" type="text" value="${esc(store?.shopify_api_version || DEFAULT_SHOPIFY_API_VERSION)}" placeholder="${DEFAULT_SHOPIFY_API_VERSION}">
                </div>
              </div>
            </div>
            <label class="toggle-row" style="margin-top:10px">
              <input id="shops-store-active" type="checkbox" ${store?.is_active !== false ? 'checked' : ''} style="width:auto">
              <span>Sklep aktywny</span>
            </label>
          </div>
          <div class="shops-v2-modal-foot">
            <button class="btn btn-ghost" type="button" onclick="closeShopsModal()">Anuluj</button>
            <button class="btn btn-primary" type="button" onclick="saveShopsStore()">Zapisz sklep</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderStatModal(modal){
    const store = getStore(modal.storeId);
    const existing = store ? getStoreStat(store.id, modal.date) : null;
    return `
      <div class="shops-v2-modal-overlay" onclick="closeShopsModal()">
        <div class="shops-v2-modal shops-v2-modal-wide" onclick="event.stopPropagation()">
          <div class="shops-v2-modal-head">
            <div>
              <h3>${existing ? 'Edytuj dane dnia' : 'Dodaj dane dnia'}</h3>
              <p>${store ? `${esc(store.name)} • ${esc(fullDateLabel(modal.date))}` : 'Wpis dnia'}</p>
            </div>
            <button class="btn btn-ghost btn-sm" type="button" onclick="closeShopsModal()">✕</button>
          </div>
          <div class="shops-v2-modal-body">
            <div class="form-row">
              <div class="form-group">
                <label class="lbl">Data</label>
                <input id="shops-stat-date" type="date" value="${esc(modal.date)}">
              </div>
              <div class="form-group">
                <label class="lbl">Przychód brutto</label>
                <input id="shops-stat-gross" type="number" min="0" step="0.01" value="${formatInputNumber(existing?.revenue_gross || 0)}">
              </div>
              <div class="form-group">
                <label class="lbl">Przychód netto</label>
                <input id="shops-stat-net" type="number" min="0" step="0.01" value="${formatInputNumber(existing?.revenue_net)}" placeholder="Puste = licz automatycznie">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="lbl">Koszty TikTok</label>
                <input id="shops-stat-ads" type="number" min="0" step="0.01" value="${formatInputNumber(existing?.ad_cost_tiktok || 0)}">
              </div>
              <div class="form-group">
                <label class="lbl">Zwroty</label>
                <input id="shops-stat-refunds" type="number" min="0" step="0.01" value="${formatInputNumber(existing?.refunds || 0)}">
              </div>
              <div class="form-group">
                <label class="lbl">Dodatkowe koszty</label>
                <input id="shops-stat-extra" type="number" min="0" step="0.01" value="${formatInputNumber(existing?.extra_costs || 0)}">
              </div>
            </div>
            <div class="form-group">
              <label class="lbl">Notatki</label>
              <textarea id="shops-stat-notes" placeholder="Kampania, problemy ze zwrotami, zmiana kreacji...">${esc(existing?.notes || '')}</textarea>
            </div>
          </div>
          <div class="shops-v2-modal-foot">
            <button class="btn btn-ghost" type="button" onclick="closeShopsModal()">Anuluj</button>
            ${existing ? `<button class="btn btn-danger" type="button" onclick="confirmDeleteStat('${store?.id}','${modal.date}')">Usuń</button>` : ''}
            <button class="btn btn-primary" type="button" onclick="saveShopsStat()">Zapisz dzień</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderConfirmModal(modal){
    return `
      <div class="shops-v2-modal-overlay" onclick="closeShopsModal()">
        <div class="shops-v2-modal shops-v2-confirm" onclick="event.stopPropagation()">
          <div class="shops-v2-modal-head">
            <div>
              <h3>${esc(modal.title || 'Potwierdź')}</h3>
              <p>${esc(modal.description || '')}</p>
            </div>
          </div>
          <div class="shops-v2-modal-foot">
            <button class="btn btn-ghost" type="button" onclick="closeShopsModal()">Anuluj</button>
            <button class="btn btn-danger" type="button" onclick="confirmShopsModalAction()">Usuń</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderModal(modal){
    if(!modal) return '';
    if(modal.type === 'company') return renderCompanyModal(modal);
    if(modal.type === 'store') return renderStoreModal(modal);
    if(modal.type === 'stat') return renderStatModal(modal);
    if(modal.type === 'confirm') return renderConfirmModal(modal);
    return '';
  }

  function renderWidget(body){
    const host = typeof body === 'string' ? document.getElementById(body) : body;
    if(!host) return;
    const currentMonth = monthKey(new Date());
    const summary = summarizeGlobal(currentMonth, 'month', localDate(new Date()));
    host.innerHTML = `
      <div class="wstat-grid">
        <div class="wstat-cell"><div class="wstat-val">${summary.companies.length}</div><div class="wstat-lbl">Firmy</div></div>
        <div class="wstat-cell"><div class="wstat-val">${summary.stores.length}</div><div class="wstat-lbl">Sklepy</div></div>
        <div class="wstat-cell"><div class="wstat-val" style="color:var(--green)">${formatCompactPLN(summary.gross)}</div><div class="wstat-lbl">Przychód mies.</div></div>
        <div class="wstat-cell"><div class="wstat-val" style="color:var(--accent)">${formatCompactPLN(summary.income)}</div><div class="wstat-lbl">Dochód mies.</div></div>
      </div>
    `;
  }

  function clampWindow(){
    const win = document.getElementById('win-shops');
    if(!win || win.classList.contains('minimized')) return;
    if(typeof window.maxedWin === 'string' && window.maxedWin === 'win-shops') return;

    const width = win.offsetWidth || parseInt(win.style.width, 10) || 0;
    const height = win.offsetHeight || parseInt(win.style.height, 10) || 0;
    const maxWidth = Math.max(720, window.innerWidth - 24);
    const maxHeight = Math.max(520, window.innerHeight - 24);
    const nextWidth = Math.min(width, maxWidth);
    const nextHeight = Math.min(height, maxHeight);
    const currentLeft = parseInt(win.style.left, 10) || 18;
    const currentTop = parseInt(win.style.top, 10) || 18;
    const left = Math.min(Math.max(12, currentLeft), Math.max(12, window.innerWidth - nextWidth - 12));
    const top = Math.min(Math.max(12, currentTop), Math.max(12, window.innerHeight - nextHeight - 12));

    win.style.width = `${nextWidth}px`;
    win.style.height = `${nextHeight}px`;
    win.style.left = `${left}px`;
    win.style.top = `${top}px`;
  }

  function ensureWindow(){
    const win = document.getElementById('win-shops');
    if(!win) return;
    const desiredWidth = Math.min(Math.max(Math.round(window.innerWidth * 0.86), 980), window.innerWidth - 24);
    const desiredHeight = Math.min(Math.max(Math.round(window.innerHeight * 0.84), 700), window.innerHeight - 24);
    const currentWidth = win.offsetWidth || parseInt(win.style.width, 10) || 0;
    const currentHeight = win.offsetHeight || parseInt(win.style.height, 10) || 0;

    if(!runtime.windowSized || currentWidth < 900 || currentHeight < 620){
      win.style.width = `${desiredWidth}px`;
      win.style.height = `${desiredHeight}px`;
      win.style.left = `${Math.max(12, Math.round((window.innerWidth - desiredWidth) / 2))}px`;
      win.style.top = `${Math.max(12, Math.round((window.innerHeight - desiredHeight) / 2))}px`;
      runtime.windowSized = true;
    }

    clampWindow();
  }

  function bindWheelScroll(host){
    if(!host) return;
    if(runtime.wheelHost && runtime.wheelHost !== host && runtime.wheelHandler){
      runtime.wheelHost.removeEventListener('wheel', runtime.wheelHandler, {capture:true});
    }
    if(runtime.wheelHost === host && runtime.wheelHandler) return;

    runtime.wheelHandler = event => {
      const modal = event.target.closest('.shops-v2-modal-body');
      if(modal && modal.scrollHeight > modal.clientHeight) return;

      const table = event.target.closest('.shops-v2-table-scroll');
      if(table){
        const canScrollX = Math.abs(event.deltaX) > 0 || event.shiftKey;
        if(canScrollX){
          table.scrollLeft += event.deltaY || event.deltaX;
          event.preventDefault();
          return;
        }
        const canScrollY = table.scrollHeight > table.clientHeight;
        if(canScrollY){
          table.scrollTop += event.deltaY;
          event.preventDefault();
        }
        return;
      }

      const scroller = host.querySelector('.shops-v2-content');
      if(!scroller || scroller.scrollHeight <= scroller.clientHeight) return;
      scroller.scrollTop += event.deltaY;
      event.preventDefault();
    };

    host.addEventListener('wheel', runtime.wheelHandler, {passive:false, capture:true});
    runtime.wheelHost = host;
  }

  function injectStyles(){
    if(document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #win-shops{min-width:720px;min-height:520px}
      #shops-body.shops-v2-host{
        display:flex;flex:1;flex-direction:column;height:100%;min-height:0;overflow:hidden;padding:0!important;
        background:var(--surface);
      }
      .shops-v2-shell{
        position:relative;display:flex;flex-direction:column;gap:12px;flex:1;min-height:0;height:100%;overflow:hidden;
        padding:12px;background:var(--surface);container-type:inline-size;
      }
      .shops-v2-shell .card{margin-bottom:0}
      .shops-v2-header-card{padding:14px 16px}
      .shops-v2-header-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}
      .shops-v2-header-main{display:flex;flex-direction:column;gap:8px;min-width:0}
      .shops-v2-breadcrumbs{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
      .shops-v2-crumb{background:none;border:none;padding:0;color:var(--text3);cursor:pointer;font:600 12px 'DM Sans',sans-serif}
      .shops-v2-crumb.active,.shops-v2-crumb:hover{color:var(--text)}
      .shops-v2-crumb-sep{color:var(--text3);font-size:12px}
      .shops-v2-header-copy{display:flex;flex-direction:column;gap:4px}
      .shops-v2-title{font-size:22px;font-weight:800;color:var(--text);line-height:1.1}
      .shops-v2-subtitle,.shops-v2-muted{font-size:12px;color:var(--text2);line-height:1.45}
      .shops-v2-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
      .shops-v2-toolbar{
        display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;
        margin-top:12px;padding-top:12px;border-top:1px solid var(--border);
      }
      .shops-v2-month-nav{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
      .shops-v2-month-nav input[type="month"]{width:auto;min-width:160px}
      .shops-v2-filters{margin:0}
      .shops-v2-range-badge{margin-left:auto}
      .shops-v2-content,.shops-v2-scroll,.shops-v2-store-view{flex:1;min-height:0}
      .shops-v2-content{
        overflow-y:auto;
        overflow-x:hidden;
        overscroll-behavior:contain;
        scrollbar-width:thin;
        -webkit-overflow-scrolling:touch;
      }
      .shops-v2-scroll{
        overflow:visible;
        display:flex;flex-direction:column;gap:12px;padding-right:2px;
        min-height:auto;
      }
      .shops-v2-store-view{
        display:flex;flex-direction:column;gap:12px;
        overflow:visible;
        padding-right:2px;
        min-height:auto;
      }
      .shops-v2-summary-block{display:flex;flex-direction:column;gap:10px}
      .shops-v2-section-kicker{font-size:11px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px}
      .shops-v2-hero-card{
        border:1.5px solid color-mix(in srgb, var(--shops-hero) 22%, var(--border));
        background:
          linear-gradient(135deg, color-mix(in srgb, var(--shops-hero) 12%, var(--surface)) 0%, var(--surface) 55%),
          var(--surface);
        padding:18px;
      }
      .shops-v2-hero-top{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap}
      .shops-v2-hero-value{font-size:clamp(30px,4vw,46px);font-weight:900;line-height:1;font-family:'DM Mono',monospace;color:var(--text)}
      .shops-v2-hero-sub{margin-top:8px;font-size:13px;color:var(--text2)}
      .shops-v2-hero-meta{display:grid;grid-template-columns:repeat(3,minmax(110px,1fr));gap:10px;min-width:min(420px,100%)}
      .shops-v2-hero-meta div{border:1px solid var(--border);background:rgba(255,255,255,.55);border-radius:14px;padding:10px 12px;display:flex;flex-direction:column;gap:4px}
      .shops-v2-hero-meta span{font-size:10px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.06em}
      .shops-v2-hero-meta strong{font-size:15px;font-weight:800;color:var(--text);font-family:'DM Mono',monospace}
      .shops-v2-expand-card{padding:0;overflow:hidden}
      .shops-v2-expand-summary{list-style:none;cursor:pointer;padding:16px 18px;font-size:14px;font-weight:800;color:var(--text);background:var(--surface2)}
      .shops-v2-expand-summary::-webkit-details-marker{display:none}
      .shops-v2-expand-body{padding:14px 16px 16px;display:flex;flex-direction:column;gap:14px}
      .shops-v2-summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
      .shops-v2-stat{display:flex;flex-direction:column;gap:8px;text-align:left;padding:14px 15px;min-height:120px}
      .shops-v2-stat-label{font-size:11px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.08em}
      .shops-v2-stat-value{font-size:clamp(20px,2.4vw,28px);font-weight:800;color:var(--text);line-height:1.05;font-family:'DM Mono',monospace}
      .shops-v2-stat-meta{font-size:12px;color:var(--text2);line-height:1.45}
      .shops-v2-stat-blue{border-color:rgba(79,126,248,.22)}
      .shops-v2-stat-green{border-color:rgba(34,197,94,.22)}
      .shops-v2-stat-red{border-color:rgba(239,68,68,.22)}
      .shops-v2-stat-orange{border-color:rgba(249,115,22,.22)}
      .shops-v2-stat-purple{border-color:rgba(139,92,246,.22)}
      .shops-v2-overview-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}
      .shops-v2-list{display:flex;flex-direction:column;gap:10px}
      .shops-v2-menu-section{padding:16px}
      .shops-v2-centered-menu{display:flex;flex-wrap:wrap;gap:12px;justify-content:center}
      .shops-v2-menu-btn{
        min-width:220px;min-height:62px;padding:0 18px;border:none;border-radius:18px;
        background:linear-gradient(135deg, color-mix(in srgb, var(--shops-menu) 80%, #ffffff) 0%, var(--shops-menu) 100%);
        color:#fff;font:800 16px 'DM Sans',sans-serif;cursor:pointer;box-shadow:0 10px 26px rgba(0,0,0,.12);
      }
      .shops-v2-menu-btn:hover{transform:translateY(-1px);box-shadow:0 14px 30px rgba(0,0,0,.14)}
      .shops-v2-store-menu-btn{min-width:210px}
      .shops-v2-list-row{
        display:grid;grid-template-columns:minmax(240px,320px) minmax(0,1fr);gap:14px;align-items:center;
        padding:14px;border:1.5px solid var(--border);border-radius:18px;background:var(--surface);
      }
      .shops-v2-row-titlebox{display:flex;flex-direction:column;gap:8px;min-width:0}
      .shops-v2-name-btn{
        display:flex;align-items:center;gap:10px;width:100%;min-width:0;text-align:left;
        border:1.5px solid var(--border);background:var(--surface2);color:var(--text);
        border-radius:14px;padding:14px 15px;font:700 15px 'DM Sans',sans-serif;cursor:pointer;
      }
      .shops-v2-name-btn:hover{border-color:rgba(79,126,248,.28);background:rgba(79,126,248,.08)}
      .shops-v2-row-subline{font-size:12px;color:var(--text3);padding-left:2px}
      .shops-v2-row-meta{display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0;flex-wrap:wrap}
      .shops-v2-metric-grid{display:grid;grid-template-columns:repeat(4,minmax(120px,1fr));gap:8px;min-width:min(560px,100%)}
      .shops-v2-metric-pill{
        display:flex;flex-direction:column;justify-content:center;gap:4px;min-height:62px;padding:10px 11px;border-radius:12px;
        border:1px solid var(--border);background:var(--surface2);
      }
      .shops-v2-metric-pill small{font-size:10px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.06em}
      .shops-v2-metric-pill strong{font-size:14px;font-weight:800;color:var(--text);font-family:'DM Mono',monospace}
      .shops-v2-row-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}
      .shops-v2-ranking{display:flex;flex-direction:column;gap:8px}
      .shops-v2-ranking-row{
        display:grid;grid-template-columns:28px 1fr auto;gap:10px;align-items:center;width:100%;
        border:1.5px solid var(--border);background:var(--surface2);padding:10px 11px;border-radius:12px;cursor:pointer;color:var(--text);text-align:left;
      }
      .shops-v2-ranking-row:hover{border-color:var(--border2);background:var(--surface3)}
      .shops-v2-ranking-index{
        width:24px;height:24px;border-radius:8px;background:var(--accent-light);color:var(--accent);
        display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;
      }
      .shops-v2-ranking-name{font-size:13px;font-weight:600;color:var(--text)}
      .shops-v2-highlight-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
      .shops-v2-highlight{border:1.5px solid var(--border);border-radius:12px;background:var(--surface2);padding:12px;display:flex;flex-direction:column;gap:4px}
      .shops-v2-highlight span{font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em}
      .shops-v2-highlight strong{font-size:15px;color:var(--text)}
      .shops-v2-highlight small{font-size:12px;color:var(--text2)}
      .shops-v2-section-card,.shops-v2-company-head{padding:14px}
      .shops-v2-section-head,.shops-v2-company-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}
      .shops-v2-company-copy,.shops-v2-entity-brand{display:flex;align-items:flex-start;gap:10px;min-width:0}
      .shops-v2-company-title,.shops-v2-entity-title{font-size:18px;font-weight:800;color:var(--text);line-height:1.15}
      .shops-v2-card-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:12px}
      .shops-v2-entity-card{display:flex;flex-direction:column;gap:12px;padding:14px}
      .shops-v2-entity-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
      .shops-v2-entity-dot{
        width:12px;height:12px;border-radius:999px;display:inline-flex;flex-shrink:0;margin-top:6px;
        box-shadow:0 0 0 4px rgba(79,126,248,.12);
      }
      .shops-v2-entity-sub{font-size:12px;color:var(--text2);line-height:1.4;margin-top:4px}
      .shops-v2-kpi-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
      .shops-v2-kpi-chip{border:1.5px solid var(--border);background:var(--surface2);border-radius:12px;padding:10px 11px;display:flex;flex-direction:column;gap:4px}
      .shops-v2-kpi-chip span{font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:.05em}
      .shops-v2-kpi-chip strong{font-size:15px;color:var(--text);font-family:'DM Mono',monospace}
      .shops-v2-card-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
      .shops-v2-quickbar{
        display:flex;align-items:center;gap:8px;flex-wrap:wrap;
        margin:10px 0 2px;
      }
      .shops-v2-quickbar input{flex:1;min-width:220px}
      .shops-v2-date-pick{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
      .shops-v2-date-label{font-size:11px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.08em}
      .shops-v2-date-input{min-width:170px}
      .shops-v2-date-pick > .cal-nav-btn,
      .shops-v2-date-pick > input[type="month"],
      .shops-v2-date-pick > .btn{display:none}
      .shops-v2-filters > .filter-btn:nth-child(n+6){display:none}
      .shops-v2-inline-form{padding:14px 16px 0}
      .shops-v2-note-edit{
        width:100%;min-height:86px;border:1.5px solid var(--border);background:var(--surface);border-radius:12px;padding:12px;
      }
      .shops-v2-integration-box{
        margin-top:12px;padding:14px;border:1.5px solid var(--border);border-radius:14px;background:var(--surface2);
        display:flex;flex-direction:column;gap:8px;
      }
      .shops-v2-empty-block,.shops-v2-empty-inline{color:var(--text3);font-size:13px}
      .shops-v2-empty-block{
        border:1.5px dashed var(--border2);border-radius:14px;padding:28px 16px;text-align:center;background:var(--surface2);grid-column:1/-1;
      }
      .shops-v2-store-top{display:grid;grid-template-columns:minmax(280px,360px) minmax(0,1fr);gap:12px;min-height:0}
      .shops-v2-panel{
        background:var(--surface2);border:1.5px solid var(--border);border-radius:16px;min-height:0;display:flex;flex-direction:column;overflow:hidden;
      }
      .shops-v2-panel-head{
        padding:16px 16px 12px;border-bottom:1px solid var(--border);background:var(--surface2);display:flex;align-items:flex-start;justify-content:space-between;gap:12px;
      }
      .shops-v2-side-panel{padding-bottom:0}
      .shops-v2-side-title{font-size:16px;font-weight:800;color:var(--text);line-height:1.2}
      .shops-v2-side-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:12px 16px 0}
      .shops-v2-mini-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:14px 16px}
      .shops-v2-mini-stat{border:1.5px solid var(--border);background:var(--surface);border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:5px}
      .shops-v2-mini-stat span{font-size:10px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.06em}
      .shops-v2-mini-stat strong{font-size:15px;font-family:'DM Mono',monospace;color:var(--text)}
      .shops-v2-note-box{padding:0 16px 16px}
      .shops-v2-note-content{
        border:1.5px solid var(--border);background:var(--surface);border-radius:12px;padding:12px;font-size:13px;color:var(--text);line-height:1.55;min-height:80px;
      }
      .shops-v2-store-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:0 16px 16px}
      .shops-v2-calendar-panel{padding:14px 16px}
      .shops-v2-calendar-inner{display:flex;flex-direction:column;gap:8px}
      .shops-v2-cal-grid .cal-day{width:100%;border:none;background:transparent}
      .shops-v2-cal-grid .cal-day.shops-v2-selected-day{background:var(--accent-light);border-color:var(--accent);color:var(--accent);font-weight:800}
      .shops-v2-cal-grid .cal-day.today.shops-v2-selected-day{background:linear-gradient(180deg,var(--accent),var(--accent2));color:#fff}
      .shops-v2-table-card{display:flex;flex-direction:column;gap:12px;flex:1;min-height:280px;padding:16px}
      .shops-v2-table-toolbar{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}
      .shops-v2-table-wrap{flex:1;min-height:0;border:1.5px solid var(--border);border-radius:14px;overflow:hidden;background:var(--surface2)}
      .shops-v2-table-scroll{height:100%;overflow:auto;overscroll-behavior:contain;scrollbar-width:thin}
      .shops-v2-month-table{border-collapse:separate;border-spacing:0;min-width:max-content;width:100%}
      .shops-v2-month-table th,.shops-v2-month-table td{padding:0;border-bottom:1px solid var(--border);border-right:1px solid var(--border);background:var(--surface)}
      .shops-v2-month-table thead th{position:sticky;top:0;z-index:2;background:var(--surface2)}
      .shops-v2-month-table tbody tr:nth-child(even) td,
      .shops-v2-month-table tbody tr:nth-child(even) th.shops-v2-sticky-col{background:rgba(0,0,0,.018)!important}
      .shops-v2-month-table tr:last-child th,.shops-v2-month-table tr:last-child td{border-bottom:none}
      .shops-v2-month-table th:first-child,.shops-v2-month-table td:first-child{border-left:none}
      .shops-v2-sticky-col{
        position:sticky;left:0;z-index:3;min-width:190px;text-align:left;padding:12px 14px!important;background:var(--surface2)!important;
        font-size:12px;font-weight:800;color:var(--text);text-transform:none;letter-spacing:0;
      }
      .shops-v2-row-total{min-width:120px;padding:12px 14px!important;background:var(--surface2);font-size:12px;font-weight:800;color:var(--text);font-family:'DM Mono',monospace}
      .shops-v2-day-header{
        display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-width:78px;padding:12px 8px;border:none;background:transparent;cursor:pointer;font:600 12px 'DM Sans',sans-serif;color:var(--text);
      }
      .shops-v2-day-header small{font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.04em}
      .shops-v2-day-header.active,.shops-v2-day-header:hover{background:var(--accent-light);color:var(--accent)}
      .shops-v2-cell-btn{
        min-width:78px;width:100%;padding:12px 10px;border:none;background:transparent;cursor:pointer;font:700 12px 'DM Mono',monospace;color:var(--text2);text-align:center;
      }
      .shops-v2-cell-btn:hover{background:var(--surface2);color:var(--text)}
      .shops-v2-cell-btn.has-value{color:var(--text)}
      .shops-v2-selected-col{background:rgba(79,126,248,.06)!important}
      .shops-v2-modal-overlay{
        position:absolute;inset:0;background:rgba(0,0,0,.42);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:18px;z-index:40;
      }
      .shops-v2-modal{
        width:min(520px,100%);max-height:100%;overflow:hidden;display:flex;flex-direction:column;background:var(--surface);border:1px solid var(--border);border-radius:22px;box-shadow:0 32px 80px rgba(0,0,0,.35);
      }
      .shops-v2-modal-wide{width:min(760px,100%)}
      .shops-v2-modal-head{
        padding:18px 20px 14px;border-bottom:1px solid var(--border);background:var(--surface2);display:flex;align-items:flex-start;justify-content:space-between;gap:10px;
      }
      .shops-v2-modal-head h3{margin:0;font-size:18px;color:var(--text)}
      .shops-v2-modal-head p{margin:4px 0 0;font-size:12px;color:var(--text2);line-height:1.4}
      .shops-v2-modal-body{padding:18px 20px;overflow:auto}
      .shops-v2-modal-foot{
        padding:12px 20px;border-top:1px solid var(--border);background:var(--surface2);display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap;
      }
      .shops-v2-confirm{width:min(420px,100%)}
      .shops-v2-host .btn,.shops-v2-host .filter-btn{white-space:nowrap}
      @container (max-width: 1160px){
        .shops-v2-store-top{grid-template-columns:1fr}
        .shops-v2-mini-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
      }
      @container (max-width: 920px){
        .shops-v2-highlight-grid,.shops-v2-kpi-grid,.shops-v2-mini-grid{grid-template-columns:1fr}
        .shops-v2-header-top,.shops-v2-toolbar,.shops-v2-section-head,.shops-v2-company-head{flex-direction:column;align-items:stretch}
        .shops-v2-actions{width:100%}
        .shops-v2-actions .btn{flex:1}
        .shops-v2-hero-meta{grid-template-columns:1fr;min-width:0;width:100%}
        .shops-v2-centered-menu{justify-content:stretch}
        .shops-v2-menu-btn{width:100%}
        .shops-v2-list-row{grid-template-columns:1fr}
        .shops-v2-metric-grid{grid-template-columns:repeat(2,minmax(0,1fr));min-width:0;width:100%}
        .shops-v2-row-actions{justify-content:flex-start}
        .shops-v2-quickbar{flex-direction:column;align-items:stretch}
        .shops-v2-range-badge{margin-left:0}
      }
      @container (max-width: 720px){
        .shops-v2-shell{padding:10px}
        .shops-v2-summary-grid,.shops-v2-card-grid,.shops-v2-overview-grid{grid-template-columns:1fr}
        .shops-v2-sticky-col{min-width:148px}
        .shops-v2-day-header,.shops-v2-cell-btn{min-width:64px;padding:10px 8px}
      }
    `;
    document.head.appendChild(style);
  }

  function renderHeader(data){
    const ui = data.ui;
    let actions = '';
    if(ui.view === 'overview'){
      actions = `<button class="btn btn-primary" type="button" onclick="openCompanyModal()">+ Firma</button>`;
    }else if(ui.view === 'company'){
      actions = [
        `<button class="btn btn-ghost" type="button" onclick="openShopsOverview()">Wszystko</button>`,
        `<button class="btn btn-primary" type="button" onclick="openStoreModal('${ui.companyId}')">+ Sklep</button>`
      ].join('');
    }else{
      actions = [
        `<button class="btn btn-ghost" type="button" onclick="openShopsCompany('${ui.companyId}')">Firma</button>`,
        `<button class="btn btn-ghost" type="button" onclick="openStatModal('${ui.storeId}','${ui.selectedDate}')">Dzien</button>`,
        `<button class="btn btn-primary" type="button" onclick="openStoreModal('${ui.companyId}','${ui.storeId}')">Ustawienia</button>`
      ].join('');
    }

    return `
      <div class="card shops-min-head">
        <div class="shops-min-head-top">
          <div class="shops-min-head-copy">
            <div class="shops-min-head-title">${esc(viewTitle(ui))}</div>
            <div class="shops-min-head-sub">${esc(rangeLabel(ui.monthKey, ui.summaryMode, ui.selectedDate))}</div>
          </div>
          <div class="shops-min-head-actions">${actions}</div>
        </div>
        <div class="shops-min-toolbar">
          <input class="shops-min-date" type="date" value="${esc(ui.selectedDate)}" onchange="jumpToShopsDate(this.value)" aria-label="Data">
          <div class="todo-filters shops-min-filters">
            <button class="filter-btn${ui.summaryMode === 'today' ? ' active' : ''}" type="button" onclick="setShopsSummaryMode('today')">Dzis</button>
            <button class="filter-btn${ui.summaryMode === 'yesterday' ? ' active' : ''}" type="button" onclick="setShopsSummaryMode('yesterday')">Wczoraj</button>
            <button class="filter-btn${ui.summaryMode === 'week' ? ' active' : ''}" type="button" onclick="setShopsSummaryMode('week')">Tydzien</button>
            <button class="filter-btn${ui.summaryMode === 'month' ? ' active' : ''}" type="button" onclick="setShopsSummaryMode('month')">Miesiac</button>
            <button class="filter-btn${ui.summaryMode === 'year' ? ' active' : ''}" type="button" onclick="setShopsSummaryMode('year')">Rok</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderMinimalHero(summary, title, accent){
    return `
      <div class="card shops-min-hero" style="--shops-min-accent:${accent || cssVar('--accent', '#4f7ef8')}">
        <div class="shops-min-kicker">${esc(title)}</div>
        <div class="shops-min-amount">${formatPLN(summary.income)}</div>
        <div class="shops-min-hero-row">
          <div class="shops-min-chip"><span>Przychód</span><strong>${formatPLN(summary.gross)}</strong></div>
          <div class="shops-min-chip"><span>Reklamy</span><strong>${formatPLN(summary.ads)}</strong></div>
          <div class="shops-min-chip"><span>Zwroty</span><strong>${formatPLN(summary.refunds)}</strong></div>
          <div class="shops-min-chip"><span>Na głowę</span><strong>${formatPLN(summary.perHead)}</strong></div>
        </div>
      </div>
    `;
  }

  function renderMiniCompanyButton(companySummary){
    const company = companySummary.company;
    const color = companyAccent(companySummary);
    return `<button class="shops-min-menu-btn" type="button" style="--shops-min-accent:${color}" onclick="openShopsCompany('${company.id}')">${esc(company.name)}</button>`;
  }

  function renderMiniStoreButton(storeSummary){
    const store = storeSummary.store;
    return `<button class="shops-min-menu-btn" type="button" style="--shops-min-accent:${store.color}" onclick="openShopsStore('${store.id}')">${esc(store.name)}</button>`;
  }

  function renderMiniStoreRow(storeSummary){
    const store = storeSummary.store;
    return `
      <button class="shops-min-row" type="button" onclick="openShopsStore('${store.id}')">
        <div class="shops-min-row-main">
          <span class="shops-v2-entity-dot" style="background:${store.color}"></span>
          <span>${esc(store.name)}</span>
        </div>
        <div class="shops-min-row-meta">
          <strong>${formatCompactPLN(storeSummary.income)}</strong>
          <span>${formatCompactPLN(storeSummary.gross)}</span>
        </div>
      </button>
    `;
  }

  function renderMiniStats(summary){
    return `
      <details class="card shops-min-details">
        <summary>Staty</summary>
        <div class="shops-min-stats">
          <div class="shops-min-stat"><span>Przychód</span><strong>${formatPLN(summary.gross)}</strong></div>
          <div class="shops-min-stat"><span>Dochód</span><strong>${formatPLN(summary.income)}</strong></div>
          <div class="shops-min-stat"><span>Reklamy</span><strong>${formatPLN(summary.ads)}</strong></div>
          <div class="shops-min-stat"><span>Zwroty</span><strong>${formatPLN(summary.refunds)}</strong></div>
        </div>
      </details>
    `;
  }

  function renderSelectedDayPanel(store, selectedDate){
    const rawStat = getStoreStat(store.id, selectedDate);
    const stat = rawStat ? computeStat(store, rawStat) : null;
    return `
      <div class="card shops-min-card">
        <div class="shops-min-card-title">${esc(fullDateLabel(selectedDate))}</div>
        <div class="shops-min-stats shops-min-stats-2">
          <div class="shops-min-stat"><span>Brutto</span><strong>${stat ? formatPLN(stat.revenue_gross) : '—'}</strong></div>
          <div class="shops-min-stat"><span>Dochód</span><strong>${stat ? formatPLN(stat.income) : '—'}</strong></div>
          <div class="shops-min-stat"><span>Ads</span><strong>${stat ? formatPLN(stat.ad_cost_tiktok) : '—'}</strong></div>
          <div class="shops-min-stat"><span>Zwroty</span><strong>${stat ? formatPLN(stat.refunds) : '—'}</strong></div>
        </div>
        <div class="shops-min-inline-actions">
          <button class="btn btn-primary" type="button" onclick="openStatModal('${store.id}','${selectedDate}')">${stat ? 'Edytuj' : 'Dodaj'}</button>
          ${stat ? `<button class="btn btn-danger" type="button" onclick="confirmDeleteStat('${store.id}','${selectedDate}')">Usuń</button>` : ''}
        </div>
      </div>
    `;
  }

  function renderStoreCalendar(store, key, selectedDate){
    const statsMap = statMapForStore(store.id, key);
    const today = localDate(new Date());
    const cells = buildCalendarCells(key);
    return `
      <div class="card shops-min-card">
        <div class="shops-min-card-head">
          <div class="shops-min-card-title">${esc(monthLabel(key))}</div>
          <div class="shops-min-inline-actions">
            <button class="btn btn-ghost btn-sm" type="button" onclick="shiftShopsMonth(-1)">‹</button>
            <button class="btn btn-ghost btn-sm" type="button" onclick="shiftShopsMonth(1)">›</button>
          </div>
        </div>
        <div class="shops-min-cal-head">
          <span>Pon</span><span>Wt</span><span>Śr</span><span>Czw</span><span>Pt</span><span>Sob</span><span>Nd</span>
        </div>
        <div class="shops-min-cal-grid">
          ${cells.map(cell=>{
            const stat = statsMap.get(cell.date);
            const cls = [
              'shops-min-cal-day',
              cell.otherMonth ? 'is-other' : '',
              cell.date === selectedDate ? 'is-active' : '',
              cell.date === today ? 'is-today' : '',
              stat ? 'has-data' : ''
            ].filter(Boolean).join(' ');
            return `<button class="${cls}" type="button" onclick="jumpToShopsDate('${cell.date}')">${cell.day}</button>`;
          }).join('')}
        </div>
      </div>
    `;
  }

  function renderStoreTable(store, summary, key, selectedDate){
    const dates = monthDays(key);
    const stats = statMapForStore(store.id, key);
    const rows = [
      {key:'revenue_gross', label:'Brutto', total:summary.gross, formatter:formatPLN},
      {key:'revenue_net_resolved', label:'Netto', total:summary.net, formatter:formatPLN},
      {key:'ad_cost_tiktok', label:'Ads', total:summary.ads, formatter:formatPLN},
      {key:'refunds', label:'Zwroty', total:summary.refunds, formatter:formatPLN},
      {key:'income', label:'Dochód', total:summary.income, formatter:formatPLN}
    ];
    return `
      <div class="card shops-min-card shops-min-table-card">
        <div class="shops-min-card-head">
          <div class="shops-min-card-title">Tabela</div>
          <button class="btn btn-ghost btn-sm" type="button" onclick="openStatModal('${store.id}','${selectedDate}')">Edytuj dzień</button>
        </div>
        <div class="shops-min-table-wrap">
          <table class="shops-min-table">
            <thead>
              <tr>
                <th>Metryka</th>
                <th>Suma</th>
                ${dates.map(date=>`<th><button class="shops-min-day-btn${date === selectedDate ? ' is-active' : ''}" type="button" onclick="jumpToShopsDate('${date}')">${Number(date.slice(8, 10))}</button></th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${rows.map(row=>`
                <tr>
                  <th>${row.label}</th>
                  <td>${row.formatter(row.total)}</td>
                  ${dates.map(date=>{
                    const stat = stats.get(date);
                    return `<td><button class="shops-min-cell${date === selectedDate ? ' is-active' : ''}" type="button" onclick="openStatModal('${store.id}','${date}')">${stat ? row.formatter(stat[row.key]) : '—'}</button></td>`;
                  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderStoreView(data){
    const store = getStore(data.ui.storeId);
    if(!store) return renderCompanyCentral(data);
    const company = getCompany(store.company_id);
    const summary = summarizeStore(store, data.ui.monthKey, data.ui.summaryMode, data.ui.selectedDate);
    return `
      <div class="shops-v2-scroll shops-min-page">
        ${renderMinimalHero(summary, `${store.name}${company ? ` • ${company.name}` : ''}`, store.color)}
        <div class="shops-min-store-grid">
          ${renderSelectedDayPanel(store, data.ui.selectedDate)}
          ${renderStoreCalendar(store, data.ui.monthKey, data.ui.selectedDate)}
        </div>
        ${renderStoreTable(store, summary, data.ui.monthKey, data.ui.selectedDate)}
      </div>
    `;
  }

  function renderOverviewCentral(data){
    const summary = summarizeGlobal(data.ui.monthKey, data.ui.summaryMode, data.ui.selectedDate);
    return `
      <div class="shops-v2-scroll shops-min-page">
        ${renderMinimalHero(summary, 'Zarobek łącznie', cssVar('--accent', '#4f7ef8'))}
        ${renderMiniStats(summary)}
        <div class="card shops-min-card">
          <div class="shops-min-card-title">Firmy</div>
          <div class="shops-min-menu">
            ${summary.companies.length ? summary.companies.map(renderMiniCompanyButton).join('') : '<div class="shops-min-empty">Dodaj pierwszą firmę</div>'}
          </div>
        </div>
        <div class="card shops-min-card">
          <div class="shops-min-card-title">Sklepy</div>
          <div class="shops-min-list">
            ${summary.stores.length ? summary.stores.map(renderMiniStoreRow).join('') : '<div class="shops-min-empty">Brak sklepów</div>'}
          </div>
        </div>
      </div>
    `;
  }

  function renderCompanyCentral(data){
    const company = getCompany(data.ui.companyId);
    if(!company) return renderOverviewCentral(data);
    const summary = summarizeCompany(company, data.ui.monthKey, data.ui.summaryMode, data.ui.selectedDate);
    return `
      <div class="shops-v2-scroll shops-min-page">
        ${renderMinimalHero(summary, company.name, companyAccent(summary))}
        ${renderMiniStats(summary)}
        <div class="card shops-min-card">
          <div class="shops-min-card-head">
            <div class="shops-min-card-title">Sklepy</div>
            <button class="btn btn-primary btn-sm" type="button" onclick="openStoreModal('${company.id}')">+ Sklep</button>
          </div>
          <div class="shops-min-menu">
            ${summary.storeSummaries.length ? summary.storeSummaries.map(renderMiniStoreButton).join('') : '<div class="shops-min-empty">Dodaj pierwszy sklep</div>'}
          </div>
        </div>
        <div class="card shops-min-card">
          <div class="shops-min-card-title">Wyniki sklepów</div>
          <div class="shops-min-list">
            ${summary.storeSummaries.length ? summary.storeSummaries.map(renderMiniStoreRow).join('') : '<div class="shops-min-empty">Brak danych</div>'}
          </div>
        </div>
      </div>
    `;
  }

  function renderContent(data){
    if(data.ui.view === 'company') return renderCompanyCentral(data);
    if(data.ui.view === 'store') return renderStoreView(data);
    return renderOverviewCentral(data);
  }

  function injectStyles(){
    let style = document.getElementById(STYLE_ID);
    if(!style){
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    style.textContent = `
      #win-shops{min-width:720px;min-height:520px}
      #shops-body.shops-v2-host{display:flex;flex:1;flex-direction:column;height:100%;min-height:0;overflow:hidden;padding:0!important;background:var(--surface)}
      .shops-v2-shell{position:relative;display:flex;flex-direction:column;gap:12px;flex:1;min-height:0;height:100%;overflow:hidden;padding:14px;background:var(--surface);container-type:inline-size}
      .shops-v2-content{flex:1;min-height:0;overflow:auto;scrollbar-width:thin;-webkit-overflow-scrolling:touch}
      .shops-v2-scroll,.shops-v2-store-view{display:flex;flex-direction:column;gap:14px}
      .shops-min-page{max-width:980px;width:100%;margin:0 auto}
      .shops-min-head{padding:16px 18px}
      .shops-min-head-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}
      .shops-min-head-copy{display:flex;flex-direction:column;gap:4px}
      .shops-min-head-title{font-size:28px;font-weight:900;color:var(--text);line-height:1}
      .shops-min-head-sub{font-size:13px;color:var(--text2)}
      .shops-min-head-actions{display:flex;gap:8px;flex-wrap:wrap}
      .shops-min-toolbar{display:flex;justify-content:center;align-items:center;gap:10px;flex-wrap:wrap;margin-top:14px}
      .shops-min-date{min-width:170px}
      .shops-min-filters{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}
      .shops-min-hero{padding:26px 22px;text-align:center;border:1.5px solid color-mix(in srgb, var(--shops-min-accent) 28%, var(--border));background:linear-gradient(180deg, color-mix(in srgb, var(--shops-min-accent) 10%, var(--surface)) 0%, var(--surface) 100%)}
      .shops-min-kicker{font-size:11px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.12em}
      .shops-min-amount{margin-top:10px;font-size:clamp(34px,5vw,58px);font-weight:900;font-family:'DM Mono',monospace;color:var(--text);line-height:1}
      .shops-min-hero-row{margin-top:18px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
      .shops-min-chip{padding:12px;border:1px solid var(--border);border-radius:16px;background:rgba(255,255,255,.55);display:flex;flex-direction:column;gap:4px}
      .shops-min-chip span{font-size:10px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.06em}
      .shops-min-chip strong{font-size:15px;font-weight:800;color:var(--text);font-family:'DM Mono',monospace}
      .shops-min-details{padding:0;overflow:hidden}
      .shops-min-details summary{cursor:pointer;list-style:none;padding:14px 16px;font-size:14px;font-weight:800;background:var(--surface2)}
      .shops-min-details summary::-webkit-details-marker{display:none}
      .shops-min-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;padding:14px}
      .shops-min-stats-2{grid-template-columns:repeat(2,minmax(0,1fr));padding:0}
      .shops-min-stat{padding:12px;border:1px solid var(--border);border-radius:16px;background:var(--surface2);display:flex;flex-direction:column;gap:4px}
      .shops-min-stat span{font-size:10px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.06em}
      .shops-min-stat strong{font-size:15px;font-weight:800;color:var(--text);font-family:'DM Mono',monospace}
      .shops-min-card{padding:16px}
      .shops-min-card-head{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
      .shops-min-card-title{font-size:17px;font-weight:800;color:var(--text)}
      .shops-min-menu{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;margin-top:14px}
      .shops-min-menu-btn{min-width:220px;min-height:58px;padding:0 18px;border:none;border-radius:18px;background:var(--shops-min-accent);color:#fff;font:800 15px 'DM Sans',sans-serif;cursor:pointer}
      .shops-min-list{display:flex;flex-direction:column;gap:10px;margin-top:14px}
      .shops-min-row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 16px;border:1px solid var(--border);border-radius:16px;background:var(--surface2);text-align:left;color:var(--text);cursor:pointer}
      .shops-min-row-main{display:flex;align-items:center;gap:10px;font-size:15px;font-weight:700}
      .shops-min-row-meta{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
      .shops-min-row-meta strong{font-size:15px;font-family:'DM Mono',monospace}
      .shops-min-row-meta span{font-size:12px;color:var(--text2);font-family:'DM Mono',monospace}
      .shops-min-empty{padding:18px;color:var(--text3);text-align:center}
      .shops-min-store-grid{display:grid;grid-template-columns:minmax(280px,360px) minmax(0,1fr);gap:14px}
      .shops-min-inline-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
      .shops-min-cal-head,.shops-min-cal-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px}
      .shops-min-cal-head{margin-top:14px;font-size:10px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;text-align:center}
      .shops-min-cal-grid{margin-top:10px}
      .shops-min-cal-day{height:42px;border:1px solid var(--border);border-radius:12px;background:var(--surface2);cursor:pointer;color:var(--text);font:700 13px 'DM Sans',sans-serif}
      .shops-min-cal-day.is-other{opacity:.45}
      .shops-min-cal-day.is-active{background:var(--accent);border-color:var(--accent);color:#fff}
      .shops-min-cal-day.is-today{box-shadow:inset 0 0 0 1px var(--accent)}
      .shops-min-cal-day.has-data::after{content:'';display:block;width:6px;height:6px;border-radius:50%;background:currentColor;margin:3px auto 0;opacity:.75}
      .shops-min-table-card{padding:0;overflow:hidden}
      .shops-min-table-wrap{overflow:auto;border-top:1px solid var(--border)}
      .shops-min-table{border-collapse:separate;border-spacing:0;min-width:max-content;width:100%}
      .shops-min-table th,.shops-min-table td{padding:0;border-right:1px solid var(--border);border-bottom:1px solid var(--border);background:var(--surface)}
      .shops-min-table thead th{position:sticky;top:0;background:var(--surface2);z-index:1}
      .shops-min-table th:first-child,.shops-min-table td:first-child{position:sticky;left:0;z-index:2;background:var(--surface2);min-width:132px;padding:12px 14px;text-align:left}
      .shops-min-day-btn,.shops-min-cell{min-width:62px;padding:12px 8px;border:none;background:transparent;cursor:pointer;font:700 12px 'DM Mono',monospace;color:var(--text)}
      .shops-min-day-btn.is-active,.shops-min-cell.is-active{background:var(--accent-light);color:var(--accent)}
      .shops-min-cell{color:var(--text2)}
      .shops-min-cell:hover,.shops-min-day-btn:hover{background:var(--surface2)}
      .shops-v2-modal-overlay{position:absolute;inset:0;background:rgba(0,0,0,.42);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:18px;z-index:40}
      .shops-v2-modal{width:min(520px,100%);max-height:100%;overflow:hidden;display:flex;flex-direction:column;background:var(--surface);border:1px solid var(--border);border-radius:22px;box-shadow:0 32px 80px rgba(0,0,0,.35)}
      .shops-v2-modal-wide{width:min(760px,100%)}
      .shops-v2-modal-head{padding:18px 20px 14px;border-bottom:1px solid var(--border);background:var(--surface2);display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
      .shops-v2-modal-head h3{margin:0;font-size:18px;color:var(--text)}
      .shops-v2-modal-head p{margin:4px 0 0;font-size:12px;color:var(--text2);line-height:1.4}
      .shops-v2-modal-body{padding:18px 20px;overflow:auto}
      .shops-v2-modal-foot{padding:12px 20px;border-top:1px solid var(--border);background:var(--surface2);display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap}
      .shops-v2-integration-box{margin-top:12px;padding:14px;border:1.5px solid var(--border);border-radius:14px;background:var(--surface2);display:flex;flex-direction:column;gap:8px}
      @container (max-width: 980px){
        .shops-min-hero-row,.shops-min-stats{grid-template-columns:repeat(2,minmax(0,1fr))}
        .shops-min-store-grid{grid-template-columns:1fr}
      }
      @container (max-width: 720px){
        .shops-v2-shell{padding:10px}
        .shops-min-head-top,.shops-min-toolbar{flex-direction:column;align-items:stretch}
        .shops-min-head-actions,.shops-min-inline-actions{width:100%}
        .shops-min-head-actions .btn,.shops-min-inline-actions .btn{flex:1}
        .shops-min-hero-row,.shops-min-stats,.shops-min-stats-2{grid-template-columns:1fr}
        .shops-min-menu-btn{width:100%}
      }
    `;
  }

  function rangeLabel(key, mode, selectedDate){
    const bounds = getRangePresetBounds(mode, selectedDate);
    if(bounds.preset === 'today') return `Dzisiaj / ${fullDateLabel(bounds.start)}`;
    if(bounds.preset === 'yesterday') return `Wczoraj / ${fullDateLabel(bounds.start)}`;
    if(bounds.preset === 'week') return `${shortDateLabel(bounds.start)} - ${shortDateLabel(bounds.end)}`;
    if(bounds.preset === 'month') return monthLabel(bounds.start.slice(0, 7));
    return String(dateAtNoon(bounds.start).getFullYear());
  }

  function renderHeader(data){
    const ui = data.ui;
    let actions = '';
    if(ui.view === 'overview'){
      actions = `<button class="btn btn-primary" type="button" onclick="openCompanyModal()">+ Firma</button>`;
    }else if(ui.view === 'company'){
      actions = [
        `<button class="btn btn-ghost" type="button" onclick="openShopsOverview()">Wszystko</button>`,
        `<button class="btn btn-ghost" type="button" onclick="openCompanyModal('${ui.companyId}')">Edytuj</button>`,
        `<button class="btn btn-danger" type="button" onclick="confirmDeleteCompany('${ui.companyId}')">Usun</button>`,
        `<button class="btn btn-primary" type="button" onclick="openStoreModal('${ui.companyId}')">+ Sklep</button>`
      ].join('');
    }else{
      actions = [
        `<button class="btn btn-ghost" type="button" onclick="openShopsCompany('${ui.companyId}')">Firma</button>`,
        `<button class="btn btn-ghost" type="button" onclick="openStatModal('${ui.storeId}','${ui.selectedDate}')">Dzien</button>`,
        `<button class="btn btn-ghost" type="button" onclick="openStoreModal('${ui.companyId}','${ui.storeId}')">Edytuj</button>`,
        `<button class="btn btn-danger" type="button" onclick="confirmDeleteStore('${ui.storeId}')">Usun</button>`
      ].join('');
    }

    return `
      <div class="card shops-min-head">
        <div class="shops-min-head-top">
          <div class="shops-min-head-copy">
            <div class="shops-min-head-title">${esc(viewTitle(ui))}</div>
            <div class="shops-min-head-sub">${esc(rangeLabel(ui.monthKey, ui.summaryMode, ui.selectedDate))}</div>
          </div>
          <div class="shops-min-head-actions">${actions}</div>
        </div>
        <div class="shops-min-toolbar">
          <input class="shops-min-date" type="date" value="${esc(ui.selectedDate)}" onchange="jumpToShopsDate(this.value)" aria-label="Data">
          <div class="todo-filters shops-min-filters">
            <button class="filter-btn${ui.summaryMode === 'today' ? ' active' : ''}" type="button" onclick="setShopsSummaryMode('today')">Dzis</button>
            <button class="filter-btn${ui.summaryMode === 'yesterday' ? ' active' : ''}" type="button" onclick="setShopsSummaryMode('yesterday')">Wczoraj</button>
            <button class="filter-btn${ui.summaryMode === 'week' ? ' active' : ''}" type="button" onclick="setShopsSummaryMode('week')">Tydzien</button>
            <button class="filter-btn${ui.summaryMode === 'month' ? ' active' : ''}" type="button" onclick="setShopsSummaryMode('month')">Miesiac</button>
            <button class="filter-btn${ui.summaryMode === 'year' ? ' active' : ''}" type="button" onclick="setShopsSummaryMode('year')">Rok</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderMinimalHero(summary, title, accent){
    return `
      <div class="card shops-min-hero" style="--shops-min-accent:${accent || cssVar('--accent', '#4f7ef8')}">
        <div class="shops-min-kicker">${esc(title)}</div>
        <div class="shops-min-amount">${formatPLN(summary.income)}</div>
        <div class="shops-min-hero-row">
          <div class="shops-min-chip"><span>Przychod</span><strong>${formatPLN(summary.gross)}</strong></div>
          <div class="shops-min-chip"><span>Reklamy</span><strong>${formatPLN(summary.ads)}</strong></div>
          <div class="shops-min-chip"><span>Zwroty</span><strong>${formatPLN(summary.refunds)}</strong></div>
          <div class="shops-min-chip"><span>Na glowe</span><strong>${formatPLN(summary.perHead)}</strong></div>
        </div>
      </div>
    `;
  }

  function renderMiniStats(summary){
    return `
      <details class="card shops-min-details">
        <summary>Staty</summary>
        <div class="shops-min-stats">
          <div class="shops-min-stat"><span>Przychod</span><strong>${formatPLN(summary.gross)}</strong></div>
          <div class="shops-min-stat"><span>Dochod</span><strong>${formatPLN(summary.income)}</strong></div>
          <div class="shops-min-stat"><span>Reklamy</span><strong>${formatPLN(summary.ads)}</strong></div>
          <div class="shops-min-stat"><span>Zwroty</span><strong>${formatPLN(summary.refunds)}</strong></div>
        </div>
      </details>
    `;
  }

  function renderSelectedDayPanel(store, selectedDate){
    const rawStat = getStoreStat(store.id, selectedDate);
    const stat = rawStat ? computeStat(store, rawStat) : null;
    return `
      <div class="card shops-min-card">
        <div class="shops-min-card-title">${esc(fullDateLabel(selectedDate))}</div>
        <div class="shops-min-stats shops-min-stats-2">
          <div class="shops-min-stat"><span>Brutto</span><strong>${stat ? formatPLN(stat.revenue_gross) : '-'}</strong></div>
          <div class="shops-min-stat"><span>Dochod</span><strong>${stat ? formatPLN(stat.income) : '-'}</strong></div>
          <div class="shops-min-stat"><span>Ads</span><strong>${stat ? formatPLN(stat.ad_cost_tiktok) : '-'}</strong></div>
          <div class="shops-min-stat"><span>Zwroty</span><strong>${stat ? formatPLN(stat.refunds) : '-'}</strong></div>
        </div>
        <div class="shops-min-inline-actions">
          <button class="btn btn-primary" type="button" onclick="openStatModal('${store.id}','${selectedDate}')">${stat ? 'Edytuj' : 'Dodaj'}</button>
          ${stat ? `<button class="btn btn-danger" type="button" onclick="confirmDeleteStat('${store.id}','${selectedDate}')">Usun</button>` : ''}
        </div>
      </div>
    `;
  }

  function renderStoreCalendar(store, key, selectedDate){
    const statsMap = statMapForStore(store.id, key);
    const today = localDate(new Date());
    const cells = buildCalendarCells(key);
    return `
      <div class="card shops-min-card">
        <div class="shops-min-card-head">
          <div class="shops-min-card-title">${esc(monthLabel(key))}</div>
          <div class="shops-min-inline-actions">
            <button class="btn btn-ghost btn-sm" type="button" onclick="shiftShopsMonth(-1)">&lt;</button>
            <button class="btn btn-ghost btn-sm" type="button" onclick="shiftShopsMonth(1)">&gt;</button>
          </div>
        </div>
        <div class="shops-min-cal-head">
          <span>Pon</span><span>Wt</span><span>Sr</span><span>Czw</span><span>Pt</span><span>Sob</span><span>Nd</span>
        </div>
        <div class="shops-min-cal-grid">
          ${cells.map(cell=>{
            const stat = statsMap.get(cell.date);
            const cls = [
              'shops-min-cal-day',
              cell.otherMonth ? 'is-other' : '',
              cell.date === selectedDate ? 'is-active' : '',
              cell.date === today ? 'is-today' : '',
              stat ? 'has-data' : ''
            ].filter(Boolean).join(' ');
            return `<button class="${cls}" type="button" onclick="jumpToShopsDate('${cell.date}')">${cell.day}</button>`;
          }).join('')}
        </div>
      </div>
    `;
  }

  function renderStoreTable(store, summary, key, selectedDate){
    const dates = monthDays(key);
    const stats = statMapForStore(store.id, key);
    const rows = [
      {key:'revenue_gross', label:'Brutto', total:summary.gross, formatter:formatPLN},
      {key:'revenue_net_resolved', label:'Netto', total:summary.net, formatter:formatPLN},
      {key:'ad_cost_tiktok', label:'Ads', total:summary.ads, formatter:formatPLN},
      {key:'refunds', label:'Zwroty', total:summary.refunds, formatter:formatPLN},
      {key:'income', label:'Dochod', total:summary.income, formatter:formatPLN}
    ];
    return `
      <div class="card shops-min-card shops-min-table-card">
        <div class="shops-min-card-head">
          <div class="shops-min-card-title">Tabela</div>
          <button class="btn btn-ghost btn-sm" type="button" onclick="openStatModal('${store.id}','${selectedDate}')">Edytuj dzien</button>
        </div>
        <div class="shops-min-table-wrap">
          <table class="shops-min-table">
            <thead>
              <tr>
                <th>Metryka</th>
                <th>Suma</th>
                ${dates.map(date=>`<th><button class="shops-min-day-btn${date === selectedDate ? ' is-active' : ''}" type="button" onclick="jumpToShopsDate('${date}')">${Number(date.slice(8, 10))}</button></th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${rows.map(row=>`
                <tr>
                  <th>${row.label}</th>
                  <td>${row.formatter(row.total)}</td>
                  ${dates.map(date=>{
                    const stat = stats.get(date);
                    return `<td><button class="shops-min-cell${date === selectedDate ? ' is-active' : ''}" type="button" onclick="openStatModal('${store.id}','${date}')">${stat ? row.formatter(stat[row.key]) : '-'}</button></td>`;
                  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderStoreView(data){
    const store = getStore(data.ui.storeId);
    if(!store) return renderCompanyCentral(data);
    const company = getCompany(store.company_id);
    const summary = summarizeStore(store, data.ui.monthKey, data.ui.summaryMode, data.ui.selectedDate);
    return `
      <div class="shops-v2-scroll shops-min-page">
        ${renderMinimalHero(summary, `${store.name}${company ? ` / ${company.name}` : ''}`, store.color)}
        <div class="shops-min-store-grid">
          ${renderSelectedDayPanel(store, data.ui.selectedDate)}
          ${renderStoreCalendar(store, data.ui.monthKey, data.ui.selectedDate)}
        </div>
        ${renderStoreTable(store, summary, data.ui.monthKey, data.ui.selectedDate)}
      </div>
    `;
  }

  function renderOverviewCentral(data){
    const summary = summarizeGlobal(data.ui.monthKey, data.ui.summaryMode, data.ui.selectedDate);
    return `
      <div class="shops-v2-scroll shops-min-page">
        ${renderMinimalHero(summary, 'Zarobek lacznie', cssVar('--accent', '#4f7ef8'))}
        ${renderMiniStats(summary)}
        <div class="card shops-min-card">
          <div class="shops-min-card-head">
            <div class="shops-min-card-title">Firmy</div>
            <button class="btn btn-primary btn-sm" type="button" onclick="openCompanyModal()">+ Firma</button>
          </div>
          <div class="shops-min-menu">
            ${summary.companies.length ? summary.companies.map(renderMiniCompanyButton).join('') : '<div class="shops-min-empty">Dodaj pierwsza firme</div>'}
          </div>
        </div>
      </div>
    `;
  }

  function renderCompanyCentral(data){
    const company = getCompany(data.ui.companyId);
    if(!company) return renderOverviewCentral(data);
    const summary = summarizeCompany(company, data.ui.monthKey, data.ui.summaryMode, data.ui.selectedDate);
    return `
      <div class="shops-v2-scroll shops-min-page">
        ${renderMinimalHero(summary, company.name, companyAccent(summary))}
        ${renderMiniStats(summary)}
        <div class="card shops-min-card">
          <div class="shops-min-card-head">
            <div class="shops-min-card-title">Sklepy</div>
            <div class="shops-min-inline-actions">
              <button class="btn btn-ghost btn-sm" type="button" onclick="openCompanyModal('${company.id}')">Edytuj</button>
              <button class="btn btn-danger btn-sm" type="button" onclick="confirmDeleteCompany('${company.id}')">Usun</button>
              <button class="btn btn-primary btn-sm" type="button" onclick="openStoreModal('${company.id}')">+ Sklep</button>
            </div>
          </div>
          <div class="shops-min-menu">
            ${summary.storeSummaries.length ? summary.storeSummaries.map(renderMiniStoreButton).join('') : '<div class="shops-min-empty">Dodaj pierwszy sklep</div>'}
          </div>
        </div>
      </div>
    `;
  }

  function renderContent(data){
    if(data.ui.view === 'company') return renderCompanyCentral(data);
    if(data.ui.view === 'store') return renderStoreView(data);
    return renderOverviewCentral(data);
  }

  function bindWheelScroll(host){
    if(!host) return;
    if(runtime.wheelHost && runtime.wheelHost !== host && runtime.wheelHandler){
      runtime.wheelHost.removeEventListener('wheel', runtime.wheelHandler, {capture:true});
    }
    if(runtime.wheelHost === host && runtime.wheelHandler) return;

    runtime.wheelHandler = event => {
      const modal = event.target.closest('.shops-v2-modal-body');
      if(modal && modal.scrollHeight > modal.clientHeight) return;

      const table = event.target.closest('.shops-v2-table-scroll, .shops-min-table-wrap');
      if(table){
        const shouldScrollHorizontally = Math.abs(event.deltaX) > 0 || event.shiftKey;
        if(shouldScrollHorizontally){
          table.scrollLeft += event.deltaY || event.deltaX;
          event.preventDefault();
          return;
        }
        if(table.scrollHeight > table.clientHeight){
          table.scrollTop += event.deltaY;
          event.preventDefault();
        }
        return;
      }

      const scroller = host.querySelector('.shops-v2-content');
      if(!scroller || scroller.scrollHeight <= scroller.clientHeight) return;
      scroller.scrollTop += event.deltaY;
      event.preventDefault();
    };

    host.addEventListener('wheel', runtime.wheelHandler, {passive:false, capture:true});
    runtime.wheelHost = host;
  }

  function injectStyles(){
    let style = document.getElementById(STYLE_ID);
    if(!style){
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    style.textContent = `
      #win-shops{min-width:720px;min-height:520px}
      #shops-body.shops-v2-host{display:flex;flex:1;flex-direction:column;height:100%;min-height:0;overflow:hidden;padding:0!important;background:var(--surface)}
      .shops-v2-shell{position:relative;display:flex;flex-direction:column;gap:12px;flex:1;min-height:0;height:100%;overflow:hidden;padding:14px;background:var(--surface);container-type:inline-size}
      .shops-v2-content{flex:1;min-height:0;overflow:auto;scrollbar-width:thin;-webkit-overflow-scrolling:touch}
      .shops-v2-scroll,.shops-v2-store-view{display:flex;flex-direction:column;gap:14px}
      .shops-min-page{max-width:980px;width:100%;margin:0 auto}
      .shops-min-head{padding:16px 18px}
      .shops-min-head-top{display:flex;flex-direction:column;justify-content:center;align-items:center;gap:12px;text-align:center}
      .shops-min-head-copy{display:flex;flex-direction:column;gap:4px;align-items:center}
      .shops-min-head-title{font-size:28px;font-weight:900;color:var(--text);line-height:1}
      .shops-min-head-sub{font-size:13px;color:var(--text2)}
      .shops-min-head-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
      .shops-min-toolbar{display:flex;justify-content:center;align-items:center;gap:10px;flex-wrap:wrap;margin-top:14px}
      .shops-min-date{min-width:170px}
      .shops-min-filters{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}
      .shops-min-hero{padding:26px 22px;text-align:center;border:1.5px solid color-mix(in srgb, var(--shops-min-accent) 28%, var(--border));background:linear-gradient(180deg, color-mix(in srgb, var(--shops-min-accent) 10%, var(--surface)) 0%, var(--surface) 100%)}
      .shops-min-kicker{font-size:11px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.12em}
      .shops-min-amount{margin-top:10px;font-size:clamp(34px,5vw,58px);font-weight:900;font-family:'DM Mono',monospace;color:var(--text);line-height:1}
      .shops-min-hero-row{margin:18px auto 0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;max-width:760px}
      .shops-min-chip{padding:12px;border:1px solid var(--border);border-radius:16px;background:rgba(255,255,255,.55);display:flex;flex-direction:column;gap:4px}
      .shops-min-chip span{font-size:10px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.06em}
      .shops-min-chip strong{font-size:15px;font-weight:800;color:var(--text);font-family:'DM Mono',monospace}
      .shops-min-details{padding:0;overflow:hidden}
      .shops-min-details summary{cursor:pointer;list-style:none;padding:14px 16px;font-size:14px;font-weight:800;background:var(--surface2);text-align:center}
      .shops-min-details summary::-webkit-details-marker{display:none}
      .shops-min-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;padding:14px}
      .shops-min-stats-2{grid-template-columns:repeat(2,minmax(0,1fr));padding:0}
      .shops-min-stat{padding:12px;border:1px solid var(--border);border-radius:16px;background:var(--surface2);display:flex;flex-direction:column;gap:4px}
      .shops-min-stat span{font-size:10px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.06em}
      .shops-min-stat strong{font-size:15px;font-weight:800;color:var(--text);font-family:'DM Mono',monospace}
      .shops-min-card{padding:16px}
      .shops-min-card-head{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
      .shops-min-card-title{font-size:17px;font-weight:800;color:var(--text)}
      .shops-min-menu{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;margin-top:14px}
      .shops-min-menu-btn{min-width:220px;min-height:58px;padding:0 18px;border:none;border-radius:18px;background:var(--shops-min-accent);color:#fff;font:800 15px 'DM Sans',sans-serif;cursor:pointer}
      .shops-min-inline-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
      .shops-min-store-grid{display:grid;grid-template-columns:minmax(280px,360px) minmax(0,1fr);gap:14px}
      .shops-min-cal-head,.shops-min-cal-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px}
      .shops-min-cal-head{margin-top:14px;font-size:10px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;text-align:center}
      .shops-min-cal-grid{margin-top:10px}
      .shops-min-cal-day{height:42px;border:1px solid var(--border);border-radius:12px;background:var(--surface2);cursor:pointer;color:var(--text);font:700 13px 'DM Sans',sans-serif}
      .shops-min-cal-day.is-other{opacity:.45}
      .shops-min-cal-day.is-active{background:var(--accent);border-color:var(--accent);color:#fff}
      .shops-min-cal-day.is-today{box-shadow:inset 0 0 0 1px var(--accent)}
      .shops-min-cal-day.has-data::after{content:'';display:block;width:6px;height:6px;border-radius:50%;background:currentColor;margin:3px auto 0;opacity:.75}
      .shops-min-table-card{padding:0;overflow:hidden}
      .shops-min-table-wrap{overflow:auto;border-top:1px solid var(--border)}
      .shops-min-table{border-collapse:separate;border-spacing:0;min-width:max-content;width:100%}
      .shops-min-table th,.shops-min-table td{padding:0;border-right:1px solid var(--border);border-bottom:1px solid var(--border);background:var(--surface)}
      .shops-min-table thead th{position:sticky;top:0;background:var(--surface2);z-index:1}
      .shops-min-table th:first-child,.shops-min-table td:first-child{position:sticky;left:0;z-index:2;background:var(--surface2);min-width:132px;padding:12px 14px;text-align:left}
      .shops-min-day-btn,.shops-min-cell{min-width:62px;padding:12px 8px;border:none;background:transparent;cursor:pointer;font:700 12px 'DM Mono',monospace;color:var(--text)}
      .shops-min-day-btn.is-active,.shops-min-cell.is-active{background:var(--accent-light);color:var(--accent)}
      .shops-min-cell{color:var(--text2)}
      .shops-min-cell:hover,.shops-min-day-btn:hover{background:var(--surface2)}
      .shops-v2-modal-overlay{position:absolute;inset:0;background:rgba(0,0,0,.42);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:18px;z-index:40}
      .shops-v2-modal{width:min(520px,100%);max-height:100%;overflow:hidden;display:flex;flex-direction:column;background:var(--surface);border:1px solid var(--border);border-radius:22px;box-shadow:0 32px 80px rgba(0,0,0,.35)}
      .shops-v2-modal-wide{width:min(760px,100%)}
      .shops-v2-modal-head{padding:18px 20px 14px;border-bottom:1px solid var(--border);background:var(--surface2);display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
      .shops-v2-modal-head h3{margin:0;font-size:18px;color:var(--text)}
      .shops-v2-modal-head p{margin:4px 0 0;font-size:12px;color:var(--text2);line-height:1.4}
      .shops-v2-modal-body{padding:18px 20px;overflow:auto}
      .shops-v2-modal-foot{padding:12px 20px;border-top:1px solid var(--border);background:var(--surface2);display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap}
      .shops-v2-integration-box{margin-top:12px;padding:14px;border:1.5px solid var(--border);border-radius:14px;background:var(--surface2);display:flex;flex-direction:column;gap:8px}
      @container (max-width: 980px){
        .shops-min-hero-row,.shops-min-stats{grid-template-columns:repeat(2,minmax(0,1fr))}
        .shops-min-store-grid{grid-template-columns:1fr}
      }
      @container (max-width: 720px){
        .shops-v2-shell{padding:10px}
        .shops-min-head-actions,.shops-min-inline-actions{width:100%}
        .shops-min-head-actions .btn,.shops-min-inline-actions .btn{flex:1}
        .shops-min-hero-row,.shops-min-stats,.shops-min-stats-2{grid-template-columns:1fr}
        .shops-min-menu-btn{width:100%}
      }
    `;
  }

  function renderShops(){
    injectStyles();
    const data = ensureData();
    ensureWindow();

    const host = document.getElementById('shops-body');
    if(!host) return;
    host.className = 'shops-v2-host';
    host.style.padding = '0';
    host.style.overflow = 'hidden';
    host.style.display = 'flex';
    host.style.flexDirection = 'column';
    host.style.flex = '1';
    host.style.minHeight = '0';
    host.style.height = '100%';
    host.innerHTML = `
      <div class="shops-v2-shell">
        ${renderHeader(data)}
        <div class="shops-v2-content">${renderContent(data)}</div>
        ${renderModal(data.ui.modal)}
      </div>
    `;
    bindWheelScroll(host);

    const title = document.querySelector('#win-shops .win-title');
    if(title) title.textContent = 'Sklepy';
    const appDef = Array.isArray(window.ALL_APPS) ? window.ALL_APPS.find(app=>app.id === 'shops') : null;
    if(appDef){
      appDef.label = 'Sklepy';
      appDef.desc = 'Firmy, sklepy i wyniki';
    }
  }

  window.renderShops = renderShops;
  window.openShopsOverview = openOverview;
  window.openShopsCompany = openCompany;
  window.openShopsStore = openStore;
  window.setShopsMonth = setMonth;
  window.shiftShopsMonth = shiftMonth;
  window.setShopsSummaryMode = setSummaryMode;
  window.jumpToShopsDate = jumpToDate;
  window.openCompanyModal = openCompanyModal;
  window.openStoreModal = openStoreModal;
  window.openStatModal = openStatModal;
  window.closeShopsModal = closeModal;
  window.saveShopsCompany = saveCompanyForm;
  window.saveShopsStore = saveStoreForm;
  window.saveShopsStat = saveStatForm;
  window.toggleCompanyActive = toggleCompanyActive;
  window.toggleStoreActive = toggleStoreActive;
  window.confirmDeleteCompany = confirmDeleteCompany;
  window.confirmDeleteStore = confirmDeleteStore;
  window.confirmDeleteStat = confirmDeleteStat;
  window.confirmShopsModalAction = confirmModalAction;
  window.fillShopStats = renderWidget;
  window.quickAddCompany = quickAddCompany;
  window.quickAddStore = quickAddStore;
  window.saveInlineStat = saveInlineStat;
  window.syncShopifyRevenue = syncShopifyRevenue;

  if(!runtime.boundResize){
    runtime.boundResize = true;
    window.addEventListener('resize', ()=>{
      clampWindow();
      const host = document.getElementById('shops-body');
      if(host && host.classList.contains('shops-v2-host')) renderShops();
    });
  }

  ensureData();
  renderShops();
})();
