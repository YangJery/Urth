/* 종이접기 엔진 + 접기 화면
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
  // 반평면 클리핑: sgn*side >= 0 인 쪽만 남긴다
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
  function compose(n, m) { // n ∘ m
    return [
      n[0] * m[0] + n[2] * m[1], n[1] * m[0] + n[3] * m[1],
      n[0] * m[2] + n[2] * m[3], n[1] * m[2] + n[3] * m[3],
      n[0] * m[4] + n[2] * m[5] + n[4], n[1] * m[4] + n[3] * m[5] + n[5],
    ];
  }
  function invApply(m, p) {
    const det = m[0] * m[3] - m[1] * m[2];
    const x = p[0] - m[4], y = p[1] - m[5];
    return [(m[3] * x - m[2] * y) / det, (-m[1] * x + m[0] * y) / det];
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
  // 점 H 를 Q 로 옮길 때 생기는 접는 선 (수직이등분선)
  function bisector(H, Q) {
    const mx = (H[0] + Q[0]) / 2, my = (H[1] + Q[1]) / 2;
    const dx = -(Q[1] - H[1]), dy = Q[0] - H[0], L = Math.hypot(dx, dy) || 1;
    return [[mx - (dx / L) * 2000, my - (dy / L) * 2000], [mx + (dx / L) * 2000, my + (dy / L) * 2000]];
  }

  G.fold = { foldLayers, reflect, bisector };

  /* ---------- 접기 화면 ---------- */
  G.FoldScene = function (model, color, ui, onDone) {
    const W = model.paper[0], H = model.paper[1];
    const TOL = 0.17 * W, PERFECT = 0.035 * W;
    const inner = color === '#efe9dc' ? '#ffffff' : G.shade(color, 0.72);
    let layers = [{ poly: [[0, 0], [W, 0], [W, H], [0, H]], m: [1, 0, 0, 1, 0, 0], flip: false, creases: [] }];
    let step = 0, scores = [], history = [];
    let drag = null, anim = null, toast = null, time = 0, finished = false, doneT = 0;
    const view = { cx: W / 2, cy: H / 2, s: 1, sx: 0, sy: 0 };

    const cur = () => model.steps[step];
    const target = () => reflect(cur().handle, cur().line[0], cur().line[1]);
    const avg = () => (scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 1);

    function refreshUi() {
      if (finished) ui.fold(model.steps.length, model.steps.length, '완성!', avg(), false);
      else ui.fold(step, model.steps.length, cur().text, avg(), history.length > 0);
    }
    refreshUi();

    function toPaper(x, y) {
      return [(x - view.sx) / view.s + view.cx, (y - view.sy) / view.s + view.cy];
    }
    function say(text, good) {
      toast = { text, good, t: 0 };
    }

    function accept(Q) {
      const st = cur(), T = target();
      const err = G.dist(Q, T);
      const useQ = err < PERFECT ? T : Q;
      const score = err < PERFECT ? 1 : G.clamp(1 - (err - PERFECT) / (TOL - PERFECT), 0, 1);
      history.push({ layers, scores: scores.slice() });
      scores.push(score);
      say(score >= 0.99 ? '완벽해요! ✨' : score > 0.6 ? '좋아요!' : '조금 삐뚤어요…', score > 0.6);
      if (st.crease) {
        anim = { base: layers, from: useQ, handle: st.handle, t: 0 };
      } else {
        const ln = bisector(st.handle, useQ);
        layers = foldLayers(layers, ln[0], ln[1], st.handle);
        advance();
      }
    }
    function advance() {
      step++;
      if (step >= model.steps.length) {
        finished = true;
        doneT = 0;
      }
      refreshUi();
    }

    this.undo = function () {
      if (!history.length || anim || finished) return;
      const h = history.pop();
      layers = h.layers;
      scores = h.scores;
      step--;
      drag = null;
      refreshUi();
    };
    // 테스트/시연용: 현재 단계를 오차 e(종이 폭 대비)로 자동 접기
    this.auto = function (e) {
      if (finished || anim) return;
      const T = target();
      accept([T[0] + (e || 0) * W, T[1]]);
      if (anim) anim.t = 1;
    };

    this.pointer = function (type, x, y) {
      if (finished || anim) return;
      const p = toPaper(x, y);
      if (type === 'down') {
        if (G.dist(p, cur().handle) * view.s < 64) drag = { q: p };
        else say('빨간 점을 잡고 끌어 보세요', false);
      } else if (type === 'move' && drag) {
        drag.q = p;
      } else if (type === 'up' && drag) {
        const q = drag.q;
        drag = null;
        if (G.dist(q, target()) <= TOL) accept(q);
        else if (G.dist(q, cur().handle) > 8) say('점선 동그라미까지 끌어다 놓으세요', false);
      }
    };

    this.update = function (dt) {
      time += dt;
      if (toast && (toast.t += dt) > 1.3) toast = null;
      if (anim) {
        anim.t += dt / 0.45;
        if (anim.t >= 1) {
          // 접었다 편 자국을 각 겹의 원래 종이 좌표로 남긴다
          const ln = bisector(anim.handle, anim.from);
          layers = anim.base.map((L) => ({
            poly: L.poly, m: L.m, flip: L.flip,
            creases: L.creases.concat([[invApply(L.m, ln[0]), invApply(L.m, ln[1])]]),
          }));
          anim = null;
          advance();
        }
      }
      if (finished) {
        doneT += dt;
        if (doneT > 1.5 && onDone) {
          const cb = onDone;
          onDone = null;
          cb(avg());
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
      if (drag && G.dist(drag.q, cur().handle) > 3) {
        const ln = bisector(cur().handle, drag.q);
        return foldLayers(layers, ln[0], ln[1], cur().handle);
      }
      return layers;
    }

    function path(ctx, poly) {
      ctx.beginPath();
      poly.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();
    }

    this.draw = function (ctx, w, h) {
      // 작업대
      ctx.fillStyle = '#3f7d6b';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.09)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = (w / 2) % 40; x < w; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
      for (let y = 0; y < h; y += 40) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
      ctx.stroke();

      const top = 120, bottom = 30;
      view.s = Math.min((w - 48) / W, (h - top - bottom) / H) * 0.86;
      view.sx = w / 2;
      view.sy = top + (h - top - bottom) / 2;

      // 종이가 화면 가운데 오도록 천천히 따라간다 (끄는 중에는 고정)
      if (!drag && !anim) {
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        const pts = [];
        layers.forEach((L) => L.poly.forEach((p) => pts.push(p)));
        if (!finished) pts.push(target(), cur().handle);
        pts.forEach((p) => { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
        view.cx += ((x0 + x1) / 2 - view.cx) * 0.08;
        view.cy += ((y0 + y1) / 2 - view.cy) * 0.08;
      }

      const fin = finished ? G.clamp(doneT / 0.9, 0, 1) : 0;
      ctx.save();
      ctx.translate(view.sx, view.sy);
      ctx.scale(view.s, view.s);
      ctx.translate(-view.cx, -view.cy);
      ctx.globalAlpha = 1 - fin;
      const px = 1 / view.s;
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

      // 안내선
      if (!finished && !anim) {
        const st = cur(), T = target(), Hp = st.handle;
        const a = st.line[0], b = st.line[1];
        const ex = (b[0] - a[0]) * 0.12, ey = (b[1] - a[1]) * 0.12;
        ctx.strokeStyle = '#ff5a4d';
        ctx.lineWidth = 2.2 * px;
        ctx.setLineDash([9 * px, 7 * px]);
        ctx.beginPath();
        ctx.moveTo(a[0] - ex, a[1] - ey);
        ctx.lineTo(b[0] + ex, b[1] + ey);
        ctx.stroke();
        // 목표 위치
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2.5 * px;
        ctx.setLineDash([5 * px, 5 * px]);
        ctx.beginPath();
        ctx.arc(T[0], T[1], 15 * px, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        if (!drag) {
          // 손잡이 → 목표로 움직이는 안내 점
          const k = (time * 0.7) % 1;
          const e = k < 0.8 ? k / 0.8 : 1;
          ctx.fillStyle = 'rgba(255,255,255,' + (k < 0.8 ? 0.85 : (1 - k) * 4) + ')';
          ctx.beginPath();
          ctx.arc(G.lerp(Hp[0], T[0], e), G.lerp(Hp[1], T[1], e), 6 * px, 0, Math.PI * 2);
          ctx.fill();
          const pulse = 11 + Math.sin(time * 5) * 2.5;
          ctx.fillStyle = '#ff5a4d';
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 3 * px;
          ctx.beginPath();
          ctx.arc(Hp[0], Hp[1], pulse * px, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else {
          const near = G.dist(drag.q, T) <= TOL;
          ctx.fillStyle = near ? '#7be08f' : '#ff5a4d';
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 3 * px;
          ctx.beginPath();
          ctx.arc(drag.q[0], drag.q[1], 10 * px, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }
      ctx.restore();

      // 완성품 등장
      if (finished) {
        const pop = fin < 1 ? 0.6 + 0.5 * Math.sin(fin * Math.PI * 0.62) / Math.sin(Math.PI * 0.62) : 1.1 - 0.1 * G.clamp((doneT - 0.9) / 0.2, 0, 1);
        ctx.save();
        ctx.translate(w / 2, view.sy);
        ctx.globalAlpha = fin;
        ctx.scale(pop, pop);
        ctx.rotate(Math.sin(time * 2) * 0.04);
        G.drawCraft(ctx, model.section, model.id, color, Math.min(w * 0.6, 300));
        ctx.restore();
      }

      if (toast) {
        const a = toast.t < 0.15 ? toast.t / 0.15 : toast.t > 1 ? (1.3 - toast.t) / 0.3 : 1;
        ctx.save();
        ctx.globalAlpha = Math.max(0, a);
        ctx.font = '700 20px system-ui, sans-serif';
        ctx.textAlign = 'center';
        const tw = ctx.measureText(toast.text).width + 36;
        const ty = h - 70 - toast.t * 10;
        ctx.fillStyle = toast.good ? '#fff7df' : '#fff';
        ctx.beginPath();
        ctx.roundRect(w / 2 - tw / 2, ty - 26, tw, 40, 20);
        ctx.fill();
        ctx.fillStyle = toast.good ? '#c9702a' : '#555';
        ctx.fillText(toast.text, w / 2, ty);
        ctx.restore();
      }
    };
  };
})();
