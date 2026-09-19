/* 고몽이 TCG 센터 관제 PWA - 읽기 전용. data/dashboard.json + data/history/index.json 만 읽는다. */
const $ = (s, el = document) => el.querySelector(s);
const view = $('#view');
let D = null, H = [], tab = 'home', filters = { game: '전체', status: '전체' }, statDay = 'today';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const n = (v) => (v == null ? '-' : Number(v).toLocaleString('ko-KR'));
const kstNow = () => new Date();
const ago = (iso) => { if (!iso) return ''; const m = Math.round((Date.now() - new Date(iso)) / 60000); if (m < 1) return '방금'; if (m < 60) return `${m}분 전`; const h = Math.floor(m / 60); if (h < 24) return `${h}시간 ${m % 60}분 전`; return `${Math.floor(h / 24)}일 전`; };
const todayStr = () => { const d = new Date(Date.now() + 9 * 3600e3); return d.toISOString().slice(0, 10); };
const shortT = (s) => (s || '').replace(/(\d{4})-(\d{2})-(\d{2})/, (_, y, m, d) => `${Number(m)}/${Number(d)}`);
const dayLabel = (ymd) => { const d = new Date(ymd + 'T00:00:00+09:00'); return `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))} (${'일월화수목금토'[d.getDay()]})`; };
const gameBadge = (g) => g ? `<span class="badge game-${esc(g)}">${esc(g)}</span>` : '<span class="badge">미분류</span>';
const postLink = (p) => p.url || `https://blog.naver.com/gold_ggu/${p.logNo}`;
const cmtLink = (logNo) => `https://m.blog.naver.com/PostView.naver?blogId=gold_ggu&logNo=${logNo}&modal=comment`;

async function load(force) {
  const btn = $('#refreshBtn'); btn.classList.add('spin');
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
    if (!D) { view.innerHTML = `<div class="err">데이터를 불러오지 못했어요. ${esc(e.message)}</div>`; btn.classList.remove('spin'); return; }
  }
  btn.classList.remove('spin');
  render();
}

function render() {
  if (!D) return;
  $('#updated').textContent = `갱신 ${D.collectedAtText || ''} (${ago(D.collectedAt)})`;
  $('#cmtDot').hidden = !(D.summary?.unansweredComments > 0);
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  const fn = { home, queue, posts, comments, stats }[tab];
  view.innerHTML = fn();
  view.scrollTop = 0; window.scrollTo(0, 0);
  bind();
}

function staleBanner() {
  const h = (Date.now() - new Date(D.collectedAt)) / 3600e3;
  return h > 14 ? `<div class="stale">마지막 수집이 ${ago(D.collectedAt)}입니다. PC의 Aside 크론이 멈춰 있을 수 있어요.</div>` : '';
}
function errBanner() { return D.errors?.length ? `<div class="err">수집 오류 ${D.errors.length}건: ${esc(D.errors.join(' / '))}</div>` : ''; }

/* ---------- 홈 ---------- */
function home() {
  const s = D.summary, t = todayStr();
  const yd = s.yesterdayCv, dbf = D.stats?.dailyCv?.[2]?.total; // 어제 vs 그제
  const delta = (yd != null && dbf != null) ? yd - dbf : null;
  const prev = H.length >= 2 ? H[H.length - 2] : null;
  const citDelta = prev?.citations?.cumulative != null ? s.citations.cumulative - prev.citations.cumulative : null;
  const todayQ = D.queue.filter(q => q.postDateText.startsWith(t));
  const todayPub = D.posts.filter(p => p.status === '공개' && (p.publishedText || '').startsWith(t));
  const todayCards = [...todayPub.map(p => ({ time: (p.publishedText || '').slice(11, 16) || '--:--', title: p.title, no: p.no, game: p.game, state: p.searchYn === false ? ['danger', '검색허용 OFF'] : (p.v5 === false ? ['warn', '발행됨 · v5 대기'] : ['ok', '발행됨 · 검색OK · v5']), url: postLink(p) })),
    ...todayQ.map(q => { const p = D.posts.find(x => x.logNo === q.logNo) || {}; return { time: q.postDateText.slice(11, 16), title: q.title, no: p.no, game: p.game, state: ['info', '예약 대기'], url: `https://blog.naver.com/gold_ggu/${q.logNo}` }; })].sort((a, b) => a.time.localeCompare(b.time));
  const alerts = D.alerts || [];
  const order = { danger: 0, warn: 1, info: 2 };
  alerts.sort((a, b) => order[a.level] - order[b.level]);
  return `${staleBanner()}${errBanner()}
  <div class="kpis">
    <div class="kpi accent"><div class="v">${n(s.todayCv)}</div><div class="l">오늘 조회수</div><div class="d">${s.todayVisitor != null ? `방문자 ${n(s.todayVisitor)}` : ''}</div></div>
    <div class="kpi"><div class="v">${n(yd)}</div><div class="l">어제 조회수</div><div class="d ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}">${delta == null ? '' : (delta > 0 ? '+' : '') + n(delta)}</div></div>
    <div class="kpi accent"><div class="v">${n(s.citations.cumulative)}</div><div class="l">AI 브리핑 인용 누적</div><div class="d ${citDelta > 0 ? 'up' : ''}">${citDelta == null ? `${s.citations.currentMonth}월 ${n(s.citations.month)}` : (citDelta >= 0 ? '+' : '') + n(citDelta) + ' (전 수집 대비)'}</div></div>
    <div class="kpi"><div class="v ${s.unansweredComments ? 'down' : ''}">${n(s.unansweredComments)}</div><div class="l">미답변 댓글</div><div class="d">전체 ${n(s.totalComments)}</div></div>
    <div class="kpi"><div class="v">${n(s.publicCount)}<span style="font-size:13px;color:var(--muted)"> / ${n(s.queueCount)}</span></div><div class="l">공개 / 예약</div><div class="d">총 ${n(s.totalCount)}개</div></div>
    <div class="kpi"><div class="v">${n(s.buddyCount)}</div><div class="l">이웃</div><div class="d">누적 조회 ${n(s.totalReadCount)}</div></div>
  </div>

  <div class="section-title">오늘 발행 일정 <small>${dayLabel(t)}</small></div>
  <div class="card compact">${todayCards.length ? todayCards.map(c => `
    <a class="row" href="${c.url}" target="_blank" rel="noopener">
      <div class="time">${c.time}</div>
      <div class="main"><div class="t">${c.no ? `#${c.no} ` : ''}${esc(c.title)}</div><div class="m">${gameBadge(c.game)}<span class="badge ${c.state[0]}">${c.state[1]}</span></div></div>
    </a>`).join('') : '<div class="empty">오늘 예약·발행 글 없음</div>'}</div>

  <div class="section-title">할 일 <small>${alerts.length}건</small></div>
  <div class="card compact">${alerts.length ? alerts.map(a => `<div class="alert ${a.level}"><span class="lv"></span><div>${a.logNo ? `<a href="https://blog.naver.com/gold_ggu/${a.logNo}" target="_blank" rel="noopener">${esc(a.text)}</a>` : esc(a.text)}</div></div>`).join('') : '<div class="empty">처리할 항목 없음</div>'}</div>

  <div class="section-title">다음 루틴</div>
  <div class="card compact">${(D.routines || []).slice().sort((a, b) => (a.nextRunAt || '').localeCompare(b.nextRunAt || '')).map(r => `
    <div class="row"><div class="main"><div class="t" style="font-weight:600">${esc(r.name)}</div><div class="m"><span class="badge ${r.state === 'active' ? 'ok' : ''}">${r.kind}</span><span>${r.nextRunAt ? '다음 ' + fmtIso(r.nextRunAt) : ''}</span></div></div></div>`).join('') || '<div class="empty">루틴 정보 없음</div>'}</div>`;
}
function fmtIso(iso) { const d = new Date(iso); const k = new Date(d.getTime() + 9 * 3600e3); return `${Number(k.toISOString().slice(5, 7))}/${Number(k.toISOString().slice(8, 10))} ${k.toISOString().slice(11, 16)}`; }

/* ---------- 예약 큐 ---------- */
function queue() {
  const t = todayStr();
  const byDay = {};
  for (const q of D.queue) (byDay[q.postDateText.slice(0, 10)] ||= []).push(q);
  const days = Object.keys(byDay).sort();
  const games = D.games?.count || {}, target = D.games?.target || {};
  const total = Object.values(games).reduce((a, b) => a + b, 0) || 1;
  const colors = { '포켓몬': '#c8102e', '리프트바운드': '#4338ca', '원피스': '#0369a1', '용품·공통': '#3f6212', '미분류': '#999' };
  return `${staleBanner()}
  <div class="section-title">게임 비중 <small>전체 ${total}개 · 목표 40/25/15/20</small></div>
  <div class="card">
    <div class="bar-wrap">${Object.entries(games).map(([g, c]) => `<span style="width:${c / total * 100}%;background:${colors[g] || '#999'}"></span>`).join('')}</div>
    <div class="legend">${Object.entries(games).map(([g, c]) => `<span><i style="background:${colors[g] || '#999'}"></i>${esc(g)} ${c}개 (${Math.round(c / total * 100)}% / 목표 ${target[g] ?? '-'}%)</span>`).join('')}</div>
  </div>
  <div class="section-title">예약 큐 <small>${D.queue.length}건</small></div>
  ${days.length ? days.map(d => `<div class="day"><div class="dh ${d === t ? 'today' : ''}"><span>${dayLabel(d)}</span><span>${byDay[d].length}건${byDay[d].length > 3 ? ' · 초과' : ''}</span></div><div class="card compact">${byDay[d].map(q => { const p = D.posts.find(x => x.logNo === q.logNo) || {}; return `
    <a class="row" href="https://blog.naver.com/gold_ggu/${q.logNo}" target="_blank" rel="noopener"><div class="time">${q.postDateText.slice(11, 16)}</div><div class="main"><div class="t">${p.no ? `#${p.no} ` : ''}${esc(q.title)}</div><div class="m">${gameBadge(p.game)}<span>${esc(p.category || '')}</span></div></div></a>`; }).join('')}</div></div>`).join('') : '<div class="card"><div class="empty">예약된 글이 없습니다. 수요일 루틴이 채웁니다.</div></div>'}`;
}

/* ---------- 글 목록 ---------- */
function posts() {
  const gamesAll = ['전체', ...new Set(D.posts.map(p => p.game).filter(Boolean))];
  const statusAll = ['전체', '공개', '예약', '문제있음', 'AI인용'];
  let list = D.posts.slice().sort((a, b) => (b.no || 0) - (a.no || 0));
  if (filters.game !== '전체') list = list.filter(p => p.game === filters.game);
  if (filters.status === '공개' || filters.status === '예약') list = list.filter(p => p.status === filters.status);
  if (filters.status === '문제있음') list = list.filter(p => p.status === '공개' && (p.searchYn === false || p.v5 === false || p.relatedLinksPending || p.unanswered > 0 || (p.priceUpdate && p.priceUpdate.due <= todayStr())));
  if (filters.status === 'AI인용') list = list.filter(p => p.aiCited);
  return `
  <div class="chips">${gamesAll.map(g => `<button class="chip ${filters.game === g ? 'active' : ''}" data-f="game" data-v="${esc(g)}">${esc(g)}</button>`).join('')}</div>
  <div class="chips">${statusAll.map(s => `<button class="chip ${filters.status === s ? 'active' : ''}" data-f="status" data-v="${esc(s)}">${esc(s)}</button>`).join('')}</div>
  <div class="section-title">글 ${list.length}개 <small>조회수는 네이버 글 목록 기준</small></div>
  <div class="card compact">${list.map(p => `
    <a class="row" href="${postLink(p)}" target="_blank" rel="noopener">
      <div class="num">#${p.no ?? '?'}</div>
      <div class="main"><div class="t">${esc(p.title)}</div>
        <div class="m">${gameBadge(p.game)}<span>${esc(shortT(p.publishedText || ''))}</span>
          ${p.status === '예약' ? '<span class="badge info">예약</span>' : `<span>조회 ${n(p.readCount)}</span><span>댓글 ${n(p.commentCount)}${p.unanswered ? ` <b style="color:var(--danger)">(${p.unanswered} 미답변)</b>` : ''}</span>`}
          ${p.status === '공개' && p.searchYn === false ? '<span class="badge danger">검색 OFF</span>' : ''}
          ${p.status === '공개' && p.v5 === false ? '<span class="badge warn">v5 미적용</span>' : ''}
          ${p.relatedLinksPending ? '<span class="badge info">링크 보강</span>' : ''}
          ${p.priceUpdate ? `<span class="badge ${p.priceUpdate.due <= todayStr() ? 'warn' : ''}">시세 ${shortT(p.priceUpdate.due)}</span>` : ''}
          ${p.aiCited ? '<span class="badge ok">AI 인용</span>' : ''}
          ${p.rank ? `<span class="badge">${esc(p.rank.keyword || '')} ${p.rank.searchRank ? '통검 ' + p.rank.searchRank + '위' : ''}${p.rank.blogRank ? ' 블탭 ' + p.rank.blogRank + '위' : ''}</span>` : ''}
        </div></div>
    </a>`).join('') || '<div class="empty">조건에 맞는 글 없음</div>'}</div>`;
}

/* ---------- 댓글 ---------- */
function comments() {
  const list = (D.comments || []).filter(c => !c.deleted);
  const un = list.filter(c => c.unanswered);
  const title = (logNo) => { const p = D.posts.find(x => x.logNo === logNo); return p ? `#${p.no ?? '?'} ${p.title}` : logNo; };
  const item = (c) => `<a class="row" href="${cmtLink(c.logNo)}" target="_blank" rel="noopener">
      <div class="main"><div class="t" style="font-weight:${c.mine ? 400 : 600};color:${c.mine ? 'var(--muted)' : 'inherit'}">${c.replyLevel > 1 ? '↳ ' : ''}${esc(c.userName)}${c.mine ? ' (나)' : ''}: ${esc(c.contents)}${c.secret ? ' <span class="badge">비밀</span>' : ''}</div>
      <div class="m"><span>${esc((c.regTime || '').slice(5, 16).replace('T', ' '))}</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:60vw">${esc(title(c.logNo))}</span>${c.unanswered ? '<span class="badge danger">미답변</span>' : ''}</div></div></a>`;
  return `${staleBanner()}
  <div class="section-title">미답변 <small>${un.length}건 · 탭하면 네이버 댓글창</small></div>
  <div class="card compact">${un.length ? un.map(item).join('') : '<div class="empty">미답변 댓글 없음</div>'}</div>
  <div class="section-title">최근 댓글 <small>${list.length}건</small></div>
  <div class="card compact">${list.length ? list.map(item).join('') : '<div class="empty">댓글 없음</div>'}</div>`;
}

/* ---------- 성과 ---------- */
function barChart(rows, key, label) {
  const w = 340, h = 140, padL = 6, padB = 22, padT = 16;
  const data = rows.slice().reverse();
  const max = Math.max(1, ...data.map(r => r[key] || 0));
  const bw = (w - padL * 2) / data.length;
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${data.map((r, i) => { const v = r[key] || 0; const bh = (h - padB - padT) * v / max; const x = padL + i * bw + 2; const y = h - padB - bh; return `<rect x="${x}" y="${y}" width="${bw - 4}" height="${bh}" rx="2" class="${i === data.length - 1 ? 'last' : ''}"></rect>${v ? `<text class="v" x="${x + (bw - 4) / 2}" y="${y - 3}" text-anchor="middle">${v}</text>` : ''}<text x="${x + (bw - 4) / 2}" y="${h - 8}" text-anchor="middle">${Number(label(r).slice(-2))}</text>`; }).join('')}</svg>`;
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
  const hb = (rows, nameKey, valKey, pctKey) => { const max = Math.max(1, ...rows.map(r => r[valKey] || 0)); return rows.map(r => `<div class="hbar"><div class="n">${esc(r[nameKey])}</div><div class="b"><span style="width:${(r[valKey] || 0) / max * 100}%"></span></div><div class="p">${n(r[valKey])}${pctKey && r[pctKey] != null ? ` · ${r[pctKey]}%` : ''}</div></div>`).join('') || '<div class="empty">데이터 없음</div>'; };
  return `${staleBanner()}
  <div class="section-title">일별 조회수 <small>최근 15일 · 어제 ${n(daily[1]?.total)} / 그제 ${n(daily[2]?.total)}</small></div>
  <div class="card">${daily.length ? barChart(daily, 'total', r => r.date) : '<div class="empty">데이터 없음</div>'}</div>

  <div class="section-title">AI 브리핑 인용수 <small>누적 ${n(D.summary.citations.cumulative)} · ${D.summary.citations.currentMonth}월 ${n(D.summary.citations.month)} · 메이트 선정 기준(${D.summary.citations.selectionPeriodMonth}월) ${n(D.summary.citations.selectionPeriod)}</small></div>
  <div class="card">${cits.length >= 2 ? barChart(cits.slice(-15).reverse(), 'c', r => r.date) : `<div class="empty">추세는 수집이 2일 이상 쌓이면 표시됩니다 (현재 ${cits.length}일)</div>`}</div>

  <div class="section-title"><span>유입 · 검색어</span><span class="seg"><button data-day="today" class="${statDay === 'today' ? 'active' : ''}">오늘</button><button data-day="yesterday" class="${statDay === 'yesterday' ? 'active' : ''}">어제</button></span></div>
  <div class="card"><h3>유입경로 <small style="color:var(--muted);font-weight:400">${esc(day?.date || '')}</small></h3>${hb(day?.referer || [], 'name', 'cv', 'pct')}</div>
  <div class="card"><h3>검색 유입 키워드</h3>${hb((day?.searchQueries || []).slice(0, 20), 'query', 'cv', null)}</div>
  <div class="card"><h3>글별 조회수 순위</h3>${(day?.rankCv || []).map(r => { const p = D.posts.find(x => x.logNo === r.logNo); return `<a class="row" href="https://blog.naver.com/gold_ggu/${r.logNo}" target="_blank" rel="noopener"><div class="num">${r.rank}</div><div class="main"><div class="t" style="font-weight:500">${p?.no ? `#${p.no} ` : ''}${esc(r.title)}</div></div><div class="num">${n(r.cv)}</div></a>`; }).join('') || '<div class="empty">데이터 없음</div>'}</div>

  <div class="section-title">키워드 노출순위 <small>${latestDate ? latestDate + ' 기준' : '월요일 루틴이 첫 기록을 남기면 표시'}</small></div>
  <div class="card compact">${latest.length ? latest.sort((a, b) => (a.searchRank || 99) - (b.searchRank || 99)).map(r => { const pv = prevMap[r.keyword + '|' + r.logNo]; const d = pv?.searchRank && r.searchRank ? pv.searchRank - r.searchRank : null; const p = D.posts.find(x => x.logNo === String(r.logNo)); return `<div class="row"><div class="main"><div class="t" style="font-weight:600">${esc(r.keyword)}</div><div class="m">${p ? `#${p.no}` : ''} 통검 ${r.searchRank ?? '-'}위 · 블로그탭 ${r.blogRank ?? '-'}위</div></div><div class="num ${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d == null ? '' : (d > 0 ? '▲' + d : d < 0 ? '▼' + (-d) : '-')}</div></div>`; }).join('') : '<div class="empty">아직 기록 없음</div>'}</div>

  <div class="section-title">AI 브리핑 인용 확인된 쿼리 <small>${(D.aiCited || []).length}건</small></div>
  <div class="card compact">${(D.aiCited || []).map(c => `<a class="row" href="https://blog.naver.com/gold_ggu/${c.logNo}" target="_blank" rel="noopener"><div class="main"><div class="t" style="font-weight:600">${esc(c.query)}</div><div class="m"><span>#${c.no}</span><span>${esc(c.type || '')}</span><span>${esc(c.date)}</span></div></div></a>`).join('') || '<div class="empty">기록 없음</div>'}</div>`;
}

/* ---------- 이벤트 ---------- */
function bind() {
  view.querySelectorAll('.chip').forEach(b => b.onclick = () => { filters[b.dataset.f] = b.dataset.v; render(); });
  view.querySelectorAll('[data-day]').forEach(b => b.onclick = () => { statDay = b.dataset.day; render(); });
}
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { tab = b.dataset.tab; render(); });
$('#refreshBtn').onclick = () => load(true);
document.addEventListener('visibilitychange', () => { if (!document.hidden && D && Date.now() - new Date(D.collectedAt) > 20 * 60e3) load(true); });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
load(false);
