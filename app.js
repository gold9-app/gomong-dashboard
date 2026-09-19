/* 고몽이 TCG 센터 관제 v2 - 읽기 전용. data/dashboard.json + data/history/index.json 만 읽는다. */
const $ = (s, el = document) => el.querySelector(s);
const view = $('#view');
let D = null, H = [], tab = 'home', filters = { game: '전체', status: '전체' }, statDay = 'today';
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- utils ---------- */
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const n = (v) => (v == null ? '-' : Number(v).toLocaleString('ko-KR'));
const ago = (iso) => { if (!iso) return ''; const m = Math.round((Date.now() - new Date(iso)) / 60000); if (m < 1) return '방금'; if (m < 60) return `${m}분 전`; const h = Math.floor(m / 60); if (h < 24) return `${h}시간 전`; return `${Math.floor(h / 24)}일 전`; };
const todayStr = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const md = (ymd) => `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}`;
const dow = (ymd) => '일월화수목금토'[new Date(ymd + 'T00:00:00+09:00').getDay()];
const fmtIso = (iso) => { const k = new Date(new Date(iso).getTime() + 9 * 3600e3).toISOString(); return { d: `${Number(k.slice(5, 7))}/${Number(k.slice(8, 10))}`, t: k.slice(11, 16) }; };
const postUrl = (logNo) => `https://blog.naver.com/gold_ggu/${logNo}`;
const cmtUrl = (logNo) => `https://m.blog.naver.com/PostView.naver?blogId=gold_ggu&logNo=${logNo}&modal=comment`;
const findPost = (logNo) => D.posts.find(p => p.logNo === String(logNo));

const I = {
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M8 7h9v9"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7l10 10M17 8v9H8"/></svg>',
  chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z"/></svg>',
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h6M9 17h6"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0 1 14 0M16 4.5a3.5 3.5 0 0 1 0 7M22 20a7 7 0 0 0-5-6.7"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2 21h20L12 3z"/><path d="M12 10v5M12 18h.01"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  bot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 14h.01M15 14h.01"/></svg>',
  inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 13h5l2 3h4l2-3h5"/><path d="M5 5h14l2 8v6H3v-6z"/></svg>',
};
const gameBadge = (g) => g ? `<span class="badge g-${esc(g)}">${esc(g)}</span>` : '<span class="badge">미분류</span>';
const empty = (t) => `<div class="empty">${I.inbox}<span>${esc(t)}</span></div>`;
const chevron = `<span class="chev">${I.chev}</span>`;

/* ---------- data ---------- */
async function load(force) {
  const btn = $('#refreshBtn'); btn.classList.add('spin');
  if (!D) skeleton();
  try {
    const bust = force ? `?t=${Date.now()}` : '';
    const [d, h] = await Promise.all([
      fetch(`./data/dashboard.json${bust}`, { cache: force ? 'reload' : 'default' }).then(r => r.json()),
      fetch(`./data/history/index.json${bust}`, { cache: force ? 'reload' : 'default' }).then(r => r.ok ? r.json() : []).catch(() => []),
    ]);
    D = d; H = Array.isArray(h) ? h : [];
    localStorage.setItem('dash', JSON.stringify({ D, H }));
  } catch (e) {
    const c = localStorage.getItem('dash');
    if (c && !D) ({ D, H } = JSON.parse(c));
    if (!D) { view.innerHTML = `<div class="banner danger">${I.alert}<span>데이터를 불러오지 못했어요. ${esc(e.message)}</span></div>`; btn.classList.remove('spin'); return; }
  }
  btn.classList.remove('spin');
  render(true);
}
function skeleton() {
  view.innerHTML = `<div class="bento"><div class="card primary span2"><div class="sk" style="height:14px;width:40%"></div><div class="sk" style="height:44px;width:60%;margin-top:10px"></div><div class="sk" style="height:64px;margin-top:14px"></div></div>${'<div class="card kpi"><div class="sk" style="height:12px;width:60%"></div><div class="sk" style="height:28px;width:50%;margin-top:10px"></div></div>'.repeat(4)}</div>`;
}

/* ---------- render ---------- */
function render(animate) {
  if (!D) return;
  const stale = (Date.now() - new Date(D.collectedAt)) / 3600e3 > 14;
  $('#updated').innerHTML = `<span class="live ${stale ? 'stale' : ''}"></span><span>${esc(D.collectedAtText || '')} 수집 · ${ago(D.collectedAt)}</span>`;
  $('#cmtDot').hidden = !(D.summary?.unansweredComments > 0);
  document.querySelectorAll('.tabs button').forEach(b => b.dataset.tab === tab ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  view.classList.remove('enter');
  view.innerHTML = { home, queue, posts, comments, stats }[tab]();
  if (animate && !reduced) requestAnimationFrame(() => view.classList.add('enter'));
  window.scrollTo(0, 0);
  bind();
  if (animate) tick();
}
const staleBanner = () => (Date.now() - new Date(D.collectedAt)) / 3600e3 > 14 ? `<div class="banner warn">${I.warn}<span>마지막 수집이 ${ago(D.collectedAt)}입니다. PC의 Aside 크론이 멈춰 있을 수 있어요.</span></div>` : '';
const errBanner = () => D.errors?.length ? `<div class="banner danger">${I.alert}<span>수집 오류 ${D.errors.length}건: ${esc(D.errors.join(' / '))}</span></div>` : '';
const delta = (v, suffix = '') => v == null ? '' : `<span class="delta ${v > 0 ? 'up' : v < 0 ? 'down' : ''}">${v > 0 ? I.up : v < 0 ? I.down : ''}${v > 0 ? '+' : ''}${n(v)}${suffix}</span>`;

/* number ticker: data-tick="1260" → 0에서 카운트업 (reduced motion이면 즉시) */
function tick() {
  view.querySelectorAll('[data-tick]').forEach(el => {
    const to = Number(el.dataset.tick); if (!isFinite(to)) return;
    if (reduced || to === 0) { el.textContent = n(to); return; }
    const t0 = performance.now(), dur = 600;
    const step = (t) => { const p = Math.min(1, (t - t0) / dur); const e = 1 - Math.pow(1 - p, 3); el.textContent = n(Math.round(to * e)); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}

/* sparkline */
function sparkline(vals, labels) {
  const w = 320, h = 64, pad = 4;
  const max = Math.max(1, ...vals), min = 0;
  const pts = vals.map((v, i) => [pad + (w - pad * 2) * i / Math.max(1, vals.length - 1), h - pad - (h - pad * 2) * (v - min) / (max - min)]);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const last = pts[pts.length - 1];
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><path class="area" d="${d} L${last[0].toFixed(1)} ${h} L${pts[0][0]} ${h} Z"/><path class="line" d="${d}"/><circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3.5"/></svg><div class="spark-labels"><span>${labels[0]}</span><span>${labels[labels.length - 1]}</span></div>`;
}

/* ---------- 홈 (Bento) ---------- */
function home() {
  const s = D.summary, t = todayStr();
  const daily = (D.stats?.dailyCv || []).slice(0, 15).reverse(); // 오래된 → 최신
  const yd = s.yesterdayCv, dbf = D.stats?.dailyCv?.[2]?.total;
  const prev = H.length >= 2 ? H[H.length - 2] : null;
  const citDelta = prev?.citations?.cumulative != null ? s.citations.cumulative - prev.citations.cumulative : null;
  // 오늘 일정
  const todayQ = D.queue.filter(q => q.postDateText.startsWith(t));
  const todayPub = D.posts.filter(p => p.status === '공개' && (p.publishedText || '').startsWith(t));
  const cards = [
    ...todayPub.map(p => ({ time: (p.publishedText || '').slice(11, 16) || '--:--', title: p.title, no: p.no, game: p.game, logNo: p.logNo, state: p.searchYn === false ? ['danger', '검색허용 OFF'] : (p.v5 === false ? ['warn', '발행됨 · v5 대기'] : ['ok', '발행 · 검색 · v5 완료']) })),
    ...todayQ.map(q => { const p = findPost(q.logNo) || {}; return { time: q.postDateText.slice(11, 16), title: q.title, no: p.no, game: p.game, logNo: q.logNo, state: ['info', '예약 대기'] }; }),
  ].sort((a, b) => a.time.localeCompare(b.time));
  const order = { danger: 0, warn: 1, info: 2 };
  const alerts = (D.alerts || []).slice().sort((a, b) => order[a.level] - order[b.level]);
  const kind = { searchOff: '검색 노출', v5: '레이아웃', links: '내부 링크', price: '시세 갱신', queue: '예약 큐', comment: '댓글', archive: '아카이브', missing: '정합성' };
  const routines = (D.routines || []).slice().sort((a, b) => (a.nextRunAt || '').localeCompare(b.nextRunAt || ''));

  return `${staleBanner()}${errBanner()}
  <div class="bento">
    <section class="card primary span2">
      <div class="eyebrow"><span>오늘 조회수</span><span class="num">${esc(md(t))} (${dow(t)})</span></div>
      <div class="big"><span data-tick="${s.todayCv ?? 0}">${n(s.todayCv)}</span><small>회</small></div>
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <span style="font-size:var(--t-sm);color:var(--muted)">어제 <b class="num" style="color:var(--text)">${n(yd)}</b></span>
        ${yd != null && dbf != null ? delta(yd - dbf, ' vs 그제') : ''}
      </div>
      ${daily.length ? sparkline(daily.map(r => r.total), daily.map(r => md(r.date))) : ''}
    </section>
    <section class="card kpi"><div class="l">${I.spark}AI 브리핑 인용 누적</div><div class="v" data-tick="${s.citations.cumulative ?? 0}">${n(s.citations.cumulative)}</div><div class="d">${citDelta != null ? delta(citDelta, ' 전 수집 대비') : `${s.citations.currentMonth}월 ${n(s.citations.month)}`}</div></section>
    <section class="card kpi ${s.unansweredComments ? 'alert' : ''}"><div class="l">${I.chat}미답변 댓글</div><div class="v" data-tick="${s.unansweredComments}">${n(s.unansweredComments)}</div><div class="d">전체 댓글 ${n(s.totalComments)}</div></section>
    <section class="card kpi"><div class="l">${I.doc}공개 / 예약</div><div class="v"><span data-tick="${s.publicCount}">${n(s.publicCount)}</span><small> / ${n(s.queueCount)}</small></div><div class="d">총 ${n(s.totalCount)}개 · 누적 조회 ${n(s.totalReadCount)}</div></section>
    <section class="card kpi"><div class="l">${I.users}이웃</div><div class="v" data-tick="${s.buddyCount ?? 0}">${n(s.buddyCount)}</div><div class="d">${s.v5Pending ? `<span class="badge warn">v5 대기 ${s.v5Pending}</span>` : '<span class="badge ok">레이아웃 정상</span>'}${s.searchOff ? `<span class="badge danger">검색 OFF ${s.searchOff}</span>` : ''}</div></section>
  </div>

  <div class="h-sec"><h2>오늘 발행 일정</h2><span class="meta">${cards.length}건</span></div>
  <section class="card"><div class="list">${cards.length ? cards.map(c => `
    <a class="row" href="${postUrl(c.logNo)}" target="_blank" rel="noopener">
      <div class="time">${c.time}</div>
      <div class="main"><div class="t">${c.no ? `<span style="color:var(--faint)">#${c.no}</span> ` : ''}${esc(c.title)}</div><div class="m">${gameBadge(c.game)}<span class="badge ${c.state[0]}">${c.state[0] === 'ok' ? I.check : c.state[0] === 'info' ? I.clock : I.warn}${c.state[1]}</span></div></div>${chevron}
    </a>`).join('') : empty('오늘 예약·발행 글 없음')}</div></section>

  <div class="h-sec"><h2>할 일</h2><span class="meta">${alerts.length}건</span></div>
  <section class="card">${alerts.length ? alerts.map(a => `<${a.logNo ? `a href="${postUrl(a.logNo)}" target="_blank" rel="noopener"` : 'div'} class="todo ${a.level}"><span class="ic">${a.level === 'danger' ? I.alert : a.level === 'warn' ? I.warn : I.info}</span><div><div class="k">${esc(kind[a.type] || a.type)}</div>${esc(a.text)}</div></${a.logNo ? 'a' : 'div'}>`).join('') : `<div class="empty">${I.check}<span>처리할 항목 없음</span></div>`}</section>

  <div class="h-sec"><h2>자동 루틴</h2><span class="meta">${routines.length}개</span></div>
  <section class="card">${routines.length ? routines.map(r => { const w = r.nextRunAt ? fmtIso(r.nextRunAt) : null; return `<div class="rt"><span class="ic">${I.bot}</span><div><div class="n">${esc(r.name)}</div><div class="w">${r.kind === 'cron' ? '반복' : '1회'} · ${r.state === 'active' ? '활성' : esc(r.state)}</div></div>${w ? `<div class="when">다음<b>${w.d} ${w.t}</b></div>` : ''}</div>`; }).join('') : empty('루틴 정보 없음')}</section>`;
}

/* ---------- 예약 (Timeline) ---------- */
function queue() {
  const t = todayStr();
  const byDay = {};
  for (const q of D.queue) (byDay[q.postDateText.slice(0, 10)] ||= []).push(q);
  const days = Object.keys(byDay).sort();
  const games = D.games?.count || {}, target = D.games?.target || {};
  const total = Object.values(games).reduce((a, b) => a + b, 0) || 1;
  const colors = { '포켓몬': 'var(--primary)', '리프트바운드': 'var(--violet)', '원피스': 'var(--info)', '용품·공통': 'var(--teal)', '미분류': 'var(--faint)' };
  return `${staleBanner()}
  <div class="h-sec"><h2>게임 비중</h2><span class="meta">전체 ${total}개 · 목표 40 / 25 / 15 / 20</span></div>
  <section class="card">
    <div class="stack">${Object.entries(games).map(([g, c]) => `<span style="width:${c / total * 100}%;background:${colors[g] || colors['미분류']}"></span>`).join('')}</div>
    <div class="legend">${Object.entries(games).map(([g, c]) => `<div><i style="background:${colors[g] || colors['미분류']}"></i>${esc(g)} <b>${c}</b>개 · ${Math.round(c / total * 100)}%${target[g] != null ? ` <span style="color:var(--faint)">/ ${target[g]}%</span>` : ''}</div>`).join('')}</div>
  </section>
  <div class="h-sec"><h2>예약 큐</h2><span class="meta">${D.queue.length}건</span></div>
  ${days.length ? `<div class="tl">${days.map(d => `<div class="day ${d === t ? 'today' : ''}"><div class="dh"><b>${md(d)} (${dow(d)})${d === t ? ' · 오늘' : ''}</b><span>${byDay[d].length}건${byDay[d].length > 3 ? ' · 초과' : ''}</span></div><section class="card"><div class="list">${byDay[d].map(q => { const p = findPost(q.logNo) || {}; return `
    <a class="row" href="${postUrl(q.logNo)}" target="_blank" rel="noopener"><div class="time">${q.postDateText.slice(11, 16)}</div><div class="main"><div class="t">${p.no ? `<span style="color:var(--faint)">#${p.no}</span> ` : ''}${esc(q.title)}</div><div class="m">${gameBadge(p.game)}<span>${esc(p.category || '')}</span></div></div>${chevron}</a>`; }).join('')}</div></section></div>`).join('')}</div>` : `<section class="card">${empty('예약된 글이 없습니다. 수요일 루틴이 채웁니다.')}</section>`}`;
}

/* ---------- 글 (Filter + List) ---------- */
function posts() {
  const gamesAll = ['전체', ...new Set(D.posts.map(p => p.game).filter(Boolean))];
  const statusAll = ['전체', '공개', '예약', '문제있음', 'AI인용'];
  let list = D.posts.slice().sort((a, b) => (b.no || 0) - (a.no || 0));
  if (filters.game !== '전체') list = list.filter(p => p.game === filters.game);
  if (filters.status === '공개' || filters.status === '예약') list = list.filter(p => p.status === filters.status);
  if (filters.status === '문제있음') list = list.filter(p => p.status === '공개' && (p.searchYn === false || p.v5 === false || p.relatedLinksPending || p.unanswered > 0 || (p.priceUpdate && p.priceUpdate.due <= todayStr())));
  if (filters.status === 'AI인용') list = list.filter(p => p.aiCited);
  const chip = (f, v) => `<button class="chip" aria-pressed="${filters[f] === v}" data-f="${f}" data-v="${esc(v)}">${esc(v)}</button>`;
  return `
  <div class="chips" role="group" aria-label="게임">${gamesAll.map(g => chip('game', g)).join('')}</div>
  <div class="chips" role="group" aria-label="상태">${statusAll.map(s => chip('status', s)).join('')}</div>
  <div class="h-sec"><h2>글 ${list.length}개</h2><span class="meta">조회수는 네이버 글 목록 기준</span></div>
  <section class="card"><div class="list">${list.map(p => `
    <a class="row" href="${postUrl(p.logNo)}" target="_blank" rel="noopener">
      <div class="no">#${p.no ?? '?'}</div>
      <div class="main"><div class="t">${esc(p.title)}</div>
        <div class="m">${gameBadge(p.game)}<span class="num">${esc((p.publishedText || '').slice(5, 16).replace('-', '/').replace(' 발행', ''))}</span>
          ${p.status === '예약' ? `<span class="badge info">${I.clock}예약</span>` : `<span>조회 <b class="num">${n(p.readCount)}</b></span><span>댓글 <b class="num">${n(p.commentCount)}</b>${p.unanswered ? ` <b style="color:var(--danger)">(${p.unanswered} 미답변)</b>` : ''}</span>`}
          ${p.status === '공개' && p.searchYn === false ? '<span class="badge danger">검색 OFF</span>' : ''}
          ${p.status === '공개' && p.v5 === false ? '<span class="badge warn">v5 미적용</span>' : ''}
          ${p.relatedLinksPending ? '<span class="badge info">링크 보강</span>' : ''}
          ${p.priceUpdate ? `<span class="badge ${p.priceUpdate.due <= todayStr() ? 'warn' : ''}">시세 ${md(p.priceUpdate.due)}</span>` : ''}
          ${p.aiCited ? `<span class="badge ok">${I.spark}AI 인용</span>` : ''}
          ${p.rank ? `<span class="badge">${esc(p.rank.keyword || '')} ${p.rank.searchRank ? '통검 ' + p.rank.searchRank + '위' : ''}${p.rank.blogRank ? ' 블탭 ' + p.rank.blogRank + '위' : ''}</span>` : ''}
        </div></div>${chevron}
    </a>`).join('') || empty('조건에 맞는 글 없음')}</div></section>`;
}

/* ---------- 댓글 ---------- */
function comments() {
  const list = (D.comments || []).filter(c => !c.deleted);
  const un = list.filter(c => c.unanswered);
  const title = (logNo) => { const p = findPost(logNo); return p ? `#${p.no ?? '?'} ${p.title}` : logNo; };
  const item = (c) => `<a class="row" href="${cmtUrl(c.logNo)}" target="_blank" rel="noopener">
      <div class="main"><div class="t" style="font-weight:${c.mine ? 400 : 600};color:${c.mine ? 'var(--muted)' : 'inherit'}">${c.replyLevel > 1 ? '<span style="color:var(--faint)">↳</span> ' : ''}${esc(c.userName)}${c.mine ? ' (나)' : ''} <span style="font-weight:400">${esc(c.contents)}</span>${c.secret ? ' <span class="badge">비밀</span>' : ''}</div>
      <div class="m"><span class="num">${esc((c.regTime || '').slice(5, 16).replace('T', ' ').replace('-', '/'))}</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:56vw">${esc(title(c.logNo))}</span>${c.unanswered ? '<span class="badge danger">미답변</span>' : ''}</div></div>${chevron}</a>`;
  return `${staleBanner()}
  <div class="h-sec"><h2>미답변</h2><span class="meta">${un.length}건 · 탭하면 네이버 댓글창</span></div>
  <section class="card"><div class="list">${un.length ? un.map(item).join('') : `<div class="empty">${I.check}<span>미답변 댓글 없음</span></div>`}</div></section>
  <div class="h-sec"><h2>최근 댓글</h2><span class="meta">${list.length}건</span></div>
  <section class="card"><div class="list">${list.length ? list.map(item).join('') : empty('댓글 없음')}</div></section>`;
}

/* ---------- 성과 ---------- */
function barChart(rows, key, label) {
  const w = 340, h = 150, padL = 4, padB = 20, padT = 18;
  const data = rows.slice().reverse();
  const max = Math.max(1, ...data.map(r => r[key] || 0));
  const bw = (w - padL * 2) / data.length;
  const grid = [0.5, 1].map(f => { const y = h - padB - (h - padB - padT) * f; return `<line x1="0" x2="${w}" y1="${y}" y2="${y}"/>`; }).join('');
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">${grid}${data.map((r, i) => { const v = r[key] || 0; const bh = Math.max(v ? 2 : 0, (h - padB - padT) * v / max); const x = padL + i * bw + 2; const y = h - padB - bh; const hi = i === data.length - 1 || v === max; return `<rect x="${x}" y="${y}" width="${bw - 4}" height="${bh}" rx="3" class="${hi ? 'hi' : ''}"></rect>${hi && v ? `<text class="v" x="${x + (bw - 4) / 2}" y="${y - 4}" text-anchor="middle">${n(v)}</text>` : ''}<text x="${x + (bw - 4) / 2}" y="${h - 6}" text-anchor="middle">${label(r)}</text>`; }).join('')}</svg>`;
}
function stats() {
  const st = D.stats || {}, day = statDay === 'today' ? st.today : st.yesterday;
  const daily = (st.dailyCv || []).slice(0, 15);
  const cits = H.filter(x => x.citations?.cumulative != null).map(x => ({ date: x.date, c: x.citations.cumulative }));
  const rank = D.rankHistory || [];
  const latestDate = rank.reduce((m, r) => r.date > m ? r.date : m, '');
  const latest = rank.filter(r => r.date === latestDate);
  const prevDate = rank.filter(r => r.date < latestDate).reduce((m, r) => r.date > m ? r.date : m, '');
  const prevMap = Object.fromEntries(rank.filter(r => r.date === prevDate).map(r => [r.keyword + '|' + r.logNo, r]));
  const hb = (rows, nameKey, valKey, pctKey) => { const max = Math.max(1, ...rows.map(r => r[valKey] || 0)); return rows.map(r => `<div class="hbar"><div class="n">${esc(r[nameKey])}</div><div class="b"><span style="width:${(r[valKey] || 0) / max * 100}%"></span></div><div class="p">${n(r[valKey])}${pctKey && r[pctKey] != null ? ` · ${r[pctKey]}%` : ''}</div></div>`).join('') || empty('데이터 없음'); };
  const c = D.summary.citations;
  return `${staleBanner()}
  <div class="h-sec"><h2>일별 조회수</h2><span class="meta">최근 15일</span></div>
  <section class="card">${daily.length ? barChart(daily, 'total', r => Number(r.date.slice(8, 10))) : empty('데이터 없음')}</section>

  <div class="h-sec"><h2>AI 브리핑 인용수</h2><span class="meta">${c.currentMonth}월 ${n(c.month)} · 선정 기준(${c.selectionPeriodMonth}월) ${n(c.selectionPeriod)}</span></div>
  <section class="card">${cits.length >= 2 ? barChart(cits.slice(-15).reverse(), 'c', r => Number(r.date.slice(8, 10))) : `<div class="empty">${I.clock}<span>추세는 수집이 2일 이상 쌓이면 표시됩니다 (현재 ${cits.length}일, 누적 ${n(c.cumulative)})</span></div>`}</section>

  <div class="h-sec"><h2>유입 · 검색어</h2><span class="seg" role="group"><button data-day="today" aria-pressed="${statDay === 'today'}">오늘</button><button data-day="yesterday" aria-pressed="${statDay === 'yesterday'}">어제</button></span></div>
  <section class="card"><h3>유입경로<small>${esc(day?.date || '')}</small></h3>${hb(day?.referer || [], 'name', 'cv', 'pct')}</section>
  <section class="card"><h3>검색 유입 키워드<small>상위 20</small></h3>${hb((day?.searchQueries || []).slice(0, 20), 'query', 'cv', null)}</section>
  <section class="card"><h3>글별 조회수 순위</h3><div class="list">${(day?.rankCv || []).map(r => { const p = findPost(r.logNo); return `<a class="row" href="${postUrl(r.logNo)}" target="_blank" rel="noopener"><div class="no">${r.rank}</div><div class="main"><div class="t" style="font-weight:500">${p?.no ? `<span style="color:var(--faint)">#${p.no}</span> ` : ''}${esc(r.title)}</div></div><div class="val">${n(r.cv)}</div></a>`; }).join('') || empty('데이터 없음')}</div></section>

  <div class="h-sec"><h2>키워드 노출순위</h2><span class="meta">${latestDate ? latestDate + ' 기준' : '월요일 루틴 첫 기록 후 표시'}</span></div>
  <section class="card"><div class="list">${latest.length ? latest.sort((a, b) => (a.searchRank || 99) - (b.searchRank || 99)).map(r => { const pv = prevMap[r.keyword + '|' + r.logNo]; const d = pv?.searchRank && r.searchRank ? pv.searchRank - r.searchRank : null; const p = findPost(r.logNo); return `<div class="row"><div class="main"><div class="t">${esc(r.keyword)}</div><div class="m">${p ? `#${p.no}` : ''} 통검 ${r.searchRank ?? '-'}위 · 블로그탭 ${r.blogRank ?? '-'}위</div></div><div class="val ${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d == null ? '' : (d > 0 ? '▲' + d : d < 0 ? '▼' + (-d) : '-')}</div></div>`; }).join('') : empty('아직 기록 없음')}</div></section>

  <div class="h-sec"><h2>AI 브리핑 인용 확인 쿼리</h2><span class="meta">${(D.aiCited || []).length}건</span></div>
  <section class="card"><div class="list">${(D.aiCited || []).map(q => `<a class="row" href="${postUrl(q.logNo)}" target="_blank" rel="noopener"><div class="main"><div class="t">${esc(q.query)}</div><div class="m"><span>#${q.no}</span><span>${esc(q.type || '')}</span><span class="num">${esc(q.date)}</span></div></div>${chevron}</a>`).join('') || empty('기록 없음')}</div></section>`;
}

/* ---------- events ---------- */
function bind() {
  view.querySelectorAll('.chip').forEach(b => b.onclick = () => { filters[b.dataset.f] = b.dataset.v; render(false); });
  view.querySelectorAll('[data-day]').forEach(b => b.onclick = () => { statDay = b.dataset.day; render(false); });
}
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { if (tab !== b.dataset.tab) { tab = b.dataset.tab; render(true); } });
$('#refreshBtn').onclick = () => load(true);
document.addEventListener('visibilitychange', () => { if (!document.hidden && D && Date.now() - new Date(D.collectedAt) > 20 * 60e3) load(true); });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
load(false);
