/* 화면 전환, 격납고, 순위표, 게임 루프 */
(function () {
  const G = window.G;
  const $ = (s) => document.querySelector(s);
  const cv = $('#cv'), ctx = cv.getContext('2d');

  const app = {
    section: null, tab: 'new', color: G.COLORS[0], rankMetric: 0,
    scene: null, crafts: G.store.get('crafts', []), name: G.store.get('name', ''),
  };
  const playerName = () => (app.name || '').trim() || '이름 없는 선수';
  const saveCrafts = () => G.store.set('crafts', app.crafts);
  const fmt = (v, m) => v.toFixed(m.digits) + ' ' + m.unit;

  function showScreen(id) {
    ['home', 'section', 'stage'].forEach((s) => ($('#' + s).hidden = s !== id));
    if (id !== 'stage') app.scene = null;
    window.scrollTo(0, 0);
  }

  function paintThumbs(root) {
    root.querySelectorAll('canvas[data-m]').forEach((c) => {
      const r = window.devicePixelRatio || 1;
      const w = c.clientWidth || 110, h = c.clientHeight || 80;
      c.width = w * r; c.height = h * r;
      const x = c.getContext('2d');
      x.scale(r, r);
      x.translate(w / 2, h / 2 + (c.dataset.s === 'plane' ? 8 : c.dataset.s === 'boat' ? 10 : 4));
      if (c.dataset.s === 'plane') x.rotate(-0.12);
      G.drawCraft(x, c.dataset.s, c.dataset.m, c.dataset.c, w * 0.8);
    });
  }

  /* ---------- 홈 ---------- */
  function renderHome() {
    $('#playerName').value = app.name;
    $('#sectionCards').innerHTML = Object.keys(G.SECTIONS).map((key, i) => {
      const sec = G.SECTIONS[key], m = sec.metrics[0], top = G.lb.get(key, m.key)[0];
      return `<button class="sec-card" data-sec="${key}">
        <canvas data-s="${key}" data-m="${G.MODELS[key][0].id}" data-c="${G.COLORS[[0, 5, 3][i]]}"></canvas>
        <div><h3>${sec.emoji} ${sec.name}</h3><p>${sec.place}</p>
        <div class="best">${top ? '🏆 ' + G.esc(top.name) + ' · ' + fmt(top.value, m) : '아직 기록이 없어요. 첫 기록의 주인공이 되어 보세요!'}</div></div>
      </button>`;
    }).join('');
    paintThumbs($('#sectionCards'));
    showScreen('home');
  }
  $('#playerName').addEventListener('input', (e) => { app.name = e.target.value; G.store.set('name', app.name); });
  $('#sectionCards').addEventListener('click', (e) => {
    const b = e.target.closest('[data-sec]');
    if (!b) return;
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
      $('#modelList').innerHTML = G.MODELS[key].map((m) => `<div class="item">
        <canvas data-s="${key}" data-m="${m.id}" data-c="${app.color}"></canvas>
        <div><h3>${m.name}<span class="badge">${m.steps.length}번 접기</span></h3><p>${m.desc}</p>
        ${['a', 'b', 'c'].map((k) => `<div class="stat">${sec.stats[k]}<i><b style="width:${m.stats[k] * 100}%"></b></i></div>`).join('')}
        <div class="row" style="margin-top:8px"><button class="btn" data-fold="${m.id}">접기 시작</button></div></div>
      </div>`).join('');
    } else if (app.tab === 'mine') {
      const mine = app.crafts.filter((c) => c.section === key);
      $('#craftList').innerHTML = mine.length ? mine.map((c) => {
        const m = G.findModel(key, c.model);
        const best = sec.metrics.map((mt) => (c.best && c.best[mt.key] != null ? mt.label + ' ' + fmt(c.best[mt.key], mt) : '')).filter(Boolean).join(' · ');
        return `<div class="item">
          <canvas data-s="${key}" data-m="${c.model}" data-c="${c.color}"></canvas>
          <div><h3>${m.name}<span class="badge">${G.grade(c.q)}등급 · 정밀도 ${Math.round(c.q * 100)}%</span></h3>
          <p>${best || '아직 기록이 없어요'}</p>
          <div class="row"><button class="btn" data-play="${c.id}">${sec.verb}</button><button class="btn ghost" data-del="${c.id}">버리기</button></div></div>
        </div>`;
      }).join('') : '<div class="empty">아직 접은 것이 없어요.<br>‘새로 접기’에서 하나 접어 보세요!</div>';
    } else {
      $('#rankSeg').innerHTML = sec.metrics.map((m, i) => `<button data-metric="${i}" class="${i === app.rankMetric ? 'on' : ''}">${m.label}</button>`).join('');
      const mt = sec.metrics[app.rankMetric], list = G.lb.get(key, mt.key);
      $('#rankList').innerHTML = list.length ? list.map((e, i) => `<li class="${e.name === playerName() ? 'me' : ''}">
        <span class="no">${['🥇', '🥈', '🥉'][i] || i + 1}</span>
        <span class="who">${G.esc(e.name)}<small>${G.esc(e.model)} · ${e.grade}등급 · ${e.date}</small></span>
        <span class="val">${fmt(e.value, mt)}</span></li>`).join('') : '<div class="empty">아직 기록이 없어요.</div>';
    }
    showScreen('section');
    paintThumbs($('#section'));
  }
  $('#secBack').addEventListener('click', renderHome);
  $('#secTabs').addEventListener('click', (e) => {
    if (e.target.dataset.tab) { app.tab = e.target.dataset.tab; renderSection(); }
  });
  $('#section').addEventListener('click', (e) => {
    const d = e.target.dataset;
    if (d.color) { app.color = d.color; renderSection(); }
    else if (d.fold) startFold(G.findModel(app.section, d.fold));
    else if (d.play) startPlay(app.crafts.find((c) => c.id === d.play));
    else if (d.metric) { app.rankMetric = +d.metric; renderSection(); }
    else if (d.del) {
      if (confirm('이 작품을 버릴까요? (순위표 기록은 남아요)')) {
        app.crafts = app.crafts.filter((c) => c.id !== d.del);
        saveCrafts();
        renderSection();
      }
    }
  });

  /* ---------- 무대 공통 ---------- */
  const last = {};
  function setText(id, v) {
    if (last[id] !== v) { last[id] = v; $('#' + id).textContent = v; }
  }
  const ui = {
    fold(step, total, text, acc, canUndo) {
      setText('foldStep', step >= total ? '완성' : step + 1 + ' / ' + total + ' 단계');
      setText('foldAcc', '정밀도 ' + Math.round(acc * 100) + '%');
      setText('foldText', text);
      $('#foldUndo').disabled = !canUndo;
    },
    hud(o) {
      setText('hudA', o.a); setText('hudB', o.b); setText('hudInfo', o.info || '');
      $('#gauge').hidden = o.gauge == null;
      if (o.gauge != null) {
        setText('gaugeLabel', o.gaugeLabel);
        $('#gaugeFill').style.width = Math.round(o.gauge * 100) + '%';
        $('#gaugeFill').className = o.gaugeBad ? 'bad' : '';
      }
      $('#hint').hidden = !o.hint;
      if (o.hint) setText('hint', o.hint);
    },
  };

  function openStage(mode) {
    $('#foldbar').hidden = mode !== 'fold';
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
  function startFold(model) {
    const color = app.color;
    openStage('fold');
    app.scene = new G.FoldScene(model, color, ui, (q) => {
      const craft = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), section: model.section, model: model.id, color, q, best: {} };
      app.crafts.unshift(craft);
      saveCrafts();
      const sec = G.SECTIONS[model.section];
      const msg = { S: '장인의 솜씨예요!', A: '아주 반듯해요!', B: '꽤 괜찮아요.', C: '조금 삐뚤지만 개성 있어요.' }[G.grade(q)];
      overlay(`<h2>완성! 🎉</h2><p class="sub">${model.name} · ${msg}</p>
        <canvas data-s="${model.section}" data-m="${model.id}" data-c="${color}"></canvas>
        <div class="big">${G.grade(q)}</div><p class="sub">접기 정밀도 ${Math.round(q * 100)}% — 반듯할수록 성능이 좋아요</p>
        <div class="row"><button class="btn" data-act="play">${sec.emoji} 바로 ${sec.verb}</button>
        <button class="btn ghost" data-act="refold">다시 접기</button><button class="btn ghost" data-act="mine">보관함</button></div>`);
      app.pending = { craft, model };
    });
  }
  $('#foldQuit').addEventListener('click', () => { app.tab = 'new'; renderSection(); });
  $('#foldUndo').addEventListener('click', () => app.scene && app.scene.undo && app.scene.undo());

  /* ---------- 플레이 ---------- */
  function startPlay(craft) {
    const model = G.findModel(craft.section, craft.model), sec = G.SECTIONS[craft.section];
    const Scene = { plane: G.PlaneScene, boat: G.BoatScene, car: G.CarScene }[craft.section];
    for (const k in last) delete last[k];
    openStage('play');
    app.pending = { craft, model };
    app.scene = new Scene(craft, model, ui, (res) => {
      const date = new Date().toISOString().slice(0, 10);
      const rows = sec.metrics.map((mt) => {
        const value = res[mt.key];
        const rank = value > 0 ? G.lb.add(craft.section, mt.key, { name: playerName(), model: model.name, grade: G.grade(craft.q), value, date }) : 0;
        const pb = craft.best[mt.key] == null || value > craft.best[mt.key];
        if (pb) craft.best[mt.key] = value;
        return `<div><small>${mt.label}</small><b>${fmt(value, mt)}</b><em>${rank === 1 ? '🏆 1위 신기록!' : rank ? '순위표 ' + rank + '위' : pb ? '이 작품 최고 기록' : ''}</em></div>`;
      });
      saveCrafts();
      overlay(`<h2>기록 측정 완료!</h2><p class="sub">${G.esc(playerName())} · ${model.name} (${G.grade(craft.q)}등급)</p>
        <div class="res">${rows.join('')}</div>
        <div class="row"><button class="btn" data-act="play">한 번 더!</button>
        <button class="btn ghost" data-act="rank">순위표</button><button class="btn ghost" data-act="mine">보관함</button></div>`);
    });
  }
  $('#playQuit').addEventListener('click', () => { app.tab = 'mine'; renderSection(); });
  $('#overlay').addEventListener('click', (e) => {
    const act = e.target.dataset.act;
    if (!act) return;
    if (act === 'play') startPlay(app.pending.craft);
    else if (act === 'refold') {
      app.crafts = app.crafts.filter((c) => c !== app.pending.craft);
      saveCrafts();
      startFold(app.pending.model);
    } else { app.tab = act; renderSection(); }
  });

  /* ---------- 입력 ---------- */
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
