/* 종이 자동차: 접힌 모양(옆모습)을 차체로 하는 2D 강체 시뮬레이션.
   두 바퀴는 스프링-댐퍼 접촉, 뒷바퀴는 고무줄이 풀리는 힘으로 굴린다.
   무게중심·관성·공기저항은 접힌 모양에서 계산한다. */
(function () {
  const G = window.G;
  const U = 0.5 / 280; // 종이 단위 → m (종이 긴 변 = 50cm)
  const GRAV = 9.8, KS = 1400, CS = 34, DMAX = 13, A0 = 7.5;

  function hgt(x) {
    if (x < 1.5) return 0;
    const z = x - 1.5, A = Math.min(0.03 + z / 160, 0.34);
    return A * (Math.sin(z * 0.62 - 1.2) + Math.sin(1.2) + 0.55 * Math.sin(z * 0.27 + 0.5) - 0.55 * Math.sin(0.5) + 0.3 * Math.sin(z * 1.55) * G.smooth(0, 6, z));
  }
  const slope = (x) => (hgt(x + 0.01) - hgt(x - 0.01)) / 0.02;

  G.PHYS.car = function (a) {
    const Lp = a.w * U, Hp = a.h * U, bottom = a.y0 + a.h;
    const r = G.clamp(0.1 * Lp, 0.03, 0.055);
    // 종이 60% + 바퀴·축·고무줄 40% (바닥에 실림)
    const cgx = 0.6 * a.mcx + 0.4 * (a.x0 + a.w / 2), cgy = 0.6 * a.mcy + 0.4 * bottom;
    const ry2 = (0.6 * (a.ixx + a.iyy + (a.mcx - cgx) ** 2 + (a.mcy - cgy) ** 2) + 0.4 * ((0.3 * a.w) ** 2 + (bottom - cgy) ** 2)) * U * U;
    const loc = (px, py) => [(px - cgx) * U, -(py - cgy) * U];
    const P = {
      Lp, Hp, r, cgx, cgy, ry2: Math.max(ry2, 0.004),
      wr: loc(a.x0 + 0.2 * a.w, bottom), wf: loc(a.x0 + 0.8 * a.w, bottom),
      kd: 0.03 + 0.5 * Hp * (0.3 + a.rightFill),       // 공기저항: 높고 앞이 뭉툭할수록 큼
      crr: 0.02 + 0.03 / a.nbar,                         // 얇은 차체는 처져서 구름저항이 큼
      cgh: (bottom - cgy) * U + r,
    };
    P.bars = [
      { label: '날렵함', v: G.clamp(1.3 - P.kd / 0.12, 0, 1) },
      { label: '낮은 무게중심', v: G.clamp(1.25 - P.cgh / 0.14, 0, 1) },
      { label: '튼튼함', v: G.clamp((a.nbar - 1) / 2.5, 0.05, 1) },
    ];
    P.tip = Lp < 0.2 ? '차가 너무 짧아 앞뒤로 뒤집히기 쉬워요.'
      : P.cgh > 0.12 ? '키가 커서 바람을 많이 받고 언덕에서 뒤집힐 수 있어요.'
      : a.nbar < 1.5 ? '종이가 얇아 차체가 처져요. 한두 번 더 접어 튼튼하게 해 보세요.'
      : a.rightFill > 0.75 ? '앞이 뭉툭해요. 앞쪽 위 모서리를 접으면 더 빨라져요.' : '낮고 날렵해요. 잘 달릴 거예요!';
    return P;
  };

  G.CarScene = function (craft, ui, onEnd) {
    const A = G.analyze(craft.shape), P = G.PHYS.car(A);
    const pts = G.hull(craft.shape.reduce((acc, L) => acc.concat(L.p), [])).map((q) => [(q[0] - P.cgx) * U, -(q[1] - P.cgy) * U]);
    const restY = P.r - P.wr[1] + GRAV / (2 * KS);
    const S = { phase: 'aim', x: 0, y: restY, vx: 0, vy: 0, th: 0, om: 0, band: 0, pull: 0, hold: false, t: 0, max: 0, top: 0, still: 0, back: 0, spin: 0, time: 0, endT: 0, why: '', camY: 0, drive: 0, lastStretch: 0, air: 0 };
    const picks = [];
    for (let x = 9; x < 600; x += 12 + x / 5) picks.push({ x, got: false });
    const dust = [];
    let aim = null, snd = null;
    this.state = S; this.params = P;

    this.release = function (pull) {
      S.band = pull; S.x = -pull * 0.5; S.phase = 'run';
      G.sfx.twang();
      snd = G.sfx.loop('car');
    };
    this.stop = function () { if (snd) snd.stop(); snd = null; };
    this.pointer = function (type, x) {
      if (S.phase === 'aim') {
        if (type === 'down') aim = { x };
        else if (type === 'move' && aim) {
          S.pull = G.clamp((aim.x - x) / 130, 0, 1);
          if (Math.abs(S.pull - S.lastStretch) > 0.08) { S.lastStretch = S.pull; G.sfx.stretch(S.pull); }
        } else if (type === 'up' && aim) { aim = null; if (S.pull > 0.15) this.release(S.pull); S.pull = 0; }
      } else {
        if (type === 'down') S.hold = true;
        if (type === 'up') S.hold = false;
      }
    };
    this.key = function (code, down) { if (code === 'Space' && S.phase === 'run') S.hold = down; };

    function step(dt) {
      const c = Math.cos(S.th), s = Math.sin(S.th);
      let fx = 0, fy = -GRAV, tq = 0, ground = 0;
      const v = Math.hypot(S.vx, S.vy);
      fx -= P.kd * v * S.vx; fy -= P.kd * v * S.vy;
      S.drive = 0;
      const contact = (lx, ly, rad, wheel, driven) => {
        const cx = S.x + lx * c - ly * s, cy = S.y + lx * s + ly * c;
        const m = slope(cx), inv = 1 / Math.sqrt(1 + m * m);
        const nx = -m * inv, ny = inv;
        const pen = rad - (cy - hgt(cx)) * inv;
        if (pen <= 0) return;
        const rx = cx - nx * rad - S.x, ry = cy - ny * rad - S.y;
        const vcx = S.vx - S.om * ry, vcy = S.vy + S.om * rx;
        const vn = vcx * nx + vcy * ny, vt = vcx * ny - vcy * nx; // 접선 = (ny, -nx)
        const Fn = Math.max(0, KS * pen - CS * vn);
        let Ft;
        if (wheel) {
          ground++;
          Ft = -P.crr * Fn * Math.tanh(vt / 0.05);
          if (driven && S.band > 0 && !S.hold) {
            const f = Math.min(A0 * (0.3 + 0.7 * S.band), 0.9 * Fn);
            Ft += f;
            S.drive = f / A0;
            S.band = Math.max(0, S.band - (Math.max(0, vt) * dt + 0.02 * dt) / DMAX);
          }
        } else Ft = -0.7 * Fn * Math.tanh(vt / 0.1); // 차체가 긁힘
        const Fx = Fn * nx + Ft * ny, Fy = Fn * ny - Ft * nx;
        fx += Fx; fy += Fy; tq += rx * Fy - ry * Fx;
      };
      contact(P.wr[0], P.wr[1], P.r, true, true);
      contact(P.wf[0], P.wf[1], P.r, true, false);
      for (const q of pts) contact(q[0], q[1], 0, false, false);
      S.vx += fx * dt; S.vy += fy * dt; S.om += (tq / P.ry2) * dt;
      S.om *= 1 - 0.4 * dt;
      S.x += S.vx * dt; S.y += S.vy * dt; S.th += S.om * dt;
      S.air = ground ? 0 : S.air + dt;
      if (S.x < -1.2) { S.x = -1.2; S.vx = Math.max(0, S.vx); }
    }

    this.update = function (dt) {
      S.time += dt;
      if (S.phase === 'run') {
        const n = 12;
        for (let i = 0; i < n; i++) step(dt / n);
        S.t += dt;
        S.spin += (S.vx * dt) / P.r;
        S.max = Math.max(S.max, S.x);
        S.top = Math.max(S.top, S.vx * 3.6);
        for (const p of picks) if (!p.got && Math.abs(p.x - S.x) < 0.3 && Math.abs(hgt(p.x) - S.y) < 0.5) { p.got = true; S.band = Math.min(1, S.band + 0.35); G.sfx.ding(); }
        if (S.drive > 0 && Math.random() < 0.5) dust.push({ x: S.x - P.Lp * 0.4, y: hgt(S.x - P.Lp * 0.4) + 0.02, t: 0 });
        if (snd) snd.set({ v: S.vx, drive: S.drive });
        const sp = Math.hypot(S.vx, S.vy);
        S.still = sp < 0.08 && Math.abs(S.om) < 0.4 ? S.still + dt : 0;
        S.back = S.vx < -0.05 && S.band <= 0 ? S.back + dt : 0;
        const flipped = Math.cos(S.th) < 0.2;
        if (flipped && S.still > 0.6) this.finish('뒤집혔어요!');
        else if (S.band <= 0 && S.still > 0.8) this.finish('고무줄이 다 풀렸어요');
        else if (S.back > 1.6) this.finish('언덕을 못 넘었어요');
        else if (S.still > (S.hold ? 4 : 1.6)) this.finish('더 나아가지 못했어요');
      } else if (S.phase === 'done') {
        S.endT += dt;
        if (S.endT > 0.9 && onEnd) { const cb = onEnd; onEnd = null; cb({ dist: Math.max(0, S.max), speed: Math.max(0, S.top) }); }
      }
      for (const d of dust) d.t += dt;
      while (dust.length && dust[0].t > 0.6) dust.shift();
      ui.hud({
        a: Math.max(0, S.max).toFixed(1) + ' m', b: (Math.max(0, S.vx) * 3.6).toFixed(0) + ' km/h',
        gauges: [{ label: '➰ 고무줄' + (S.hold && S.phase === 'run' ? ' (잡는 중)' : ''), v: S.phase === 'aim' ? S.pull : S.band, color: '#e8554e' }],
        hint: S.phase === 'aim' ? '차를 뒤로(←) 당겨 고무줄을 감았다 놓으세요!' : S.phase === 'done' ? S.why : S.t < 6 ? '내리막에서는 꾹 눌러 고무줄을 잡아 아끼세요' : '',
      });
    };
    this.finish = function (why) { S.phase = 'done'; S.why = why; this.stop(); if (why.indexOf('뒤집') >= 0) G.sfx.thud(); };

    this.draw = function (ctx, w, h) {
      const s = G.clamp(w / 3.6, 105, 190);
      const px = S.phase === 'aim' ? -S.pull * 0.5 : S.x;
      const camX = px - (w * 0.34) / s;
      S.camY += ((S.phase === 'aim' ? 0 : hgt(S.x)) - S.camY) * 0.1;
      const X = (x) => (x - camX) * s, Y = (y) => h * 0.64 - (y - S.camY) * s;

      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#ffd9a0');
      sky.addColorStop(1, '#fff3dc');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fff6c9';
      ctx.beginPath(); ctx.arc(w * 0.78, h * 0.2, 36, 0, 7); ctx.fill();
      [['#f3c98f', 0.08, 70], ['#e2b377', 0.18, 30]].forEach(([col, par, up], k) => {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 16) {
          const wx = x + camX * s * par;
          ctx.lineTo(x, h * 0.6 - up - Math.sin(wx * 0.008 + k) * 26 - Math.sin(wx * 0.021 + k * 2) * 12);
        }
        ctx.lineTo(w, h);
        ctx.fill();
      });

      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let q = 0; q <= w + 6; q += 6) ctx.lineTo(q, Y(hgt(camX + q / s)));
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fillStyle = '#8fbf6a';
      ctx.fill();
      ctx.beginPath();
      for (let q = 0; q <= w + 6; q += 6) { const y = Y(hgt(camX + q / s)) + 5; q ? ctx.lineTo(q, y) : ctx.moveTo(q, y); }
      ctx.strokeStyle = '#5b5750';
      ctx.lineWidth = 12;
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.strokeStyle = '#f5e9c8';
      ctx.lineWidth = 2;
      ctx.setLineDash([14, 14]);
      ctx.lineDashOffset = camX * s;
      ctx.stroke();
      ctx.setLineDash([]);

      // 출발선과 거리 표지
      ctx.fillStyle = '#fff';
      ctx.fillRect(X(0) - 2, Y(0) - 2, 4, 14);
      ctx.font = '700 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      for (let m = Math.max(1, Math.ceil(camX)); m < camX + w / s + 1; m++) {
        const sx = X(m), sy = Y(hgt(m));
        if (m % 5) { ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(sx - 1, sy + 12, 2, 6); continue; }
        ctx.fillStyle = '#8a6a48';
        ctx.fillRect(sx - 1.5, sy - 40, 3, 40);
        ctx.fillStyle = '#fff';
        ctx.fillRect(sx - 18, sy - 56, 36, 17);
        ctx.fillStyle = '#4b4239';
        ctx.fillText(m + 'm', sx, sy - 43);
      }
      for (const p of picks) {
        if (p.got) continue;
        const sx = X(p.x);
        if (sx < -30 || sx > w + 30) continue;
        const sy = Y(hgt(p.x)) - 26 + Math.sin(S.time * 3 + p.x) * 3;
        ctx.strokeStyle = '#e8554e'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.ellipse(sx, sy, 12, 8, 0.4, 0, 7); ctx.stroke();
        ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(sx, sy, 12, 8, 0.4, 0, 7); ctx.stroke();
      }
      for (const d of dust) {
        ctx.fillStyle = 'rgba(255,255,255,' + (0.6 - d.t) + ')';
        ctx.beginPath(); ctx.arc(X(d.x) - d.t * 20, Y(d.y) - d.t * 16, 4 + d.t * 10, 0, 7); ctx.fill();
      }

      // 차체(접은 모양) + 바퀴 + 고무줄
      const k = s * U;
      ctx.save();
      ctx.translate(X(px), Y(S.y));
      ctx.rotate(-S.th);
      ctx.save();
      ctx.scale(k, k);
      ctx.translate(-P.cgx, -P.cgy);
      G.drawShape(ctx, craft.shape, craft.color, 1 / k);
      ctx.restore();
      const wy = -P.wr[1] * s, R = P.r * s;
      const stretch = S.phase === 'aim' ? S.pull : S.band;
      ctx.strokeStyle = '#e8554e';
      ctx.lineWidth = 1.5 + stretch * 2;
      ctx.beginPath(); ctx.moveTo(P.wr[0] * s, wy); ctx.lineTo(P.wf[0] * s, wy); ctx.stroke();
      [P.wr[0], P.wf[0]].forEach((wx) => {
        ctx.save();
        ctx.translate(wx * s, wy);
        ctx.rotate(S.spin);
        ctx.fillStyle = '#4b4239';
        ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.fill();
        ctx.fillStyle = '#efe6d3';
        ctx.beginPath(); ctx.arc(0, 0, R * 0.45, 0, 7); ctx.fill();
        ctx.strokeStyle = '#4b4239'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-R * 0.45, 0); ctx.lineTo(R * 0.45, 0); ctx.stroke();
        ctx.restore();
      });
      ctx.restore();
      if (S.phase === 'aim' && S.pull > 0) {
        ctx.fillStyle = '#4b4239';
        ctx.font = '700 14px system-ui, sans-serif';
        ctx.fillText('감기 ' + Math.round(S.pull * 100) + '%', X(px), Y(S.y) - P.Hp * s - 16);
      }
    };
  };
})();
