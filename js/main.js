/* 화면 전환, 보관함, 순위표, 게임 루프 */
(function () {
  const G = window.G;
  const $ = (s) => document.querySelector(s);
  const cv = $('#cv'), ctx = cv.getContext('2d');

  const app = {
    section: null, tab: 'new', color: G.COLORS[0], rankMetric: 0, square: false,
    scene: null, crafts: G.store.get('crafts2', []), name: G.store.get('name', ''), pending: null,
  };
  const playerName = () => (app.name || '').trim() || '이름 없는 선수';
  const saveCrafts = () => G.store.set('crafts2', app.crafts);
  const fmt = (v, m) => v.toFixed(m.digits) + ' ' + m.unit;
  const bars = (list) => list.map((b) => `<div class="stat">${b.label}<i><b style="width:${Math.round(b.v * 100)}%"></b></i></div>`).join('');

  function leaveScene() {
    if (app.scene && app.scene.stop) app.scene.stop();
    app.scene = null;
  }
  function showScreen(id) {
    ['home', 'section', 'stage'].forEach((s) => ($('#' + s).hidden = s !== id));
    if (id !== 'stage') leaveScene();
    window.scrollTo(0, 0);
  }

  // 접힌 모양 썸네일
  function paintThumbs(root) {
    root.querySelectorAll('canvas[data-shape]').forEach((c) => {
      const shape = c.dataset.shape === 'guide' ? G.fold.guideShape(G.findModel(c.dataset.s, c.dataset.m)) : (app.crafts.find((k) => k.id === c.dataset.shape) || {}).shape;
      if (!shape) return;
      const r = window.devicePixelRatio || 1, w = c.clientWidth || 110, h = c.clientHeight || 80;
      c.width = w * r; c.height = h * r;
      const x = c.getContext('2d');
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      shape.forEach((L) => L.p.forEach((q) => { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }));
      const k = Math.min((w - 12) / (x1 - x0), (h - 12) / (y1 - y0));
      x.scale(r, r);
      x.translate(w / 2, h / 2);
      x.scale(k, k);
      x.translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
      G.drawShape(x, shape, c.dataset.c, 1 / k);
    });
  }

  /* ---------- 홈 ---------- */
  function renderHome() {
    $('#playerName').value = app.name;
    $('#soundBtn').textContent = G.sfx.muted ? '🔇' : '🔊';
    $('#sectionCards').innerHTML = Object.keys(G.SECTIONS).map((key) => {
      const sec = G.SECTIONS[key], m = sec.metrics[0], top = G.lb.get(key, m.key)[0];
      return `<button class="sec-card" data-sec="${key}">
        <div class="emoji">${sec.emoji}</div>
        <div><h3>${sec.name}</h3><p>${sec.place}</p>
        <div class="best">${top ? '🏆 ' + G.esc(top.name) + ' · ' + fmt(top.value, m) : '아직 기록이 없어요. 첫 기록의 주인공이 되어 보세요!'}</div></div>
      </button>`;
    }).join('');
    showScreen('home');
  }
  $('#playerName').addEventListener('input', (e) => { app.name = e.target.value; G.store.set('name', app.name); });
  $('#soundBtn').addEventListener('click', () => { $('#soundBtn').textContent = G.sfx.toggle() ? '🔇' : '🔊'; G.sfx.click(); });
  $('#sectionCards').addEventListener('click', (e) => {
    const b = e.target.closest('[data-sec]');
    if (!b) return;
    G.sfx.click();
    app.section = b.dataset.sec;
    app.tab = app.crafts.some((c) => c.section === app.section) ? 'mine' : 'new';
    renderSection();
  });

  /* ---------- 섹션 ---------- */
  function renderSection() {
    const key = app.section, sec = G.SECTIONS[key];
    $('#secTitle').textContent = sec.emoji + ' ' + sec.name;
    document.querySelectorAll('#secTabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === app.tab));
    ['new', 'mine', 'rank'].forEach((t) => ($('#tab-' + t).hidden = t !== app.tab));

    if (app.tab === 'new') {
      $('#palette').innerHTML = G.COLORS.map((c) => `<button style="background:${c}" data-color="${c}" class="${c === app.color ? 'on' : ''}" aria-label="색 ${c}"></button>`).join('');
      $('#modelList').innerHTML = `<div class="item free">
        <div class="big-emoji">✂️</div>
        <div><h3>자유 접기</h3><p>정해진 모양 없이 내 마음대로! 접힌 모양 그대로 무게중심·저항이 계산돼 움직여요.</p>
        <div class="chips"><button data-square="0" class="${app.square ? '' : 'on'}">직사각형 종이</button><button data-square="1" class="${app.square ? 'on' : ''}">정사각형 종이</button></div>
        <div class="row"><button class="btn" data-fold="free">자유롭게 접기</button></div></div>
      </div><div class="sechead">도안 따라 접기 (중간부터 마음대로 바꿔도 돼요)</div>` + G.MODELS[key].map((m) => `<div class="item">
        <canvas data-shape="guide" data-s="${key}" data-m="${m.id}" data-c="${app.color}"></canvas>
        <div><h3>${m.name}<span class="badge">${m.steps.length}번 접기</span></h3><p>${m.desc}</p>
        <div class="row"><button class="btn ghost" data-fold="${m.id}">도안 보며 접기</button></div></div>
      </div>`).join('');
    } else if (app.tab === 'mine') {
      const mine = app.crafts.filter((c) => c.section === key);
      $('#craftList').innerHTML = mine.length ? mine.map((c) => {
        const best = sec.metrics.map((mt) => (c.best && c.best[mt.key] != null ? mt.label + ' ' + fmt(c.best[mt.key], mt) : '')).filter(Boolean).join(' · ');
        return `<div class="item">
          <canvas data-shape="${c.id}" data-c="${c.color}"></canvas>
          <div><h3>${G.esc(c.name)}</h3>
          <p>${best || '아직 기록이 없어요'}</p>
          <div class="row"><button class="btn" data-play="${c.id}">${sec.verb}</button><button class="btn ghost" data-del="${c.id}">버리기</button></div></div>
        </div>`;
      }).join('') : '<div class="empty">아직 접은 것이 없어요.<br>‘새로 접기’에서 하나 접어 보세요!</div>';
    } else {
      $('#rankSeg').innerHTML = sec.metrics.map((m, i) => `<button data-metric="${i}" class="${i === app.rankMetric ? 'on' : ''}">${m.label}</button>`).join('');
      const mt = sec.metrics[app.rankMetric], list = G.lb.get(key, mt.key);
      $('#rankList').innerHTML = list.length ? list.map((e, i) => `<li class="${e.name === playerName() ? 'me' : ''}">
        <span class="no">${['🥇', '🥈', '🥉'][i] || i + 1}</span>
        <span class="who">${G.esc(e.name)}<small>${G.esc(e.model)} · ${e.date}</small></span>
        <span class="val">${fmt(e.value, mt)}</span></li>`).join('') : '<div class="empty">아직 기록이 없어요.</div>';
    }
    showScreen('section');
    paintThumbs($('#section'));
  }
  $('#secBack').addEventListener('click', () => { G.sfx.click(); renderHome(); });
  $('#secTabs').addEventListener('click', (e) => {
    if (e.target.dataset.tab) { G.sfx.click(); app.tab = e.target.dataset.tab; renderSection(); }
  });
  $('#section').addEventListener('click', (e) => {
    const d = e.target.dataset;
    if (d.color) { app.color = d.color; renderSection(); }
    else if (d.square) { app.square = d.square === '1'; renderSection(); }
    else if (d.fold) { G.sfx.click(); startFold(d.fold === 'free' ? null : G.findModel(app.section, d.fold)); }
    else if (d.play) { G.sfx.click(); startPlay(app.crafts.find((c) => c.id === d.play)); }
    else if (d.metric) { app.rankMetric = +d.metric; renderSection(); }
    else if (d.del) {
      // 한 번 더 눌러야 버려진다 (confirm 창을 쓸 수 없는 환경 대비)
      if (e.target.dataset.sure) {
        app.crafts = app.crafts.filter((c) => c.id !== d.del);
        saveCrafts();
        renderSection();
      } else {
        e.target.dataset.sure = '1';
        e.target.textContent = '정말 버리기?';
        e.target.classList.add('red');
      }
    }
  });

  /* ---------- 무대 공통 ---------- */
  const last = {};
  function setText(id, v) {
    if (last[id] !== v) { last[id] = v; $('#' + id).textContent = v; }
  }
  const ui = {
    fold(o) {
      setText('foldSub', o.sub);
      setText('foldText', o.text);
      $('#foldUndo').disabled = !o.canUndo;
      $('#foldCrease').classList.toggle('on', o.crease);
      $('#foldTop').classList.toggle('on', o.top);
    },
    hud(o) {
      setText('hudA', o.a); setText('hudB', o.b); setText('hudInfo', o.info || '');
      const gs = o.gauges || [], box = $('#gauges');
      if (box.children.length !== gs.length) box.innerHTML = gs.map(() => '<div class="gauge"><span></span><div class="gbar"><i></i></div></div>').join('');
      gs.forEach((g, i) => {
        const el = box.children[i], key = 'g' + i;
        if (last[key] !== g.label) { last[key] = g.label; el.firstChild.textContent = g.label; }
        const f = el.querySelector('i');
        f.style.width = Math.round(G.clamp(g.v, 0, 1) * 100) + '%';
        f.style.background = g.color;
      });
      $('#hint').hidden = !o.hint;
      if (o.hint) setText('hint', o.hint);
    },
  };

  function openStage(mode) {
    leaveScene();
    for (const k in last) delete last[k];
    $('#foldbar').hidden = $('#foldtools').hidden = mode !== 'fold';
    $('#hud').hidden = mode !== 'play';
    $('#hint').hidden = true;
    $('#overlay').hidden = true;
    showScreen('stage');
    resize();
  }
  function overlay(html) {
    $('#overlayCard').innerHTML = html;
    $('#overlay').hidden = false;
    $('#hint').hidden = true;
    paintThumbs($('#overlayCard'));
  }

  /* ---------- 접기 ---------- */
  function startFold(guide) {
    const sec = G.SECTIONS[app.section], color = app.color, section = app.section;
    const paper = guide ? guide.paper : app.square ? [240, 240] : sec.paper;
    openStage('fold');
    app.scene = new G.FoldScene({ section, paper, color, guide }, ui, (shape, wings) => {
      const n = app.crafts.filter((c) => c.section === section).length + 1;
      const craft = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), section, name: (guide ? guide.name : '내 ' + sec.name.replace('종이 ', '')) + ' ' + n + '호', color, shape, wings, best: {} };
      app.crafts.unshift(craft);
      saveCrafts();
      const pa = section === 'plane' ? G.planeAnalysis(craft) : null, opened = pa && pa.keel;
      const P = pa ? pa.P : G.PHYS[section](G.analyze(shape));
      G.sfx.fanfare();
      app.pending = { craft, guide };
      overlay(`<h2>완성! 🎉</h2>
        <canvas data-shape="${craft.id}" data-c="${color}"></canvas>
        <input id="craftName" maxlength="14" value="${G.esc(craft.name)}" aria-label="작품 이름">
        ${bars(P.bars)}
        <div class="tip">💡 ${opened ? (wings.length < 2 ? '날개가 한쪽만 접혔어요. 뒤집어서 반대쪽도 접으면 좋아요. ' : '날개를 양쪽으로 펴서 날려요. ') : ''}${P.tip}</div>
        <div class="row"><button class="btn" data-act="play">${sec.emoji} 바로 ${sec.verb}</button>
        <button class="btn ghost" data-act="refold">다시 접기</button><button class="btn ghost" data-act="mine">보관함</button></div>`);
      $('#craftName').addEventListener('input', (e) => { craft.name = e.target.value.trim() || '이름 없는 작품'; saveCrafts(); });
    });
  }
  $('#foldQuit').addEventListener('click', () => { app.tab = 'new'; renderSection(); });
  const foldBtn = (id, fn) => $(id).addEventListener('click', () => app.scene && app.scene[fn] && app.scene[fn]());
  foldBtn('#foldUndo', 'undo'); foldBtn('#foldFlip', 'flip'); foldBtn('#foldCrease', 'toggleCrease'); foldBtn('#foldTop', 'toggleTop'); foldBtn('#foldDone', 'finish');

  /* ---------- 플레이 ---------- */
  function startPlay(craft) {
    const sec = G.SECTIONS[craft.section];
    const Scene = { plane: G.PlaneScene, boat: G.BoatScene, car: G.CarScene }[craft.section];
    openStage('play');
    app.pending = { craft, guide: app.pending && app.pending.craft === craft ? app.pending.guide : null };
    app.scene = new Scene(craft, ui, (res) => {
      const date = new Date().toISOString().slice(0, 10);
      let record = false;
      const rows = sec.metrics.map((mt) => {
        const value = res[mt.key];
        const rank = value > 0 ? G.lb.add(craft.section, mt.key, { name: playerName(), model: craft.name, value, date }) : 0;
        const pb = craft.best[mt.key] == null || value > craft.best[mt.key];
        if (pb) craft.best[mt.key] = value;
        if (rank === 1) record = true;
        return `<div><small>${mt.label}</small><b>${fmt(value, mt)}</b><em>${rank === 1 ? '🏆 1위 신기록!' : rank ? '순위표 ' + rank + '위' : pb ? '이 작품 최고 기록' : ''}</em></div>`;
      });
      saveCrafts();
      if (record) G.sfx.fanfare();
      overlay(`<h2>기록 측정 완료!</h2><p class="sub">${G.esc(playerName())} · ${G.esc(craft.name)}</p>
        <div class="res">${rows.join('')}</div>
        <div class="row"><button class="btn" data-act="play">한 번 더!</button>
        <button class="btn ghost" data-act="rank">순위표</button><button class="btn ghost" data-act="mine">보관함</button></div>`);
    });
  }
  $('#playQuit').addEventListener('click', () => { app.tab = 'mine'; renderSection(); });
  $('#overlay').addEventListener('click', (e) => {
    const act = e.target.dataset.act;
    if (!act) return;
    G.sfx.click();
    if (act === 'play') startPlay(app.pending.craft);
    else if (act === 'refold') {
      app.crafts = app.crafts.filter((c) => c !== app.pending.craft);
      saveCrafts();
      startFold(app.pending.guide);
    } else { app.tab = act; renderSection(); }
  });

  /* ---------- 입력 ---------- */
  window.addEventListener('pointerdown', () => G.sfx.unlock(), { capture: true });
  function pos(e) {
    const r = cv.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }
  const send = (type, e) => {
    if (!app.scene || !app.scene.pointer || !$('#overlay').hidden) return;
    const p = pos(e);
    app.scene.pointer(type, p[0], p[1]);
  };
  cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); send('down', e); });
  cv.addEventListener('pointermove', (e) => send('move', e));
  cv.addEventListener('pointerup', (e) => send('up', e));
  cv.addEventListener('pointercancel', (e) => send('up', e));
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  const onKey = (down) => (e) => {
    if (!app.scene || !app.scene.key || !$('#overlay').hidden || e.target.tagName === 'INPUT') return;
    if (['Space', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (!e.repeat) app.scene.key(e.code, down);
  };
  window.addEventListener('keydown', onKey(true));
  window.addEventListener('keyup', onKey(false));

  /* ---------- 루프 ---------- */
  let vw = 0, vh = 0;
  function resize() {
    const r = window.devicePixelRatio || 1;
    vw = cv.clientWidth; vh = cv.clientHeight;
    cv.width = Math.round(vw * r); cv.height = Math.round(vh * r);
  }
  window.addEventListener('resize', resize);
  let prev = 0;
  function frame(t) {
    const dt = Math.min(0.05, (t - prev) / 1000 || 0);
    prev = t;
    if (app.scene && vw) {
      if ($('#overlay').hidden) app.scene.update(dt);
      const r = window.devicePixelRatio || 1;
      ctx.setTransform(r, 0, 0, r, 0, 0);
      app.scene.draw(ctx, vw, vh);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  G.app = app; // 디버깅용
  renderHome();
})();
