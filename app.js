/* 고몽이 TCG 센터 관제 v3.1 - 읽기 전용 + Aside 작업 보내기(ntfy). data/dashboard.json + data/history/index.json 만 읽는다.
   최신화: ntfy.sh 토픽에 "refresh <PIN>" POST → PC의 Aside 이벤트 루틴이 수집·push → 새 collectedAt 뜰 때까지 폴링 */
const CFG = { ntfyTopic: 'gomong-dash-lvxu3bje', resultTopic: 'gomong-dash-lvxu3bje-r', alertTopic: 'gomong-dash-lvxu3bje-alert', taskSlots: ['12:30', '15:30', '18:30', '21:30'], collectSlots: ['08:00', '13:00'], pollMs: 10000, pollMaxMs: 300000, taskPollMs: 8000 };
/* v4 (2026-10-14): 작업 요청은 하루 4번 모아서 처리. 다음 처리 시각 */
const nextSlot = (slots) => { const hm = new Date(Date.now() + 9 * 3600e3).toISOString().slice(11, 16); const s = slots.find(x => x > hm); return s ? `오늘 ${s}` : `내일 ${slots[0]}`; };
const nextTaskSlot = () => nextSlot((typeof D !== 'undefined' && D && D.taskSlots) || CFG.taskSlots);
/* 버튼에 붙일 요청 문구 저장소 (data-req=인덱스) */
let REQ = [];
const reqIdx = (text) => { REQ.push(text); return REQ.length - 1; };
const $ = (s, el = document) => el.querySelector(s);
const view = $('#view');
let D = null, H = [], S = null, C = null, CH = [], T = [], TL = [], tab = 'home', filters = { game: '전체', status: '전체' }, statDay = 'today', expand = {}, perfView = 'top';
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- utils ---------- */
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const n = (v) => (v == null ? '-' : Number(v).toLocaleString('ko-KR'));
const ago = (iso) => { if (!iso) return ''; const m = Math.round((Date.now() - new Date(iso)) / 60000); if (m < 1) return '방금'; if (m < 60) return `${m}분 전`; const h = Math.floor(m / 60); if (h < 24) return `${h}시간 전`; return `${Math.floor(h / 24)}일 전`; };
const todayStr = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const md = (ymd) => `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}`;
const dow = (ymd) => '일월화수목금토'[new Date(ymd + 'T00:00:00+09:00').getDay()];
const fmtIso = (iso) => { const k = new Date(new Date(iso).getTime() + 9 * 3600e3).toISOString(); return { d: `${Number(k.slice(5, 7))}/${Number(k.slice(8, 10))}`, t: k.slice(11, 16) }; };
const postUrl = (logNo) => `https://blog.naver.com/rmarn99/${logNo}`;
const cmtUrl = (logNo) => `https://m.blog.naver.com/PostView.naver?blogId=rmarn99&logNo=${logNo}&modal=comment`;
const findPost = (logNo) => D.posts.find(p => p.logNo === String(logNo));
const stripHtml = (s) => String(s ?? '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&amp;/g, '&');

const I = {
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/></svg>',
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
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18 9 12l6-6"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
};
const gameBadge = (g) => g ? `<span class="badge g-${esc(g)}">${esc(g)}</span>` : '<span class="badge">미분류</span>';
const empty = (t, ic = I.inbox) => `<div class="empty">${ic}<span>${esc(t)}</span></div>`;

/* ---------- data ---------- */
async function fetchData(force) {
  const bust = force ? `?t=${Date.now()}` : '';
  // 2026-10-14: 'default'는 GitHub Pages max-age 10분 때문에 옛 tasks.json(대기)을 보여주던 문제 → 항상 서버에 재확인(no-cache, ETag라 가벼움)
  const opt = { cache: force ? 'reload' : 'no-cache' };
  const [d, h, s, c, ch, t] = await Promise.all([
    fetch(`./data/dashboard.json${bust}`, opt).then(r => r.json()),
    fetch(`./data/history/index.json${bust}`, opt).then(r => r.ok ? r.json() : []).catch(() => []),
    fetch(`./data/status.json${bust}`, opt).then(r => r.ok ? r.json() : null).catch(() => null),
    fetch(`./data/cafe.json${bust}`, opt).then(r => r.ok ? r.json() : null).catch(() => null),
    fetch(`./data/cafe_history.json${bust}`, opt).then(r => r.ok ? r.json() : []).catch(() => []),
    fetch(`./data/tasks.json${bust}`, opt).then(r => r.ok ? r.json() : []).catch(() => []),
  ]);
  return { d, h: Array.isArray(h) ? h : [], s, c, ch: Array.isArray(ch) ? ch : [], t: Array.isArray(t) ? t : [] };
}
async function load(force) {
  const btn = $('#refreshBtn'); btn.classList.add('spin');
  if (!D) skeleton();
  try { const { d, h, s, c, ch, t } = await fetchData(force); D = d; H = h; S = s; C = c; CH = ch; T = t; localStorage.setItem('dash', JSON.stringify({ D, H })); }
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
  REQ = [];
  view.innerHTML = { home, queue, posts, comments, stats, cafe }[tab]();
  if (animate && !reduced) requestAnimationFrame(() => view.classList.add('enter'));
  if (animate) window.scrollTo(0, 0);
  bind();
  if (animate) tick();
}
const staleBanner = () => {
  // 상태 파일이 마지막 수집본보다 새롭고 실패를 기록했으면 그 원인을 우선 표시
  if (S && !S.loginOk && new Date(S.at) > new Date(D.collectedAt)) {
    const why = S.preflight === 'NAVER_LOGIN_REQUIRED' ? 'PC 브라우저의 네이버 로그인이 풀렸어요. PC에서 다시 로그인하면 다음 회차부터 정상 수집됩니다.' : 'PC의 Aside 브라우저 연결이 실패했어요 (재부팅 후 WSL2 포트 충돌 가능성). 브라우저를 재시작해 주세요.';
    return `<div class="banner danger">${I.alert}<span><b>수집 실패 (${esc(S.atText || '')})</b><br>${why} 아래는 ${esc(D.collectedAtText)} 수집본입니다.</span></div>`;
  }
  return (Date.now() - new Date(D.collectedAt)) / 3600e3 > 14 ? `<div class="banner warn">${I.warn}<span>마지막 수집이 ${ago(D.collectedAt)}입니다. PC가 꺼져 있거나 Aside가 멈춰 있을 수 있어요.</span></div>` : '';
};
const errBanner = () => D.errors?.length ? `<div class="banner danger">${I.alert}<span>수집 오류 ${D.errors.length}건: ${esc(D.errors.join(' / '))}</span></div>` : '';
const delta = (v, suffix = '') => v == null ? '' : v === 0 ? `<span class="delta">±0${suffix}</span>` : `<span class="delta ${v > 0 ? 'up' : v < 0 ? 'down' : ''}">${v > 0 ? I.up : v < 0 ? I.down : ''}${v > 0 ? '+' : ''}${n(v)}${suffix}</span>`;

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
  const routines = (D.routines || []).slice().sort((a, b) => (a.nextRunAt || '9').localeCompare(b.nextRunAt || '9'));
  const rName = (nm) => String(nm || '').replace(/^고몽이( TCG 센터)? /, '').replace(/\s*\(.*\)\s*$/, '');
  return `${staleBanner()}${errBanner()}
  <div class="bento">
    <section class="card primary span2">
      <div class="eyebrow"><span>오늘 조회수</span><span class="num">${md(t)} (${dow(t)})</span></div>
      <div class="big"><span data-tick="${s.todayCv ?? 0}">${n(s.todayCv)}</span><small>회</small></div>
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><span style="font-size:var(--t-sm);color:var(--muted)">방문자 <b class="num" style="color:var(--text)">${n(s.todayVisitor)}</b></span><span style="font-size:var(--t-sm);color:var(--muted)">어제 <b class="num" style="color:var(--text)">${n(yd)}</b></span>${yd != null && dbf != null ? delta(yd - dbf, ' vs 그제') : ''}</div>
      ${daily.length ? sparkline(daily.map(r => r.total), daily.map(r => md(r.date))) : ''}
    </section>
    <section class="card kpi"><div class="l">${I.spark}AI 인용 누적</div><div class="v" data-tick="${s.citations.cumulative ?? 0}">${n(s.citations.cumulative)}</div><div class="d">${citDelta != null ? delta(citDelta) : ''}<span>이번 달 ${n(s.citations.month)}</span></div></section>
    <section class="card kpi ${s.unansweredComments ? 'alert' : ''}"><div class="l">${I.chat}미답변 댓글</div><div class="v" data-tick="${s.unansweredComments}">${n(s.unansweredComments)}</div><div class="d">전체 ${n(s.totalComments)}개</div></section>
    <section class="card kpi"><div class="l">${I.doc}공개 / 예약</div><div class="v"><span data-tick="${s.publicCount}">${n(s.publicCount)}</span><small> / ${n(s.queueCount)}</small></div><div class="d">${s.v5Pending ? `<span class="badge warn">v5 대기 ${s.v5Pending}</span>` : s.probeFail ? `<span class="badge info">확인 보류 ${s.probeFail}</span>` : `<span class="badge ok">${I.check}레이아웃 정상</span>`}${s.searchOff ? `<span class="badge danger">검색 OFF ${s.searchOff}</span>` : ''}${s.notIndexed48 ? `<span class="badge danger">미색인 ${s.notIndexed48}</span>` : ''}</div></section>
    <section class="card kpi"><div class="l">${I.users}이웃</div><div class="v" data-tick="${s.buddyCount ?? 0}">${n(s.buddyCount)}</div><div class="d">서로이웃 신청·교류 매일 21:10</div></section>
    ${(() => { const R = D.revenue || {}; const sc = R.shopConnect?.total; const ad = R.adpost; return `<section class="card kpi rev" data-goto="stats" role="link" tabindex="0"><div class="l"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 9l2 6 2-5 2 5 2-6M7.5 12h9"/></svg>${ad?.report?.mtd ? `${ad.report.mtd.month}월 수익` : '수익'}</div><div class="v"><span data-tick="${(ad?.report?.mtd?.rev ?? 0) + (sc?.commissionAmount ?? 0)}">${n((ad?.report?.mtd?.rev ?? 0) + (sc?.commissionAmount ?? 0))}</span><small>원</small></div><div class="d"><span>애드포스트 ${n(ad?.report?.mtd?.rev ?? 0)} · 쇼핑커넥트 ${n(sc?.commissionAmount ?? 0)} (클릭 ${n(sc?.accessCnt ?? 0)} · 주문 ${n(sc?.productOrderCnt ?? 0)})</span>${ad ? (ad.report?.mtd ? `<span class="badge ok">월말 예상 ${n(ad.report.mtd.projected)}원</span>` : `<span class="badge ${/정상/.test(ad.mediaStatusKo || '') ? 'ok' : /보류|반려/.test(ad.mediaStatusKo || '') ? 'warn' : 'info'}">애드포스트 ${esc(ad.mediaStatusKo || '-')}</span>`) : ''}</div></section>`; })()}
    ${C ? `<section class="card kpi cafe ${cafeIssues ? 'alert' : ''}" data-goto="cafe" role="link" tabindex="0"><div class="l">${I.users}카페 멤버 · 글</div><div class="v"><span data-tick="${C.members ?? 0}">${n(C.members)}</span><small> / ${n(C.articles)}</small></div><div class="d">${cafeMDelta != null ? delta(cafeMDelta) : ''}${C.pendingLevelUps ? `<span class="badge warn">등업 대기 ${C.pendingLevelUps}</span>` : ''}${(C.unansweredQuestions || []).length ? `<span class="badge danger">질문 ${C.unansweredQuestions.length}</span>` : ''}${(C.ruleFlags || []).length ? `<span class="badge danger">거래 경고 ${C.ruleFlags.length}</span>` : ''}${!cafeIssues ? `<span class="badge ok">${I.check}${esc(C.grade || '정상')}</span>` : ''}</div></section>` : ''}
  </div>

  <div class="h-sec"><h2>오늘 일정</h2><span class="meta">${cards.length}건</span></div>
  <section class="card"><div class="list">${cards.length ? cards.map(c => item({ href: postUrl(c.logNo), time: c.time, no: c.no, game: c.game, badges: `<span class="badge ${c.state[0]}">${c.state[1]}${c.state[2]}</span>`, title: c.title })).join('') : empty('오늘 예약·발행 글 없음')}</div></section>

  ${D.todos ? todoSection(cafeAlerts) + kwSection() : `<div class="h-sec"><h2>할 일</h2><span class="meta">${alerts.length}건</span></div>
  <section class="card">${alerts.length ? alerts.map(a => { const p = a.logNo ? findPost(a.logNo) : null; const tag = a.logNo ? `a href="${postUrl(a.logNo)}" target="_blank" rel="noopener"` : (a.cafe && a.url) ? `a href="${esc(a.url)}" target="_blank" rel="noopener"` : 'div'; const body = p ? `<div>${p.no ? `<span class="badge">#${p.no}</span> ` : ''}${esc(p.title)}</div>${a.priceUpdate || a.type === 'price' ? `<div class="pt">${esc(a.text.split(': ').slice(1).join(': '))}</div>` : ''}` : esc(a.text); return `<${tag} class="todo ${a.level}"><span class="ic">${a.level === 'danger' ? I.alert : a.level === 'warn' ? I.warn : I.info}</span><div><div class="k">${esc(kind[a.type] || a.type)}</div>${body}</div></${a.logNo || (a.cafe && a.url) ? 'a' : 'div'}>`; }).join('') : `<div class="empty">${I.check}<span>처리할 항목 없음</span></div>`}</section>`}

  <div class="h-sec"><h2>Aside 작업</h2><span class="meta">${(() => { const m = mergedTasks(); const run = m.filter(x => x.status === '진행중' || x.status === '대기').length; const wait = m.filter(x => !x.status || x.status === '대기').length, doing = m.filter(x => x.status === '진행중').length; return run ? [doing ? `진행 ${doing}` : '', wait ? `대기 ${wait} · ${nextTaskSlot()} 처리` : ''].filter(Boolean).join(' · ') : m.length + '개'; })()}</span></div>
  <section class="card tasks" data-open-tasks role="button" tabindex="0">${(() => { const m = mergedTasks().slice(0, 3); return m.length ? '<div class="tl-mini">' + m.map(x => `<div>${stBadge(x.status)}<span class="t">${esc(x.text)}</span><span class="meta">${esc((x.atText || '').slice(5, 16))}</span></div>`).join('') + '</div>' : `<div class="empty">${I.inbox}<span>보낸 작업 없음 · 위 종이비행기 버튼으로 Aside에 작업을 보내요</span></div>`; })()}</section>

  ${routines.some(r => 'last' in r) ? routineSection(routines, rName) : `<div class="h-sec"><h2>자동 루틴</h2><span class="meta">${routines.length}개</span></div>
  <section class="card">${routines.length ? routines.map(r => { const w = r.nextRunAt ? fmtIso(r.nextRunAt) : null; return `<div class="rt"><span class="ic">${I.bot}</span><div><div class="n" title="${esc(r.name)}">${esc(rName(r.name))}</div><div class="w">${r.rrule ? '반복' : r.kind === 'cron' ? '앱 버튼으로 실행' : '1회'} · ${r.state === 'active' ? '활성' : esc(r.state)}</div></div>${w ? `<div class="when">다음<b>${w.d} ${w.t}</b></div>` : '<div class="when">앱 버튼<b>대기</b></div>'}</div>`; }).join('') : empty('루틴 정보 없음')}</section>`}`;
}

/* ---------- v4 홈 섹션 (2026-10-14) ---------- */
function todoSection(cafeAlerts) {
  const order = { danger: 0, warn: 1, info: 2 };
  const cafeT = (cafeAlerts || []).map(a => ({ level: a.level, type: a.type, title: ({ cafe_levelup: '카페 등업 신청 대기', cafe_question: '카페 미답변 질문', cafe_trade: '카페 거래 글 규칙 위반', cafe_greeting: '카페 새 가입인사' })[a.type] || '카페', text: a.text, url: a.url }));
  const list = [...(D.todos || []), ...cafeT].sort((a, b) => (order[a.level] ?? 3) - (order[b.level] ?? 3));
  const urgent = list.filter(t => t.level !== 'info').length;
  const ic = (l) => l === 'danger' ? I.alert : l === 'warn' ? I.warn : I.info;
  const row = (t) => {
    const href = t.logNo ? postUrl(t.logNo) : t.url || null;
    const act = (t.action ? `<button class="mini-btn" data-req="${reqIdx(TASK_PRESETS[t.action.preset].t)}">${esc(t.action.label)}</button>` : '') + (t.goto && t.goto.startsWith('posts:') ? `<button class="mini-btn" data-goto-posts="${esc(t.goto.slice(6))}">글 목록에서 보기</button>` : '');
    return `<div class="todo ${t.level}"><span class="ic">${ic(t.level)}</span><div><div class="k">${esc(t.title)}</div>${href ? `<a class="tlink" href="${esc(href)}" target="_blank" rel="noopener">${esc(t.text)}</a>` : `<div>${esc(t.text)}</div>`}${t.note ? `<div class="pt">${esc(t.note)}</div>` : ''}${act}</div></div>`;
  };
  return `<div class="h-sec"><h2>할 일</h2><span class="meta">${urgent ? `급한 것 ${urgent}건 · ` : ''}${list.length}건</span></div>
  <section class="card">${list.length ? limited('todo', list, 5, row) : `<div class="empty">${I.check}<span>급하게 처리할 항목 없음</span></div>`}</section>`;
}
function kwSection() {
  const K = D.kw; if (!K || (!(K.expand || []).length && !(K.retarget || []).length)) return '';
  const exText = (x) => `확장 키워드 "${x.kw}"(월 검색 ${x.total}회, ${x.game}·${x.intent})로 신규 글 1개를 작성해 다음 빈 예약 슬롯에 예약 발행하고 제목·시각·URL 보고.${x.near ? ` 기존 #${x.near} 글과 검색 의도가 겹치지 않게 축을 달리하고, 겹침이 크면 쓰지 말고 보류로 알려줘.` : ''} SPEC v4.1·말투 v8·하루 3개 한도 준수.`;
  const rtText = (x) => `재공략 키워드 "${x.kw}"${x.total ? `(월 검색 ${x.total}회)` : ''}: 기존 #${x.no} "${x.title}"이 ${x.rankDate} 측정에서 PC·모바일 모두 순위 밖. 기존 글은 수정하지 말고, 같은 키워드를 다른 검색 의도(비교·가격·FAQ 등)로 잡은 새 글 1개를 작성해 다음 빈 예약 슬롯에 예약 발행. 제목·소제목·문장·표 구조는 새로 쓰고 관련 글 링크로 기존 글 1개만 연결. 결과(제목·시각·URL) 보고.`;
  const exRow = (x) => `<div class="todo info kw"><span class="ic">${I.spark}</span><div><div class="k">${esc(x.kw)}</div><div class="kwmeta">${gameBadge(x.game)}<span class="badge">월 ${n(x.total)}</span>${x.aib ? '<span class="badge ok">AI 브리핑</span>' : ''}${x.blogs != null ? `<span class="badge">블로그 ${x.blogs}</span>` : ''}${x.near ? `<span class="badge warn">#${x.near}와 가까움</span>` : ''}</div><button class="mini-btn" data-req="${reqIdx(exText(x))}">이 키워드로 새 글 요청</button></div></div>`;
  const rtRow = (x) => `<div class="todo warn kw"><span class="ic">${I.sync}</span><div><div class="k">${esc(x.kw)}</div><a class="tlink" href="${postUrl(x.logNo)}" target="_blank" rel="noopener">#${x.no} ${esc(x.title)}</a><div class="kwmeta">${gameBadge(x.game)}${x.total ? `<span class="badge">월 ${n(x.total)}</span>` : ''}<span class="badge danger">순위 밖 (${esc(md(x.rankDate))})</span><span class="badge">발행 ${x.age}일</span></div><button class="mini-btn" data-req="${reqIdx(rtText(x))}">다른 축 새 글 요청</button></div></div>`;
  const ex = K.expand || [], rt = K.retarget || [];
  const mapYmd = K.mapAt ? new Date(new Date(K.mapAt).getTime() + 9 * 3600e3).toISOString().slice(0, 10) : null;
  return `<div class="h-sec"><h2>키워드 기회</h2><span class="meta">${mapYmd ? `키워드 지도 ${md(mapYmd)} 기준` : ''}</span></div>
  <section class="card">${rt.length ? `<div class="sub-h">재공략 <small>쓴 지 14일 넘었는데 순위 밖</small></div>${limited('kwrt', rt, 2, rtRow)}` : ''}${ex.length ? `<div class="sub-h">확장 키워드 <small>아직 안 쓴 롱테일, AI 브리핑 우선</small></div>${limited('kwex', ex, 3, exRow)}` : ''}</section>`;
}
/* ---------- 글별 성과 (2026-10-14) ---------- */
function perfSection() {
  const P = D.perf; if (!P || !(P.rows || []).length) return '';
  const views = { top: ['잘 되는 글', r => r.grade === 'top'], low: ['안 되는 글', r => r.grade === 'low'], noindex: ['미색인', r => r.grade === 'noindex'], all: ['전체', () => true] };
  const [label, fn] = views[perfView] || views.top;
  const list = P.rows.filter(fn);
  const won = (v) => v == null ? '-' : n(v) + '원';
  const srcTxt = { log: '', new: '', adpost: '', avg: '(평균 추정)' };
  const exText = (r) => `잘 되는 글 #${r.no} "${r.title}"(최근 7일 조회 ${r.v7}회, 주키워드 "${r.keyword || ''}")과 같은 주제의 확장 키워드 1개를 키워드 지도에서 골라(이미 쓴 글과 검색 의도가 겹치지 않는 롱테일) 신규 글 1개를 작성해 다음 빈 예약 슬롯에 예약 발행. 기존 글은 수정하지 말고 관련 글 링크로 1번만 연결. 키워드·제목·시각·URL 보고.`;
  const rtText = (r) => `안 되는 글 #${r.no} "${r.title}"(발행 ${r.ageD}일, 7일 조회 ${r.v7}회, 주키워드 "${r.keyword || ''}" 순위 밖): 기존 글은 수정하지 말고, 같은 키워드를 다른 검색 의도(비교·가격·FAQ 등)로 잡은 새 글 1개를 작성해 다음 빈 예약 슬롯에 예약 발행. 네이버에서 rmarn99 가 이미 그 키워드로 잡히면 보류. 결과 보고.`;
  const row = (r) => {
    const rk = r.mBest ? `<span class="badge ${r.mBest <= 3 ? 'ok' : r.mBest <= 10 ? 'info' : 'warn'}">모바일 ${r.mBest}위</span>` : r.indexed === false ? '<span class="badge danger">미색인</span>' : '<span class="badge">순위 밖</span>';
    const act = r.grade === 'top' ? `<button class="mini-btn" data-req="${reqIdx(exText(r))}">같은 주제 확장 새 글 요청</button>` : r.grade === 'low' ? `<button class="mini-btn" data-req="${reqIdx(rtText(r))}">다른 축 새 글 요청</button>` : '';
    return `<div class="perf-row"><a class="tlink" href="${postUrl(r.logNo)}" target="_blank" rel="noopener"><div class="meta"><span class="no">#${r.no ?? '?'}</span>${gameBadge(r.game)}<span class="right">${rk}</span></div><div class="title">${esc(r.title)}</div></a><div class="perf-nums"><span><b>${n(r.v7)}</b>7일 조회${srcTxt[r.v7src] || ''}</span><span><b>${won(r.est7)}</b>7일 추정 수익</span><span><b>${r.perDay != null ? n(Math.round(r.perDay)) : '-'}</b>하루 평균</span></div>${act}</div>`;
  };
  const c = P.counts || {};
  return `<div class="h-sec"><h2>글별 성과</h2><span class="meta">RPM ${n(P.rpm7)}원 기준 추정</span></div>
  <div class="chips" role="group" aria-label="글별 성과 보기">${Object.entries(views).map(([k, v]) => `<button class="chip" data-perf="${k}" aria-pressed="${perfView === k}">${v[0]} ${k === 'all' ? P.rows.length : (c[k] ?? 0)}</button>`).join('')}</div>
  <section class="card">${list.length ? limited('perf_' + perfView, list, 5, row) : empty(perfView === 'low' ? '안 되는 글 없음 (14일 지난 글 중 하위 25%·순위 밖 기준)' : '해당 글 없음', I.check)}<p class="hint" style="margin:10px 0 0">7일 조회는 글별 조회수 기록(${P.logDays}일째 누적 중) → 애드포스트 글별 조회 → 평균 추정 순으로 계산해요. 수익은 조회 × 최근 7일 RPM으로 추정한 값이고 실제 글별 수입이 아니에요.</p></section>`;
}
function indexSection() {
  const X = D.indexing; if (!X) return '';
  const miss = X.missing48 || [];
  const row = (r) => `<a class="item" href="${postUrl(r.logNo)}" target="_blank" rel="noopener"><div class="meta"><span class="no">#${r.no ?? '?'}</span>${gameBadge(r.game)}<span class="right"><span class="badge danger">${Math.floor(r.ageH / 24)}일째 미색인</span></span></div><div class="title">${esc(r.title)}</div>${r.lastIndexedAt ? `<div class="sub"><span>마지막 색인 확인 ${esc(fmtIso(r.lastIndexedAt).d)}</span></div>` : ''}</a>`;
  return `<div class="h-sec"><h2>검색 색인</h2><span class="meta">${esc(fmtIso(X.at).d)} ${esc(fmtIso(X.at).t)} 확인</span></div>
  <section class="card"><dl class="kv" style="margin-bottom:8px"><dt>48시간 색인율</dt><dd>${X.ratio48 != null ? X.ratio48 + '%' : '-'}</dd><dt>색인 / 미색인 / 확인 중</dt><dd>${n(X.indexed)} / ${n(X.notIndexed)} / ${n(X.unknown)}</dd></dl><p class="hint">블로그탭에서 제목으로 검색해 내 글이 잡히는지 수집 때마다 일부씩 확인해요. 미색인은 두 번 연속 안 잡혔을 때만 표시해요. 글 수정·재발행은 하지 않아요.</p>${(X.dropped || []).length ? `<div class="banner danger">${I.alert}<span>전엔 잡히다 빠진 글 ${X.dropped.length}개: ${X.dropped.map(r => '#' + (r.no ?? '?')).join(' ')}</span></div>` : ''}<div class="list">${miss.length ? limited('idx', miss, 5, row) : empty('48시간 지난 미색인 글 없음', I.check)}</div></section>`;
}
function routineSection(routines, rName) {
  const live = routines.filter(r => r.status !== 'completed');
  const done = routines.length - live.length;
  const RS = { ok: ['ok', '정상'], skip: ['info', '건너뜀'], warn: ['warn', '확인 필요'], running: ['info', '실행 중'] };
  const row = (r) => {
    const w = r.nextRunAt ? fmtIso(r.nextRunAt) : null;
    const st = r.status === 'paused' ? ['', '일시정지'] : r.missed ? ['danger', '놓침'] : r.last ? RS[r.last.result] || RS.ok : null;
    const lastLine = r.last ? `<div class="w">${st ? `<span class="badge ${st[0]}">${esc(st[1])}</span> ` : ''}${esc(ago(r.last.at))} 실행 · 누적 ${n(r.last.runs)}회</div>${r.last.summary ? `<div class="rs clamp1">${esc(r.last.summary)}</div>` : ''}` : `<div class="w">아직 실행 기록 없음</div>`;
    return `<div class="rt${r.status === 'paused' ? ' paused' : ''}"><span class="ic">${I.bot}</span><div><div class="n" title="${esc(r.name)}">${esc(rName(r.name))}</div>${lastLine}</div>${r.status === 'paused' ? '<div class="when">상태<b>일시정지</b></div>' : w ? `<div class="when">다음<b>${w.d} ${w.t}</b></div>` : '<div class="when">다음<b>-</b></div>'}</div>`;
  };
  const bad = live.filter(r => r.missed || (r.last && r.last.result === 'warn')).length;
  return `<div class="h-sec"><h2>자동 루틴</h2><span class="meta">${bad ? `확인 ${bad} · ` : ''}${live.length}개${done ? ` (끝난 1회성 ${done}개 숨김)` : ''}</span></div>
  <section class="card">${live.length ? live.map(row).join('') : empty('루틴 정보 없음')}</section>`;
}

/* ---------- 예약 ---------- */
function queue() {
  const t = todayStr();
  const byDay = {};
  for (const q of D.queue) (byDay[q.postDateText.slice(0, 10)] ||= []).push(q);
  const days = Object.keys(byDay).sort();
  const games = D.games?.count || {}, target = D.games?.target || {};
  const total = Object.values(games).reduce((a, b) => a + b, 0) || 1;
  const colors = { '포켓몬': 'var(--red)', '리프트바운드': 'var(--violet)', '원피스': 'var(--info)', '용품': 'var(--teal)', '용품·공통': 'var(--teal)', '미분류': 'var(--faint)' };
  const pk = games['포켓몬'] || 0, etcPct = Math.round((total - pk) / total * 100);
  return `${staleBanner()}
  <div class="h-sec"><h2>게임 비중</h2><span class="meta">전체 ${total}개</span></div>
  <section class="card">
    <div class="stack">${Object.entries(games).map(([g, c]) => `<span style="width:${c / total * 100}%;background:${colors[g] || colors['미분류']}"></span>`).join('')}</div>
    <div class="legend">${Object.entries(games).map(([g, c]) => `<div><i style="background:${colors[g] || colors['미분류']}"></i><span class="lg-n">${esc(g)}</span> <b>${c}</b>개 · ${Math.round(c / total * 100)}%</div>`).join('')}</div>
    <div class="legend-target">목표 포켓몬 ${target['포켓몬'] ?? 80}% · 기타 ${target['기타'] ?? 20}% → 현재 포켓몬 <b>${Math.round(pk / total * 100)}%</b> · 기타 <b>${etcPct}%</b></div>
  </section>
  <div class="h-sec"><h2>예약 큐</h2><span class="meta">${D.queue.length}건</span></div>
  ${days.length ? `<div class="tl">${days.map(d => `<div class="day ${d === t ? 'today' : ''}"><div class="dh"><b>${md(d)} (${dow(d)})${d === t ? ' 오늘' : ''}</b><span>${byDay[d].length}건${byDay[d].length > 3 ? ' · 초과' : ''}</span></div><section class="card"><div class="list">${byDay[d].map(q => { const p = findPost(q.logNo) || {}; return item({ href: postUrl(q.logNo), time: q.postDateText.slice(11, 16), no: p.no, game: p.game, badges: p.category ? `<span class="badge">${esc(p.category.replace(/^(포켓몬 카드|리프트바운드|원피스 카드) /, ''))}</span>` : '', title: q.title }); }).join('')}</div></section></div>`).join('')}</div>` : `<section class="card">${empty('예약된 글이 없습니다. 월·목 09:30 신규 글 루틴이 채웁니다.')}</section>`}`;
}

/* ---------- 글 ---------- */
function posts() {
  const gamesAll = ['전체', ...new Set(D.posts.map(p => p.game).filter(Boolean))];
  const statusAll = ['전체', '공개', '예약', '문제있음', ...(D.indexing ? ['색인 안 됨'] : []), 'AI인용'];
  // 2026-10-14: no 순서는 발행 순서와 다를 수 있어(#77이 #75보다 먼저 발행) 실제 발행·예약 시각으로 정렬
  const pts = (p) => { const m = String(p.publishedText || '').match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2})/); return m ? m[1] : ''; };
  let list = D.posts.slice().sort((a, b) => pts(b).localeCompare(pts(a)) || (b.no || 0) - (a.no || 0));
  if (filters.game !== '전체') list = list.filter(p => p.game === filters.game);
  if (filters.status === '공개' || filters.status === '예약') list = list.filter(p => p.status === filters.status);
  if (filters.status === '색인 안 됨') list = list.filter(p => p.status === '공개' && p.indexed === false);
  if (filters.status === '문제있음') list = list.filter(p => p.status === '공개' && (p.indexed === false || p.searchYn === false || p.v5 === false || p.relatedLinksPending || p.unanswered > 0 || (p.priceUpdate && p.priceUpdate.due <= todayStr())));
  if (filters.status === 'AI인용') list = list.filter(p => p.aiCited);
  const chip = (f, v) => `<button class="chip" aria-pressed="${filters[f] === v}" data-f="${f}" data-v="${esc(v)}">${esc(v)}</button>`;
  return `
  <div class="chips" role="group" aria-label="게임">${gamesAll.map(g => chip('game', g)).join('')}</div>
  <div class="chips" role="group" aria-label="상태">${statusAll.map(s => chip('status', s)).join('')}</div>
  <div class="h-sec"><h2>글 ${list.length}개</h2><span class="meta">${filters.status === 'AI인용' ? '10/1 기준 · 글별 인용 점검은 10/1에 중단' : '조회수는 네이버 글 목록 기준'}</span></div>
  <section class="card"><div class="list">${list.length ? limited('posts', list, 15, p => {
    const flags = [
      p.status === '예약' ? `<span class="badge info">${I.clock}예약</span>` : '',
      p.status === '공개' && p.searchYn === false ? '<span class="badge danger">검색 OFF</span>' : '',
      p.status === '공개' && p.indexed === false ? '<span class="badge danger">미색인</span>' : '',
      p.status === '공개' && p.v5 === false ? '<span class="badge warn">v5 미적용</span>' : '',
      p.relatedLinksPending ? '<span class="badge info">링크 보강</span>' : '',
      p.priceUpdate ? `<span class="badge ${p.priceUpdate.due <= todayStr() ? 'warn' : ''}">시세 ${md(p.priceUpdate.due)}</span>` : '',
      p.aiCited ? `<span class="badge ok" title="10/1 점검 기준">${I.spark}AI 인용(10/1)</span>` : '',
    ].join('');
    const sub = p.status === '공개' ? `<span>${esc((p.publishedText || '').slice(5, 10).replace('-', '/'))}</span><span>조회 <b>${n(p.readCount)}</b></span><span>댓글 <b>${n(p.commentCount)}</b>${p.unanswered ? ` <b style="color:var(--danger)">미답변 ${p.unanswered}</b>` : ''}</span>${(() => { const r = (D.perf?.rows || []).find(x => x.logNo === p.logNo); return r && r.v7 != null ? `<span>7일 <b>${n(r.v7)}</b>회${r.est7 != null ? ` · 약 ${n(r.est7)}원` : ''}</span>` : ''; })()}${p.mRank ? (() => { const r = p.mRank; const c = r.mBlogRank == null ? 'danger' : r.mBlogRank <= 3 ? 'ok' : r.mBlogRank <= 7 ? 'info' : 'warn'; return `<span class="badge ${c}" title="${esc(r.keyword)} · ${esc(r.date)}">모바일 ${r.mBlogRank ? `블로그 ${r.mBlogRank}위` : '1페이지 밖'}${r.mContentRank ? ` · 통검 ${r.mContentRank}번째` : ''}</span>`; })() : ''}` : `<span>${esc(p.publishedText || '')} 예약</span>`;
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
  const mr = D.mobileRankHistory || [];
  const mDate = mr.reduce((m, r) => r.date > m ? r.date : m, '');
  const mLatest = mr.filter(r => r.date === mDate);
  const mPrevDate = mr.filter(r => r.date < mDate).reduce((m, r) => r.date > m ? r.date : m, '');
  const mPrev = Object.fromEntries(mr.filter(r => r.date === mPrevDate).map(r => [r.keyword, r]));
  const mIn = mLatest.filter(r => r.mBlogRank).length;
  const mTier = (v, cut) => v == null ? 'danger' : v <= cut[0] ? 'ok' : v <= cut[1] ? 'info' : 'warn';
  const mRow = r => { const pv = mPrev[r.keyword]; const d = pv?.mBlogRank && r.mBlogRank ? pv.mBlogRank - r.mBlogRank : (r.mBlogRank && pv && !pv.mBlogRank ? 'new' : null); const p = r.logNo ? findPost(r.logNo) : null; const tt = !r.hasBlog ? '' : mTier(r.mBlogRank, [3, 7]); const bt = mTier(r.mTabRank, [1, 5]); const totBadge = !r.hasBlog ? `<span class="badge">통검 블로그 없음</span>` : r.mBlogRank ? `<span class="badge ${tt}">통검 블로그 ${r.mBlogRank}위<span style="opacity:.7;font-weight:500">/${r.mBlogCount}</span></span>` : `<span class="badge danger">통검 1페이지 밖</span>`; const tabBadge = `<span class="badge ${bt}">블로그탭 ${r.mTabRank ? r.mTabRank + '위' : '밖'}</span>`; const ct = mTier(r.mContentRank, [5, 10]); const allTxt = r.mContentRank ? `<span class="badge ${ct}">통검 ${r.mContentRank}번째</span>` : ''; return `<div class="rank mr-row mr-${tt || 'none'}"><span class="no mr-no">${r.mBlogRank ?? '–'}</span><span class="t"><b>${esc(r.keyword)}</b>${p ? ` <span style="color:var(--faint);font-size:var(--t-xs)">#${p.no}</span>` : ''}<span class="mr-badges">${totBadge}${allTxt}${tabBadge}</span></span><span class="val ${d === 'new' || d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d == null ? '' : d === 'new' ? 'NEW' : (d > 0 ? '\u25b2' + d : d < 0 ? '\u25bc' + (-d) : '-')}</span></div>`; };
  const hb = (key, rows, nameKey, valKey, pctKey, limit) => { const max = Math.max(1, ...rows.map(r => r[valKey] || 0)); return rows.length ? limited(key, rows, limit, r => `<div class="hbar"><div class="top"><div class="n">${esc(r[nameKey])}</div><div class="p"><b>${n(r[valKey])}</b>${pctKey && r[pctKey] != null ? ` · ${r[pctKey]}%` : ''}</div></div><div class="b"><span style="width:${(r[valKey] || 0) / max * 100}%"></span></div></div>`) : empty('데이터 없음'); };
  const c = D.summary.citations;
  const R = D.revenue || {}, SC = R.shopConnect, AD = R.adpost, MT = R.mate;
  const scT = SC?.total || {};
  const scDaily = (SC?.daily || []).map(d => ({ date: d.date, access: d.access || 0 }));
  const matePct = MT ? Math.min(100, Math.round(MT.projected / MT.ref * 100)) : 0;
  const revSec = `
  <div class="h-sec"><h2>수익화</h2><span class="meta">쇼핑커넥트·애드포스트는 어제까지 집계</span></div>
  <section class="card"><h3>쇼핑 커넥트 누적<small>주문 기준 · 정산은 구매확정 기준</small></h3>
    ${SC ? `<div class="rank"><span class="t">예상 수익</span><span class="val"><b>${n(scT.commissionAmount ?? 0)}원</b></span></div>
    <div class="rank"><span class="t">클릭(유입)</span><span class="val">${n(scT.accessCnt ?? 0)}</span></div>
    <div class="rank"><span class="t">주문 · 판매 개수</span><span class="val">${n(scT.productOrderCnt ?? 0)} · ${n(scT.salesCnt ?? 0)}</span></div>
    <div class="rank"><span class="t">판매 금액 · 전환율</span><span class="val">${n(scT.salesAmount ?? 0)}원 · ${scT.salesConversionRate ?? 0}%</span></div>
    ${scDaily.some(d => d.access) ? `<h3 style="margin-top:12px">일별 클릭<small>최근 15일</small></h3>${barChart(scDaily, 'access', r => Number(r.date.slice(8, 10)))}` : `<div class="empty">${I.clock}<span>아직 클릭 기록 없음 (첫 구매형 글 10/2 발행)</span></div>`}
    ${(SC.products || []).length ? `<h3 style="margin-top:12px">상품별</h3>${SC.products.map(p => `<div class="rank"><span class="t">${esc(p.productName || p.name || '')}</span><span class="val">${n(p.salesCnt ?? p.salesCount ?? 0)}개</span></div>`).join('')}` : ''}` : empty('수집 실패 또는 데이터 없음')}</section>
  ${(() => { const AR = AD?.report; const st = AD ? `<div class="rank"><span class="t">블로그 미디어 상태</span><span class="val"><span class="badge ${/정상/.test(AD.mediaStatusKo || '') ? 'ok' : /보류|반려/.test(AD.mediaStatusKo || '') ? 'warn' : 'info'}">${esc(AD.mediaStatusKo || '-')}</span></span></div><div class="rank"><span class="t">현재 잔액</span><span class="val">${n(AD.remainPoint ?? 0)}원</span></div>` : '';
    if (!AD) return `<section class="card"><h3>애드포스트</h3>${empty('수집 안 됨')}</section>`;
    if (!AR || AR.error || !AR.yesterday) return `<section class="card"><h3>애드포스트</h3>${st}${AR?.error ? `<div class="empty" style="padding:8px 0"><span>상세 리포트 실패: ${esc(AR.error)}</span></div>` : ''}</section>`;
    const Y = AR.yesterday, L = AR.last7, P = AR.prev7, M = AR.mtd;
    const diff = P && P.days ? Math.round((L.perDay - P.perDay) / Math.max(1, P.perDay) * 100) : null;
    const dd = (AR.daily || []).map(r => ({ date: r.date, rev: r.rev })).reverse(); // barChart 는 최신순 입력을 받아 뒤집는다
    return `<section class="card"><h3>애드포스트 수입<small>${AR.dataThrough.slice(5).replace('-', '/')}까지 집계 · 하루 늦게 반영</small></h3>
    <div class="rank"><span class="t">어제(${Y.date.slice(5).replace('-', '/')}) 수입</span><span class="val"><b>${n(Y.rev)}원</b> · 클릭 ${n(Y.clk)}</span></div>
    <div class="rank"><span class="t">최근 7일 · 하루 평균</span><span class="val">${n(L.rev)}원 · ${n(L.perDay)}원${diff != null ? ` <span class="badge ${diff >= 0 ? 'ok' : 'warn'}">${diff >= 0 ? '+' : ''}${diff}%</span>` : ''}</span></div>
    <div class="rank"><span class="t">${M.month}월 누적 → 월말 예상</span><span class="val"><b>${n(M.rev)}원</b> → ${n(M.projected)}원</span></div>
    <div class="rank"><span class="t">조회 1,000회당 수입(RPM)</span><span class="val">${L.rpm != null ? n(L.rpm) + '원' : '-'}</span></div>
    <div class="rank"><span class="t">클릭률 · 클릭당 수입</span><span class="val">${L.ctr}% · ${L.cpc != null ? n(L.cpc) + '원' : '-'}</span></div>
    ${st}
    ${dd.length ? `<h3 style="margin-top:12px">일별 수입<small>원</small></h3>${barChart(dd, 'rev', r => Number(r.date.slice(8, 10)))}` : ''}
    ${(AR.slots || []).length ? `<h3 style="margin-top:12px">광고 위치별<small>${AR.start.slice(5).replace('-', '/')}~ · 수입 비중</small></h3>${AR.slots.map(s => `<div class="hbar"><div class="top"><div class="n">${esc(s.slot)}</div><div class="p"><b>${n(s.rev)}원</b> · ${s.share}% · CTR ${s.ctr}%</div></div><div class="b"><span style="width:${s.share}%"></span></div></div>`).join('')}` : ''}
    ${(AR.posts || []).length ? `<h3 style="margin-top:12px">글별 추정 수입<small>최근 ${AR.postDays}일 · 조회 비중으로 나눈 추정</small></h3>${AR.posts.slice(0, 7).map(p => `<div class="rank"><span class="t">${esc(p.title)}</span><span class="val">${n(p.est)}원 · 조회 ${n(p.cv)}</span></div>`).join('')}` : ''}
  </section>`; })()}
  <section class="card"><h3>네이버 메이트 예상<small>${MT ? `${MT.month}월 인용 → ${MT.selectionMonth}월 선정` : ''}</small></h3>${MT ? `<div class="hbar"><div class="top"><div class="n">${MT.month}월 월말 예상 <b>${n(MT.projected)}</b></div><div class="p">참고선 ${n(MT.ref)} · ${matePct}%</div></div><div class="b"><span style="width:${matePct}%"></span></div></div><div class="rank"><span class="t">${MT.month}월 ${MT.day}일까지</span><span class="val">${n(MT.count)} (하루 ${n(MT.pace)})</span></div><div class="empty" style="padding:8px 0"><span>참고선은 비공식(8월 게임 주제 선정 사례). 인용수만으로 정해지지 않음 · 베타 12월 종료</span></div>` : empty('인용수 수집 후 표시')}</section>`;
  return `${staleBanner()}${perfSection()}${revSec}
  <div class="h-sec"><h2>일별 조회수</h2><span class="meta">최근 15일</span></div>
  <section class="card">${daily.length ? barChart(daily, 'total', r => Number(r.date.slice(8, 10))) : empty('데이터 없음')}</section>

  <div class="h-sec"><h2>AI 브리핑 인용수</h2><span class="meta">${c.currentMonth}월 ${n(c.month)} · 메이트 선정기준(${c.selectionPeriodMonth ?? '-'}월) ${n(c.selectionPeriod)}</span></div>
  <section class="card">${cits.length >= 2 ? barChart(cits.slice(-15).reverse(), 'c', r => Number(r.date.slice(8, 10))) : `<div class="empty">${I.clock}<span>추세는 수집이 2일 이상 쌓이면 표시 (현재 ${cits.length}일 · 누적 ${n(c.cumulative)})</span></div>`}</section>

  <div class="h-sec"><h2>유입 · 검색어</h2><span class="seg" role="group"><button data-day="today" aria-pressed="${statDay === 'today'}">오늘</button><button data-day="yesterday" aria-pressed="${statDay === 'yesterday'}">어제</button></span></div>
  <section class="card"><h3>유입경로<small>${esc(day?.date || '')}</small></h3>${hb('ref', day?.referer || [], 'name', 'cv', 'pct', 6)}</section>
  <section class="card"><h3>검색 유입 키워드</h3>${hb('kw', (day?.searchQueries || []).slice(0, 30), 'query', 'cv', null, 8)}</section>
  <section class="card"><h3>글별 조회수 순위</h3>${(day?.rankCv || []).map(r => { const p = findPost(r.logNo); return `<a class="rank" href="${postUrl(r.logNo)}" target="_blank" rel="noopener"><span class="no">${r.rank}</span><span class="t">${p?.no ? `<span style="color:var(--faint)">#${p.no}</span> ` : ''}${esc(r.title)}</span><span class="val">${n(r.cv)}</span></a>`; }).join('') || empty('데이터 없음')}</section>

  ${indexSection()}
  <div class="h-sec"><h2>모바일 통합검색 순위</h2><span class="meta">${mDate ? `${mDate} · 1페이지 노출 ${mIn}/${mLatest.length}` : '첫 측정 후 표시'}</span></div>
  <section class="card">${mLatest.length ? `<div class="mr-legend"><span class="badge ok">좋음</span><span class="badge info">보통</span><span class="badge warn">낮음</span><span class="badge danger">1페이지 밖</span><button class="linkbtn" data-mr-help>기준 보기</button></div><div class="mr-help" hidden>통검 블로그: 1~3위 좋음 · 4~7위 보통 · 8위~ 낮음<br>통검 n번째(카페·웹 포함 순서): 1~5 · 6~10 · 11~<br>블로그탭: 1위 · 2~5위 · 6위~</div>` : ''}${mLatest.length ? limited('mrank', mLatest.slice().sort((a, b) => (a.mBlogRank || 99) - (b.mBlogRank || 99) || (a.mTabRank || 99) - (b.mTabRank || 99)), 12, mRow) : empty('아직 기록 없음')}</section>

  <div class="h-sec"><h2>PC 노출순위</h2><span class="meta">${latestDate ? latestDate + ' 기준' : '월요일 루틴 첫 기록 후 표시'}</span></div>
  <section class="card">${latest.length ? limited('pcrank', latest.sort((a, b) => (a.searchRank || 99) - (b.searchRank || 99)), 8, r => { const pv = prevMap[r.keyword + '|' + r.logNo]; const d = pv?.searchRank && r.searchRank ? pv.searchRank - r.searchRank : null; const p = findPost(r.logNo); return `<div class="rank"><span class="t"><b>${esc(r.keyword)}</b><br><span style="color:var(--muted);font-size:var(--t-xs)">${p ? `#${p.no} · ` : ''}통검 ${r.searchRank ?? '-'}위 · 블로그탭 ${r.blogRank ?? '-'}위</span></span><span class="val ${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d == null ? '' : (d > 0 ? '▲' + d : d < 0 ? '▼' + (-d) : '-')}</span></div>`; }) : empty('아직 기록 없음')}</section>`;
}

/* ---------- 카페 (data/cafe.json + cafe_history.json, 2026-09-19) ---------- */
function cafe() {
  if (!C) return `${staleBanner()}<section class="card">${empty('카페 데이터가 아직 없어요. 다음 자동 수집(08·13시, 20:30) 뒤 표시됩니다.', I.clock)}</section>`;
  const boardOf = (id) => (C.boards || []).find(b => b.menuId === id);
  const bBadge = (a) => `<span class="badge ${[28, 29, 30].includes(a.menuId) ? 'warn' : [26, 13, 27].includes(a.menuId) ? 'info' : a.isNotice ? 'primary' : ''}">${esc((a.menuName || '').replace(/\(.*\)$/, '').replace(/ 게시판$/, ''))}</span>`;
  const art = (a, extra = '') => item({ href: a.url, game: '', time: (a.writeDate || '').slice(5, 16).replace('-', '/'), badges: `${extra}${a.commentCount ? `<span class="badge">댓글 ${a.commentCount}</span>` : ''}`, title: a.title, sub: `<span>${bBadge(a)}</span><span>${esc(a.writer)}${a.writerLevel ? ` · ${esc(a.writerLevel)}` : ''}</span><span>조회 <b>${n(a.readCount)}</b></span>` });
  const hist = (CH || []).slice(-15);
  const prev = hist.length >= 2 ? hist[hist.length - 2] : null;
  const mDelta = prev && prev.members != null && C.members != null ? C.members - prev.members : null;
  const alerts = (C.alerts || []);
  const kind = { levelup: '등업 신청 대기', question: '미답변 질문', trade: '거래 글 규칙 위반', greeting: '새 가입인사', account: '운영 계정', infoplan: '정보 글' };
  const A = C.account || null; const transition = A ? A.mode !== '매니저' : false; const P = C.infoPlan || null;
  const pct = P && P.target ? Math.min(100, Math.round(P.done / P.target * 100)) : 0;
  const daysLeft = A?.managerExpected ? Math.max(0, Math.ceil((new Date(A.managerExpected + 'T00:00:00+09:00') - Date.now()) / 86400e3)) : null;
  const stale = (Date.now() - new Date(C.collectedAt)) / 3600e3 > 14;
  const boards = (C.boards || []).filter(b => b.menuId !== 23);
  return `${staleBanner()}${C.errors?.length ? `<div class="banner warn">${I.warn}<span>카페 수집 경고 ${C.errors.length}건: ${esc(C.errors.join(' / '))}</span></div>` : ''}
  ${A ? `<div class="banner ${transition ? 'warn' : 'ok'}">${transition ? I.clock : I.check}<span>${transition ? `전환기 운영 · 계정 <b>${esc(A.nick || '')}</b> (${esc(A.grade || '챔피언')}) · 매니저 전환 예정 ${esc(A.managerExpected || '')}${daysLeft != null ? ` (D-${daysLeft})` : ''} · 일반 게시판 정보 글만 발행` : `매니저 계정 <b>${esc(A.nick || '')}</b> · 전체 운영 모드`}${A.checkedAt ? ` · 확인 ${esc(A.checkedAt)}` : ''}</span></div>` : ''}
  <div class="h-sec"><h2>카페 현황</h2><span class="meta">${esc(C.collectedAtText || '')} 수집${stale ? ' · 오래됨' : ''}</span></div>
  <div class="kpi-row5">
    <section class="card kpi"><div class="l">${I.users}멤버</div><div class="v" data-tick="${C.members ?? 0}">${n(C.members)}</div><div class="d">${mDelta != null ? delta(mDelta) : ''}<span>${esc(C.grade || '')}</span></div></section>
    <section class="card kpi"><div class="l">${I.doc}글</div><div class="v" data-tick="${C.articles ?? 0}">${n(C.articles)}</div><div class="d">멤버 글 ${n(C.counts?.byMember)}</div></section>
    ${transition && P ? `<section class="card kpi ${P.done < P.target ? 'alert' : ''}"><div class="l">${I.doc}정보 글 (AEO)</div><div class="v" data-tick="${P.done}">${n(P.done)}<small> / ${n(P.target)}</small></div><div class="d">이번 주 ${n(P.thisWeek)}/4 · 조회 ${n(P.reads)}</div></section>` : `<section class="card kpi ${C.pendingLevelUps ? 'alert' : ''}"><div class="l">${I.check}등업 대기</div><div class="v" data-tick="${C.pendingLevelUps ?? 0}">${n(C.pendingLevelUps)}</div><div class="d">트레이너 승인</div></section>`}
    ${transition ? `<section class="card kpi"><div class="l">${I.clock}매니저 전환</div><div class="v">${daysLeft != null ? `D-${daysLeft}` : '-'}</div><div class="d">${esc(A?.managerExpected || '')} 예정</div></section>` : `<section class="card kpi"><div class="l">${I.clock}오늘 출석</div><div class="v" data-tick="${C.todayAttendance ?? 0}">${n(C.todayAttendance)}</div><div class="d" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block">${esc(C.todayMission || '미션 없음')}</div></section>`}
    <section class="card kpi ${(C.unansweredQuestions || []).length ? 'alert' : ''}"><div class="l">${I.chat}미답변 질문</div><div class="v" data-tick="${(C.unansweredQuestions || []).length}">${n((C.unansweredQuestions || []).length)}</div><div class="d">질문 글 ${n(C.counts?.questions)}</div></section>
    <section class="card kpi ${(C.ruleFlags || []).length ? 'alert' : ''}"><div class="l">${I.alert}거래 경고</div><div class="v" data-tick="${(C.ruleFlags || []).length}">${n((C.ruleFlags || []).length)}</div><div class="d">거래 글 ${n(C.counts?.trades)}</div></section>
  </div>

  <div class="h-sec"><h2>할 일</h2><span class="meta">${alerts.length}건</span></div>
  <section class="card">${alerts.length ? alerts.map(a => `<a class="todo ${a.level}" href="${a.url}" target="_blank" rel="noopener"><span class="ic">${a.level === 'danger' ? I.alert : a.level === 'warn' ? I.warn : I.info}</span><div><div class="k">${esc(kind[a.type] || a.type)}</div><div>${esc(a.text)}</div></div></a>`).join('') : `<div class="empty">${I.check}<span>처리할 항목 없음</span></div>`}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">${transition ? '' : `<a class="badge primary" href="${esc(C.links?.levelUp || '')}" target="_blank" rel="noopener">등업 신청 관리</a><a class="badge" href="${esc(C.links?.manage || '')}" target="_blank" rel="noopener">카페 관리</a>`}<a class="badge" href="${esc(C.links?.attendance || '')}" target="_blank" rel="noopener">출석체크</a><a class="badge" href="${esc(C.url || '')}" target="_blank" rel="noopener">카페 홈</a></div></section>

  ${P ? `<div class="h-sec"><h2>${transition ? '전환기 정보 글 (AEO)' : '정보 글 (AEO)'}</h2><span class="meta">${transition ? `${P.done}/${P.target}` : `누적 ${P.done}개 · 화·목 10:00`} · ${esc(P.start || '')}~</span></div>
  <section class="card"><div style="height:8px;border-radius:4px;background:rgba(127,127,127,.25);overflow:hidden;margin-bottom:10px"><div style="width:${pct}%;height:100%;background:#03c75a"></div></div><div class="list">${(P.posts || []).length ? P.posts.map(a => art(a, '<span class="badge ok">정보</span>')).join('') : empty('아직 전환기 정보 글 없음 · 화·목 10:00 루틴이 2개씩 발행')}</div></section>` : ''}

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
/* 시트: 상단 고정 헤더(뒤로·제목·닫기) + 휴대폰 뒤로가기/Esc/아래로 끌기로 닫힘 + 뒤 화면 스크롤 잠금 (2026-10-01 UX 점검) */
let sheetOpener = null;
function openSheet(html, title = '') {
  const wasOpen = !!document.querySelector('.sheet');
  const keepScroll = wasOpen ? document.querySelector('.sheet').scrollTop : 0;
  document.querySelectorAll('.sheet-bg,.sheet').forEach(e => e.remove());
  if (!wasOpen) { sheetOpener = document.activeElement; if (!history.state?.sheet) history.pushState({ sheet: 1, tab }, '', '#' + tab); }
  document.documentElement.classList.add('sheet-open');
  document.body.insertAdjacentHTML('beforeend', `<div class="sheet-bg"></div><div class="sheet ${wasOpen ? 'no-anim' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}" tabindex="-1"><div class="sheet-head"><button class="icon-btn sm" data-sheet-close aria-label="뒤로">${I.back}</button><div class="sh-title">${esc(title)}</div><button class="icon-btn sm" data-sheet-close aria-label="닫기">${I.x}</button><div class="grip"></div></div><div class="sheet-body">${html}</div></div>`);
  const sh = $('.sheet'); sh.scrollTop = keepScroll;
  $('.sheet-bg').onclick = () => closeSheet();
  sh.querySelectorAll('[data-sheet-close]').forEach(b => b.onclick = () => closeSheet());
  const head = sh.querySelector('.sheet-head'); let y0 = null, dy = 0;
  head.addEventListener('touchstart', e => { y0 = e.touches[0].clientY; dy = 0; sh.style.transition = 'none'; }, { passive: true });
  head.addEventListener('touchmove', e => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); sh.style.transform = `translateY(${dy}px)`; }, { passive: true });
  head.addEventListener('touchend', () => { sh.style.transition = ''; if (dy > 90) closeSheet(); else sh.style.transform = ''; y0 = null; });
  if (!wasOpen) sh.focus({ preventScroll: true });
}
function closeSheet(fromPop) {
  if (!document.querySelector('.sheet')) return;
  document.querySelectorAll('.sheet-bg,.sheet').forEach(e => e.remove());
  document.documentElement.classList.remove('sheet-open');
  clearTimeout(taskTimer);
  if (!fromPop && history.state?.sheet) history.back();
  if (sheetOpener && sheetOpener.focus) sheetOpener.focus({ preventScroll: true });
  sheetOpener = null;
}
function toast(msg, ms = 2600) { document.querySelectorAll('.toast').forEach(e => e.remove()); document.body.insertAdjacentHTML('beforeend', `<div class="toast">${esc(msg)}</div>`); setTimeout(() => document.querySelectorAll('.toast').forEach(e => e.remove()), ms); }
/* v4 (2026-10-14): 즉시 수집 루틴(이벤트 트리거)은 Aside v2 이전으로 막혔다. 버튼은 '상태·다시 받기' 시트로 바꾸고,
   수집이 꼭 필요하면 작업 요청(다음 처리 시각에 실행)으로 보낸다. */
function refreshSheet() {
  if (refreshing) return;
  const nx = D ? nextAutoRun() : null;
  const alertUrl = `https://ntfy.sh/${CFG.alertTopic}`;
  openSheet(`
    <dl class="kv"><dt>마지막 수집</dt><dd>${D ? esc(D.collectedAtText) + ' (' + ago(D.collectedAt) + ')' : '-'}</dd><dt>자동 수집</dt><dd>매일 ${CFG.collectSlots.join(' · ')}${nx ? ` (다음 ${nx.d} ${nx.t})` : ''}</dd><dt>작업 처리</dt><dd>매일 ${((D && D.taskSlots) || CFG.taskSlots).join(' · ')} (다음 ${esc(nextTaskSlot())})</dd></dl>
    <button class="btn primary" id="doRefetch">최신 데이터 다시 받기</button>
    <button class="btn ghost" id="doCollectTask">수집 요청 보내기 (${esc(nextTaskSlot())}에 실행)</button>
    <div class="h-sec" style="margin-top:18px"><h2>휴대폰 알림</h2></div>
    <p class="hint">문제가 생길 때만 알림이 와요: 수집 실패·로그인 풀림, 예약글 공개 실패, 검색허용 OFF, 루틴 놓침·이상, 미답변 댓글, 조회수 30% 이상 급락, 애드포스트 RPM 절반 이하. ntfy 앱(무료)에서 아래 토픽을 한 번 구독하면 돼요.</p>
    <dl class="kv"><dt>토픽</dt><dd style="overflow-wrap:anywhere">${esc(CFG.alertTopic)}</dd></dl>
    <button class="btn ghost" id="copyTopic">토픽 이름 복사</button>
    <a class="linkbtn" href="${alertUrl}" target="_blank" rel="noopener">브라우저에서 최근 알림 보기</a>`, '상태·알림');
  $('#doRefetch').onclick = async () => { closeSheet(); await load(true); toast(`다시 받았어요 · ${D.collectedAtText} 수집본`); };
  $('#doCollectTask').onclick = () => taskSheet(TASK_PRESETS[4].t);
  $('#copyTopic').onclick = async () => { try { await navigator.clipboard.writeText(CFG.alertTopic); toast('토픽 이름을 복사했어요'); } catch { toast(CFG.alertTopic, 5000); } };
}
async function runRefresh(pin) {
  refreshing = true;
  const startedAt = D?.collectedAt;
  const steps = ['PC에 신호 보내기', 'Aside가 네이버 데이터 수집', 'GitHub Pages 반영', '앱에 새 데이터 표시'];
  const paint = (idx, fail) => openSheet(`<p>${fail ? esc(fail) : '창을 닫아도 계속 진행돼요. 완료되면 알려드릴게요.'}</p><ol class="steps">${steps.map((s, i) => `<li class="${fail && i === idx ? 'fail' : i < idx ? 'done' : i === idx ? 'doing' : ''}"><span class="st">${i < idx ? I.check : (fail && i === idx) ? I.x : i === idx ? I.sync : i + 1}</span>${s}</li>`).join('')}</ol>${fail ? '<button class="btn ghost" data-close-btn>닫기</button>' : '<button class="btn ghost" data-close-btn>백그라운드로</button>'}`, '최신화 진행 중');
  const wire = () => { const b = $('[data-close-btn]'); if (b) b.onclick = () => closeSheet(); };
  paint(0); wire();
  $('#refreshBtn').classList.add('spin');
  try {
    const rid = newId(); const r = await fetch(`https://ntfy.sh/${CFG.ntfyTopic}`, { method: 'POST', body: `refresh #${rid} ${await sig16(pin, rid)}`, headers: { Title: 'gomong refresh', Tags: 'arrows_counterclockwise', Priority: 'high' } });
    if (!r.ok) throw new Error('ntfy ' + r.status);
  } catch (e) { paint(0, '신호를 못 보냈어요. 네트워크를 확인해 주세요. (' + e.message + ')'); wire(); refreshing = false; $('#refreshBtn').classList.remove('spin'); return; }
  paint(1); wire();
  const t0 = Date.now();
  let seenPages = false;
  while (Date.now() - t0 < CFG.pollMaxMs) {
    await new Promise(r => setTimeout(r, CFG.pollMs));
    try {
      const { d, h, s, t } = await fetchData(true); if (t) T = t;
      if (s && !s.loginOk && new Date(s.at).getTime() > t0 - 60000) {
        S = s; render(false);
        paint(1, s.preflight === 'NAVER_LOGIN_REQUIRED' ? 'PC의 네이버 로그인이 풀려 수집을 못 했어요. PC에서 다시 로그인해 주세요.' : 'PC 브라우저 연결이 실패했어요. 브라우저를 재시작해 주세요.'); wire(); refreshing = false; $('#refreshBtn').classList.remove('spin'); return;
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


/* ---------- Aside 작업 보내기 (v3.1, 2026-09-20) ----------
   앱 → ntfy 토픽 "task #<id> <sig>\n내용" (sig = sha256(pin:id) 앞 16자, PIN 평문 전송 안 함)
   → Aside 이벤트 루틴이 ntfy JSON으로 전문을 읽고 실행 → 결과 토픽(resultTopic)에 "result #<id> <status>\n요약" + data/tasks.json */
const TASK_PRESETS = [
  { l: '예약글 점검', t: '예약글 큐와 CSV 상태를 대조해서 불일치·검색허용 OFF·v5 미적용이 있으면 고치고 결과 보고' },
  { l: '미답변 댓글', t: '미답변 댓글을 확인해서 고몽이 톤으로 답글을 달고 어떤 댓글에 뭐라고 답했는지 보고' },
  { l: '확장 키워드 새 글', t: '키워드 지도(keyword_map_latest.json)에서 AI 브리핑이 있고 아직 안 쓴 확장 키워드 1개를 골라 신규 글 1개를 작성해 다음 빈 예약 슬롯에 예약 발행하고 키워드·제목·시각·URL 보고. 기존 글과 검색 의도가 겹치면 제외' },
  { l: '모바일 순위 점검', t: 'tools/mobile_rank.js 로 공개 글 주키워드의 모바일 통합검색 순위를 지금 조회해서 지난 측정 대비 변화 보고 (모바일순위_history.json 에 기록)' },
  { l: '대시보드 갱신', t: '대시보드 데이터만 다시 수집해서 push' },
  { l: '새 글 1개', t: 'SPEC v4.1로 신규 글 1개를 작성해 다음 빈 예약 슬롯(하루 3개 기준)에 예약 발행하고 제목·시각·URL 보고. 주제는 자동완성·AI 브리핑 근거로 고르고 포켓몬 80% 비중 유지' },
];
const STATUS_CLS = { '대기': 'st-wait', '진행중': 'st-run', '완료': 'st-done', '보류': 'st-hold', '실패': 'st-fail', '거부': 'st-fail' };
const stBadge = (s) => `<span class="badge ${STATUS_CLS[s] || 'st-wait'}">${s === '진행중' ? I.sync : s === '완료' ? I.check : (s === '실패' || s === '거부') ? I.x : s === '보류' ? I.alert : I.clock} ${esc(s || '대기')}</span>`;
const newId = () => Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 5);
async function sig16(pin, id) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${pin}:${id}`)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('').slice(0, 16); }
/* 상태 우선순위: 더 진행된 상태가 이긴다(오래된 캐시·알림 순서가 뒤섞여도 '완료'가 '대기'로 되돌아가지 않게) */
const ST_RANK = { '대기': 0, '진행중': 1, '보류': 2, '실패': 2, '거부': 2, '완료': 2 };
const stWins = (oldS, oldAt, newS, newAt) => { const a = ST_RANK[oldS] ?? -1, b = ST_RANK[newS] ?? -1; return b > a || (b === a && (!oldAt || (newAt && newAt >= oldAt))); };
function mergedTasks() {
  // tasks.json(영구) + ntfy 실시간(내가 보낸 task, Aside의 result) + 로컬 보낸 기록
  const local = JSON.parse(localStorage.getItem('sentTasks') || '[]');
  const map = new Map();
  for (const l of local) map.set(l.id, { id: l.id, text: l.text, at: l.at, atText: l.atText, status: '대기' });
  for (const m of TL) {
    if (m.kind === 'task') { const o = map.get(m.id) || { id: m.id, at: m.at, atText: m.atText, status: '대기' }; o.text = o.text || m.text; map.set(m.id, o); }
    if (m.kind === 'result') { const o = map.get(m.id) || { id: m.id, at: m.at, atText: m.atText, text: '(내용 없음)' }; if (stWins(o.status, o.doneAt, m.status, m.at)) { o.status = m.status; o.result = m.text; o.doneAt = m.at; o.doneAtText = m.atText; } map.set(m.id, o); }
  }
  for (const t of T) { const o = map.get(t.id) || { id: t.id }; const newer = stWins(o.status, o.doneAt, t.status, t.doneAt || t.startedAt || t.queuedAt); Object.assign(o, { text: t.text || o.text, at: t.at || o.at, atText: t.atText || o.atText }); if (newer && t.status) { o.status = t.status; o.result = t.result ?? o.result; o.doneAt = t.doneAt || o.doneAt; o.doneAtText = t.doneAtText || o.doneAtText; } map.set(t.id, o); }
  return [...map.values()].filter(x => x.text).sort((a, b) => (b.at || '').localeCompare(a.at || ''));
}
async function pollTaskLog(paint = true) {
  try {
    const [a, b] = await Promise.all([
      fetch(`https://ntfy.sh/${CFG.ntfyTopic}/json?poll=1&since=12h`).then(r => r.text()),
      fetch(`https://ntfy.sh/${CFG.resultTopic}/json?poll=1&since=12h`).then(r => r.text()),
    ]);
    const parse = (txt) => txt.split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(m => m && m.event === 'message');
    const out = [];
    for (const m of parse(a)) { const h = String(m.message || '').match(/^task #([A-Za-z0-9_-]{4,20}) [0-9a-f]{16}[ \n]?([\s\S]*)$/); if (h) out.push({ kind: 'task', id: h[1], text: h[2].trim(), at: new Date(m.time * 1000).toISOString(), atText: fmtK(m.time * 1000) }); }
    for (const m of parse(b)) { const h = String(m.message || '').match(/^result #([A-Za-z0-9_-]{4,20}) (\S+)[ \n]?([\s\S]*)$/); if (h) out.push({ kind: 'result', id: h[1], status: h[2], text: h[3].trim(), at: new Date(m.time * 1000).toISOString(), atText: fmtK(m.time * 1000) }); }
    TL = out;
  } catch {}
  const running = mergedTasks().some(x => x.status === '진행중' || x.status === '대기');
  const dot = $('#taskDot'); if (dot) dot.hidden = !running;
  if (paint && document.querySelector('.tasklog')) { $('.tasklog').outerHTML = taskLogHtml(); wireTaskLog(); }
  if (running && document.querySelector('.tasklog')) { clearTimeout(taskTimer); taskTimer = setTimeout(pollTaskLog, CFG.taskPollMs); }
}
let taskTimer = null;
const fmtK = (ms) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
let taskLogAll = false;
function taskLogHtml() {
  const all = mergedTasks(); const m = taskLogAll ? all.slice(0, 30) : all.slice(0, 5);
  return `<ul class="tasklog">${m.length ? m.map(x => `<li><div class="tl-meta">${stBadge(x.status)}<span>${esc((x.atText || '').slice(5, 16))}</span>${x.doneAtText ? `<span>→ ${esc(x.doneAtText.slice(11, 16))}</span>` : (!x.status || x.status === '대기') ? `<span>다음 처리 ${esc(nextTaskSlot())}</span>` : ''}</div><div class="tl-text">${esc(x.text)}</div>${x.result ? `<div class="tl-res clamp" role="button" tabindex="0" title="눌러서 펼치기">${esc(x.result)}</div>` : ''}</li>`).join('') : `<li><div class="empty">${I.inbox}<span>아직 보낸 작업이 없어요</span></div></li>`}${all.length > 5 ? `<li class="tl-more-li"><button class="more" data-tl-more>${taskLogAll ? '최근 5개만 보기' : `이전 기록 ${Math.min(all.length, 30) - 5}개 더보기`}</button></li>` : ''}</ul>`;
}
function wireTaskLog() {
  document.querySelectorAll('.tasklog .tl-res').forEach(el => { const t = () => el.classList.toggle('clamp'); el.onclick = t; el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); t(); } }; });
  const mb = $('[data-tl-more]'); if (mb) mb.onclick = () => { taskLogAll = !taskLogAll; $('.tasklog').outerHTML = taskLogHtml(); wireTaskLog(); };
}
function taskSheet(prefill) {
  if (typeof prefill !== 'string') prefill = '';
  const pin = localStorage.getItem('refreshPin');
  openSheet(`
    <p>PC의 Aside가 블로그 운영 규칙(gomong-blog 스킬) 안에서 실행하고 결과를 여기로 돌려줘요. 예약글 수정·글 삭제·다른 카페 활동 같은 금지 작업은 "보류"로 되묻습니다.</p>
    <div class="chips wrap" id="taskPresets">${TASK_PRESETS.map((p, i) => `<button class="chip" data-preset="${i}">${esc(p.l)}</button>`).join('')}</div>
    <textarea id="taskText" placeholder="할 일을 적어 주세요. 예) 키워드 '다이소 탑로더'로 새 글 1개 예약해줘" maxlength="1500">${esc(prefill)}</textarea>
    ${pin ? '' : `<input id="pinInput" class="pin-inline" inputmode="numeric" maxlength="6" placeholder="PIN 6자리 (처음 한 번)" autocomplete="off">`}
    <p class="hint">작업은 하루 4번(${((D && D.taskSlots) || CFG.taskSlots).join(' · ')}) 모아서 처리해요. 지금 보내면 <b>${esc(nextTaskSlot())}</b>에 시작해요. PIN은 전송되지 않고 서명(sha256)만 붙어요.${pin ? ' <button class="linkbtn" id="resetPin">PIN 다시 입력</button>' : ''}</p>
    <button class="btn primary" id="doTask">${I.send} 보내기</button>
    <div class="h-sec" style="margin-top:16px"><h2>작업 로그</h2><span class="meta">최근 12시간 + 기록</span></div>
    ${taskLogHtml()}`, 'Aside에 작업 보내기');
  const rp = $('#resetPin'); if (rp) rp.onclick = () => { localStorage.removeItem('refreshPin'); toast('PIN을 지웠어요. 다시 입력해 주세요'); taskSheet(); };
  wireTaskLog();
  document.querySelectorAll('#taskPresets .chip').forEach(b => b.onclick = () => { $('#taskText').value = TASK_PRESETS[b.dataset.preset].t; document.querySelectorAll('#taskPresets .chip').forEach(x => x.setAttribute('aria-pressed', x === b)); $('#taskText').focus(); });
  $('#doTask').onclick = async () => {
    const text = ($('#taskText').value || '').trim();
    if (text.length < 4) { toast('작업 내용을 조금 더 적어 주세요'); return; }
    let p = pin || ($('#pinInput')?.value || '').trim();
    if (!/^\d{6}$/.test(p)) { toast('PIN 6자리를 입력해 주세요'); return; }
    localStorage.setItem('refreshPin', p);
    const id = newId(); const s = await sig16(p, id);
    $('#doTask').disabled = true;
    try {
      const r = await fetch(`https://ntfy.sh/${CFG.ntfyTopic}`, { method: 'POST', body: `task #${id} ${s}\n${text}`, headers: { Title: 'gomong task', Tags: 'clipboard', Priority: 'high' } });
      if (!r.ok) throw new Error('ntfy ' + r.status);
      const local = JSON.parse(localStorage.getItem('sentTasks') || '[]'); local.push({ id, text, at: new Date().toISOString(), atText: fmtK(Date.now()) }); localStorage.setItem('sentTasks', JSON.stringify(local.slice(-50)));
      $('#taskText').value = ''; toast(`접수했어요. ${nextTaskSlot()}에 처리해요`, 3200);
      $('.tasklog').outerHTML = taskLogHtml(); wireTaskLog(); pollTaskLog();
    } catch (e) { toast('전송 실패: ' + e.message, 4000); }
    $('#doTask').disabled = false;
  };
  pollTaskLog();
}

/* ---------- events ---------- */
function bind() {
  view.querySelectorAll('[data-goto-posts]').forEach(b => b.onclick = () => { filters.status = b.dataset.gotoPosts; filters.game = '전체'; goTab('posts'); });
  view.querySelectorAll('[data-req]').forEach(b => b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); taskSheet(REQ[Number(b.dataset.req)] || ''); });
  view.querySelectorAll('[data-open-tasks]').forEach(el => { el.onclick = taskSheet; el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); taskSheet(); } }; });
  document.querySelectorAll('[data-goto]').forEach(el => { const go = () => goTab(el.dataset.goto); el.onclick = go; el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }; });
  view.querySelectorAll('.chip').forEach(b => b.onclick = () => { filters[b.dataset.f] = b.dataset.v; render(false); });
  view.querySelectorAll('[data-day]').forEach(b => b.onclick = () => { statDay = b.dataset.day; render(false); });
  view.querySelectorAll('[data-perf]').forEach(b => b.onclick = () => { perfView = b.dataset.perf; render(false); });
  view.querySelectorAll('[data-more]').forEach(b => b.onclick = () => { expand[b.dataset.more] = !expand[b.dataset.more]; render(false); });
  view.querySelectorAll('[data-mr-help]').forEach(b => b.onclick = () => { const h = b.closest('.card').querySelector('.mr-help'); h.hidden = !h.hidden; b.textContent = h.hidden ? '기준 보기' : '기준 닫기'; });
}
/* 탭 이동과 휴대폰 뒤로가기: 홈이 아닌 탭에서 뒤로 → 홈, 홈에서 뒤로 → 앱 종료. 같은 탭을 다시 누르면 맨 위로 */
function goTab(next) {
  if (next === tab) { window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }); return; }
  if (next === 'home') { if (history.state?.tab && history.state.tab !== 'home' && !history.state.sheet) { history.back(); return; } tab = 'home'; history.replaceState({ tab }, '', '#home'); }
  else { tab = next; if ((history.state?.tab || 'home') === 'home') history.pushState({ tab }, '', '#' + tab); else history.replaceState({ tab }, '', '#' + tab); }
  expand = {}; render(true);
}
window.addEventListener('popstate', e => {
  const st = e.state || { tab: 'home' };
  if (document.querySelector('.sheet') && !st.sheet) closeSheet(true);
  const next = st.tab || 'home';
  if (next !== tab) { tab = next; expand = {}; render(true); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.querySelector('.sheet')) closeSheet(); });
(() => { const h = location.hash.slice(1); const valid = ['home', 'queue', 'posts', 'comments', 'stats', 'cafe']; history.replaceState({ tab: 'home' }, '', '#home'); if (valid.includes(h) && h !== 'home') { tab = h; history.pushState({ tab }, '', '#' + h); } })();
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => goTab(b.dataset.tab));
$('#refreshBtn').onclick = refreshSheet;
$('#taskBtn').onclick = taskSheet;
setInterval(() => { if (D) pollTaskLog(false); }, 60000);
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
