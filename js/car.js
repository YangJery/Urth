/* 종이 자동차 달리기 (옆에서 본 언덕길) */
(function () {
  const G = window.G;
  const GRAV = 9.8, TOP = 3.2;

  function hgt(x) {
    if (x < 0) x = 0;
    const ramp = x < 10 ? TOP * (0.5 + 0.5 * Math.cos((Math.PI * x) / 10)) : 0;
    const A = Math.min(0.12 + x / 110, 1.0);
    return ramp + A * (Math.sin(x * 0.21) + 0.6 * Math.sin(x * 0.083 + 1) + 0.35 * Math.sin(x * 0.47 + 2));
  }
  const slope = (x) => (hgt(x + 0.05) - hgt(x - 0.05)) / 0.1;

  G.CarScene = function (craft, model, ui, onEnd) {
    const P = model.phys, eff = G.eff(craft.q);
    const S = { phase: 'ready', x: 0, v: 0, t: 0, energy: 1, hold: false, max: 0, top: 0, still: 0, back: 0, spin: 0, camY: TOP, time: 0, endT: 0, why: '' };
    const picks = [];
    for (let x = 28; x < 3000; x += 30 + x / 8 + G.rand(0, 8)) picks.push({ x, got: false });
    const dust = [];
    this.state = S; // 테스트용

    this.pointer = function (type) {
      if (type === 'down') { S.hold = true; if (S.phase === 'ready') S.phase = 'run'; }
      if (type === 'up') S.hold = false;
    };
    this.key = function (code, down) {
      if (code === 'Space' || code === 'ArrowRight') { S.hold = down; if (down && S.phase === 'ready') S.phase = 'run'; }
    };

    function finish(why) {
      S.phase = 'done';
      S.why = why;
    }

    this.update = function (dt) {
      S.time += dt;
      if (S.phase === 'run') {
        const n = 4, h = dt / n;
        for (let i = 0; i < n; i++) {
          const th = Math.atan(slope(S.x));
          const crr = (P.crr / eff) * (1 + S.max / 400);
          let a = -GRAV * Math.sin(th) - P.cd * S.v * Math.abs(S.v);
          const thrust = S.hold && S.energy > 0;
          if (thrust) { a += P.power; S.energy = Math.max(0, S.energy - h / (P.tank * (0.8 + 0.2 * eff))); }
          const fr = crr * GRAV * Math.cos(th);
          if (Math.abs(S.v) < 0.05 && Math.abs(a) <= fr) { S.v = 0; a = 0; } else a -= Math.sign(S.v || a) * fr;
          S.v += a * h;
          S.x += S.v * Math.cos(th) * h;
          if (S.x < 0) { S.x = 0; S.v = 0; }
        }
        S.t += dt;
        S.spin += (S.v * dt) / 0.25;
        S.max = Math.max(S.max, S.x);
        S.top = Math.max(S.top, S.v * 3.6);
        for (const p of picks) {
          if (!p.got && Math.abs(p.x - S.x) < 0.8) { p.got = true; S.energy = Math.min(1, S.energy + 0.3); }
        }
        if (S.hold && S.energy > 0 && Math.random() < 0.5) dust.push({ x: S.x - 0.6, y: hgt(S.x - 0.6) + 0.1, t: 0 });
        S.still = Math.abs(S.v) < 0.15 ? S.still + dt : 0;
        S.back = S.v < -0.1 && S.energy <= 0 ? S.back + dt : 0;
        if (S.energy <= 0 && S.still > 0.7) finish('멈췄어요');
        else if (S.back > 1.3) finish('언덕을 못 넘었어요');
        else if (S.still > 6) finish('멈췄어요');
      } else if (S.phase === 'done') {
        S.endT += dt;
        if (S.endT > 0.9 && onEnd) {
          const cb = onEnd;
          onEnd = null;
          cb({ dist: S.max, speed: S.top });
        }
      }
      for (const d of dust) d.t += dt;
      while (dust.length && dust[0].t > 0.6) dust.shift();
      ui.hud({
        a: S.max.toFixed(1) + ' m', b: (Math.max(0, S.v) * 3.6).toFixed(0) + ' km/h', gauge: S.energy, gaugeLabel: '⚙️ 태엽',
        hint: S.phase === 'ready' ? '화면을 꾹 누르면 태엽이 풀리며 달려요!' : S.phase === 'done' ? S.why : S.t < 5 ? '오르막에서만 눌러 태엽을 아끼세요. 고무줄을 먹으면 충전!' : '',
      });
    };

    this.draw = function (ctx, w, h) {
      const s = G.clamp(w / 18, 24, 44);
      const camX = S.x - (w * 0.32) / s;
      S.camY += (hgt(S.x) - S.camY) * 0.1;
      const X = (x) => (x - camX) * s, Y = (y) => h * 0.62 - (y - S.camY) * s;

      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#ffd9a0');
      sky.addColorStop(1, '#fff3dc');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fff6c9';
      ctx.beginPath(); ctx.arc(w * 0.78, h * 0.2, 36, 0, 7); ctx.fill();
      // 먼 언덕
      [['#f3c98f', 0.2, 70], ['#e2b377', 0.4, 30]].forEach(([c, par, up], k) => {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 16) {
          const wx = x + camX * s * par;
          ctx.lineTo(x, h * 0.6 - up - Math.sin(wx * 0.008 + k) * 26 - Math.sin(wx * 0.021 + k * 2) * 12);
        }
        ctx.lineTo(w, h);
        ctx.fill();
      });

      // 지면
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let px = 0; px <= w + 8; px += 8) ctx.lineTo(px, Y(hgt(camX + px / s)));
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fillStyle = '#8fbf6a';
      ctx.fill();
      ctx.beginPath();
      for (let px = 0; px <= w + 8; px += 8) {
        const y = Y(hgt(camX + px / s)) + 5;
        px ? ctx.lineTo(px, y) : ctx.moveTo(px, y);
      }
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

      // 거리 표지판
      ctx.font = '700 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      for (let m = Math.max(10, Math.ceil(camX / 10) * 10); m < camX + w / s + 2; m += 10) {
        const sx = X(m), sy = Y(hgt(m));
        ctx.fillStyle = '#8a6a48';
        ctx.fillRect(sx - 1.5, sy - 34, 3, 34);
        ctx.fillStyle = '#fff';
        ctx.fillRect(sx - 17, sy - 48, 34, 16);
        ctx.fillStyle = '#4b4239';
        ctx.fillText(m + 'm', sx, sy - 36);
      }
      // 고무줄
      ctx.font = '22px system-ui, sans-serif';
      for (const p of picks) {
        if (p.got) continue;
        const sx = X(p.x);
        if (sx < -30 || sx > w + 30) continue;
        const sy = Y(hgt(p.x)) - 22 + Math.sin(S.time * 3 + p.x) * 3;
        ctx.strokeStyle = '#e8554e';
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.ellipse(sx, sy, 11, 7, 0.4, 0, 7); ctx.stroke();
        ctx.strokeStyle = '#ffd166';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(sx, sy, 11, 7, 0.4, 0, 7); ctx.stroke();
      }
      // 먼지
      for (const d of dust) {
        ctx.fillStyle = 'rgba(255,255,255,' + (0.6 - d.t) + ')';
        ctx.beginPath(); ctx.arc(X(d.x) - d.t * 20, Y(d.y) - d.t * 16, 4 + d.t * 10, 0, 7); ctx.fill();
      }
      // 자동차
      const size = Math.max(50, s * 1.6);
      const th = Math.atan(slope(S.x));
      ctx.save();
      ctx.translate(X(S.x), Y(hgt(S.x)));
      ctx.rotate(-th);
      ctx.translate(0, -size * 0.275);
      G.drawCraft(ctx, 'car', model.id, craft.color, size, S.spin);
      ctx.restore();
    };
  };
})();
