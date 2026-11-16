/* 종이접기 엔진 + 자유 접기 화면 + 접힌 모양 분석
   종이는 여러 겹의 볼록 다각형(layer)으로 표현한다. 접는 선을 기준으로
   한쪽에 있는 모든 겹을 잘라 반사시켜 맨 위에 쌓는다. */
(function () {
  const G = window.G;

  const side = (p, a, b) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);

  function reflect(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
    return [2 * (a[0] + t * dx) - p[0], 2 * (a[1] + t * dy) - p[1]];
  }
  function clip(poly, a, b, sgn) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const P = poly[i], Q = poly[(i + 1) % poly.length];
      const sp = sgn * side(P, a, b), sq = sgn * side(Q, a, b);
      if (sp >= 0) out.push(P);
      if ((sp > 0 && sq < 0) || (sp < 0 && sq > 0)) {
        const t = sp / (sp - sq);
        out.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t]);
      }
    }
    return out;
  }
  function area(poly) {
    let s = 0;
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      s += p[0] * q[1] - q[0] * p[1];
    }
    return Math.abs(s) / 2;
  }
  // 아핀 [a,b,c,d,e,f] : x' = a x + c y + e, y' = b x + d y + f
  function reflMatrix(a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
    const ux = dx / L, uy = dy / L;
    const r = [2 * ux * ux - 1, 2 * ux * uy, 2 * ux * uy, 2 * uy * uy - 1];
    return [r[0], r[1], r[2], r[3], a[0] - (r[0] * a[0] + r[2] * a[1]), a[1] - (r[1] * a[0] + r[3] * a[1])];
  }
  function compose(n, m) {
    return [
      n[0] * m[0] + n[2] * m[1], n[1] * m[0] + n[3] * m[1],
      n[0] * m[2] + n[2] * m[3], n[1] * m[2] + n[3] * m[3],
      n[0] * m[4] + n[2] * m[5] + n[4], n[1] * m[4] + n[3] * m[5] + n[5],
    ];
  }
  const apply = (m, p) => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];
  function invApply(m, p) {
    const det = m[0] * m[3] - m[1] * m[2];
    const x = p[0] - m[4], y = p[1] - m[5];
    return [(m[3] * x - m[2] * y) / det, (-m[1] * x + m[0] * y) / det];
  }
  function inside(poly, p) {
    let pos = false, neg = false;
    for (let i = 0; i < poly.length; i++) {
      const s = side(p, poly[i], poly[(i + 1) % poly.length]);
      if (s > 1e-9) pos = true; else if (s < -1e-9) neg = true;
      if (pos && neg) return false;
    }
    return true;
  }

  function foldLayers(layers, a, b, P) {
    const s = Math.sign(side(P, a, b));
    if (!s) return layers;
    const R = reflMatrix(a, b);
    const stay = [], move = [];
    for (const L of layers) {
      const st = clip(L.poly, a, b, -s);
      if (st.length > 2 && area(st) > 0.5) stay.push({ poly: st, m: L.m, flip: L.flip, creases: L.creases });
      const mv = clip(L.poly, a, b, s);
      if (mv.length > 2 && area(mv) > 0.5) {
        move.push({ poly: mv.map((p) => reflect(p, a, b)), m: compose(R, L.m), flip: !L.flip, creases: L.creases });
      }
    }
    return stay.concat(move.reverse());
  }
  function bisector(H, Q) {
    const mx = (H[0] + Q[0]) / 2, my = (H[1] + Q[1]) / 2;
    const dx = -(Q[1] - H[1]), dy = Q[0] - H[0], L = Math.hypot(dx, dy) || 1;
    return [[mx - (dx / L) * 2000, my - (dy / L) * 2000], [mx + (dx / L) * 2000, my + (dy / L) * 2000]];
  }
  const sheet = (W, H) => [{ poly: [[0, 0], [W, 0], [W, H], [0, H]], m: [1, 0, 0, 1, 0, 0], flip: false, creases: [] }];
  const r1 = (v) => Math.round(v * 10) / 10;
  const toShape = (layers) => layers.map((L) => ({ p: L.poly.map((q) => [r1(q[0]), r1(q[1])]), f: L.flip ? 1 : 0 }));

  G.fold = {
    foldLayers, reflect, bisector,
    // 도안대로 정확히 접었을 때의 모양
    guideShape(model) {
      let L = sheet(model.paper[0], model.paper[1]);
      model.steps.forEach((s) => { if (!s.crease) L = foldLayers(L, s.line[0], s.line[1], s.handle); });
      return toShape(L);
    },
  };

  /* ---------- 접힌 모양 그리기 (현재 변환 좌표 = 종이 단위) ---------- */
  G.innerColor = (color) => (color === '#efe9dc' ? '#ffffff' : G.shade(color, 0.72));
  G.drawShape = function (ctx, shape, color, lw) {
    const inner = G.innerColor(color);
    ctx.lineJoin = 'round';
    ctx.lineWidth = lw;
    ctx.strokeStyle = 'rgba(70,50,30,0.45)';
    for (const L of shape) {
      ctx.beginPath();
      L.p.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
      ctx.closePath();
      ctx.fillStyle = L.f ? color : inner;
      ctx.fill();
      ctx.stroke();
    }
  };

  /* ---------- 모양 분석: 겹 수 지도를 만들어 면적·무게중심·관성·대칭을 구한다 ---------- */
  G.analyze = function (shape) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    shape.forEach((L) => L.p.forEach((q) => { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }));
    const w = x1 - x0, h = y1 - y0, cell = Math.max(w, h) / 72;
    const nx = Math.max(1, Math.ceil(w / cell)), ny = Math.max(1, Math.ceil(h / cell));
    const t = new Float32Array(nx * ny);
    for (const L of shape) {
      let lx0 = 1e9, ly0 = 1e9, lx1 = -1e9, ly1 = -1e9;
      L.p.forEach((q) => { lx0 = Math.min(lx0, q[0]); ly0 = Math.min(ly0, q[1]); lx1 = Math.max(lx1, q[0]); ly1 = Math.max(ly1, q[1]); });
      const i0 = Math.max(0, Math.floor((lx0 - x0) / cell)), i1 = Math.min(nx - 1, Math.floor((lx1 - x0) / cell));
      const j0 = Math.max(0, Math.floor((ly0 - y0) / cell)), j1 = Math.min(ny - 1, Math.floor((ly1 - y0) / cell));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        if (inside(L.p, [x0 + (i + 0.5) * cell, y0 + (j + 0.5) * cell])) t[j * nx + i]++;
      }
    }
    let n = 0, m = 0, sx = 0, sy = 0, ax = 0, ay = 0;
    const colM = new Float32Array(nx), cols = [], rowsN = new Float32Array(ny);
    for (let i = 0; i < nx; i++) cols.push({ front: 1e9, back: -1e9 });
    const rows = [];
    for (let j = 0; j < ny; j++) rows.push({ y: y0 + (j + 0.5) * cell, left: 1e9, right: -1e9 });
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const v = t[j * nx + i];
      if (!v) continue;
      const x = x0 + (i + 0.5) * cell, y = y0 + (j + 0.5) * cell;
      n++; m += v; sx += v * x; sy += v * y; ax += x; ay += y;
      colM[i] += v; rowsN[j]++;
      cols[i].front = Math.min(cols[i].front, y - cell / 2);
      cols[i].back = Math.max(cols[i].back, y + cell / 2);
      rows[j].left = Math.min(rows[j].left, x - cell / 2);
      rows[j].right = Math.max(rows[j].right, x + cell / 2);
    }
    const mcx = sx / m, mcy = sy / m, acx = ax / n, acy = ay / n;
    let ixx = 0, iyy = 0, axx = 0;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const v = t[j * nx + i];
      if (!v) continue;
      const x = x0 + (i + 0.5) * cell, y = y0 + (j + 0.5) * cell;
      ixx += v * (x - mcx) * (x - mcx); iyy += v * (y - mcy) * (y - mcy); axx += (x - acx) * (x - acx);
    }
    // 좌우 대칭: 무게중심을 지나는 세로축 기준으로 열 질량 분포를 비교
    let diff = 0;
    for (let i = 0; i < nx; i++) {
      const xm = 2 * mcx - (x0 + (i + 0.5) * cell), f = (xm - x0) / cell - 0.5;
      const k = Math.floor(f), u = f - k;
      const a = k >= 0 && k < nx ? colM[k] : 0, b = k + 1 >= 0 && k + 1 < nx ? colM[k + 1] : 0;
      diff += Math.abs(colM[i] - (a * (1 - u) + b * u));
    }
    // 앞쪽(위 25%) / 오른쪽(25%) 이 얼마나 꽉 차 있는지 → 뭉툭함
    let topFill = 0, rightFill = 0;
    const qy = Math.max(1, Math.round(ny * 0.25)), qx = Math.max(1, Math.round(nx * 0.25));
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      if (!t[j * nx + i]) continue;
      if (j < qy) topFill++;
      if (i >= nx - qx) rightFill++;
    }
    const c2 = cell * cell;
    return {
      x0, y0, w, h, cell, nx, ny, cols, rows,
      area: n * c2, mass: m * c2, nbar: m / n, mcx, mcy, acx, acy,
      ixx: ixx / m, iyy: iyy / m, axx: axx / n,
      asym: diff / (2 * m / 1), lean: (acx - mcx) / Math.max(w, 1),
      topFill: topFill / (qy * nx), rightFill: rightFill / (qx * ny),
    };
  };
  G.hull = function (pts) {
    const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const q of p) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  };

  /* ---------- 접기 화면 ---------- */
  const MAX_FOLDS = 16;
  G.FoldScene = function (opt, ui, onDone) {
    const W = opt.paper[0], H = opt.paper[1], color = opt.color, guide = opt.guide || null;
    const sec = G.SECTIONS[opt.section];
    const inner = G.innerColor(color);
    let layers = sheet(W, H);
    let gi = guide ? 0 : -1, folds = 0, creaseMode = false, history = [];
    let drag = null, anim = null, toast = null, time = 0, snaps = [];
    const view = { cx: W / 2, cy: H / 2, s: 1, sx: 0, sy: 0 };

    const cur = () => (guide && gi >= 0 && gi < guide.steps.length ? guide.steps[gi] : null);
    const target = (st) => reflect(st.handle, st.line[0], st.line[1]);

    function rebuildSnaps() {
      const seen = new Set(), out = [];
      const add = (p) => {
        const k = Math.round(p[0]) + ',' + Math.round(p[1]);
        if (!seen.has(k)) { seen.add(k); out.push(p); }
      };
      for (const L of layers) {
        const n = L.poly.length;
        for (let i = 0; i < n; i++) {
          const a = L.poly[i], b = L.poly[(i + 1) % n];
          add(a);
          add([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
          // 접은 자국과 변이 만나는 점
          for (const c of L.creases) {
            const c0 = apply(L.m, c[0]), c1 = apply(L.m, c[1]);
            const sa = side(a, c0, c1), sb = side(b, c0, c1);
            if ((sa > 0 && sb < 0) || (sa < 0 && sb > 0)) { const u = sa / (sa - sb); add([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]); }
          }
        }
      }
      const st = cur();
      if (st) { add(st.handle); add(target(st)); }
      snaps = out;
    }
    function snap(p, px, avoid) {
      let best = null, bd = px / view.s;
      for (const s of snaps) {
        if (avoid && G.dist(s, avoid) < 4) continue;
        const d = G.dist(s, p);
        if (d < bd) { bd = d; best = s; }
      }
      return best;
    }

    function refreshUi() {
      rebuildSnaps();
      const st = cur();
      const text = st ? st.text : guide && gi >= guide.steps.length ? '도안 끝! 더 접어도 되고, ✅ 완성을 눌러도 돼요' : '아무 곳이나 잡아 끌어서 마음대로 접어 보세요';
      ui.fold({ text, sub: (st ? '도안 ' + (gi + 1) + '/' + guide.steps.length + ' · ' : '') + '접은 횟수 ' + folds + (creaseMode ? ' · 접었다 펴기 켜짐' : ''), canUndo: history.length > 0, crease: creaseMode });
    }
    refreshUi();

    const toPaper = (x, y) => [(x - view.sx) / view.s + view.cx, (y - view.sy) / view.s + view.cy];
    const say = (text, good) => { toast = { text, good, t: 0 }; };

    function commit(P, Q) {
      if (folds >= MAX_FOLDS && !creaseMode) return say('더는 접을 수 없을 만큼 두꺼워요!', false);
      const st = cur();
      const match = st && G.dist(P, st.handle) < 0.09 * W && G.dist(Q, target(st)) < 0.1 * W;
      const asCrease = creaseMode || (match && st.crease);
      const ln = bisector(P, Q);
      const next = foldLayers(layers, ln[0], ln[1], P);
      if (next.length > 320) return say('너무 잘게 접혀요. 다른 곳을 접어 보세요', false);
      history.push({ layers, gi, folds });
      if (asCrease) {
        anim = { base: layers, from: Q, handle: P, t: 0 };
        G.sfx.crease();
      } else {
        layers = next;
        folds++;
        G.sfx.fold();
      }
      if (match) { gi++; say(G.dist(Q, target(st)) < 1 ? '딱 맞아요! ✨' : '좋아요!', true); }
      else if (st) say('도안과 다르게 접었어요 (↩ 로 되돌릴 수 있어요)', false);
      refreshUi();
    }

    this.undo = function () {
      if (!history.length || anim) return;
      const h = history.pop();
      layers = h.layers; gi = h.gi; folds = h.folds; drag = null;
      G.sfx.crease();
      refreshUi();
    };
    this.flip = function () {
      if (anim) return;
      let x0 = 1e9, x1 = -1e9;
      layers.forEach((L) => L.poly.forEach((p) => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); }));
      const a = [(x0 + x1) / 2, 0], b = [(x0 + x1) / 2, 1], R = reflMatrix(a, b);
      history.push({ layers, gi, folds });
      layers = layers.map((L) => ({ poly: L.poly.map((p) => reflect(p, a, b)), m: compose(R, L.m), flip: !L.flip, creases: L.creases })).reverse();
      if (cur()) gi = -1; // 뒤집으면 도안 안내는 끝
      G.sfx.fold();
      say('뒤집었어요', true);
      refreshUi();
    };
    this.toggleCrease = function () { creaseMode = !creaseMode; refreshUi(); };
    this.finish = function () {
      if (anim || !onDone) return;
      const cb = onDone;
      onDone = null;
      cb(toShape(layers));
    };
    // 테스트/시연용: 도안의 현재 단계를 오차 e 로 접기, 또는 임의의 두 점으로 접기
    this.auto = function (e) {
      const st = cur();
      if (!st || anim) return;
      const T = target(st);
      commit(st.handle, [T[0] + (e || 0) * W, T[1]]);
      if (anim) anim.t = 1;
    };
    this.foldPts = function (P, Q) { commit(P, Q); if (anim) anim.t = 1; };

    this.pointer = function (type, x, y) {
      if (anim) return;
      const p = toPaper(x, y);
      if (type === 'down') {
        const s = snap(p, 20);
        if (s) drag = { p: s, q: s, snapped: null };
        else if (layers.some((L) => inside(L.poly, p))) drag = { p, q: p, snapped: null };
        else say('종이를 잡고 끌어 보세요', false);
      } else if (type === 'move' && drag) {
        const s = snap(p, 14, drag.p);
        drag.q = s || p;
        drag.snapped = s;
      } else if (type === 'up' && drag) {
        const d = drag;
        drag = null;
        if (G.dist(d.p, d.q) > 8) commit(d.p, d.q);
      }
    };

    this.update = function (dt) {
      time += dt;
      if (toast && (toast.t += dt) > 1.6) toast = null;
      if (anim) {
        anim.t += dt / 0.45;
        if (anim.t >= 1) {
          const ln = bisector(anim.handle, anim.from);
          layers = anim.base.map((L) => ({
            poly: L.poly, m: L.m, flip: L.flip,
            creases: L.creases.concat([[invApply(L.m, ln[0]), invApply(L.m, ln[1])]]),
          }));
          anim = null;
          refreshUi();
        }
      }
    };

    function shown() {
      if (anim) {
        const e = 1 - Math.pow(1 - G.clamp(anim.t, 0, 1), 2);
        const q = [G.lerp(anim.from[0], anim.handle[0], e), G.lerp(anim.from[1], anim.handle[1], e)];
        if (G.dist(q, anim.handle) < 3) return anim.base;
        const ln = bisector(anim.handle, q);
        return foldLayers(anim.base, ln[0], ln[1], anim.handle);
      }
      if (drag && G.dist(drag.q, drag.p) > 3) {
        const ln = bisector(drag.p, drag.q);
        return foldLayers(layers, ln[0], ln[1], drag.p);
      }
      return layers;
    }
    function path(ctx, poly) {
      ctx.beginPath();
      poly.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();
    }

    this.draw = function (ctx, w, h) {
      ctx.fillStyle = '#3f7d6b';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.09)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = (w / 2) % 40; x < w; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
      for (let y = 0; y < h; y += 40) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
      ctx.stroke();

      const top = 128, bottom = 96;
      view.s = Math.min((w - 48) / W, (h - top - bottom) / H) * 0.84;
      view.sx = w / 2;
      view.sy = top + (h - top - bottom) / 2;

      let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
      layers.forEach((L) => L.poly.forEach((p) => { bx0 = Math.min(bx0, p[0]); by0 = Math.min(by0, p[1]); bx1 = Math.max(bx1, p[0]); by1 = Math.max(by1, p[1]); }));
      if (!drag && !anim) {
        view.cx += ((bx0 + bx1) / 2 - view.cx) * 0.08;
        view.cy += ((by0 + by1) / 2 - view.cy) * 0.08;
      }

      ctx.save();
      ctx.translate(view.sx, view.sy);
      ctx.scale(view.s, view.s);
      ctx.translate(-view.cx, -view.cy);
      const px = 1 / view.s;

      // 방향 안내
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = '700 ' + 13 * px + 'px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(sec.frontLabel, (bx0 + bx1) / 2, by0 - 12 * px);
      if (sec.front === 'right') {
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 2 * px;
        ctx.setLineDash([4 * px, 6 * px]);
        ctx.beginPath(); ctx.moveTo(bx0 - 20 * px, by1 + 9 * px); ctx.lineTo(bx1 + 20 * px, by1 + 9 * px); ctx.stroke();
        ctx.setLineDash([]);
        const wr = 9 * px;
        [0.2, 0.8].forEach((k) => { ctx.beginPath(); ctx.arc(G.lerp(bx0, bx1, k), by1, wr, 0, Math.PI); ctx.stroke(); });
      }

      const list = shown();
      ctx.lineJoin = 'round';
      list.forEach((L, i) => {
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.28)';
        ctx.shadowBlur = i ? 7 : 16;
        ctx.shadowOffsetY = i ? 2 : 6;
        path(ctx, L.poly);
        ctx.fillStyle = L.flip ? color : inner;
        ctx.fill();
        ctx.restore();
        path(ctx, L.poly);
        ctx.strokeStyle = 'rgba(70,50,30,0.35)';
        ctx.lineWidth = px;
        ctx.stroke();
        if (L.creases.length) {
          ctx.save();
          path(ctx, L.poly);
          ctx.clip();
          ctx.transform(L.m[0], L.m[1], L.m[2], L.m[3], L.m[4], L.m[5]);
          ctx.strokeStyle = 'rgba(70,50,30,0.3)';
          ctx.lineWidth = px * 1.2;
          ctx.setLineDash([6 * px, 4 * px]);
          L.creases.forEach((c) => { ctx.beginPath(); ctx.moveTo(c[0][0], c[0][1]); ctx.lineTo(c[1][0], c[1][1]); ctx.stroke(); });
          ctx.restore();
        }
      });

      const st = cur();
      if (st && !anim && !drag) {
        const T = target(st), Hp = st.handle, a = st.line[0], b = st.line[1];
        const ex = (b[0] - a[0]) * 0.12, ey = (b[1] - a[1]) * 0.12;
        ctx.strokeStyle = '#ff5a4d';
        ctx.lineWidth = 2.2 * px;
        ctx.setLineDash([9 * px, 7 * px]);
        ctx.beginPath(); ctx.moveTo(a[0] - ex, a[1] - ey); ctx.lineTo(b[0] + ex, b[1] + ey); ctx.stroke();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2.5 * px;
        ctx.setLineDash([5 * px, 5 * px]);
        ctx.beginPath(); ctx.arc(T[0], T[1], 15 * px, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        const k = (time * 0.7) % 1, e = k < 0.8 ? k / 0.8 : 1;
        ctx.fillStyle = 'rgba(255,255,255,' + (k < 0.8 ? 0.85 : (1 - k) * 4) + ')';
        ctx.beginPath(); ctx.arc(G.lerp(Hp[0], T[0], e), G.lerp(Hp[1], T[1], e), 6 * px, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ff5a4d';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3 * px;
        ctx.beginPath(); ctx.arc(Hp[0], Hp[1], (11 + Math.sin(time * 5) * 2.5) * px, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      if (drag) {
        // 붙는 점들과 접는 선
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        snaps.forEach((s) => { ctx.beginPath(); ctx.arc(s[0], s[1], 3 * px, 0, 7); ctx.fill(); });
        if (G.dist(drag.p, drag.q) > 3) {
          const ln = bisector(drag.p, drag.q);
          ctx.strokeStyle = 'rgba(255,90,77,0.9)';
          ctx.lineWidth = 2 * px;
          ctx.setLineDash([9 * px, 7 * px]);
          ctx.beginPath(); ctx.moveTo(ln[0][0], ln[0][1]); ctx.lineTo(ln[1][0], ln[1][1]); ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.fillStyle = drag.snapped ? '#7be08f' : '#ff5a4d';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3 * px;
        ctx.beginPath(); ctx.arc(drag.q[0], drag.q[1], (drag.snapped ? 12 : 9) * px, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      ctx.restore();

      if (toast) {
        const a = toast.t < 0.15 ? toast.t / 0.15 : toast.t > 1.3 ? (1.6 - toast.t) / 0.3 : 1;
        ctx.save();
        ctx.globalAlpha = Math.max(0, a);
        ctx.font = '700 16px system-ui, sans-serif';
        ctx.textAlign = 'center';
        const tw = ctx.measureText(toast.text).width + 32;
        const ty = h - bottom - 24;
        ctx.fillStyle = toast.good ? '#fff7df' : '#fff';
        ctx.beginPath(); ctx.roundRect(w / 2 - tw / 2, ty - 24, tw, 36, 18); ctx.fill();
        ctx.fillStyle = toast.good ? '#c9702a' : '#555';
        ctx.fillText(toast.text, w / 2, ty);
        ctx.restore();
      }
    };
  };
})();
