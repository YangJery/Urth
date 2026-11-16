/* 종이 배 띄우기 (위에서 본 냇물) */
(function () {
  const G = window.G;
  const SCALE = 36; // px / m

  G.BoatScene = function (craft, model, ui, onEnd) {
    const P = model.phys, eff = G.eff(craft.q);
    const S = { phase: 'float', x: 0, vx: 0, tx: 0, d: 0, t: 0, water: 0, time: 0, shake: 0, sinkT: 0, next: 8, keyDir: 0, spin: 0, flash: 0 };
    let objs = [];
    let RW = 200, W = 0, H = 0;

    function spawn() {
      const r = Math.random();
      const type = S.d < 6 ? 'rock' : r < 0.62 ? 'rock' : r < 0.8 ? 'whirl' : 'sun';
      const ahead = S.d + (H * 0.8) / SCALE + 3;
      const mk = (x) => objs.push({ type, x, d: ahead + G.rand(-0.6, 0.6), r: type === 'rock' ? G.rand(14, 25) : type === 'whirl' ? 34 : 15, seed: Math.random() * 100, hit: false });
      const x = G.rand(-0.9, 0.9);
      mk(x);
      if (type === 'rock' && S.d > 70 && Math.random() < Math.min(0.6, S.d / 300)) mk(x > 0 ? x - G.rand(0.8, 1.1) : x + G.rand(0.8, 1.1));
      S.next = S.d + Math.max(2.3, 6.5 - S.d / 55) * G.rand(0.7, 1.3);
    }

    this.pointer = function (type, x) {
      if (type === 'down' || type === 'move') S.tx = G.clamp((x - W / 2) / RW, -0.95, 0.95);
    };
    this.key = function (code, down) {
      if (code === 'ArrowLeft') S.keyDir = down ? -1 : S.keyDir === -1 ? 0 : S.keyDir;
      if (code === 'ArrowRight') S.keyDir = down ? 1 : S.keyDir === 1 ? 0 : S.keyDir;
    };

    this.update = function (dt) {
      S.time += dt;
      S.shake = Math.max(0, S.shake - dt * 3);
      S.flash = Math.max(0, S.flash - dt * 2.5);
      if (S.phase === 'float') {
        const v = P.speed * (2.4 + Math.min(S.d / 120, 3));
        S.d += v * dt;
        S.t += dt;
        if (S.keyDir) S.tx = G.clamp(S.tx + S.keyDir * 1.8 * dt, -0.95, 0.95);
        S.vx += (30 * P.agile * (S.tx - S.x) - 9 * S.vx) * dt;
        S.x += S.vx * dt;
        if (Math.abs(S.x) > 0.93) { S.x = Math.sign(S.x) * 0.93; S.vx = 0; S.water += 0.06 * dt; }
        S.water += (dt * 0.012 * (1 + S.t / 45)) / (P.tough * eff);
        if (S.d >= S.next) spawn();
        for (const o of objs) {
          const dx = (o.x - S.x) * RW, dy = (o.d - S.d) * SCALE;
          const dd = Math.hypot(dx, dy);
          if (o.type === 'rock' && !o.hit && dd < o.r + 13) {
            o.hit = true;
            S.water += 0.2 / (P.tough * eff);
            S.vx = (dx > 0 ? -1 : 1) * 1.6;
            S.shake = 1;
            S.flash = 1;
          } else if (o.type === 'whirl' && dd < o.r + 8) {
            S.water += (0.22 * dt) / P.tough;
            S.vx += Math.sign(o.x - S.x) * 2.2 * dt;
            S.spin += dt * 6;
          } else if (o.type === 'sun' && !o.hit && dd < o.r + 16) {
            o.hit = true;
            S.water = Math.max(0, S.water - 0.13);
          }
        }
        objs = objs.filter((o) => (o.d - S.d) * SCALE > -H * 0.4 && !(o.type === 'sun' && o.hit));
        if (S.water >= 1) { S.water = 1; S.phase = 'sink'; }
      } else if (S.phase === 'sink') {
        S.sinkT += dt;
        if (S.sinkT > 1.5 && onEnd) {
          const cb = onEnd;
          onEnd = null;
          cb({ dist: S.d, time: S.t });
        }
      }
      ui.hud({
        a: S.d.toFixed(1) + ' m', b: S.t.toFixed(1) + ' 초', gauge: S.water, gaugeLabel: '💧 젖음', gaugeBad: true,
        hint: S.t < 4 ? '손가락(마우스)을 따라 배가 움직여요. 바위를 피하고 ☀️로 말리세요!' : '',
      });
    };

    function drawBoat(ctx, c) {
      const id = model.id;
      const len = id === 'canoe' ? 30 : id === 'sail' ? 24 : 26, wid = id === 'canoe' ? 8 : id === 'sail' ? 12 : 11;
      const hull = () => { ctx.beginPath(); ctx.moveTo(0, -len); ctx.quadraticCurveTo(wid * 1.5, 0, 0, len); ctx.quadraticCurveTo(-wid * 1.5, 0, 0, -len); };
      hull();
      ctx.fillStyle = c;
      ctx.fill();
      ctx.strokeStyle = 'rgba(60,45,30,0.55)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.save();
      hull();
      ctx.clip();
      ctx.fillStyle = 'rgba(0,0,0,0.13)';
      ctx.fillRect(0, -len, wid * 2, len * 2);
      ctx.restore();
      if (id === 'classic') {
        ctx.fillStyle = G.shade(craft.color, 0.45);
        ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(5, 0); ctx.lineTo(0, 11); ctx.lineTo(-5, 0); ctx.closePath();
        ctx.fill(); ctx.stroke();
      } else if (id === 'sail') {
        ctx.fillStyle = G.shade(craft.color, 0.5);
        ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(9, 10); ctx.lineTo(0, 12); ctx.closePath();
        ctx.fill(); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(0, -len + 6); ctx.lineTo(0, len - 6); ctx.stroke();
      }
    }

    this.draw = function (ctx, w, h) {
      W = w; H = h;
      RW = Math.min(w * 0.42, 230);
      const by = h * 0.72;
      const Y = (d) => by - (d - S.d) * SCALE;
      const scroll = S.d * SCALE;

      // 둑
      ctx.fillStyle = '#7cc46b';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#5fae55';
      for (let i = 0; i < 40; i++) {
        const side = i % 2 ? 1 : -1;
        const gx = w / 2 + side * (RW + 22 + G.hash(i) * Math.max(10, w / 2 - RW - 30));
        const gy = ((G.hash(i + 50) * (h + 80) + scroll) % (h + 80)) - 40;
        ctx.beginPath(); ctx.arc(gx, gy, 9 + G.hash(i + 9) * 9, 0, 7); ctx.fill();
      }
      // 물
      ctx.fillStyle = '#d9c9a0';
      ctx.fillRect(w / 2 - RW - 26, 0, RW * 2 + 52, h);
      const wg = ctx.createLinearGradient(w / 2 - RW, 0, w / 2 + RW, 0);
      wg.addColorStop(0, '#5fb6e6'); wg.addColorStop(0.5, '#49a3dc'); wg.addColorStop(1, '#5fb6e6');
      ctx.fillStyle = wg;
      ctx.fillRect(w / 2 - RW - 18, 0, RW * 2 + 36, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      for (let i = 0; i < 26; i++) {
        const sx = w / 2 + (G.hash(i + 3) * 2 - 1) * RW;
        const sy = ((G.hash(i + 70) * (h + 60) + scroll * (1.15 + G.hash(i) * 0.3)) % (h + 60)) - 30;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy + 12 + G.hash(i + 5) * 16); ctx.stroke();
      }
      // 거리 표시
      ctx.font = '700 12px system-ui, sans-serif';
      ctx.textAlign = 'left';
      for (let m = Math.ceil(S.d / 10) * 10; m < S.d + h / SCALE; m += 10) {
        if (m <= 0) continue;
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(w / 2 - RW - 18, Y(m), RW * 2 + 36, 2);
        ctx.fillStyle = '#fff';
        ctx.fillText(m + ' m', w / 2 - RW - 10, Y(m) - 5);
      }

      for (const o of objs) {
        const ox = w / 2 + o.x * RW, oy = Y(o.d);
        if (o.type === 'rock') {
          ctx.strokeStyle = 'rgba(255,255,255,0.7)';
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(ox, oy + 3, o.r + 3 + Math.sin(S.time * 4 + o.seed) * 1.5, 0.2, Math.PI - 0.2); ctx.stroke();
          ctx.fillStyle = '#8a8f98';
          ctx.beginPath();
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2, rr = o.r * (0.82 + G.hash(o.seed + k) * 0.3);
            k ? ctx.lineTo(ox + Math.cos(a) * rr, oy + Math.sin(a) * rr) : ctx.moveTo(ox + Math.cos(a) * rr, oy + Math.sin(a) * rr);
          }
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.25)';
          ctx.beginPath(); ctx.arc(ox - o.r * 0.25, oy - o.r * 0.25, o.r * 0.35, 0, 7); ctx.fill();
        } else if (o.type === 'whirl') {
          ctx.strokeStyle = 'rgba(255,255,255,0.75)';
          ctx.lineWidth = 2.5;
          for (let k = 0; k < 3; k++) {
            ctx.beginPath();
            const a0 = S.time * 4 + (k * Math.PI * 2) / 3;
            for (let j = 0; j <= 14; j++) {
              const rr = o.r * (j / 14), a = a0 + j * 0.32;
              j ? ctx.lineTo(ox + Math.cos(a) * rr, oy + Math.sin(a) * rr) : ctx.moveTo(ox, oy);
            }
            ctx.stroke();
          }
        } else {
          ctx.font = '26px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('☀️', ox, oy + 9 + Math.sin(S.time * 3 + o.seed) * 2);
        }
      }

      // 배
      const sink = G.clamp(S.sinkT / 1.4, 0, 1);
      const bx = w / 2 + S.x * RW + Math.sin(S.time * 40) * S.shake * 4;
      ctx.save();
      ctx.translate(bx, by);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-9, 22); ctx.lineTo(-13, 44); ctx.moveTo(9, 22); ctx.lineTo(13, 44); ctx.stroke();
      ctx.rotate(S.vx * 0.35 + Math.sin(S.time * 2.2) * 0.05 + (S.phase === 'sink' ? S.sinkT * 2.5 : 0));
      ctx.scale(1.25 * (1 - sink * 0.75), 1.25 * (1 - sink * 0.75));
      ctx.globalAlpha = 1 - sink;
      const c = G.shade(craft.color, -0.35 * S.water);
      drawBoat(ctx, S.flash > 0 ? G.shade(craft.color, 0.6 * S.flash) : c);
      ctx.restore();
      if (S.phase === 'sink') {
        ctx.strokeStyle = 'rgba(255,255,255,' + (1 - sink) + ')';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(bx, by, 14 + sink * 46, 0, 7); ctx.stroke();
      }
    };
  };
})();
