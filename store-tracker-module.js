(function(){
  if(window.__storeTrackerModuleLoaded) return;
  window.__storeTrackerModuleLoaded = true;

  const TRACKER_STYLE_ID = 'store-tracker-styles';
  const STORE_COLORS = ['#4f7ef8', '#22c55e', '#f97316', '#eab308', '#f43f5e', '#14b8a6', '#8b5cf6', '#06b6d4'];
  const SHARE_TYPE_LABELS = {
    headcount: 'Podzial na osoby',
    percentage: 'Procent zysku',
    fixed: 'Stala kwota'
  };
  const CALCULATION_MODE_LABELS = {
    gross_to_net: 'Automatyczne netto z brutto',
    manual_net: 'Netto wpisywane recznie'
  };
  const trackerRuntime = {
    charts: {}
  };

  function trackerUid(prefix){
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
  }

  function trackerNowIso(){
    return new Date().toISOString();
  }

  function trackerLocalDate(date){
    const value = date instanceof Date ? date : new Date(date || Date.now());
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function trackerMonthKey(value){
    const date = value ? (value instanceof Date ? value : new Date(value)) : new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  function trackerParseMonthKey(monthKey){
    const match = String(monthKey || '').match(/^(\d{4})-(\d{2})$/);
    if(!match){
      const fallback = new Date();
      return {
        year: fallback.getFullYear(),
        monthIndex: fallback.getMonth(),
        daysInMonth: new Date(fallback.getFullYear(), fallback.getMonth() + 1, 0).getDate()
      };
    }
    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    return {
      year,
      monthIndex,
      daysInMonth: new Date(year, monthIndex + 1, 0).getDate()
    };
  }

  function trackerDateFromMonthDay(monthKey, day){
    const meta = trackerParseMonthKey(monthKey);
    const month = String(meta.monthIndex + 1).padStart(2, '0');
    const dayPart = String(day).padStart(2, '0');
    return `${meta.year}-${month}-${dayPart}`;
  }

  function trackerDayList(monthKey){
    const meta = trackerParseMonthKey(monthKey);
    return Array.from({length: meta.daysInMonth}, (_, index)=>trackerDateFromMonthDay(monthKey, index + 1));
  }

  function trackerMonthLabel(monthKey){
    const meta = trackerParseMonthKey(monthKey);
    return new Intl.DateTimeFormat('pl-PL', {month:'long', year:'numeric'})
      .format(new Date(meta.year, meta.monthIndex, 1))
      .replace(/^./, value=>value.toUpperCase());
  }

  function trackerWeekdayShort(dateStr){
    return new Intl.DateTimeFormat('pl-PL', {weekday:'short'})
      .format(new Date(`${dateStr}T12:00:00`))
      .replace('.', '')
      .toUpperCase();
  }

  function trackerDateLabel(dateStr){
    return new Intl.DateTimeFormat('pl-PL', {day:'numeric', month:'short'})
      .format(new Date(`${dateStr}T12:00:00`));
  }

  function trackerFullDateLabel(dateStr){
    return new Intl.DateTimeFormat('pl-PL', {
      weekday:'long',
      day:'numeric',
      month:'long',
      year:'numeric'
    }).format(new Date(`${dateStr}T12:00:00`));
  }

  function trackerNum(value){
    if(typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const normalized = String(value ?? '').trim().replace(/\s+/g, '').replace(',', '.');
    if(!normalized) return 0;
    const number = Number(normalized);
    return Number.isFinite(number) ? number : 0;
  }

  function trackerMaybeNum(value){
    const normalized = String(value ?? '').trim().replace(/\s+/g, '').replace(',', '.');
    if(!normalized) return null;
    const number = Number(normalized);
    return Number.isFinite(number) ? number : null;
  }

  function trackerFmtPLN(value){
    return new Intl.NumberFormat('pl-PL', {
      style:'currency',
      currency:'PLN',
      minimumFractionDigits:0,
      maximumFractionDigits:2
    }).format(trackerNum(value));
  }

  function trackerFmtCompactPLN(value){
    const amount = trackerNum(value);
    const abs = Math.abs(amount);
    if(abs >= 1000000) return `${(amount / 1000000).toLocaleString('pl-PL', {maximumFractionDigits:1})} mln zl`;
    if(abs >= 1000) return `${(amount / 1000).toLocaleString('pl-PL', {maximumFractionDigits:1})} tys. zl`;
    return trackerFmtPLN(amount);
  }

  function trackerFmtPct(value){
    if(value === null || value === undefined || Number.isNaN(Number(value))) return '—';
    return `${trackerNum(value).toLocaleString('pl-PL', {maximumFractionDigits:1})}%`;
  }

  function trackerColor(index){
    return STORE_COLORS[index % STORE_COLORS.length];
  }

  function trackerDefaultUi(){
    return {
      view: 'dashboard',
      monthKey: trackerMonthKey(new Date()),
      storeFilter: 'all',
      activeStoreId: null,
      modal: null
    };
  }

  function trackerNormalizeStore(store, index){
    const now = trackerNowIso();
    return {
      id: store.id || trackerUid('store'),
      name: String(store.name || 'Nowy sklep').trim(),
      is_active: store.is_active !== false,
      color: store.color || trackerColor(index || 0),
      vat_rate: Math.max(0, Math.min(99, trackerNum(store.vat_rate || 23))),
      profit_share_type: ['headcount', 'percentage', 'fixed'].includes(store.profit_share_type) ? store.profit_share_type : 'headcount',
      profit_share_value: trackerNum(store.profit_share_value || 0),
      headcount: Math.max(1, parseInt(store.headcount || 1, 10)),
      calculation_mode: ['gross_to_net', 'manual_net'].includes(store.calculation_mode) ? store.calculation_mode : 'gross_to_net',
      created_at: store.created_at || now,
      updated_at: store.updated_at || now
    };
  }

  function trackerNormalizeStat(stat){
    if(!stat || !stat.store_id || !stat.date) return null;
    const now = trackerNowIso();
    return {
      id: stat.id || trackerUid('stat'),
      store_id: stat.store_id,
      date: String(stat.date).slice(0, 10),
      revenue_gross: trackerNum(stat.revenue_gross),
      revenue_net: stat.revenue_net === null || stat.revenue_net === undefined || stat.revenue_net === '' ? null : trackerNum(stat.revenue_net),
      ad_cost_tiktok: trackerNum(stat.ad_cost_tiktok),
      refunds: trackerNum(stat.refunds),
      extra_costs: trackerNum(stat.extra_costs),
      notes: String(stat.notes || '').trim(),
      created_at: stat.created_at || now,
      updated_at: stat.updated_at || now
    };
  }

  function trackerEnsureData(){
    if(!S.storeTracker || typeof S.storeTracker !== 'object') S.storeTracker = {};
    const data = S.storeTracker;
    if(!Array.isArray(data.stores)) data.stores = [];
    if(!Array.isArray(data.dailyStats)) data.dailyStats = [];
    if(!data.ui || typeof data.ui !== 'object') data.ui = {};
    if(!data.meta || typeof data.meta !== 'object') data.meta = {};
    data.version = 1;

    const defaults = trackerDefaultUi();
    Object.keys(defaults).forEach(key=>{
      if(data.ui[key] === undefined || data.ui[key] === null || data.ui[key] === '') data.ui[key] = defaults[key];
    });
    if(typeof data.meta.migratedLegacy !== 'boolean') data.meta.migratedLegacy = false;
    if(typeof data.meta.seeded !== 'boolean') data.meta.seeded = false;

    data.stores = data.stores.map((store, index)=>trackerNormalizeStore(store, index));
    data.dailyStats = data.dailyStats.map(trackerNormalizeStat).filter(Boolean);

    trackerMigrateLegacyShops();

    data.stores = data.stores.map((store, index)=>trackerNormalizeStore(store, index));
    data.dailyStats = data.dailyStats.map(trackerNormalizeStat).filter(Boolean);
    data.dailyStats.sort((a, b)=>a.date.localeCompare(b.date));

    if(!data.ui.activeStoreId && data.stores.length) data.ui.activeStoreId = data.stores[0].id;
    if(data.ui.activeStoreId && !data.stores.some(store=>store.id === data.ui.activeStoreId)) data.ui.activeStoreId = data.stores[0]?.id || null;
    if(data.ui.storeFilter !== 'all' && !data.stores.some(store=>store.id === data.ui.storeFilter)) data.ui.storeFilter = 'all';

    trackerSyncLegacyMirror();
    return data;
  }

  function trackerMigrateLegacyShops(){
    const data = S.storeTracker;
    if(data.meta.migratedLegacy) return;

    const legacyShops = Array.isArray(S.shops) ? S.shops : [];
    if(!legacyShops.length){
      data.meta.migratedLegacy = true;
      return;
    }

    const existingNames = new Set((data.stores || []).map(store=>String(store.name || '').trim().toLowerCase()));
    legacyShops.forEach((shop, index)=>{
      const normalizedName = String(shop.name || '').trim();
      if(!normalizedName || existingNames.has(normalizedName.toLowerCase())) return;

      const storeId = `legacy_${shop.id || trackerUid('store')}`;
      data.stores.push({
        id: storeId,
        name: normalizedName,
        is_active: shop.status !== 'archived',
        color: trackerColor(index),
        vat_rate: trackerNum(shop.vatRate || 23),
        profit_share_type: 'headcount',
        profit_share_value: 0,
        headcount: Math.max(1, parseInt(shop.people || 1, 10)),
        calculation_mode: 'gross_to_net',
        created_at: trackerNowIso(),
        updated_at: trackerNowIso()
      });

      (shop.entries || []).forEach(entry=>{
        if(!entry || !entry.date) return;
        const revenues = Array.isArray(entry.revenues) ? entry.revenues : [];
        const adEntries = Array.isArray(entry.adEntries) ? entry.adEntries : [];
        const gross = revenues.reduce((sum, item)=>sum + trackerNum(item.amount), 0);
        const allAds = adEntries.reduce((sum, item)=>sum + trackerNum(item.amount), 0);
        const tiktokAds = adEntries.filter(item=>item.platformId === 'tiktok').reduce((sum, item)=>sum + trackerNum(item.amount), 0);
        const notes = [];
        if(allAds && !tiktokAds) notes.push('Zmigrowano z legacy jako laczny koszt reklam');
        if(entry.notes) notes.push(entry.notes);
        data.dailyStats.push({
          id: trackerUid('stat'),
          store_id: storeId,
          date: String(entry.date).slice(0, 10),
          revenue_gross: gross,
          revenue_net: null,
          ad_cost_tiktok: tiktokAds || allAds,
          refunds: 0,
          extra_costs: 0,
          notes: notes.join(' • '),
          created_at: trackerNowIso(),
          updated_at: trackerNowIso()
        });
      });

      existingNames.add(normalizedName.toLowerCase());
    });

    data.meta.migratedLegacy = true;
  }

  function trackerSyncLegacyMirror(){
    const data = S.storeTracker;
    if(!data) return;
    S.shops = (data.stores || []).map(store=>({
      id: store.id,
      name: store.name,
      platform: 'Profit Tracker',
      notes: '',
      adsOn: store.is_active,
      campaignOk: true,
      status: store.is_active ? 'active' : 'muted',
      entries: (data.dailyStats || [])
        .filter(stat=>stat.store_id === store.id)
        .map(stat=>({
          id: stat.id,
          date: stat.date,
          revenues: stat.revenue_gross ? [{id:`${stat.id}_rev`, amount: trackerNum(stat.revenue_gross)}] : [],
          adEntries: stat.ad_cost_tiktok ? [{id:`${stat.id}_ads`, platformId:'tiktok', amount: trackerNum(stat.ad_cost_tiktok)}] : [],
          refunds: trackerNum(stat.refunds),
          extraCosts: trackerNum(stat.extra_costs)
        })),
      adPlatforms: [{id:'tiktok', name:'TikTok Ads', enabled:true, color:'#010101'}],
      vatRate: store.vat_rate,
      people: store.headcount,
      apiKey: ''
    }));
  }

  function trackerData(){
    return trackerEnsureData();
  }

  function trackerGetAllStores(){
    return trackerData().stores
      .slice()
      .sort((a, b)=>(Number(b.is_active) - Number(a.is_active)) || a.name.localeCompare(b.name, 'pl'));
  }

  function trackerGetStore(storeId){
    return trackerData().stores.find(store=>store.id === storeId) || null;
  }

  function trackerGetFilteredStores(includeInactive){
    const data = trackerData();
    let stores = trackerGetAllStores();
    if(data.ui.storeFilter !== 'all') stores = stores.filter(store=>store.id === data.ui.storeFilter);
    else if(!includeInactive) stores = stores.filter(store=>store.is_active);
    return stores;
  }

  function trackerGetStatsForMonth(monthKey, storeIds){
    const ids = Array.isArray(storeIds) ? new Set(storeIds) : null;
    return trackerData().dailyStats
      .filter(stat=>stat.date.startsWith(`${monthKey}-`) && (!ids || ids.has(stat.store_id)))
      .sort((a, b)=>a.date.localeCompare(b.date));
  }

  function trackerGetStat(storeId, date){
    return trackerData().dailyStats.find(stat=>stat.store_id === storeId && stat.date === date) || null;
  }

  function trackerComputeNet(store, stat){
    if(stat.revenue_net !== null && stat.revenue_net !== undefined) return trackerNum(stat.revenue_net);
    if(store.calculation_mode === 'gross_to_net'){
      const divider = 1 + (trackerNum(store.vat_rate) / 100);
      return divider > 0 ? trackerNum(stat.revenue_gross) / divider : trackerNum(stat.revenue_gross);
    }
    return 0;
  }

  function trackerComputePerHead(store, income){
    const type = store.profit_share_type || 'headcount';
    const shareValue = trackerNum(store.profit_share_value);
    if(type === 'percentage') return income * (shareValue / 100);
    if(type === 'fixed') return shareValue;
    return income / Math.max(1, parseInt(store.headcount || 1, 10));
  }

  function trackerComputeMonthlyPerHead(store, income, statCount){
    const type = store.profit_share_type || 'headcount';
    const shareValue = trackerNum(store.profit_share_value);
    if(type === 'percentage') return income * (shareValue / 100);
    if(type === 'fixed') return statCount > 0 ? shareValue * statCount : 0;
    return income / Math.max(1, parseInt(store.headcount || 1, 10));
  }

  function trackerComputeStat(store, stat){
    const revenueGross = trackerNum(stat.revenue_gross);
    const revenueNet = trackerComputeNet(store, stat);
    const adCost = trackerNum(stat.ad_cost_tiktok);
    const refunds = trackerNum(stat.refunds);
    const extraCosts = trackerNum(stat.extra_costs);
    const income = revenueNet - adCost - refunds - extraCosts;
    return {
      ...stat,
      revenue_gross: revenueGross,
      revenue_net_resolved: revenueNet,
      ad_cost_tiktok: adCost,
      refunds,
      extra_costs: extraCosts,
      income,
      per_head: trackerComputePerHead(store, income),
      ad_pct: revenueGross > 0 ? (adCost / revenueGross) * 100 : 0,
      has_manual_net: stat.revenue_net !== null && stat.revenue_net !== undefined
    };
  }

  function trackerStoreSummary(store, monthKey){
    const stats = trackerGetStatsForMonth(monthKey, [store.id]).map(stat=>trackerComputeStat(store, stat));
    const summary = {
      store,
      stats,
      gross: 0,
      net: 0,
      ads: 0,
      refunds: 0,
      extra: 0,
      income: 0,
      perHead: 0,
      adPct: 0,
      daysWithData: stats.length,
      bestDay: null,
      worstDay: null
    };

    stats.forEach(stat=>{
      summary.gross += stat.revenue_gross;
      summary.net += stat.revenue_net_resolved;
      summary.ads += stat.ad_cost_tiktok;
      summary.refunds += stat.refunds;
      summary.extra += stat.extra_costs;
      summary.income += stat.income;
      if(!summary.bestDay || stat.income > summary.bestDay.income) summary.bestDay = stat;
      if(!summary.worstDay || stat.income < summary.worstDay.income) summary.worstDay = stat;
    });

    summary.perHead = trackerComputeMonthlyPerHead(store, summary.income, summary.daysWithData);
    summary.adPct = summary.gross > 0 ? (summary.ads / summary.gross) * 100 : 0;
    return summary;
  }

  function trackerRanking(monthKey, storeIds){
    const targetIds = Array.isArray(storeIds) ? new Set(storeIds) : null;
    return trackerGetAllStores()
      .filter(store=>!targetIds || targetIds.has(store.id))
      .map(store=>trackerStoreSummary(store, monthKey))
      .filter(summary=>summary.daysWithData > 0 || targetIds)
      .sort((a, b)=>b.income - a.income);
  }

  function trackerGlobalSummary(monthKey, storeIds){
    const ids = Array.isArray(storeIds) ? storeIds : trackerGetFilteredStores(false).map(store=>store.id);
    const ranking = trackerRanking(monthKey, ids);
    const summary = {
      gross: 0,
      net: 0,
      ads: 0,
      refunds: 0,
      extra: 0,
      income: 0,
      perHead: 0,
      adPct: 0,
      storeCount: ids.length,
      bestStore: ranking[0] || null,
      worstStore: ranking[ranking.length - 1] || null,
      ranking
    };

    ranking.forEach(item=>{
      summary.gross += item.gross;
      summary.net += item.net;
      summary.ads += item.ads;
      summary.refunds += item.refunds;
      summary.extra += item.extra;
      summary.income += item.income;
      summary.perHead += item.perHead;
    });
    summary.adPct = summary.gross > 0 ? (summary.ads / summary.gross) * 100 : 0;
    return summary;
  }

  function trackerDailyTotals(monthKey, storeIds){
    const ids = Array.isArray(storeIds) ? new Set(storeIds) : new Set(trackerGetFilteredStores(false).map(store=>store.id));
    const storeMap = new Map(trackerGetAllStores().map(store=>[store.id, store]));
    const result = trackerDayList(monthKey).map(date=>({
      date,
      label: trackerDateLabel(date),
      weekday: trackerWeekdayShort(date),
      gross: 0,
      net: 0,
      ads: 0,
      refunds: 0,
      extra: 0,
      income: 0,
      perHead: 0,
      entries: 0
    }));
    const byDate = new Map(result.map(item=>[item.date, item]));

    trackerGetStatsForMonth(monthKey).forEach(stat=>{
      if(!ids.has(stat.store_id)) return;
      const store = storeMap.get(stat.store_id);
      if(!store) return;
      const computed = trackerComputeStat(store, stat);
      const bucket = byDate.get(stat.date);
      if(!bucket) return;
      bucket.gross += computed.revenue_gross;
      bucket.net += computed.revenue_net_resolved;
      bucket.ads += computed.ad_cost_tiktok;
      bucket.refunds += computed.refunds;
      bucket.extra += computed.extra_costs;
      bucket.income += computed.income;
      bucket.perHead += computed.per_head;
      bucket.entries += 1;
    });

    return result;
  }

  function trackerPersist(message, type){
    trackerSyncLegacyMirror();
    saveS();
    try{ updateMenubar(); }catch(e){}
    try{ renderPillStats(); }catch(e){}
    try{ renderNotifBubble(); }catch(e){}
    try{
      if(S.widgets?.['shop-stats']?.enabled && typeof fillWidget === 'function') fillWidget('shop-stats');
    }catch(e){}
    trackerRenderShops();
    if(message) toast(message, type || 'success', 2600);
  }

  function trackerSetView(view){
    trackerData().ui.view = view;
    trackerRenderShops();
  }

  function trackerSetFilter(storeId){
    const data = trackerData();
    data.ui.storeFilter = storeId || 'all';
    if(storeId && storeId !== 'all') data.ui.activeStoreId = storeId;
    trackerRenderShops();
  }

  function trackerSetMonth(monthKey){
    if(!/^\d{4}-\d{2}$/.test(String(monthKey || ''))) return;
    trackerData().ui.monthKey = monthKey;
    trackerRenderShops();
  }

  function trackerShiftMonth(delta){
    const data = trackerData();
    const meta = trackerParseMonthKey(data.ui.monthKey);
    const next = new Date(meta.year, meta.monthIndex + delta, 1);
    data.ui.monthKey = trackerMonthKey(next);
    trackerRenderShops();
  }

  function trackerSelectStore(storeId){
    const data = trackerData();
    data.ui.activeStoreId = storeId;
    data.ui.view = 'store';
    trackerRenderShops();
  }

  function trackerOpenStoreModal(storeId){
    const data = trackerData();
    data.ui.modal = {type:'store', storeId: storeId || null};
    trackerRenderShops();
  }

  function trackerOpenStatModal(storeId, date){
    const data = trackerData();
    const targetStoreId = storeId || data.ui.activeStoreId || data.stores[0]?.id || null;
    if(!targetStoreId){
      toast('Najpierw dodaj sklep.', 'warning', 2800);
      data.ui.modal = {type:'store', storeId:null};
      trackerRenderShops();
      return;
    }
    const targetDate = date || trackerLocalDate(new Date());
    const existing = trackerGetStat(targetStoreId, targetDate);
    data.ui.modal = {
      type:'stat',
      storeId: targetStoreId,
      date: targetDate,
      statId: existing?.id || null
    };
    trackerRenderShops();
  }

  function trackerOpenDeleteStore(storeId){
    trackerData().ui.modal = {type:'confirm-delete-store', storeId};
    trackerRenderShops();
  }

  function trackerOpenDeleteStat(statId){
    trackerData().ui.modal = {type:'confirm-delete-stat', statId};
    trackerRenderShops();
  }

  function trackerCloseModal(){
    trackerData().ui.modal = null;
    trackerRenderShops();
  }

  function trackerSaveStoreForm(){
    const data = trackerData();
    const id = document.getElementById('tracker-store-id')?.value || null;
    const name = String(document.getElementById('tracker-store-name')?.value || '').trim();
    const vatRate = trackerNum(document.getElementById('tracker-store-vat')?.value);
    const headcount = Math.max(1, parseInt(document.getElementById('tracker-store-headcount')?.value || 1, 10));
    const profitShareType = document.getElementById('tracker-store-share-type')?.value || 'headcount';
    const profitShareValue = trackerNum(document.getElementById('tracker-store-share-value')?.value || 0);
    const calculationMode = document.getElementById('tracker-store-calc-mode')?.value || 'gross_to_net';
    const color = document.getElementById('tracker-store-color')?.value || trackerColor(data.stores.length);
    const isActive = !!document.getElementById('tracker-store-active')?.checked;

    if(!name){
      toast('Podaj nazwe sklepu.', 'warning', 2600);
      return;
    }

    const existingIndex = data.stores.findIndex(store=>store.id === id);
    const existing = existingIndex >= 0 ? data.stores[existingIndex] : null;
    const nextStore = trackerNormalizeStore({
      id: existing?.id || trackerUid('store'),
      name,
      is_active: isActive,
      color,
      vat_rate: vatRate,
      profit_share_type: profitShareType,
      profit_share_value: profitShareValue,
      headcount,
      calculation_mode: calculationMode,
      created_at: existing?.created_at || trackerNowIso(),
      updated_at: trackerNowIso()
    }, existingIndex >= 0 ? existingIndex : data.stores.length);

    if(existingIndex >= 0) data.stores.splice(existingIndex, 1, nextStore);
    else data.stores.unshift(nextStore);

    data.ui.activeStoreId = nextStore.id;
    data.ui.modal = null;
    if(data.ui.view === 'manage') data.ui.view = 'store';
    trackerPersist(existing ? 'Zapisano sklep.' : 'Dodano nowy sklep.');
  }

  function trackerSaveStatForm(){
    const data = trackerData();
    const modal = data.ui.modal || {};
    const storeId = document.getElementById('tracker-stat-store')?.value || '';
    const date = document.getElementById('tracker-stat-date')?.value || '';
    const gross = trackerNum(document.getElementById('tracker-stat-gross')?.value);
    const manualNet = trackerMaybeNum(document.getElementById('tracker-stat-net')?.value);
    const ads = trackerNum(document.getElementById('tracker-stat-ads')?.value);
    const refunds = trackerNum(document.getElementById('tracker-stat-refunds')?.value);
    const extraCosts = trackerNum(document.getElementById('tracker-stat-extra')?.value);
    const notes = String(document.getElementById('tracker-stat-notes')?.value || '').trim();
    const store = trackerGetStore(storeId);

    if(!store){
      toast('Wybierz sklep.', 'warning', 2500);
      return;
    }
    if(!date){
      toast('Wybierz date.', 'warning', 2500);
      return;
    }
    if([gross, ads, refunds, extraCosts].some(value=>value < 0) || (manualNet !== null && manualNet < 0)){
      toast('Wartosci nie moga byc ujemne.', 'warning', 2800);
      return;
    }
    if(store.calculation_mode === 'manual_net' && manualNet === null){
      toast('Ten sklep wymaga recznego wpisania netto.', 'warning', 3200);
      return;
    }

    const existingIndex = data.dailyStats.findIndex(stat=>(
      (modal.statId && stat.id === modal.statId) ||
      (stat.store_id === storeId && stat.date === date)
    ));
    const existing = existingIndex >= 0 ? data.dailyStats[existingIndex] : null;
    const nextStat = trackerNormalizeStat({
      id: existing?.id || trackerUid('stat'),
      store_id: storeId,
      date,
      revenue_gross: gross,
      revenue_net: manualNet,
      ad_cost_tiktok: ads,
      refunds,
      extra_costs: extraCosts,
      notes,
      created_at: existing?.created_at || trackerNowIso(),
      updated_at: trackerNowIso()
    });

    if(existingIndex >= 0) data.dailyStats.splice(existingIndex, 1, nextStat);
    else data.dailyStats.push(nextStat);
    data.dailyStats.sort((a, b)=>a.date.localeCompare(b.date));

    data.ui.activeStoreId = storeId;
    data.ui.modal = null;
    trackerPersist(existing ? 'Zapisano dzien.' : 'Dodano dane dzienne.');
  }

  function trackerDeleteStoreConfirmed(){
    const data = trackerData();
    const storeId = data.ui.modal?.storeId;
    if(!storeId) return;
    data.stores = data.stores.filter(store=>store.id !== storeId);
    data.dailyStats = data.dailyStats.filter(stat=>stat.store_id !== storeId);
    data.ui.activeStoreId = data.stores[0]?.id || null;
    data.ui.storeFilter = data.ui.storeFilter === storeId ? 'all' : data.ui.storeFilter;
    data.ui.modal = null;
    trackerPersist('Usunieto sklep i jego dane.', 'info');
  }

  function trackerDeleteStatConfirmed(){
    const data = trackerData();
    const statId = data.ui.modal?.statId;
    if(!statId) return;
    data.dailyStats = data.dailyStats.filter(stat=>stat.id !== statId);
    data.ui.modal = null;
    trackerPersist('Usunieto wpis dzienny.', 'info');
  }

  function trackerToggleStoreActive(storeId){
    const store = trackerGetStore(storeId);
    if(!store) return;
    store.is_active = !store.is_active;
    store.updated_at = trackerNowIso();
    trackerPersist(store.is_active ? 'Sklep aktywowany.' : 'Sklep zdezaktywowany.', 'info');
  }

  function trackerLoadDemoData(){
    const data = trackerData();
    if(data.stores.length || data.dailyStats.length){
      toast('Demo wczytasz na pustym module albo po usunieciu obecnych sklepow.', 'warning', 3600);
      return;
    }

    const monthKey = data.ui.monthKey || trackerMonthKey(new Date());
    const demoStores = [
      {id:'demo_fashiondrop', name:'FashionDrop', color:'#4f7ef8', vat_rate:23, headcount:2, calculation_mode:'gross_to_net', profit_share_type:'headcount', profit_share_value:0, is_active:true},
      {id:'demo_techgear', name:'TechGear', color:'#22c55e', vat_rate:23, headcount:3, calculation_mode:'gross_to_net', profit_share_type:'percentage', profit_share_value:35, is_active:true},
      {id:'demo_homebloom', name:'HomeBloom', color:'#f97316', vat_rate:8, headcount:1, calculation_mode:'manual_net', profit_share_type:'fixed', profit_share_value:900, is_active:true}
    ].map((store, index)=>trackerNormalizeStore(store, index));

    const seeds = {
      demo_fashiondrop: {
        gross: [21500, 19800, 22650, 24500, 21900, 23300, 24120, 25210],
        ads: [4200, 3980, 4370, 4620, 4310, 4480, 4510, 4725],
        refunds: [520, 300, 410, 640, 590, 470, 520, 610],
        extra: [260, 260, 320, 410, 300, 290, 340, 360]
      },
      demo_techgear: {
        gross: [16800, 17220, 18140, 17680, 19020, 20110, 18450, 20890],
        ads: [3350, 3480, 3620, 3540, 3800, 4010, 3710, 4180],
        refunds: [230, 180, 260, 210, 290, 240, 220, 310],
        extra: [180, 200, 200, 220, 220, 240, 210, 260]
      },
      demo_homebloom: {
        gross: [12400, 13200, 14120, 13680, 14900, 15740, 16210, 16850],
        net: [11480, 12210, 13040, 12680, 13890, 14620, 15140, 15710],
        ads: [1800, 1900, 2100, 2050, 2240, 2320, 2410, 2550],
        refunds: [160, 120, 210, 180, 190, 200, 170, 210],
        extra: [220, 220, 260, 260, 280, 280, 300, 320]
      }
    };

    const days = [1, 2, 4, 6, 9, 12, 14, 15];
    data.stores = demoStores;
    data.dailyStats = [];

    demoStores.forEach(store=>{
      const source = seeds[store.id];
      days.forEach((day, index)=>{
        data.dailyStats.push(trackerNormalizeStat({
          id: trackerUid('stat'),
          store_id: store.id,
          date: trackerDateFromMonthDay(monthKey, day),
          revenue_gross: source.gross[index],
          revenue_net: Array.isArray(source.net) ? source.net[index] : null,
          ad_cost_tiktok: source.ads[index],
          refunds: source.refunds[index],
          extra_costs: source.extra[index],
          notes: index % 3 === 0 ? 'Dzien po wiekszej optymalizacji kampanii.' : ''
        }));
      });
    });

    data.meta.seeded = true;
    data.ui.activeStoreId = demoStores[0].id;
    data.ui.storeFilter = 'all';
    data.ui.view = 'dashboard';
    trackerPersist('Wczytano przykladowe dane sklepow.');
  }

  function trackerStatPreview(){
    const storeId = document.getElementById('tracker-stat-store')?.value || '';
    const date = document.getElementById('tracker-stat-date')?.value || '';
    const store = trackerGetStore(storeId);
    const preview = document.getElementById('tracker-stat-preview');
    if(!preview || !store || !date) return;

    const pseudo = trackerNormalizeStat({
      id: 'preview',
      store_id: storeId,
      date,
      revenue_gross: document.getElementById('tracker-stat-gross')?.value || 0,
      revenue_net: trackerMaybeNum(document.getElementById('tracker-stat-net')?.value),
      ad_cost_tiktok: document.getElementById('tracker-stat-ads')?.value || 0,
      refunds: document.getElementById('tracker-stat-refunds')?.value || 0,
      extra_costs: document.getElementById('tracker-stat-extra')?.value || 0,
      notes: ''
    });
    const computed = trackerComputeStat(store, pseudo);
    const autoLabel = computed.has_manual_net ? 'Reczne netto' : (store.calculation_mode === 'gross_to_net' ? 'Netto automatyczne' : 'Netto nieuzupelnione');

    preview.innerHTML = `
      <div class="tracker-preview-chip">
        <span class="tracker-preview-label">${autoLabel}</span>
        <strong>${trackerFmtPLN(computed.revenue_net_resolved)}</strong>
      </div>
      <div class="tracker-preview-chip">
        <span class="tracker-preview-label">Dochod</span>
        <strong>${trackerFmtPLN(computed.income)}</strong>
      </div>
      <div class="tracker-preview-chip">
        <span class="tracker-preview-label">Na glowe</span>
        <strong>${trackerFmtPLN(computed.per_head)}</strong>
      </div>
      <div class="tracker-preview-chip">
        <span class="tracker-preview-label">TikTok / przychod</span>
        <strong>${trackerFmtPct(computed.ad_pct)}</strong>
      </div>`;
  }

  function trackerToolbarHtml(data){
    const stores = trackerGetAllStores();
    return `
      <section class="tracker-hero">
        <div>
          <div class="tracker-eyebrow">Profit tracker ecommerce</div>
          <h1>Sklepy / Wyniki</h1>
          <p>Nowy modul do dziennych wynikow sklepow, liczenia dochodu i miesiecznej kontroli wyniku bez wracania do Excela.</p>
        </div>
        <div class="tracker-hero-actions">
          <button class="tracker-btn tracker-btn-ghost" type="button" onclick="trackerShiftMonth(-1)">← Poprzedni miesiac</button>
          <div class="tracker-month-pill">${trackerMonthLabel(data.ui.monthKey)}</div>
          <button class="tracker-btn tracker-btn-ghost" type="button" onclick="trackerShiftMonth(1)">Nastepny →</button>
        </div>
      </section>
      <section class="tracker-toolbar">
        <div class="tracker-toolbar-group">
          <label class="tracker-control">
            <span>Miesiac</span>
            <input type="month" value="${escHtml(data.ui.monthKey)}" onchange="trackerSetMonth(this.value)">
          </label>
          <label class="tracker-control">
            <span>Filtr sklepu</span>
            <select onchange="trackerSetFilter(this.value)">
              <option value="all"${data.ui.storeFilter === 'all' ? ' selected' : ''}>Wszystkie aktywne</option>
              ${stores.map(store=>`<option value="${escHtml(store.id)}"${data.ui.storeFilter === store.id ? ' selected' : ''}>${escHtml(store.name)}${store.is_active ? '' : ' (nieaktywny)'}</option>`).join('')}
            </select>
          </label>
        </div>
        <div class="tracker-toolbar-group tracker-toolbar-actions">
          <button class="tracker-btn tracker-btn-subtle" type="button" onclick="trackerSetView('dashboard')">Dashboard</button>
          <button class="tracker-btn tracker-btn-subtle" type="button" onclick="trackerSetView('month')">Tabela miesieczna</button>
          <button class="tracker-btn tracker-btn-subtle" type="button" onclick="trackerSetView('store')">Widok sklepu</button>
          <button class="tracker-btn tracker-btn-subtle" type="button" onclick="trackerSetView('manage')">Zarzadzanie</button>
          <button class="tracker-btn tracker-btn-ghost" type="button" onclick="trackerOpenStatModal()">+ Dodaj dzien</button>
          <button class="tracker-btn tracker-btn-primary" type="button" onclick="trackerOpenStoreModal()">+ Dodaj sklep</button>
        </div>
      </section>
      <nav class="tracker-nav">
        <button class="tracker-nav-btn${data.ui.view === 'dashboard' ? ' active' : ''}" onclick="trackerSetView('dashboard')">Dashboard globalny</button>
        <button class="tracker-nav-btn${data.ui.view === 'month' ? ' active' : ''}" onclick="trackerSetView('month')">Miesieczny uklad</button>
        <button class="tracker-nav-btn${data.ui.view === 'store' ? ' active' : ''}" onclick="trackerSetView('store')">Pojedynczy sklep</button>
        <button class="tracker-nav-btn${data.ui.view === 'manage' ? ' active' : ''}" onclick="trackerSetView('manage')">Zarzadzanie sklepami</button>
      </nav>`;
  }

  function trackerMetricCard(label, value, tone, sub){
    return `
      <article class="tracker-kpi tracker-tone-${tone || 'neutral'}">
        <span class="tracker-kpi-label">${label}</span>
        <strong class="tracker-kpi-value">${value}</strong>
        <span class="tracker-kpi-sub">${sub || ''}</span>
      </article>`;
  }

  function trackerDashboardHtml(data){
    const filteredStores = trackerGetFilteredStores(false);
    if(!filteredStores.length) return trackerEmptyStateHtml();

    const storeIds = filteredStores.map(store=>store.id);
    const summary = trackerGlobalSummary(data.ui.monthKey, storeIds);
    const ranking = summary.ranking.slice(0, 6);
    const daily = trackerDailyTotals(data.ui.monthKey, storeIds).filter(day=>day.entries > 0);

    return `
      <div class="tracker-dashboard-grid">
        <section class="tracker-card tracker-card-span-2">
          <div class="tracker-card-header">
            <div>
              <div class="tracker-card-eyebrow">Miesieczne podsumowanie</div>
              <h2>Globalny wynik wszystkich sklepow</h2>
            </div>
            <div class="tracker-card-actions">
              <button class="tracker-chip-btn" type="button" onclick="trackerOpenStatModal()">Dodaj wynik dnia</button>
            </div>
          </div>
          <div class="tracker-kpi-grid">
            ${trackerMetricCard('Przychod lacznie', trackerFmtPLN(summary.gross), 'blue', `${summary.storeCount} sklepow w zestawieniu`)}
            ${trackerMetricCard('Dochod lacznie', trackerFmtPLN(summary.income), summary.income >= 0 ? 'green' : 'red', 'Po kosztach i zwrotach')}
            ${trackerMetricCard('Na glowe', trackerFmtPLN(summary.perHead), 'violet', 'Wedlug modelu podzialu sklepow')}
            ${trackerMetricCard('Koszty reklam', trackerFmtPLN(summary.ads), 'orange', trackerFmtPct(summary.adPct))}
            ${trackerMetricCard('Zwroty', trackerFmtPLN(summary.refunds), 'rose', 'Miesieczny koszt zwrotow')}
          </div>
        </section>

        <section class="tracker-card tracker-card-chart tracker-card-span-2">
          <div class="tracker-card-header">
            <div>
              <div class="tracker-card-eyebrow">Trend dzienny</div>
              <h2>Przychod i dochod w czasie</h2>
            </div>
          </div>
          <div class="tracker-chart-wrap">
            <canvas id="tracker-global-chart" aria-label="Wykres przychodu i dochodu"></canvas>
          </div>
        </section>

        <section class="tracker-card">
          <div class="tracker-card-header">
            <div>
              <div class="tracker-card-eyebrow">Ranking sklepow</div>
              <h2>Najmocniejsze sklepy miesiaca</h2>
            </div>
          </div>
          <div class="tracker-ranking-list">
            ${ranking.length ? ranking.map((item, index)=>`
              <button class="tracker-ranking-item" type="button" onclick="trackerSelectStore('${escHtml(item.store.id)}')">
                <span class="tracker-ranking-index">${index + 1}</span>
                <span class="tracker-ranking-color" style="background:${item.store.color}"></span>
                <span class="tracker-ranking-body">
                  <strong>${escHtml(item.store.name)}</strong>
                  <small>${trackerFmtPLN(item.gross)} przychodu</small>
                </span>
                <span class="tracker-ranking-value ${item.income >= 0 ? 'is-positive' : 'is-negative'}">${trackerFmtCompactPLN(item.income)}</span>
              </button>`).join('') : `<div class="tracker-muted">Brak wpisow za wybrany miesiac.</div>`}
          </div>
        </section>

        <section class="tracker-card">
          <div class="tracker-card-header">
            <div>
              <div class="tracker-card-eyebrow">Sklepy miesiaca</div>
              <h2>Najlepszy i najgorszy wynik</h2>
            </div>
          </div>
          <div class="tracker-highlight-stack">
            <article class="tracker-highlight tracker-highlight-good">
              <span>Najlepszy sklep</span>
              <strong>${summary.bestStore ? escHtml(summary.bestStore.store.name) : '—'}</strong>
              <small>${summary.bestStore ? `${trackerFmtPLN(summary.bestStore.income)} dochodu` : 'Brak danych'}</small>
            </article>
            <article class="tracker-highlight tracker-highlight-bad">
              <span>Najslabszy sklep</span>
              <strong>${summary.worstStore ? escHtml(summary.worstStore.store.name) : '—'}</strong>
              <small>${summary.worstStore ? `${trackerFmtPLN(summary.worstStore.income)} dochodu` : 'Brak danych'}</small>
            </article>
          </div>
        </section>

        <section class="tracker-card tracker-card-span-3">
          <div class="tracker-card-header">
            <div>
              <div class="tracker-card-eyebrow">Dzienne sumy</div>
              <h2>Wszystkie sklepy razem dzien po dniu</h2>
            </div>
          </div>
          <div class="tracker-day-feed">
            ${daily.length ? daily.map(day=>`
              <button class="tracker-day-card" type="button" onclick="trackerSetMonth('${escHtml(day.date.slice(0,7))}')">
                <span class="tracker-day-card-top">${day.weekday} <strong>${trackerDateLabel(day.date)}</strong></span>
                <span class="tracker-day-card-main">${trackerFmtCompactPLN(day.gross)}</span>
                <span class="tracker-day-card-sub ${day.income >= 0 ? 'is-positive' : 'is-negative'}">${trackerFmtPLN(day.income)} dochodu</span>
              </button>`).join('') : `<div class="tracker-muted">Dodaj pierwszy wpis dnia, aby zobaczyc podsumowanie.</div>`}
          </div>
        </section>
      </div>`;
  }

  function trackerCellButton(storeId, date, display, tone, extraClass, title, hasData){
    return `
      <button
        class="tracker-cell-btn ${tone || ''} ${extraClass || ''}${hasData ? '' : ' is-empty'}"
        type="button"
        title="${escHtml(title || 'Edytuj dane dnia')}"
        onclick="trackerOpenStatModal('${escHtml(storeId)}','${escHtml(date)}')"
      >${display}</button>`;
  }

  function trackerMonthBlock(store, monthKey){
    const days = trackerDayList(monthKey);
    const summary = trackerStoreSummary(store, monthKey);
    const statsMap = new Map(summary.stats.map(stat=>[stat.date, stat]));

    const rows = [
      {
        label: 'Przychod brutto',
        total: trackerFmtPLN(summary.gross),
        render(date){
          const stat = statsMap.get(date);
          return trackerCellButton(store.id, date, stat ? trackerFmtPLN(stat.revenue_gross) : '＋', 'tone-blue', '', trackerFullDateLabel(date), !!stat);
        }
      },
      {
        label: 'Przychod netto',
        total: trackerFmtPLN(summary.net),
        render(date){
          const stat = statsMap.get(date);
          if(!stat) return trackerCellButton(store.id, date, '＋', 'tone-neutral', '', trackerFullDateLabel(date), false);
          const badge = stat.has_manual_net ? '<span class="tracker-mini-badge">R</span>' : '<span class="tracker-mini-badge auto">A</span>';
          return trackerCellButton(store.id, date, `${badge}${trackerFmtPLN(stat.revenue_net_resolved)}`, 'tone-neutral', 'tracker-cell-has-badge', trackerFullDateLabel(date), true);
        }
      },
      {
        label: 'Koszty TikTok',
        total: trackerFmtPLN(summary.ads),
        render(date){
          const stat = statsMap.get(date);
          return trackerCellButton(store.id, date, stat ? trackerFmtPLN(stat.ad_cost_tiktok) : '＋', 'tone-orange', '', trackerFullDateLabel(date), !!stat);
        }
      },
      {
        label: 'Dochod',
        total: trackerFmtPLN(summary.income),
        render(date){
          const stat = statsMap.get(date);
          const tone = stat ? (stat.income >= 0 ? 'tone-green' : 'tone-red') : 'tone-neutral';
          return trackerCellButton(store.id, date, stat ? trackerFmtPLN(stat.income) : '＋', tone, '', trackerFullDateLabel(date), !!stat);
        }
      },
      {
        label: 'Na glowe',
        total: trackerFmtPLN(summary.perHead),
        render(date){
          const stat = statsMap.get(date);
          const tone = stat ? (stat.per_head >= 0 ? 'tone-violet' : 'tone-red') : 'tone-neutral';
          return trackerCellButton(store.id, date, stat ? trackerFmtPLN(stat.per_head) : '＋', tone, '', trackerFullDateLabel(date), !!stat);
        }
      },
      {
        label: 'TikTok / przychod',
        total: trackerFmtPct(summary.adPct),
        render(date){
          const stat = statsMap.get(date);
          return trackerCellButton(store.id, date, stat ? trackerFmtPct(stat.ad_pct) : '＋', 'tone-neutral', '', trackerFullDateLabel(date), !!stat);
        }
      },
      {
        label: 'Zwroty',
        total: trackerFmtPLN(summary.refunds),
        render(date){
          const stat = statsMap.get(date);
          return trackerCellButton(store.id, date, stat ? trackerFmtPLN(stat.refunds) : '＋', 'tone-rose', '', trackerFullDateLabel(date), !!stat);
        }
      },
      {
        label: 'Dodatkowe koszty',
        total: trackerFmtPLN(summary.extra),
        render(date){
          const stat = statsMap.get(date);
          return trackerCellButton(store.id, date, stat ? trackerFmtPLN(stat.extra_costs) : '＋', 'tone-amber', '', trackerFullDateLabel(date), !!stat);
        }
      }
    ];

    return `
      <section class="tracker-store-block" style="--tracker-store-color:${store.color}">
        <div class="tracker-store-block-header">
          <div>
            <div class="tracker-store-name-line">
              <span class="tracker-store-dot"></span>
              <h3>${escHtml(store.name)}</h3>
              <span class="tracker-store-chip">${store.is_active ? 'aktywny' : 'nieaktywny'}</span>
            </div>
            <div class="tracker-store-meta">VAT ${store.vat_rate}% • ${SHARE_TYPE_LABELS[store.profit_share_type]} • ${CALCULATION_MODE_LABELS[store.calculation_mode]}</div>
          </div>
          <div class="tracker-store-block-actions">
            <div class="tracker-store-summary-metric">${trackerFmtCompactPLN(summary.gross)} przychodu</div>
            <div class="tracker-store-summary-metric ${summary.income >= 0 ? 'is-positive' : 'is-negative'}">${trackerFmtCompactPLN(summary.income)} dochodu</div>
            <button class="tracker-chip-btn" type="button" onclick="trackerOpenStatModal('${escHtml(store.id)}')">Dodaj dzien</button>
            <button class="tracker-chip-btn" type="button" onclick="trackerSelectStore('${escHtml(store.id)}')">Otworz sklep</button>
          </div>
        </div>
        <div class="tracker-table-wrap">
          <table class="tracker-month-table">
            <thead>
              <tr>
                <th class="sticky-col sticky-col-head">Metryka</th>
                ${days.map(date=>`<th><span>${trackerWeekdayShort(date)}</span><strong>${date.slice(-2)}</strong></th>`).join('')}
                <th class="summary-col">Suma</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(row=>`
                <tr>
                  <th class="sticky-col">${row.label}</th>
                  ${days.map(date=>`<td>${row.render(date)}</td>`).join('')}
                  <td class="summary-col">${row.total}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </section>`;
  }

  function trackerMonthlyHtml(data){
    const stores = trackerGetFilteredStores(false);
    if(!stores.length) return trackerEmptyStateHtml();

    return `
      <div class="tracker-month-layout">
        <section class="tracker-card tracker-card-inline">
          <div class="tracker-card-header">
            <div>
              <div class="tracker-card-eyebrow">Widok miesieczny</div>
              <h2>Uklad inspirowany Excelem, ale czytelny i szybszy</h2>
            </div>
            <div class="tracker-card-actions">
              <button class="tracker-chip-btn" type="button" onclick="trackerShiftMonth(-1)">←</button>
              <div class="tracker-inline-month">${trackerMonthLabel(data.ui.monthKey)}</div>
              <button class="tracker-chip-btn" type="button" onclick="trackerShiftMonth(1)">→</button>
            </div>
          </div>
          <div class="tracker-muted">Kliknij dowolna komorke, aby dodac albo zedytowac wynik dnia dla sklepu.</div>
        </section>
        ${stores.map(store=>trackerMonthBlock(store, data.ui.monthKey)).join('')}
      </div>`;
  }

  function trackerStoreDetailHtml(data){
    const store = trackerGetStore(data.ui.activeStoreId) || trackerGetFilteredStores(true)[0] || null;
    if(!store) return trackerEmptyStateHtml();

    const summary = trackerStoreSummary(store, data.ui.monthKey);
    const recent = summary.stats.slice().sort((a, b)=>b.date.localeCompare(a.date));

    return `
      <div class="tracker-store-view-grid">
        <section class="tracker-card tracker-card-span-2">
          <div class="tracker-card-header">
            <div>
              <div class="tracker-card-eyebrow">Widok sklepu</div>
              <h2>${escHtml(store.name)}</h2>
            </div>
            <div class="tracker-card-actions">
              <button class="tracker-chip-btn" type="button" onclick="trackerOpenStoreModal('${escHtml(store.id)}')">Edytuj sklep</button>
              <button class="tracker-chip-btn" type="button" onclick="trackerOpenStatModal('${escHtml(store.id)}')">Dodaj dzien</button>
            </div>
          </div>
          <div class="tracker-store-hero-grid">
            ${trackerMetricCard('Przychod', trackerFmtPLN(summary.gross), 'blue', `${summary.daysWithData} dni z danymi`)}
            ${trackerMetricCard('Dochod', trackerFmtPLN(summary.income), summary.income >= 0 ? 'green' : 'red', 'Po kosztach reklam i zwrotach')}
            ${trackerMetricCard('Na glowe', trackerFmtPLN(summary.perHead), 'violet', SHARE_TYPE_LABELS[store.profit_share_type])}
            ${trackerMetricCard('TikTok / przychod', trackerFmtPct(summary.adPct), 'orange', trackerFmtPLN(summary.ads))}
          </div>
        </section>

        <section class="tracker-card">
          <div class="tracker-card-header">
            <div>
              <div class="tracker-card-eyebrow">Ustawienia sklepu</div>
              <h2>Model liczenia</h2>
            </div>
          </div>
          <div class="tracker-setting-list">
            <div><span>Status</span><strong>${store.is_active ? 'Aktywny' : 'Nieaktywny'}</strong></div>
            <div><span>VAT</span><strong>${store.vat_rate}%</strong></div>
            <div><span>Netto</span><strong>${CALCULATION_MODE_LABELS[store.calculation_mode]}</strong></div>
            <div><span>Podzial</span><strong>${SHARE_TYPE_LABELS[store.profit_share_type]}</strong></div>
            <div><span>Wartosc podzialu</span><strong>${trackerFmtPLN(store.profit_share_value)}</strong></div>
            <div><span>Liczba osob</span><strong>${store.headcount}</strong></div>
          </div>
        </section>

        <section class="tracker-card tracker-card-chart tracker-card-span-2">
          <div class="tracker-card-header">
            <div>
              <div class="tracker-card-eyebrow">Wykres sklepu</div>
              <h2>Przychod, dochod i reklama</h2>
            </div>
          </div>
          <div class="tracker-chart-wrap">
            <canvas id="tracker-store-chart" aria-label="Wykres sklepu"></canvas>
          </div>
        </section>

        <section class="tracker-card tracker-card-span-2">
          <div class="tracker-card-header">
            <div>
              <div class="tracker-card-eyebrow">Historia dni</div>
              <h2>Wpisy za ${trackerMonthLabel(data.ui.monthKey)}</h2>
            </div>
          </div>
          <div class="tracker-history-wrap">
            <table class="tracker-history-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Brutto</th>
                  <th>Netto</th>
                  <th>TikTok</th>
                  <th>Dochod</th>
                  <th>Na glowe</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${recent.length ? recent.map(stat=>`
                  <tr>
                    <td>
                      <div class="tracker-history-date">
                        <strong>${trackerDateLabel(stat.date)}</strong>
                        <small>${trackerWeekdayShort(stat.date)}</small>
                      </div>
                    </td>
                    <td>${trackerFmtPLN(stat.revenue_gross)}</td>
                    <td>${trackerFmtPLN(stat.revenue_net_resolved)}</td>
                    <td>${trackerFmtPLN(stat.ad_cost_tiktok)}</td>
                    <td class="${stat.income >= 0 ? 'is-positive' : 'is-negative'}">${trackerFmtPLN(stat.income)}</td>
                    <td>${trackerFmtPLN(stat.per_head)}</td>
                    <td class="tracker-history-actions">
                      <button class="tracker-chip-btn" type="button" onclick="trackerOpenStatModal('${escHtml(store.id)}','${escHtml(stat.date)}')">Edytuj</button>
                      <button class="tracker-chip-btn danger" type="button" onclick="trackerOpenDeleteStat('${escHtml(stat.id)}')">Usun</button>
                    </td>
                  </tr>`).join('') : `<tr><td colspan="7" class="tracker-empty-row">Brak danych w tym miesiacu.</td></tr>`}
              </tbody>
            </table>
          </div>
        </section>
      </div>`;
  }

  function trackerManageHtml(data){
    const stores = trackerGetAllStores();
    if(!stores.length) return trackerEmptyStateHtml();

    return `
      <div class="tracker-manage-layout">
        <section class="tracker-card tracker-card-inline">
          <div class="tracker-card-header">
            <div>
              <div class="tracker-card-eyebrow">Zarzadzanie sklepami</div>
              <h2>Dynamiczna lista sklepow i ustawien</h2>
            </div>
            <div class="tracker-card-actions">
              <button class="tracker-btn tracker-btn-primary" type="button" onclick="trackerOpenStoreModal()">+ Dodaj sklep</button>
            </div>
          </div>
          <div class="tracker-muted">Tu ustawiasz liczenie netto, VAT, podzial zysku i aktywnosc sklepu bez grzebania w danych dziennych.</div>
        </section>
        <div class="tracker-manage-grid">
          ${stores.map(store=>{
            const summary = trackerStoreSummary(store, data.ui.monthKey);
            return `
              <article class="tracker-store-card" style="--tracker-store-color:${store.color}">
                <div class="tracker-store-card-top">
                  <div class="tracker-store-card-title">
                    <span class="tracker-store-dot"></span>
                    <strong>${escHtml(store.name)}</strong>
                  </div>
                  <span class="tracker-store-chip ${store.is_active ? '' : 'muted'}">${store.is_active ? 'aktywny' : 'nieaktywny'}</span>
                </div>
                <div class="tracker-store-card-metrics">
                  <div><span>Przychod</span><strong>${trackerFmtCompactPLN(summary.gross)}</strong></div>
                  <div><span>Dochod</span><strong class="${summary.income >= 0 ? 'is-positive' : 'is-negative'}">${trackerFmtCompactPLN(summary.income)}</strong></div>
                  <div><span>Na glowe</span><strong>${trackerFmtCompactPLN(summary.perHead)}</strong></div>
                  <div><span>VAT</span><strong>${store.vat_rate}%</strong></div>
                </div>
                <div class="tracker-store-card-meta">
                  <span>${CALCULATION_MODE_LABELS[store.calculation_mode]}</span>
                  <span>${SHARE_TYPE_LABELS[store.profit_share_type]}</span>
                </div>
                <div class="tracker-store-card-actions">
                  <button class="tracker-chip-btn" type="button" onclick="trackerSelectStore('${escHtml(store.id)}')">Otworz</button>
                  <button class="tracker-chip-btn" type="button" onclick="trackerOpenStoreModal('${escHtml(store.id)}')">Edytuj</button>
                  <button class="tracker-chip-btn" type="button" onclick="trackerToggleStoreActive('${escHtml(store.id)}')">${store.is_active ? 'Dezaktywuj' : 'Aktywuj'}</button>
                  <button class="tracker-chip-btn danger" type="button" onclick="trackerOpenDeleteStore('${escHtml(store.id)}')">Usun</button>
                </div>
              </article>`;
          }).join('')}
        </div>
      </div>`;
  }

  function trackerEmptyStateHtml(){
    return `
      <div class="tracker-empty-state">
        <div class="tracker-empty-orb"></div>
        <div class="tracker-empty-content">
          <span class="tracker-empty-kicker">Sklepy / Wyniki</span>
          <h2>Nowy profit tracker jest gotowy</h2>
          <p>Dodaj pierwszy sklep albo wczytaj demo, zeby zobaczyc dashboard, miesieczna tabele i pelne liczenie dochodu w jednej aplikacji.</p>
          <div class="tracker-empty-actions">
            <button class="tracker-btn tracker-btn-primary" type="button" onclick="trackerOpenStoreModal()">+ Dodaj pierwszy sklep</button>
            <button class="tracker-btn tracker-btn-ghost" type="button" onclick="trackerLoadDemoData()">Wczytaj demo</button>
          </div>
        </div>
      </div>`;
  }

  function trackerStoreModalHtml(store){
    return `
      <div class="tracker-modal-backdrop" onclick="trackerCloseModal()">
        <div class="tracker-modal" onclick="event.stopPropagation()">
          <div class="tracker-modal-header">
            <div>
              <span class="tracker-modal-kicker">Sklep</span>
              <h3>${store ? 'Edytuj sklep' : 'Dodaj nowy sklep'}</h3>
            </div>
            <button class="tracker-modal-close" type="button" onclick="trackerCloseModal()">✕</button>
          </div>
          <div class="tracker-modal-body">
            <input type="hidden" id="tracker-store-id" value="${escHtml(store?.id || '')}">
            <div class="tracker-form-grid two">
              <label class="tracker-field"><span>Nazwa sklepu</span><input id="tracker-store-name" type="text" value="${escHtml(store?.name || '')}" placeholder="np. FashionDrop"></label>
              <label class="tracker-field"><span>Kolor</span><input id="tracker-store-color" type="color" value="${escHtml(store?.color || '#4f7ef8')}"></label>
              <label class="tracker-field"><span>VAT (%)</span><input id="tracker-store-vat" type="number" min="0" max="99" step="1" value="${trackerNum(store?.vat_rate || 23)}"></label>
              <label class="tracker-field"><span>Liczba osob</span><input id="tracker-store-headcount" type="number" min="1" step="1" value="${Math.max(1, parseInt(store?.headcount || 1, 10))}"></label>
              <label class="tracker-field"><span>Sposob liczenia netto</span><select id="tracker-store-calc-mode"><option value="gross_to_net"${store?.calculation_mode === 'gross_to_net' || !store ? ' selected' : ''}>Automatycznie z brutto</option><option value="manual_net"${store?.calculation_mode === 'manual_net' ? ' selected' : ''}>Recznie wpisywane netto</option></select></label>
              <label class="tracker-field"><span>Model podzialu</span><select id="tracker-store-share-type"><option value="headcount"${store?.profit_share_type === 'headcount' || !store ? ' selected' : ''}>Dochod / headcount</option><option value="percentage"${store?.profit_share_type === 'percentage' ? ' selected' : ''}>Procent dochodu</option><option value="fixed"${store?.profit_share_type === 'fixed' ? ' selected' : ''}>Stala kwota</option></select></label>
              <label class="tracker-field"><span>Wartosc podzialu</span><input id="tracker-store-share-value" type="number" min="0" step="0.01" value="${trackerNum(store?.profit_share_value || 0)}"></label>
              <label class="tracker-field tracker-checkbox"><span>Aktywny sklep</span><input id="tracker-store-active" type="checkbox"${store?.is_active !== false ? ' checked' : ''}></label>
            </div>
          </div>
          <div class="tracker-modal-footer">
            <button class="tracker-btn tracker-btn-subtle" type="button" onclick="trackerCloseModal()">Anuluj</button>
            <button class="tracker-btn tracker-btn-primary" type="button" onclick="trackerSaveStoreForm()">Zapisz sklep</button>
          </div>
        </div>
      </div>`;
  }

  function trackerStatModalHtml(modal){
    const data = trackerData();
    const stat = modal.statId ? data.dailyStats.find(item=>item.id === modal.statId) : trackerGetStat(modal.storeId, modal.date);
    const storeId = stat?.store_id || modal.storeId || data.ui.activeStoreId || data.stores[0]?.id || '';
    const date = stat?.date || modal.date || trackerLocalDate(new Date());

    return `
      <div class="tracker-modal-backdrop" onclick="trackerCloseModal()">
        <div class="tracker-modal tracker-modal-wide" onclick="event.stopPropagation()">
          <div class="tracker-modal-header">
            <div>
              <span class="tracker-modal-kicker">Dane dzienne</span>
              <h3>${stat ? 'Edytuj wynik dnia' : 'Dodaj wynik dnia'}</h3>
            </div>
            <button class="tracker-modal-close" type="button" onclick="trackerCloseModal()">✕</button>
          </div>
          <div class="tracker-modal-body">
            <div class="tracker-form-grid two">
              <label class="tracker-field"><span>Sklep</span><select id="tracker-stat-store" onchange="trackerRefreshStatPreview()">${data.stores.map(store=>`<option value="${escHtml(store.id)}"${store.id === storeId ? ' selected' : ''}>${escHtml(store.name)}</option>`).join('')}</select></label>
              <label class="tracker-field"><span>Data</span><input id="tracker-stat-date" type="date" value="${escHtml(date)}" onchange="trackerRefreshStatPreview()"></label>
              <label class="tracker-field"><span>Przychod brutto</span><input id="tracker-stat-gross" type="number" min="0" step="0.01" value="${trackerNum(stat?.revenue_gross || 0)}" oninput="trackerRefreshStatPreview()"></label>
              <label class="tracker-field"><span>Przychod netto</span><input id="tracker-stat-net" type="number" min="0" step="0.01" value="${stat?.revenue_net === null || stat?.revenue_net === undefined ? '' : trackerNum(stat.revenue_net)}" placeholder="Zostaw puste, jesli ma liczyc sie samo" oninput="trackerRefreshStatPreview()"></label>
              <label class="tracker-field"><span>Koszty reklam TikTok</span><input id="tracker-stat-ads" type="number" min="0" step="0.01" value="${trackerNum(stat?.ad_cost_tiktok || 0)}" oninput="trackerRefreshStatPreview()"></label>
              <label class="tracker-field"><span>Zwroty</span><input id="tracker-stat-refunds" type="number" min="0" step="0.01" value="${trackerNum(stat?.refunds || 0)}" oninput="trackerRefreshStatPreview()"></label>
              <label class="tracker-field"><span>Dodatkowe koszty</span><input id="tracker-stat-extra" type="number" min="0" step="0.01" value="${trackerNum(stat?.extra_costs || 0)}" oninput="trackerRefreshStatPreview()"></label>
              <label class="tracker-field tracker-field-full"><span>Notatki</span><textarea id="tracker-stat-notes" rows="4" placeholder="np. problem z platnosciami, mocny dzien po kampanii, wieksze zwroty...">${escHtml(stat?.notes || '')}</textarea></label>
            </div>
            <div id="tracker-stat-preview" class="tracker-preview-box"></div>
          </div>
          <div class="tracker-modal-footer">
            <div class="tracker-modal-footer-left">${stat ? `<button class="tracker-btn tracker-btn-danger" type="button" onclick="trackerOpenDeleteStat('${escHtml(stat.id)}')">Usun wpis</button>` : ''}</div>
            <div class="tracker-modal-footer-right">
              <button class="tracker-btn tracker-btn-subtle" type="button" onclick="trackerCloseModal()">Anuluj</button>
              <button class="tracker-btn tracker-btn-primary" type="button" onclick="trackerSaveStatForm()">Zapisz dane</button>
            </div>
          </div>
        </div>
      </div>`;
  }

  function trackerConfirmModalHtml(title, body, actionLabel, actionFn, tone){
    return `
      <div class="tracker-modal-backdrop" onclick="trackerCloseModal()">
        <div class="tracker-modal tracker-modal-confirm" onclick="event.stopPropagation()">
          <div class="tracker-modal-header">
            <div>
              <span class="tracker-modal-kicker">Potwierdzenie</span>
              <h3>${title}</h3>
            </div>
            <button class="tracker-modal-close" type="button" onclick="trackerCloseModal()">✕</button>
          </div>
          <div class="tracker-modal-body"><p class="tracker-confirm-copy">${body}</p></div>
          <div class="tracker-modal-footer">
            <button class="tracker-btn tracker-btn-subtle" type="button" onclick="trackerCloseModal()">Anuluj</button>
            <button class="tracker-btn ${tone === 'danger' ? 'tracker-btn-danger' : 'tracker-btn-primary'}" type="button" onclick="${actionFn}">${actionLabel}</button>
          </div>
        </div>
      </div>`;
  }

  function trackerModalHtml(data){
    const modal = data.ui.modal;
    if(!modal) return '';
    if(modal.type === 'store') return trackerStoreModalHtml(modal.storeId ? trackerGetStore(modal.storeId) : null);
    if(modal.type === 'stat') return trackerStatModalHtml(modal);
    if(modal.type === 'confirm-delete-store'){
      const store = trackerGetStore(modal.storeId);
      return trackerConfirmModalHtml('Usunac sklep?', `Sklep ${store ? `"${store.name}"` : ''} zostanie usuniety razem ze wszystkimi danymi dziennymi.`, 'Usun sklep', 'trackerDeleteStoreConfirmed()', 'danger');
    }
    if(modal.type === 'confirm-delete-stat') return trackerConfirmModalHtml('Usunac wpis dnia?', 'Ta operacja usuwa caly zapis dzienny dla wybranego sklepu.', 'Usun wpis', 'trackerDeleteStatConfirmed()', 'danger');
    return '';
  }

  function trackerContentHtml(data){
    if(!data.stores.length) return trackerEmptyStateHtml();
    if(data.ui.view === 'month') return trackerMonthlyHtml(data);
    if(data.ui.view === 'store') return trackerStoreDetailHtml(data);
    if(data.ui.view === 'manage') return trackerManageHtml(data);
    return trackerDashboardHtml(data);
  }

  function trackerEnsureWindow(){
    const win = document.getElementById('win-shops');
    if(!win || win.dataset.trackerSized === '1') return;
    const width = Math.min(window.innerWidth - 40, 1380);
    const height = Math.min(window.innerHeight - 60, 900);
    win.style.width = `${Math.max(1080, width)}px`;
    win.style.height = `${Math.max(680, height)}px`;
    win.style.left = `${Math.max(18, Math.round((window.innerWidth - Math.max(1080, width)) / 2))}px`;
    win.style.top = '18px';
    win.dataset.trackerSized = '1';
    const title = win.querySelector('.win-title');
    if(title) title.textContent = 'Sklepy / Wyniki';
  }

  function trackerDestroyCharts(){
    Object.keys(trackerRuntime.charts).forEach(key=>{
      try{ trackerRuntime.charts[key].destroy(); }catch(e){}
    });
    trackerRuntime.charts = {};
  }

  function trackerChartOptions(){
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {labels: {color: '#c9d3ea', font: {family: 'DM Sans'}}},
        tooltip: {
          callbacks: {
            label(context){
              const label = context.dataset.label || '';
              return `${label}: ${trackerFmtPLN(context.parsed.y)}`;
            }
          }
        }
      },
      scales: {
        x: {ticks: {color: '#8ca0c7'}, grid: {display:false}},
        y: {
          ticks: {
            color: '#8ca0c7',
            callback(value){ return trackerFmtCompactPLN(value); }
          },
          grid: {color: 'rgba(140,160,199,.14)'}
        }
      }
    };
  }

  function trackerRenderCharts(){
    if(!window.Chart) return;
    trackerDestroyCharts();
    const data = trackerData();
    const filteredStores = trackerGetFilteredStores(false);
    const storeIds = filteredStores.map(store=>store.id);

    const globalCanvas = document.getElementById('tracker-global-chart');
    if(globalCanvas){
      const daily = trackerDailyTotals(data.ui.monthKey, storeIds);
      trackerRuntime.charts.global = new Chart(globalCanvas, {
        type: 'line',
        data: {
          labels: daily.map(item=>item.date.slice(-2)),
          datasets: [
            {label:'Przychod', data: daily.map(item=>Math.round(item.gross)), borderColor:'#5b8cff', backgroundColor:'rgba(91,140,255,.16)', fill:true, tension:0.3, pointRadius:2},
            {label:'Dochod', data: daily.map(item=>Math.round(item.income)), borderColor:'#22c55e', backgroundColor:'rgba(34,197,94,.08)', fill:true, tension:0.3, pointRadius:2},
            {label:'TikTok Ads', data: daily.map(item=>Math.round(item.ads)), borderColor:'#f97316', backgroundColor:'rgba(249,115,22,.08)', fill:false, tension:0.3, pointRadius:2}
          ]
        },
        options: trackerChartOptions()
      });
    }

    const storeCanvas = document.getElementById('tracker-store-chart');
    if(storeCanvas){
      const store = trackerGetStore(data.ui.activeStoreId) || filteredStores[0];
      if(store){
        const summary = trackerStoreSummary(store, data.ui.monthKey);
        trackerRuntime.charts.store = new Chart(storeCanvas, {
          type: 'bar',
          data: {
            labels: summary.stats.map(stat=>stat.date.slice(-2)),
            datasets: [
              {type:'line', label:'Przychod brutto', data: summary.stats.map(stat=>Math.round(stat.revenue_gross)), borderColor:store.color, backgroundColor:`${store.color}22`, tension:0.3, pointRadius:3, fill:false},
              {type:'bar', label:'Dochod', data: summary.stats.map(stat=>Math.round(stat.income)), backgroundColor:'rgba(34,197,94,.52)', borderRadius:10},
              {type:'bar', label:'TikTok Ads', data: summary.stats.map(stat=>Math.round(stat.ad_cost_tiktok)), backgroundColor:'rgba(249,115,22,.45)', borderRadius:10}
            ]
          },
          options: trackerChartOptions()
        });
      }
    }
  }

  function trackerInjectStyles(){
    if(document.getElementById(TRACKER_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = TRACKER_STYLE_ID;
    style.textContent = `
      #win-shops .shops-layout,#shops-body{height:100%;padding:0 !important;}
      .tracker-app{height:100%;display:flex;flex-direction:column;color:#eef3ff;background:radial-gradient(circle at top right, rgba(91,140,255,.18), transparent 32%),radial-gradient(circle at bottom left, rgba(20,184,166,.16), transparent 28%),linear-gradient(180deg, #0a1120 0%, #0b1325 38%, #09101f 100%);}
      .tracker-hero{display:flex;justify-content:space-between;gap:18px;padding:24px 26px 18px;border-bottom:1px solid rgba(123,147,190,.16);background:linear-gradient(180deg, rgba(18,28,50,.92), rgba(11,19,37,.72));}
      .tracker-eyebrow,.tracker-card-eyebrow,.tracker-modal-kicker{display:inline-flex;align-items:center;gap:8px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#8fa5cf;font-weight:700;}
      .tracker-hero h1,.tracker-card h2,.tracker-modal h3{margin:6px 0 0;font-size:28px;line-height:1.1;color:#f8fbff;}
      .tracker-card h2{font-size:20px;}.tracker-hero p{margin:12px 0 0;max-width:740px;font-size:14px;line-height:1.6;color:#98abd1;}.tracker-hero-actions{display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap;justify-content:flex-end;}
      .tracker-month-pill,.tracker-inline-month{padding:11px 16px;border-radius:14px;border:1px solid rgba(123,147,190,.18);background:rgba(17,27,47,.76);color:#f8fbff;font-weight:700;}
      .tracker-toolbar,.tracker-nav{display:flex;justify-content:space-between;gap:16px;padding:16px 26px 0;flex-wrap:wrap;}.tracker-nav{padding-bottom:16px;}.tracker-toolbar-group{display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;}.tracker-toolbar-actions{justify-content:flex-end;}
      .tracker-control{display:flex;flex-direction:column;gap:7px;min-width:220px;font-size:12px;color:#8fa5cf;font-weight:600;}
      .tracker-control input,.tracker-control select,.tracker-field input,.tracker-field select,.tracker-field textarea{width:100%;border:none;outline:none;border-radius:14px;background:#111b32;color:#f8fbff;padding:12px 14px;font:500 14px 'DM Sans', sans-serif;box-shadow:inset 0 0 0 1px rgba(123,147,190,.16);}
      .tracker-field input[type="color"]{min-height:48px;padding:6px;}.tracker-field textarea{resize:vertical;min-height:120px;}
      .tracker-btn,.tracker-chip-btn,.tracker-nav-btn{border:none;outline:none;cursor:pointer;font:600 13px 'DM Sans', sans-serif;transition:transform .16s ease, opacity .16s ease, background .16s ease;}
      .tracker-btn:hover,.tracker-chip-btn:hover,.tracker-nav-btn:hover{transform:translateY(-1px);}.tracker-btn{padding:12px 16px;border-radius:14px;}
      .tracker-btn-primary{background:linear-gradient(135deg, #5b8cff, #7a8dff);color:white;box-shadow:0 18px 36px rgba(91,140,255,.25);}
      .tracker-btn-ghost{background:rgba(255,255,255,.06);color:#eaf0ff;box-shadow:inset 0 0 0 1px rgba(123,147,190,.16);}
      .tracker-btn-subtle{background:#111b32;color:#c6d3ef;box-shadow:inset 0 0 0 1px rgba(123,147,190,.16);}
      .tracker-btn-danger{background:rgba(239,68,68,.14);color:#ffd7d7;box-shadow:inset 0 0 0 1px rgba(239,68,68,.25);}
      .tracker-nav-btn{padding:10px 14px;border-radius:999px;background:rgba(255,255,255,.04);color:#8fa5cf;box-shadow:inset 0 0 0 1px rgba(123,147,190,.14);}
      .tracker-nav-btn.active{background:rgba(91,140,255,.18);color:#f8fbff;box-shadow:inset 0 0 0 1px rgba(91,140,255,.22);}
      .tracker-content{flex:1;overflow:auto;padding:8px 26px 26px;}.tracker-dashboard-grid,.tracker-store-view-grid{display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:18px;}
      .tracker-manage-grid{display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:16px;}
      .tracker-card,.tracker-store-block,.tracker-store-card{border-radius:24px;border:1px solid rgba(123,147,190,.14);background:linear-gradient(180deg, rgba(14,22,39,.92), rgba(9,15,28,.86));box-shadow:0 18px 40px rgba(0,0,0,.26);}
      .tracker-card,.tracker-store-card{padding:18px;}.tracker-card-span-2{grid-column:span 2;}.tracker-card-span-3{grid-column:span 3;}
      .tracker-card-header,.tracker-modal-header{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;}.tracker-card-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
      .tracker-kpi-grid{display:grid;grid-template-columns:repeat(auto-fit, minmax(160px, 1fr));gap:12px;margin-top:18px;}
      .tracker-kpi{padding:18px;border-radius:20px;background:rgba(255,255,255,.03);box-shadow:inset 0 0 0 1px rgba(123,147,190,.14);}
      .tracker-kpi-label{display:block;font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:#8fa5cf;font-weight:700;}
      .tracker-kpi-value{display:block;margin-top:10px;font-size:28px;line-height:1.1;color:#f8fbff;}.tracker-kpi-sub{display:block;margin-top:8px;font-size:12px;color:#8fa5cf;}
      .tracker-tone-blue .tracker-kpi-value{color:#8bb2ff;}.tracker-tone-green .tracker-kpi-value{color:#72e8a0;}.tracker-tone-violet .tracker-kpi-value{color:#baa8ff;}.tracker-tone-orange .tracker-kpi-value{color:#ffb77d;}.tracker-tone-rose .tracker-kpi-value{color:#ff9ba8;}.tracker-tone-red .tracker-kpi-value{color:#ff8c8c;}
      .tracker-chart-wrap{position:relative;min-height:290px;margin-top:18px;}
      .tracker-ranking-list,.tracker-highlight-stack,.tracker-day-feed,.tracker-setting-list{margin-top:18px;display:flex;flex-direction:column;gap:10px;}
      .tracker-ranking-item,.tracker-day-card{display:flex;align-items:center;gap:12px;width:100%;padding:12px 14px;border:none;border-radius:18px;cursor:pointer;color:#edf3ff;background:#111b32;box-shadow:inset 0 0 0 1px rgba(123,147,190,.14);}
      .tracker-ranking-index{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.05);font-weight:700;}
      .tracker-ranking-color,.tracker-store-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;background:var(--tracker-store-color, #5b8cff);}
      .tracker-ranking-body{display:flex;flex-direction:column;gap:2px;text-align:left;}.tracker-ranking-body small,.tracker-muted,.tracker-store-meta,.tracker-store-card-meta{color:#8fa5cf;font-size:12px;}
      .tracker-ranking-value,.is-positive{color:#72e8a0;}.is-negative{color:#ff9ba8;}
      .tracker-highlight{padding:18px;border-radius:20px;display:flex;flex-direction:column;gap:6px;box-shadow:inset 0 0 0 1px rgba(123,147,190,.14);}
      .tracker-highlight-good{background:linear-gradient(180deg, rgba(34,197,94,.14), rgba(12,22,20,.86));}.tracker-highlight-bad{background:linear-gradient(180deg, rgba(239,68,68,.14), rgba(24,14,18,.86));}
      .tracker-day-feed{flex-direction:row;overflow:auto;padding-bottom:4px;}.tracker-day-card{min-width:200px;flex-direction:column;align-items:flex-start;}
      .tracker-day-card-top{font-size:12px;color:#8fa5cf;}.tracker-day-card-main{font-size:24px;font-weight:700;color:#f8fbff;}.tracker-day-card-sub{font-size:13px;}
      .tracker-month-layout{display:flex;flex-direction:column;gap:16px;}.tracker-store-block{overflow:hidden;}
      .tracker-store-block-header{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;padding:18px 18px 14px;border-bottom:1px solid rgba(123,147,190,.14);background:linear-gradient(180deg, rgba(255,255,255,.03), transparent);}
      .tracker-store-name-line{display:flex;align-items:center;gap:10px;}.tracker-store-name-line h3{margin:0;font-size:22px;}
      .tracker-store-chip{display:inline-flex;padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.06);color:#d4def4;font-size:11px;text-transform:uppercase;letter-spacing:.08em;font-weight:700;}.tracker-store-chip.muted{color:#9aa7c4;}
      .tracker-store-block-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;}.tracker-store-summary-metric{padding:9px 12px;border-radius:14px;background:rgba(255,255,255,.04);color:#eef3ff;font-size:12px;font-weight:700;}
      .tracker-table-wrap,.tracker-history-wrap{overflow:auto;}.tracker-month-table,.tracker-history-table{width:max-content;min-width:100%;border-collapse:separate;border-spacing:0;}
      .tracker-month-table th,.tracker-month-table td,.tracker-history-table th,.tracker-history-table td{padding:10px;border-bottom:1px solid rgba(123,147,190,.12);text-align:center;}
      .tracker-month-table thead th{position:sticky;top:0;z-index:3;background:#10192e;color:#9eb1d5;font-size:11px;letter-spacing:.08em;text-transform:uppercase;}
      .tracker-month-table thead th strong{display:block;margin-top:4px;font-size:15px;color:#f3f7ff;letter-spacing:normal;}
      .tracker-month-table .sticky-col{position:sticky;left:0;z-index:2;background:#10192e;text-align:left;min-width:170px;color:#eef3ff;}.tracker-month-table .sticky-col-head{z-index:4;}
      .tracker-month-table .summary-col{min-width:140px;font-weight:700;color:#eef3ff;background:#0e172b;}
      .tracker-cell-btn{width:100%;min-height:44px;padding:8px 10px;border:none;border-radius:14px;background:#111b32;color:#eef3ff;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;box-shadow:inset 0 0 0 1px rgba(123,147,190,.14);}
      .tracker-cell-btn.is-empty{color:#6f82a8;background:rgba(255,255,255,.02);}.tracker-cell-btn.tone-blue{color:#8bb2ff;}.tracker-cell-btn.tone-green{color:#72e8a0;}.tracker-cell-btn.tone-red{color:#ff9ba8;}.tracker-cell-btn.tone-violet{color:#baa8ff;}.tracker-cell-btn.tone-orange{color:#ffb77d;}.tracker-cell-btn.tone-rose{color:#ff9ba8;}.tracker-cell-btn.tone-amber{color:#ffd28a;}
      .tracker-mini-badge{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:999px;background:rgba(255,255,255,.08);color:#f3f7ff;font-size:10px;font-weight:800;}.tracker-mini-badge.auto{color:#8bb2ff;}
      .tracker-store-hero-grid{display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:12px;margin-top:18px;}
      .tracker-setting-list div,.tracker-store-card-metrics div{display:flex;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid rgba(123,147,190,.12);}.tracker-store-card-metrics{margin-top:16px;}
      .tracker-store-card-top,.tracker-store-card-title{display:flex;justify-content:space-between;gap:10px;align-items:center;}.tracker-store-card-title{justify-content:flex-start;}
      .tracker-store-card-meta{display:flex;flex-wrap:wrap;gap:8px 12px;margin-top:14px;}
      .tracker-store-card-actions,.tracker-history-actions,.tracker-modal-footer,.tracker-modal-footer-left,.tracker-modal-footer-right{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}.tracker-store-card-actions{margin-top:18px;}
      .tracker-chip-btn{padding:9px 12px;border-radius:12px;background:#111b32;color:#d7e2f8;box-shadow:inset 0 0 0 1px rgba(123,147,190,.16);}.tracker-chip-btn.danger{color:#ffd7d7;box-shadow:inset 0 0 0 1px rgba(239,68,68,.22);}
      .tracker-history-table{width:100%;}.tracker-history-table thead th{text-align:left;color:#8fa5cf;font-size:11px;letter-spacing:.08em;text-transform:uppercase;}.tracker-history-table tbody td{text-align:left;}
      .tracker-history-date{display:flex;flex-direction:column;gap:3px;}.tracker-empty-row{text-align:center !important;color:#8fa5cf;}
      .tracker-empty-state{position:relative;min-height:420px;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:28px;border:1px solid rgba(123,147,190,.12);background:linear-gradient(180deg, rgba(15,23,42,.96), rgba(9,15,28,.92));}
      .tracker-empty-orb{position:absolute;width:420px;height:420px;border-radius:50%;background:radial-gradient(circle, rgba(91,140,255,.28) 0%, rgba(91,140,255,0) 70%);filter:blur(20px);}
      .tracker-empty-content{position:relative;z-index:1;max-width:560px;text-align:center;padding:24px;}.tracker-empty-kicker{display:inline-flex;margin-bottom:12px;padding:8px 12px;border-radius:999px;background:rgba(255,255,255,.06);color:#c8d4ec;text-transform:uppercase;letter-spacing:.12em;font-size:11px;font-weight:700;}
      .tracker-empty-content h2{margin:0;font-size:36px;}.tracker-empty-content p{margin:14px 0 0;color:#96a9cf;line-height:1.7;}.tracker-empty-actions{display:flex;justify-content:center;gap:10px;margin-top:22px;flex-wrap:wrap;}
      .tracker-modal-backdrop{position:fixed;inset:0;z-index:99998;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(5,8,15,.56);backdrop-filter:blur(10px);}
      .tracker-modal{width:min(620px, 100%);border-radius:26px;border:1px solid rgba(123,147,190,.14);background:linear-gradient(180deg, #0f172a 0%, #0b1222 100%);box-shadow:0 30px 80px rgba(0,0,0,.45);color:#eef3ff;}
      .tracker-modal-wide{width:min(880px, 100%);}.tracker-modal-confirm{width:min(520px, 100%);}
      .tracker-modal-header,.tracker-modal-footer{padding:22px 22px 0;}.tracker-modal-body{padding:18px 22px 10px;}
      .tracker-modal-footer{justify-content:space-between;padding-bottom:22px;}.tracker-modal-close{border:none;width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.06);color:#eef3ff;cursor:pointer;}
      .tracker-form-grid{display:grid;grid-template-columns:1fr;gap:14px;}.tracker-form-grid.two{grid-template-columns:repeat(2, minmax(0, 1fr));}
      .tracker-field{display:flex;flex-direction:column;gap:7px;color:#8fa5cf;font-size:12px;font-weight:600;}.tracker-field-full{grid-column:1 / -1;}.tracker-checkbox{justify-content:flex-end;}.tracker-checkbox input{width:20px;height:20px;padding:0;}
      .tracker-preview-box{margin-top:16px;display:grid;grid-template-columns:repeat(auto-fit, minmax(160px, 1fr));gap:10px;}
      .tracker-preview-chip{padding:14px;border-radius:18px;background:#111b32;box-shadow:inset 0 0 0 1px rgba(123,147,190,.14);}
      .tracker-preview-label{display:block;margin-bottom:8px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#8fa5cf;}.tracker-confirm-copy{margin:0;color:#a6b6d6;line-height:1.7;}
      @media (max-width: 1180px){.tracker-dashboard-grid,.tracker-store-view-grid{grid-template-columns:1fr;}.tracker-card-span-2,.tracker-card-span-3{grid-column:auto;}}
      @media (max-width: 860px){.tracker-hero,.tracker-toolbar,.tracker-nav,.tracker-content{padding-left:16px;padding-right:16px;}.tracker-hero{padding-top:18px;}.tracker-hero h1{font-size:24px;}.tracker-form-grid.two{grid-template-columns:1fr;}.tracker-month-table .sticky-col,.tracker-month-table .summary-col{min-width:130px;}}
    `;
    document.head.appendChild(style);
  }

  function trackerRenderShops(){
    const root = document.getElementById('shops-body');
    if(!root) return;
    const data = trackerData();
    trackerEnsureWindow();
    if(Array.isArray(window.ALL_APPS)){
      const shopsApp = window.ALL_APPS.find(app=>app.id === 'shops');
      if(shopsApp){
        shopsApp.label = 'Sklepy / Wyniki';
        shopsApp.desc = 'Profit tracker sklepow';
      }
    }
    root.innerHTML = `<div class="tracker-app">${trackerToolbarHtml(data)}<div class="tracker-content">${trackerContentHtml(data)}</div>${trackerModalHtml(data)}</div>`;
    requestAnimationFrame(()=>{
      trackerStatPreview();
      trackerRenderCharts();
    });
  }

  function trackerFillWidget(body){
    const data = trackerData();
    const storeIds = trackerGetFilteredStores(false).map(store=>store.id);
    const summary = trackerGlobalSummary(data.ui.monthKey, storeIds);
    const top = summary.ranking.slice(0, 4);
    body.innerHTML = `
      <div class="wstat-grid">
        <div class="wstat-cell"><div class="wstat-val">${summary.storeCount}</div><div class="wstat-lbl">Sklepy</div></div>
        <div class="wstat-cell"><div class="wstat-val" style="color:var(--green)">${trackerFmtCompactPLN(summary.gross)}</div><div class="wstat-lbl">Przychod</div></div>
        <div class="wstat-cell"><div class="wstat-val" style="color:var(--accent)">${trackerFmtCompactPLN(summary.income)}</div><div class="wstat-lbl">Dochod</div></div>
        <div class="wstat-cell"><div class="wstat-val" style="color:var(--purple)">${trackerFmtCompactPLN(summary.ads)}</div><div class="wstat-lbl">Ads</div></div>
      </div>
      <div class="wstat-shops">${top.map(item=>`<div class="wstat-shop-row"><div class="wstat-dot" style="background:${item.store.color}"></div><span>${escHtml(item.store.name)}</span><span style="margin-left:auto;font-size:10px;color:var(--text3);font-family:'DM Mono',monospace">${trackerFmtCompactPLN(item.income)}</span></div>`).join('')}</div>`;
  }

  const baseApplyMigrations = window.applyMigrations;
  if(typeof baseApplyMigrations === 'function'){
    window.applyMigrations = function(){
      baseApplyMigrations();
      trackerEnsureData();
    };
  }

  window.trackerRenderShops = trackerRenderShops;
  window.renderShops = trackerRenderShops;
  window.trackerSetView = trackerSetView;
  window.trackerSetFilter = trackerSetFilter;
  window.trackerSetMonth = trackerSetMonth;
  window.trackerShiftMonth = trackerShiftMonth;
  window.trackerSelectStore = trackerSelectStore;
  window.trackerOpenStoreModal = trackerOpenStoreModal;
  window.trackerOpenStatModal = trackerOpenStatModal;
  window.trackerOpenDeleteStore = trackerOpenDeleteStore;
  window.trackerOpenDeleteStat = trackerOpenDeleteStat;
  window.trackerCloseModal = trackerCloseModal;
  window.trackerSaveStoreForm = trackerSaveStoreForm;
  window.trackerSaveStatForm = trackerSaveStatForm;
  window.trackerDeleteStoreConfirmed = trackerDeleteStoreConfirmed;
  window.trackerDeleteStatConfirmed = trackerDeleteStatConfirmed;
  window.trackerToggleStoreActive = trackerToggleStoreActive;
  window.trackerLoadDemoData = trackerLoadDemoData;
  window.trackerRefreshStatPreview = trackerStatPreview;
  window.fillShopStats = trackerFillWidget;

  trackerInjectStyles();
  trackerEnsureData();
  saveS();
  trackerRenderShops();
})();
