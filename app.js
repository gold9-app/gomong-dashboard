/* 고몽이 TCG 센터 관제 v2.1 - 읽기 전용. data/dashboard.json + data/history/index.json 만 읽는다.
   최신화: ntfy.sh 토픽에 "refresh <PIN>" POST → PC의 Aside 이벤트 루틴이 수집·push → 새 collectedAt 뜰 때까지 폴링 */
const CFG = { ntfyTopic: 'gomong-dash-lvxu3bje', pollMs: 10000, pollMaxMs: 300000 };
const $ = (s, el = document) => el.querySelector(s);
const view = $('#view');
let D = null, H = [], S = null, C = null, CH = [], tab = 'home', filters = { game: '전체', status: '전체' }, statDay = 'today', expand = {};
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
const stripHtml = (s) => String(s ?? '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');

const I = {
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M8 7h9v9"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7l10 10M17 8v9H8"/></svg>',
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
  sync: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
};
const gameBadge = (g) => g ? `<span class="badge g-${esc(g)}">${esc(g)}</span>` : '<span class="badge">미분류</span>';
const empty = (t, ic = I.inbox) => `<div class="empty">${ic}<span>${esc(t)}</span></div>`;

/* ---------- data ---------- */
async function fetchData(force) {
  const bust = force ? `?t=${Date.now()}` : '';
  const opt = { cache: force ? 'reload' : 'default' };
  const [d, h, s, c, ch] = await Promise.all([
    fetch(`./data/dashboard.json${bust}`, opt).then(r => r.json()),
    fetch(`./data/history/index.json${bust}`, opt).then(r => r.ok ? r.json() : []).catch(() => []),
    fetch(`./data/status.json${bust}`, opt).then(r => r.ok ? r.json() : null).catch(() => null),
    fetch(`./data/cafe.json${bust}`, opt).then(r => r.ok ? r.json() : null).catch(() => null),
    fetch(`./data/cafe_history.json${bust}`, opt).then(r => r.ok ? r.json() : []).catch(() => []),
  ]);
  return { d, h: Array.isArray(h) ? h : [], s, c, ch: Array.isArray(ch) ? ch : [] };
}
async function load(force) {
  const btn = $('#refreshBtn'); btn.classList.add('spin');
  if (!D) skeleton();
  try { const { d, h, s, c, ch } = await fetchData(force); D = d; H = h; S = s; C = c; CH = ch; localStorage.setItem('dash', JSON.stringify({ D, H })); }
  catch (e) {
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
function nextAutoRun() {
  const r = (D.routines || []).find(x => /관제 대시보드 갱신/.test(x.name) && x.nextRunAt);
  return r ? fmtIso(r.nextRunAt) : null;
}
function header() {
  const stale = (Date.now() - new Date(D.collectedAt)) / 3600e3 > 14;
  const nx = nextAutoRun();
  $('#updated').innerHTML = `<span class="live ${stale ? 'stale' : ''}"></span><span>${ago(D.collectedAt)} 수집${nx ? ` · 다음 자동 ${nx.d === md(todayStr()) ? '' : nx.d + ' '}${nx.t}` : ''}</span>`;
}
function render(animate) {
  if (!D) return;
  header();
  $('#cmtDot').hidden = !(D.summary?.unansweredComments > 0);
  const cafeDot = $('#cafeDot'); if (cafeDot) cafeDot.hidden = !(C && (C.alerts || []).some(a => a.level !== 'info'));
  document.querySelectorAll('.tabs button').forEach(b => b.dataset.tab === tab ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  view.classList.remove('enter');
  view.innerHTML = { home, queue, posts, comments, stats, cafe }[tab]();
  if (animate && !reduced) requestAnimationFrame(() => view.classList.add('enter'));
  if (animate) window.scrollTo(0, 0);
  bind();
  if (animate) tick();
}
const staleBanner = () => {
  // 상태 파일이 마지막 수집본보다 새겍고 실패를 기록했으면 그 원인을 우선 표시
  if (S && !S.loginOk && new Date(S.at) > new Date(D.collectedAt)) {
    const why = S.preflight === 'NAVER_LOGIN_REQUIRED' ? 'PC 바라우저의 네이버 로그인이 풀렸어요. PC에서 다시 로그인하면 다음 회차부터 정상 수집됩니다.' : 'PC의 Aside 바라우저 연결이 실패했어요 (재부팅 후 WSL2 포트 충돌 가능성). 바라우저를 재시작해 주세요.';
    return `<div class="banner danger">${I.alert}<span><b>수집 실패 (${esc(S.atText || '')})</b><br>${why} 아래는 ${esc(D.collectedAtText)} 수집본입니다.</span></div>`;
  }
  return (Date.now() - new Date(D.collectedAt)) / 3600e3 > 14 ? `<div class="banner warn">${I.warn}<span>마지막 수집이 ${ago(D.collectedAt)}입니다. PC가 꺼져 있거나 Aside가 멈춰 있을 수 있어요.</span></div>` : '';
};
const errBanner = () => D.errors?.length ? `<div class="banner danger">${I.alert}<span>수집 오류 ${D.errors.length}건: ${esc(D.errors.join(' / '))}</span></div>` : '';
const delta = (v, suffix = '') => v == null ? '' : `<span class="delta ${v > 0 ? 'up' : v < 0 ? 'down' : ''}">${v > 0 ? I.up : v < 0 ? I.down : ''}${v > 0 ? '+' : ''}${n(v)}${suffix}</span>`;

function tick() {
  view.querySelectorAll('[data-tick]').forEach(el => {
    const to = Number(el.dataset.tick); if (!isFinite(to)) return;
    if (reduced || to === 0) { el.textContent = n(to); return; }
    const t0 = performance.now(), dur = 600;
    const step = (t) => { const p = Math.min(1, (t - t0) / dur); const e = 1 - Math.pow(1 - p, 3); el.textContent = n(Math.round(to * e)); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}
function sparkline(vals, labels) {
  const w = 320, h = 64, pad = 4, max = Math.max(1, ...vals);
  const pts = vals.map((v, i) => [pad + (w - pad * 2) * i / Math.max(1, vals.length - 1), h - pad - (h - pad * 2) * v / max]);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const last = pts[pts.length - 1];
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><path class="area" d="${d} L${last[0].toFixed(1)} ${h} L${pts[0][0]} ${h} Z"/><path class="line" d="${d}"/><circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3.5"/></svg><div class="spark-labels"><span>${labels[0]}</span><span>${labels[labels.length - 1]}</span></div>`;
}
/* 목록 아이템: 메타 줄(시간/번호/배지) + 제목 전체 폭 + 보조 줄 */
function item({ href, time, no, game, badges = '', title, sub = '' }) {
  return `<a class="item" href="${href}" target="_blank" rel="noopener">
    <div class="meta">${time ? `<span class="time">${time}</span>` : ''}${no ? `<span class="no">#${no}</span>` : ''}${game === '' ? '' : gameBadge(game)}<span class="right">${badges}</span></div>
    <div class="title">${esc(title)}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</a>`;
}
/* 더보기: key별 접힘 */
function limited(key, arr, limit, renderItem) {
  const open = expand[key];
  const shown = open ? arr : arr.slice(0, limit);
  return shown.map(renderItem).join('') + (arr.length > limit ? `<button class="more" data-more="${key}">${open ? '접기' : `더보기 (${arr.length - limit}개)`}</button>` : '');
}

/* ---------- 홈 ---------- */
function home() {
  const s = D.summary, t = todayStr();
  const daily = (D.stats?.dailyCv || []).slice(0, 15).reverse();
  const yd = s.yesterdayCv, dbf = D.stats?.dailyCv?.[2]?.total;
  const prev = H.length >= 2 ? H[H.length - 2] : null;
  const citDelta = prev?.citations?.cumulative != null ? s.citations.cumulative - prev.citations.cumulative : null;
  const todayQ = D.queue.filter(q => q.postDateText.startsWith(t));
  const todayPub = D.posts.filter(p => p.status === '공개' && (p.publishedText || '').startsWith(t));
  const cards = [
    ...todayPub.map(p => ({ time: (p.publishedText || '').slice(11, 16) || '--:--', title: p.title, no: p.no, game: p.game, logNo: p.logNo, state: p.searchYn === false ? ['danger', I.alert, '검색 OFF'] : (p.v5 === false ? ['warn', I.warn, 'v5 대기'] : ['ok', I.check, '발행 완료']) })),
    ...todayQ.map(q => { const p = findPost(q.logNo) || {}; return { time: q.postDateText.slice(11, 16), title: q.title, no: p.no, game: p.game, logNo: q.logNo, state: ['info', I.clock, '예약'] }; }),
  ].sort((a, b) => a.time.localeCompare(b.time));
  const order = { danger: 0, warn: 1, info: 2 };
  const cafeAlerts = (C?.alerts || []).filter(a => a.level !== 'info').map(a => ({ ...a, cafe: true, type: 'cafe_' + a.type }));
  const alerts = [...(D.alerts || []), ...cafeAlerts].sort((a, b) => (order[a.level] ?? 3) - (order[b.level] ?? 3));
  const kind = { searchOff: '검색 노출 꺼짐', v5: 'v5 레이아웃 미적용', links: '관련 글·로드맵 링크 보강', price: '시세 갱신 도래', queue: '예약 큐 점검', comment: '미답변 댓글', archive: 'CSV 미등록 글', missing: 'CSV에만 있는 글', cafe_levelup: '카페 등업 신청 대기', cafe_question: '카페 미답변 질문', cafe_trade: '카페 거래 글 규칙 위반', cafe_greeting: '카페 새 가입인사' };
  const cafeIssues = (C?.pendingLevelUps || 0) + (C?.unansweredQuestions || []).length + (C?.ruleFlags || []).length;
  const cafePrev = CH.length >= 2 ? CH[CH.length - 2] : null;
  const cafeMDelta = cafePrev && cafePrev.members != null && C?.members != null ? C.members - cafePrev.members : null;
  const routines = (D.routines || []).slice().sort((a, b) => (a.nextRunAt || '').localeCompare(b.nextRunAt || ''));
  return `${staleBanner()}${errBanner()}
  <div class="bento">
    <section class="card primary span2">
      <div class="eyebrow"><span>오늘 조회수</span><span class="num">${md(t)} (${dow(t)})</span></div>
      <div class="big"><span data-tick="${s.todayCv ?? 0}">${n(s.todayCv)}</span><small>회</small></div>
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><span style="font-size:var(--t-sm);color:var(--muted)">어제 <b class="num" style="color:var(--text)">${n(yd)}</b></span>${yd != null && dbf != null ? delta(yd - dbf, ' vs 그제') : ''}</div>
      ${daily.length ? sparkline(daily.map(r => r.total), daily.map(r => md(r.date))) : ''}
    </section>
    <section class="card kpi"><div class="l">${I.spark}AI 인용 누적</div><div class="v" data-tick="${s.citations.cumulative ?? 0}">${n(s.citations.cumulative)}</div><div class="d">${citDelta != null ? delta(citDelta) : ''}<span>${s.citations.currentMonth}월 ${n(s.citations.month)}</span></div></section>
    <section class="card kpi ${s.unansweredComments ? 'alert' : ''}"><div class="l">${I.chat}미답변 댓글</div><div class="v" data-tick="${s.unansweredComments}">${n(s.unansweredComments)}</div><div class="d">전체 ${n(s.totalComments)}개</div></section>
    <section class="card kpi"><div class="l">${I.doc}공개 / 예약</div><div class="v"><span data-tick="${s.publicCount}">${n(s.publicCount)}</span><small> / ${n(s.queueCount)}</small></div><div class="d">누적 조회 ${n(s.totalReadCount)}</div></section>
    <section class="card kpi"><div class="l">${I.users}이웃</div><div class="v" data-tick="${s.buddyCount ?? 0}">${n(s.buddyCount)}</div><div class="d">${s.v5Pending ? `<span class="badge warn">v5 대기 ${s.v5Pending}</span>` : `<span class="badge ok">${I.check}레이아웃 정상</span>`}${s.searchOff ? `<span class="badge danger">검색 OFF ${s.searchOff}</span>` : ''}</div></section>
    ${C ? `<section class="card kpi cafe ${cafeIssues ? 'alert' : ''}" data-goto="cafe" role="link" tabindex="0"><div class="l">${I.users}카페 멤버 · 글</div><div class="v"><span data-tick="${C.members ?? 0}">${n(C.members)}</span><small> / ${n(C.articles)}</small></div><div class="d">${cafeMDelta != null ? delta(cafeMDelta) : ''}${C.pendingLevelUps ? `<span class="badge warn">등업 대기 ${C.pendingLevelUps}</span>` : ''}${(C.unansweredQuestions || []).length ? `<span class="badge danger">질문 ${C.unansweredQuestions.length}</span>` : ''}${(C.ruleFlags || []).length ? `<span class="badge danger">거래 경고 ${C.ruleFlags.length}</span>` : ''}${!cafeIssues ? `<span class="badge ok">${I.check}${esc(C.grade || '정상')}</span>` : ''}</div></section>` : ''}
  </div>

  <div class="h-sec"><h2>오늘 일정</h2><span class="meta">${cards.length}건</span></div>
  <section class="card"><div class="list">${cards.length ? cards.map(c => item({ href: postUrl(c.logNo), time: c.time, no: c.no, game: c.game, badges: `<span class="badge ${c.state[0]}">${c.state[1]}${c.state[2]}</span>`, title: c.title })).join('') : empty('오늘 예약·발행 글 없음')}</div></section>

  <div class="h-sec"><h2>할 일</h2><span class="meta">${alerts.length}건</span></div>
  <section class="card">${alerts.length ? alerts.map(a => { const p = a.logNo ? findPost(a.logNo) : null; const tag = a.logNo ? `a href="${postUrl(a.logNo)}" target="_blank" rel="noopener"` : (a.cafe && a.url) ? `a href="${esc(a.url)}" target="_blank" rel="noopener"` : 'div'; const body = p ? `<div>${p.no ? `<span class="badge">#${p.no}</span> ` : ''}${esc(p.title)}</div>${a.priceUpdate || a.type === 'price' ? `<div class="pt">${esc(a.text.split(': ').slice(1).join(': '))}</div>` : ''}` : esc(a.text); return `<${tag} class="todo ${a.level}"><span class="ic">${a.level === 'danger' ? I.alert : a.level === 'warn' ? I.warn : I.info}</span><div><div class="k">${esc(kind[a.type] || a.type)}</div>${body}</div></${a.logNo || (a.cafe && a.url) ? 'a' : 'div'}>`; }).join('') : `<div class="empty">${I.check}<span>처리할 항목 없음</span></div>`}</section>

  <div class="h-sec"><h2>자동 루틴</h2><span class="meta">${routines.length}개</span></div>
  <section class="card">${routines.length ? routines.map(r => { const w = r.nextRunAt ? fmtIso(r.nextRunAt) : null; return `<div class="rt"><span class="ic">${I.bot}</span><div><div class="n">${esc(r.name)}</div><div class="w">${r.rrule ? '반복' : r.kind === 'cron' ? '이벤트' : '1회'} · ${r.state === 'active' ? '활성' : esc(r.state)}</div></div>${w ? `<div class="when">다음<b>${w.d} ${w.t}</b></div>` : '<div class="when">앱 버튼<b>대기</b></div>'}</div>`; }).join('') : empty('루틴 정보 없음')}</section>`;
}

/* ---------- 예약 ---------- */
function queue() {
  const t = todayStr();
  const byDay = {};
  for (const q of D.queue) (byDay[q.postDateText.slice(0, 10)] ||= []).push(q);
  const days = Object.keys(byDay).sort();
  const games = D.games?.count || {}, target = D.games?.target || {};
  const total = Object.values(games).reduce((a, b) => a + b, 0) || 1;
  const colors = { '포켓몬': 'var(--red)', '리프트바운드': 'var(--violet)', '원피스': 'var(--info)', '용품·공통': 'var(--teal)', '미분류': 'var(--faint)' };
  return `${staleBanner()}
  <div class="h-sec"><h2>게임 비중</h2><span class="meta">전체 ${total}개</span></div>
  <section class="card">
    <div class="stack">${Object.entries(games).map(([g, c]) => `<span style="width:${c / total * 100}%;background:${colors[g] || colors['미분류']}"></span>`).join('')}</div>
    <div class="legend">${Object.entries(games).map(([g, c]) => `<div><i style="background:${colors[g] || colors['미분류']}"></i>${esc(g)} <b>${c}</b>개 · ${Math.round(c / total * 100)}%${target[g] != null ? ` <span style="color:var(--faint)">/ 목표 ${target[g]}%</span>` : ''}</div>`).join('')}</div>
  </section>
  <div class="h-sec"><h2>예약 큐</h2><span class="meta">${D.queue.length}건</span></div>
  ${days.length ? `<div class="tl">${days.map(d => `<div class="day ${d === t ? 'today' : ''}"><div class="dh"><b>${md(d)} (${dow(d)})${d === t ? ' 오늘' : ''}</b><span>${byDay[d].length}건${byDay[d].length > 3 ? ' · 초과' : ''}</span></div><section class="card"><div class="list">${byDay[d].map(q => { const p = findPost(q.logNo) || {}; return item({ href: postUrl(q.logNo), time: q.postDateText.slice(11, 16), no: p.no, game: p.game, badges: p.category ? `<span class="badge">${esc(p.category.replace(/^(포켓몬 카드|리프트바운드|원피스 카드) /, ''))}</span>` : '', title: q.title }); }).join('')}</div></section></div>`).join('')}</div>` : `<section class="card">${empty('예약된 글이 없습니다. 수요일 루틴이 채웁니다.')}</section>`}`;
}

/* ---------- 글 ---------- */
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
  <section class="card"><div class="list">${list.length ? limited('posts', list, 15, p => {
    const flags = [
      p.status === '예약' ? `<span class="badge info">${I.clock}예약</span>` : '',
      p.status === '공개' && p.searchYn === false ? '<span class="badge danger">검색 OFF</span>' : '',
      p.status === '공개' && p.v5 === false ? '<span class="badge warn">v5 미적용</span>' : '',
      p.relatedLinksPending ? '<span class="badge info">링크 보강</span>' : '',
      p.priceUpdate ? `<span class="badge ${p.priceUpdate.due <= todayStr() ? 'warn' : ''}">시세 ${md(p.priceUpdate.due)}</span>` : '',
      p.aiCited ? `<span class="badge ok">${I.spark}AI 인용</span>` : '',
    ].join('');
    const sub = p.status === '공개' ? `<span>${esc((p.publishedText || '').slice(5, 10).replace('-', '/'))}</span><span>조회 <b>${n(p.readCount)}</b></span><span>댓글 <b>${n(p.commentCount)}</b>${p.unanswered ? ` <b style="color:var(--danger)">미답변 ${p.unanswered}</b>` : ''}</span>${p.rank ? `<span>${esc(p.rank.keyword || '')} 통검 <b>${p.rank.searchRank ?? '-'}</b>위</span>` : ''}` : `<span>${esc(p.publishedText || '')} 예약</span>`;
    return item({ href: postUrl(p.logNo), no: p.no ?? '?', game: p.game, badges: flags, title: p.title, sub });
  }) : empty('조건에 맞는 글 없음')}</div></section>`;
}

/* ---------- 댓글 ---------- */
function comments() {
  const list = (D.comments || []).filter(c => !c.deleted);
  const un = list.filter(c => c.unanswered);
  const title = (logNo) => { const p = findPost(logNo); return p ? `#${p.no ?? '?'} ${p.title}` : logNo; };
  const cm = (c) => `<a class="item" href="${cmtUrl(c.logNo)}" target="_blank" rel="noopener">
      <div class="meta">${c.replyLevel > 1 ? '<span style="color:var(--faint)">↳</span>' : ''}<b style="color:${c.mine ? 'var(--muted)' : 'var(--text)'}">${esc(c.userName)}${c.mine ? ' (나)' : ''}</b><span class="num">${esc((c.regTime || '').slice(5, 16).replace('T', ' ').replace('-', '/'))}</span><span class="right">${c.unanswered ? '<span class="badge danger">미답변</span>' : ''}${c.secret ? '<span class="badge">비밀</span>' : ''}</span></div>
      <div class="body ${c.mine ? 'mine' : ''}">${esc(stripHtml(c.contents))}</div>
      <div class="ctx">${esc(title(c.logNo))}</div></a>`;
  return `${staleBanner()}
  <div class="h-sec"><h2>미답변</h2><span class="meta">${un.length}건 · 탭하면 네이버 댓글창</span></div>
  <section class="card"><div class="list">${un.length ? un.map(cm).join('') : `<div class="empty">${I.check}<span>미답변 댓글 없음</span></div>`}</div></section>
  <div class="h-sec"><h2>최근 댓글</h2><span class="meta">${list.length}건</span></div>
  <section class="card"><div class="list">${list.length ? limited('comments', list, 10, cm) : empty('댓글 없음')}</div></section>`;
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
  const hb = (key, rows, nameKey, valKey, pctKey, limit) => { const max = Math.max(1, ...rows.map(r => r[valKey] || 0)); return rows.length ? limited(key, rows, limit, r => `<div class="hbar"><div class="top"><div class="n">${esc(r[nameKey])}</div><div class="p"><b>${n(r[valKey])}</b>${pctKey && r[pctKey] != null ? ` · ${r[pctKey]}%` : ''}</div></div><div class="b"><span style="width:${(r[valKey] || 0) / max * 100}%"></span></div></div>`) : empty('데이터 없음'); };
  const c = D.summary.citations;
  return `${staleBanner()}
  <div class="h-sec"><h2>일별 조회수</h2><span class="meta">최근 15일</span></div>
  <section class="card">${daily.length ? barChart(daily, 'total', r => Number(r.date.slice(8, 10))) : empty('데이터 없음')}</section>

  <div class="h-sec"><h2>AI 브리핑 인용수</h2><span class="meta">${c.currentMonth}월 ${n(c.month)} · 선정기준 ${n(c.selectionPeriod)}</span></div>
  <section class="card">${cits.length >= 2 ? barChart(cits.slice(-15).reverse(), 'c', r => Number(r.date.slice(8, 10))) : `<div class="empty">${I.clock}<span>추세는 수집이 2일 이상 쌓이면 표시 (현재 ${cits.length}일 · 누적 ${n(c.cumulative)})</span></div>`}</section>

  <div class="h-sec"><h2>유입 · 검색어</h2><span class="seg" role="group"><button data-day="today" aria-pressed="${statDay === 'today'}">오늘</button><button data-day="yesterday" aria-pressed="${statDay === 'yesterday'}">어제</button></span></div>
  <section class="card"><h3>유입경로<small>${esc(day?.date || '')}</small></h3>${hb('ref', day?.referer || [], 'name', 'cv', 'pct', 6)}</section>
  <section class="card"><h3>검색 유입 키워드</h3>${hb('kw', (day?.searchQueries || []).slice(0, 30), 'query', 'cv', null, 8)}</section>
  <section class="card"><h3>글별 조회수 순위</h3>${(day?.rankCv || []).map(r => { const p = findPost(r.logNo); return `<a class="rank" href="${postUrl(r.logNo)}" target="_blank" rel="noopener"><span class="no">${r.rank}</span><span class="t">${p?.no ? `<span style="color:var(--faint)">#${p.no}</span> ` : ''}${esc(r.title)}</span><span class="val">${n(r.cv)}</span></a>`; }).join('') || empty('데이터 없음')}</section>

  <div class="h-sec"><h2>키워드 노출순위</h2><span class="meta">${latestDate ? latestDate + ' 기준' : '월요일 루틴 첫 기록 후 표시'}</span></div>
  <section class="card">${latest.length ? latest.sort((a, b) => (a.searchRank || 99) - (b.searchRank || 99)).map(r => { const pv = prevMap[r.keyword + '|' + r.logNo]; const d = pv?.searchRank && r.searchRank ? pv.searchRank - r.searchRank : null; const p = findPost(r.logNo); return `<div class="rank"><span class="t"><b>${esc(r.keyword)}</b><br><span style="color:var(--muted);font-size:var(--t-xs)">${p ? `#${p.no} · ` : ''}통검 ${r.searchRank ?? '-'}위 · 블로그탭 ${r.blogRank ?? '-'}위</span></span><span class="val ${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d == null ? '' : (d > 0 ? '▲' + d : d < 0 ? '▼' + (-d) : '-')}</span></div>`; }).join('') : empty('아직 기록 없음')}</section>

  <div class="h-sec"><h2>AI 브리핑 인용 확인 쿼리</h2><span class="meta">${(D.aiCited || []).length}건</span></div>
  <section class="card"><div class="list">${(D.aiCited || []).map(q => item({ href: postUrl(q.logNo), no: q.no, badges: `<span class="badge ok">${I.spark}${esc(q.type || '인용')}</span>`, title: q.query, sub: `<span>${esc(q.date)}</span>` })).join('') || empty('기록 없음')}</div></section>`;
}

/* ---------- 카페 (data/cafe.json + cafe_history.json, 2026-09-19) ---------- */
function cafe() {
  if (!C) return `${staleBanner()}<section class="card">${empty('카페 데이터가 아직 없어요. 다음 자동 수집(08/13/20시) 뒤 표시됩니다.', I.clock)}</section>`;
  const boardOf = (id) => (C.boards || []).find(b => b.menuId === id);
  const bBadge = (a) => `<span class="badge ${[28, 29, 30].includes(a.menuId) ? 'warn' : [26, 13, 27].includes(a.menuId) ? 'info' : a.isNotice ? 'primary' : ''}">${esc((a.menuName || '').replace(/\(.*\)$/, '').replace(/ 게시판$/, ''))}</span>`;
  const art = (a, extra = '') => item({ href: a.url, game: '', time: (a.writeDate || '').slice(5, 16).replace('-', '/'), badges: `${extra}${a.commentCount ? `<span class="badge">댓글 ${a.commentCount}</span>` : ''}`, title: a.title, sub: `<span>${bBadge(a)}</span><span>${esc(a.writer)}${a.writerLevel ? ` · ${esc(a.writerLevel)}` : ''}</span><span>조회 <b>${n(a.readCount)}</b></span>` });
  const hist = (CH || []).slice(-15);
  const prev = hist.length >= 2 ? hist[hist.length - 2] : null;
  const mDelta = prev && prev.members != null && C.members != null ? C.members - prev.members : null;
  const alerts = (C.alerts || []);
  const kind = { levelup: '등업 신청 대기', question: '미답변 질문', trade: '거래 글 규칙 위반', greeting: '새 가입인사' };
  const stale = (Date.now() - new Date(C.collectedAt)) / 3600e3 > 14;
  const boards = (C.boards || []).filter(b => b.menuId !== 23);
  return `${staleBanner()}${C.errors?.length ? `<div class="banner warn">${I.warn}<span>카페 수집 경고 ${C.errors.length}건: ${esc(C.errors.join(' / '))}</span></div>` : ''}
  <div class="h-sec"><h2>카페 현황</h2><span class="meta">${esc(C.collectedAtText || '')} 수집${stale ? ' · 오래됨' : ''}</span></div>
  <div class="kpi-row5">
    <section class="card kpi"><div class="l">${I.users}멤버</div><div class="v" data-tick="${C.members ?? 0}">${n(C.members)}</div><div class="d">${mDelta != null ? delta(mDelta) : ''}<span>${esc(C.grade || '')}</span></div></section>
    <section class="card kpi"><div class="l">${I.doc}글</div><div class="v" data-tick="${C.articles ?? 0}">${n(C.articles)}</div><div class="d">멤버 글 ${n(C.counts?.byMember)}</div></section>
    <section class="card kpi ${C.pendingLevelUps ? 'alert' : ''}"><div class="l">${I.check}등업 대기</div><div class="v" data-tick="${C.pendingLevelUps ?? 0}">${n(C.pendingLevelUps)}</div><div class="d">트레이너 승인</div></section>
    <section class="card kpi"><div class="l">${I.clock}오늘 출석</div><div class="v" data-tick="${C.todayAttendance ?? 0}">${n(C.todayAttendance)}</div><div class="d" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block">${esc(C.todayMission || '미션 없음')}</div></section>
    <section class="card kpi ${(C.unansweredQuestions || []).length ? 'alert' : ''}"><div class="l">${I.chat}미답변 질문</div><div class="v" data-tick="${(C.unansweredQuestions || []).length}">${n((C.unansweredQuestions || []).length)}</div><div class="d">질문 글 ${n(C.counts?.questions)}</div></section>
    <section class="card kpi ${(C.ruleFlags || []).length ? 'alert' : ''}"><div class="l">${I.alert}거래 경고</div><div class="v" data-tick="${(C.ruleFlags || []).length}">${n((C.ruleFlags || []).length)}</div><div class="d">거래 글 ${n(C.counts?.trades)}</div></section>
  </div>

  <div class="h-sec"><h2>할 일</h2><span class="meta">${alerts.length}건</span></div>
  <section class="card">${alerts.length ? alerts.map(a => `<a class="todo ${a.level}" href="${a.url}" target="_blank" rel="noopener"><span class="ic">${a.level === 'danger' ? I.alert : a.level === 'warn' ? I.warn : I.info}</span><div><div class="k">${esc(kind[a.type] || a.type)}</div><div>${esc(a.text)}</div></div></a>`).join('') : `<div class="empty">${I.check}<span>처리할 항목 없음</span></div>`}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><a class="badge primary" href="${esc(C.links?.levelUp || '')}" target="_blank" rel="noopener">등업 신청 관리</a><a class="badge" href="${esc(C.links?.manage || '')}" target="_blank" rel="noopener">카페 관리</a><a class="badge" href="${esc(C.links?.attendance || '')}" target="_blank" rel="noopener">출석체크</a><a class="badge" href="${esc(C.url || '')}" target="_blank" rel="noopener">카페 홈</a></div></section>

  <div class="h-sec"><h2>멤버 추이</h2><span class="meta">${hist.length ? `${md(hist[0].date)} ~ ${md(hist[hist.length - 1].date)}` : ''}</span></div>
  <section class="card">${hist.length >= 2 ? sparkline(hist.map(h => h.members || 0), hist.map(h => md(h.date))) : `<div class="empty">${I.clock}<span>추세는 수집이 2일 이상 쌓이면 표시 (현재 ${hist.length}일 · 멤버 ${n(C.members)})</span></div>`}</section>

  ${(C.unansweredQuestions || []).length ? `<div class="h-sec"><h2>미답변 질문</h2><span class="meta">${C.unansweredQuestions.length}건</span></div><section class="card"><div class="list">${C.unansweredQuestions.map(a => art(a, '<span class="badge danger">미답변</span>')).join('')}</div></section>` : ''}
  ${(C.ruleFlags || []).length ? `<div class="h-sec"><h2>거래 글 규칙 경고</h2><span class="meta">${C.ruleFlags.length}건</span></div><section class="card"><div class="list">${C.ruleFlags.map(f => item({ href: f.url, game: '', badges: '<span class="badge danger">규칙</span>', title: f.title, sub: `<span>${esc(f.menuName)}</span><span>${esc(f.writer)}</span><span style="color:var(--danger)">${esc(f.reason)}</span>` })).join('')}</div></section>` : ''}

  <div class="h-sec"><h2>거래 게시판</h2><span class="meta">최근 ${(C.tradePosts || []).length}건</span></div>
  <section class="card"><div class="list">${(C.tradePosts || []).length ? limited('cafeTrade', C.tradePosts, 5, a => art(a, a.prefix ? `<span class="badge">[${esc(a.prefix)}]</span>` : '')) : empty('거래 글 없음')}</div></section>

  <div class="h-sec"><h2>최근 글</h2><span class="meta">${(C.recentArticles || []).length}건</span></div>
  <section class="card"><div class="list">${(C.recentArticles || []).length ? limited('cafeRecent', C.recentArticles, 10, a => art(a, a.isNotice ? '<span class="badge primary">공지</span>' : '')) : empty('글 없음')}</div></section>

  <div class="h-sec"><h2>게시판별 글 수</h2><span class="meta">${boards.length}개</span></div>
  <section class="card"><div class="board-grid">${boards.map(b => `<div><span>${esc(b.name.replace(/\(.*\)$/, ''))}</span><b>${n(b.count)}</b></div>`).join('')}</div></section>`;
}

/* ---------- 최신화 (ntfy → Aside 이벤트 루틴) ---------- */
let refreshing = false;
function openSheet(html) { closeSheet(); document.body.insertAdjacentHTML('beforeend', `<div class="sheet-bg" data-close></div><div class="sheet" role="dialog" aria-modal="true">${html}</div>`); $('.sheet-bg').onclick = closeSheet; }
function closeSheet() { document.querySelectorAll('.sheet-bg,.sheet').forEach(e => e.remove()); }
function toast(msg, ms = 2600) { document.querySelectorAll('.toast').forEach(e => e.remove()); document.body.insertAdjacentHTML('beforeend', `<div class="toast">${esc(msg)}</div>`); setTimeout(() => document.querySelectorAll('.toast').forEach(e => e.remove()), ms); }
function refreshSheet() {
  if (refreshing) return;
  const nx = D ? nextAutoRun() : null;
  const pin = localStorage.getItem('refreshPin');
  openSheet(`<div class="grip"></div><h2>최신화</h2>
    <p>PC의 Aside에 "지금 수집" 신호를 보내요. PC가 켜져 있으면 보통 1~2분 안에 새 데이터가 반영됩니다.</p>
    <dl class="kv"><dt>마지막 수집</dt><dd>${D ? esc(D.collectedAtText) + ' (' + ago(D.collectedAt) + ')' : '-'}</dd><dt>다음 자동 수집</dt><dd>${nx ? nx.d + ' ' + nx.t : '-'}</dd></dl>
    ${pin ? '' : `<p>처음 한 번 PIN을 입력해요 (Aside가 알려준 6자리).</p><input id="pinInput" inputmode="numeric" maxlength="6" placeholder="······" autocomplete="off">`}
    <button class="btn primary" id="doRefresh">지금 수집 요청</button>
    <button class="btn ghost" id="doRefetch">신호 없이 다시 받기만</button>`);
  $('#doRefetch').onclick = async () => { closeSheet(); await load(true); toast(`다시 받았어요 · ${D.collectedAtText} 수집본`); };
  $('#doRefresh').onclick = async () => {
    let p = pin || ($('#pinInput')?.value || '').trim();
    if (!/^\d{6}$/.test(p)) { toast('PIN 6자리를 입력해 주세요'); return; }
    localStorage.setItem('refreshPin', p);
    await runRefresh(p);
  };
}
async function runRefresh(pin) {
  refreshing = true;
  const startedAt = D?.collectedAt;
  const steps = ['PC에 신호 보내기', 'Aside가 네이버 데이터 수집', 'GitHub Pages 반영', '앱에 새 데이터 표시'];
  const paint = (idx, fail) => openSheet(`<div class="grip"></div><h2>최신화 진행 중</h2><p>${fail ? esc(fail) : '창을 닫아도 계속 진행돼요. 완료되면 알려드릴게요.'}</p><ol class="steps">${steps.map((s, i) => `<li class="${fail && i === idx ? 'fail' : i < idx ? 'done' : i === idx ? 'doing' : ''}"><span class="st">${i < idx ? I.check : (fail && i === idx) ? I.x : i === idx ? I.sync : i + 1}</span>${s}</li>`).join('')}</ol>${fail ? '<button class="btn ghost" data-close-btn>닫기</button>' : '<button class="btn ghost" data-close-btn>백그라운드로</button>'}`);
  const wire = () => { const b = $('[data-close-btn]'); if (b) b.onclick = closeSheet; };
  paint(0); wire();
  $('#refreshBtn').classList.add('spin');
  try {
    const r = await fetch(`https://ntfy.sh/${CFG.ntfyTopic}`, { method: 'POST', body: `refresh ${pin}`, headers: { Title: 'gomong refresh', Tags: 'arrows_counterclockwise', Priority: 'high' } });
    if (!r.ok) throw new Error('ntfy ' + r.status);
  } catch (e) { paint(0, '신호를 못 보냈어요. 네트워크를 확인해 주세요. (' + e.message + ')'); wire(); refreshing = false; $('#refreshBtn').classList.remove('spin'); return; }
  paint(1); wire();
  const t0 = Date.now();
  let seenPages = false;
  while (Date.now() - t0 < CFG.pollMaxMs) {
    await new Promise(r => setTimeout(r, CFG.pollMs));
    try {
      const { d, h, s } = await fetchData(true);
      if (s && !s.loginOk && new Date(s.at).getTime() > t0 - 60000) {
        S = s; render(false);
        paint(1, s.preflight === 'NAVER_LOGIN_REQUIRED' ? 'PC의 네이버 로그인이 풀려 수집을 못 했어요. PC에서 다시 로그인해 주세요.' : 'PC 바라우저 연결이 실패했어요. 바라우저를 재시작해 주세요.'); wire(); refreshing = false; $('#refreshBtn').classList.remove('spin'); return;
      }
      if (d.collectedAt !== startedAt) {
        D = d; H = h; S = s; localStorage.setItem('dash', JSON.stringify({ D, H }));
        if (document.querySelector('.sheet')) { paint(3); wire(); await new Promise(r => setTimeout(r, 500)); }
        closeSheet(); render(true); refreshing = false; $('#refreshBtn').classList.remove('spin');
        toast(`최신화 완료 · ${D.collectedAtText} 수집`);
        return;
      }
      if (Date.now() - t0 > 45000 && !seenPages && document.querySelector('.sheet')) { seenPages = true; paint(2); wire(); }
    } catch {}
  }
  refreshing = false; $('#refreshBtn').classList.remove('spin');
  if (document.querySelector('.sheet')) { paint(seenPages ? 2 : 1, 'PC가 꺼져 있거나 Aside가 응답하지 않아요. 마지막 수집본을 그대로 보여드립니다.'); wire(); }
  else toast('최신화 실패: PC가 꺼져 있거나 Aside가 응답하지 않아요', 4000);
}

/* ---------- events ---------- */
function bind() {
  document.querySelectorAll('[data-goto]').forEach(el => { const go = () => { tab = el.dataset.goto; expand = {}; render(true); }; el.onclick = go; el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }; });
  view.querySelectorAll('.chip').forEach(b => b.onclick = () => { filters[b.dataset.f] = b.dataset.v; render(false); });
  view.querySelectorAll('[data-day]').forEach(b => b.onclick = () => { statDay = b.dataset.day; render(false); });
  view.querySelectorAll('[data-more]').forEach(b => b.onclick = () => { expand[b.dataset.more] = !expand[b.dataset.more]; render(false); });
}
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { if (tab !== b.dataset.tab) { tab = b.dataset.tab; expand = {}; render(true); } });
$('#refreshBtn').onclick = refreshSheet;
document.addEventListener('visibilitychange', () => { if (!document.hidden && D && !refreshing && Date.now() - new Date(D.collectedAt) > 20 * 60e3) load(true); });
setInterval(() => { if (D) header(); }, 60000);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then(reg => { reg.update().catch(() => {}); }).catch(() => {});
  // 새 버전 SW가 활성화되면(이미 구버전이 제어 중이던 경우에만) 즉시 새로고침 → 홈화면 앱도 첫 실행에서 최신 UI
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !refreshing) { toast('새 버전으로 업데이트 중'); setTimeout(() => location.reload(), 600); } hadController = true; });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) navigator.serviceWorker.getRegistration().then(r => r && r.update().catch(() => {})); });
}
load(false);
