/* 종이 배: 접힌 모양(위에서 본 선체)으로 저항·복원력·젖는 속도를 계산하고
   고무줄 물레방아로 추진한다. 전진·선회·횡요(좌우 흔들림)를 따로 적분한다. */
(function () {
  const G = window.G;
  const U = 0.00105, HALF = 0.9; // 냇물 반폭(m)

  G.PHYS.boat = function (a) {
    const Lp = a.h * U, Bp = a.w * U;
    const stab = Math.sqrt(a.axx) / (0.289 * 200); // 1 = 폭 21cm 상자
    const slender = a.h / Math.max(a.w, 1);
    const P = {
      Lp, Bp, r: Math.max(Lp, Bp) / 2,
      kq: 1.0 + (5 * (0.35 + a.topFill)) / slender,   // 조파 저항: 뭉툭하고 넓을수록 큼
      wr2: 26 + 420 * stab * stab,                     // 횡요 복원 (폭²에 비례)
      soak: 0.02 / Math.pow(a.nbar, 1.1),            // 두꺼울수록 천천히 젖음
      tough: Math.sqrt(a.nbar),
      agile: G.clamp(0.24 / Lp, 0.7, 1.5),
      bias: G.clamp(a.lean * 14, -1, 1) + (a.asym > 0.04 ? Math.sign(a.lean || 1) * a.asym * 3 : 0),
    };
    P.bars = [
      { label: '날렵함', v: G.clamp(1.25 - P.kq / 6, 0, 1) },
      { label: '안정성', v: G.clamp(stab * 1.15, 0, 1) },
      { label: '두께', v: G.clamp((a.nbar - 1) / 3, 0.05, 1) },
    ];
    P.tip = a.nbar < 1.3 ? '종이가 얇아 금방 젖어요. 여러 겹으로 접어 두껍게 해 보세요.'
      : stab < 0.42 ? '폭이 좁아 빠르지만 물결에 잘 흔들려요.'
      : P.kq > 4.5 ? '넓고 뭉툭해 느리지만 든든해요. 뱃머리를 뾰족하게 하면 빨라져요.'
      : Math.abs(P.bias) > 0.3 ? '좌우가 달라 한쪽으로 자꾸 돌아요.' : '균형 잡힌 선체예요!';
    return P;
  };

  G.BoatScene = function (craft, ui, onEnd) {
    const A = G.analyze(craft.shape), P = G.PHYS.boat(A);
    const S = { phase: 'aim', x: 0, d: 0, psi: 0, u: 0, r: 0, phi: 0, p: 0, tx: 0, t: 0, water: 0, band: 0, pull: 0, time: 0, shake: 0, flash: 0, sinkT: 0, why: '', next: 3, keyDir: 0, paddle: 0, lastStretch: 0 };
    const rnd = G.rng(777);
    let objs = [], aim = null, snd = null, W = 0, H = 0, SC = 200;

    function spawn() {
      const q = rnd();
      const type = S.next < 5 ? 'rock' : q < 0.55 ? 'rock' : q < 0.7 ? 'whirl' : q < 0.86 ? 'sun' : 'band';
      const mk = (x) => objs.push({ type, x, d: S.next + rnd(-0.15, 0.15), r: type === 'rock' ? rnd(0.07, 0.13) : type === 'whirl' ? 0.2 : 0.09, seed: rnd(0, 100), hit: false });
      const x = rnd(-0.78, 0.78);
      mk(x);
      if (type === 'rock' && S.next > 25 && rnd() < Math.min(0.6, S.next / 90)) mk(x > 0 ? x - rnd(0.7, 0.95) : x + rnd(0.7, 0.95));
      S.next += Math.max(0.9, 2.3 - S.next / 45) * rnd(0.75, 1.25);
    }

    this.state = S; this.params = P;
    this.release = function (pull) { // 고무줄을 감았다 놓기
      S.band = pull; S.phase = 'float'; S.u = 0.2;
      G.sfx.twang(); G.sfx.horn();
      snd = G.sfx.loop('boat');
    };
    this.stop = function () { if (snd) snd.stop(); snd = null; };
    this.pointer = function (type, x, y) {
      if (S.phase === 'aim') {
        if (type === 'down') aim = { y };
        else if (type === 'move' && aim) {
          S.pull = G.clamp((y - aim.y) / 130, 0, 1);
          if (Math.abs(S.pull - S.lastStretch) > 0.08) { S.lastStretch = S.pull; G.sfx.stretch(S.pull); }
        } else if (type === 'up' && aim) { aim = null; if (S.pull > 0.15) this.release(S.pull); S.pull = 0; }
      } else if (type === 'down' || type === 'move') S.tx = G.clamp(((x - W / 2) / SC), -HALF, HALF);
    };
    this.key = function (code, down) {
      if (code === 'ArrowLeft') S.keyDir = down ? -1 : S.keyDir === -1 ? 0 : S.keyDir;
      if (code === 'ArrowRight') S.keyDir = down ? 1 : S.keyDir === 1 ? 0 : S.keyDir;
    };

    function step(dt) {
      // 추진: 고무줄이 풀리는 동안 물레방아가 민다
      const thrust = S.band > 0 ? 1.7 * (0.35 + 0.65 * S.band) : 0;
      if (S.band > 0) S.band = Math.max(0, S.band - dt / 9);
      S.u += (thrust - 0.25 * S.u - P.kq * S.u * Math.abs(S.u)) * dt;
      // 조타: 물을 가르는 속도가 있어야 키가 듣는다
      const auth = (0.3 + Math.min(1, S.u / 0.5)) * P.agile;
      const want = G.clamp(((S.tx - S.x) / HALF) * 1.7, -0.75, 0.75);
      S.r += ((14 * (want - S.psi) - 6.5 * S.r) * auth + P.bias * 2.2 * S.u) * dt;
      S.psi += S.r * dt;
      const cur = 0.35 + Math.min(S.d / 80, 0.65);
      S.x += S.u * Math.sin(S.psi) * dt;
      S.d += (cur + S.u * Math.cos(S.psi)) * dt;
      // 횡요: 물결과 급선회가 배를 흔든다. 많이 기울면 물이 넘어온다
      const wave = (3.5 + S.d / 7) * (Math.sin(S.t * 2.0) + 0.6 * Math.sin(S.t * 3.4 + 1) + 0.4 * Math.sin(S.t * 5.3 + 2));
      S.p += (-P.wr2 * S.phi - 2 * 0.22 * Math.sqrt(P.wr2) * S.p + wave + S.r * (S.u + 0.3) * 9) * dt;
      S.phi += S.p * dt;
      const over = Math.abs(S.phi) - 0.33;
      if (over > 0) S.water += over * 0.9 * dt;
      S.water += P.soak * (1 + S.t / 50) * dt;
      S.t += dt;
      const lim = HALF - P.Bp / 2;
      if (Math.abs(S.x) > lim) { S.x = Math.sign(S.x) * lim; S.u *= 1 - 2 * dt; S.psi *= 1 - 4 * dt; S.water += 0.05 * dt; }
    }

    this.update = function (dt) {
      S.time += dt;
      S.shake = Math.max(0, S.shake - dt * 3);
      S.flash = Math.max(0, S.flash - dt * 2.5);
      if (S.phase === 'float') {
        if (S.keyDir) S.tx = G.clamp(S.tx + S.keyDir * 1.6 * dt, -HALF, HALF);
        for (let i = 0; i < 4; i++) step(dt / 4);
        S.paddle += (S.band > 0 ? 14 : S.u * 6) * dt;
        while (S.next < S.d + 4.5) spawn();
        for (const o of objs) {
          const dx = o.x - S.x, dy = o.d - S.d, dd = Math.hypot(dx, dy);
          if (o.type === 'rock' && !o.hit && dd < o.r + P.r * 0.7) {
            o.hit = true;
            S.water += 0.16 / P.tough;
            S.u *= 0.25; S.r += (dx > 0 ? -1 : 1) * 3; S.p += (dx > 0 ? -1 : 1) * 4; S.x -= Math.sign(dx || 1) * 0.04;
            S.shake = 1; S.flash = 1;
            G.sfx.thud(); G.sfx.splash();
          } else if (o.type === 'whirl' && dd < o.r + 0.05) {
            S.water += (0.2 * dt) / P.tough;
            S.r += 5 * dt; S.x += Math.sign(dx) * 0.25 * dt;
          } else if ((o.type === 'sun' || o.type === 'band') && !o.hit && dd < o.r + P.r) {
            o.hit = true;
            if (o.type === 'sun') S.water = Math.max(0, S.water - 0.13); else S.band = Math.min(1, S.band + 0.5);
            G.sfx.ding();
          }
        }
        objs = objs.filter((o) => o.d > S.d - 2 && !((o.type === 'sun' || o.type === 'band') && o.hit));
        if (snd) snd.set({ thrust: S.band > 0 ? 0.35 + 0.65 * S.band : 0, u: S.u });
        if (Math.abs(S.phi) > 1.15) { S.phase = 'sink'; S.why = '뒤집혔어요!'; }
        else if (S.water >= 1) { S.water = 1; S.phase = 'sink'; S.why = '흠뻑 젖어 가라앉았어요'; }
        if (S.phase === 'sink') { this.stop(); G.sfx.bubble(); }
      } else if (S.phase === 'sink') {
        S.sinkT += dt;
        if (S.sinkT > 1.5 && onEnd) { const cb = onEnd; onEnd = null; cb({ dist: S.d, time: S.t }); }
      }
      ui.hud({
        a: S.d.toFixed(1) + ' m', b: S.t.toFixed(1) + ' 초',
        gauges: [{ label: '💧 젖음', v: S.water, color: '#4a8fe7' }, { label: '➰ 고무줄', v: S.phase === 'aim' ? S.pull : S.band, color: '#e8554e' }],
        hint: S.phase === 'aim' ? '아래로 당겨 고무줄을 감았다 놓으세요!' : S.phase === 'sink' ? S.why : S.t < 5 ? '손가락 쪽으로 키를 돌려요. 바위를 피하고 ☀️·➰을 주우세요' : '',
      });
    };

    this.draw = function (ctx, w, h) {
      W = w; H = h;
      const RW = Math.min(w * 0.42, 230);
      SC = RW / HALF;
      const by = h * 0.72;
      const Y = (d) => by - (d - S.d) * SC;
      const scroll = S.d * SC;

      ctx.fillStyle = '#7cc46b';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#5fae55';
      for (let i = 0; i < 40; i++) {
        const sd = i % 2 ? 1 : -1;
        const gx = w / 2 + sd * (RW + 22 + G.hash(i) * Math.max(10, w / 2 - RW - 30));
        const gy = ((G.hash(i + 50) * (h + 80) + scroll) % (h + 80)) - 40;
        ctx.beginPath(); ctx.arc(gx, gy, 9 + G.hash(i + 9) * 9, 0, 7); ctx.fill();
      }
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
        const sy = ((G.hash(i + 70) * (h + 60) + (scroll + S.time * 60) * (1.1 + G.hash(i) * 0.3)) % (h + 60)) - 30;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy + 12 + G.hash(i + 5) * 16); ctx.stroke();
      }
      ctx.font = '700 12px system-ui, sans-serif';
      ctx.textAlign = 'left';
      for (let m = Math.ceil(S.d / 5) * 5; m < S.d + h / SC; m += 5) {
        if (m <= 0) continue;
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(w / 2 - RW - 18, Y(m), RW * 2 + 36, 2);
        ctx.fillStyle = '#fff';
        ctx.fillText(m + ' m', w / 2 - RW - 10, Y(m) - 5);
      }

      for (const o of objs) {
        const ox = w / 2 + o.x * SC, oy = Y(o.d), R = o.r * SC;
        if (oy < -60 || oy > h + 60) continue;
        if (o.type === 'rock') {
          ctx.strokeStyle = 'rgba(255,255,255,0.7)';
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(ox, oy + 3, R + 3 + Math.sin(S.time * 4 + o.seed) * 1.5, 0.2, Math.PI - 0.2); ctx.stroke();
          ctx.fillStyle = '#8a8f98';
          ctx.beginPath();
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2, rr = R * (0.82 + G.hash(o.seed + k) * 0.3);
            k ? ctx.lineTo(ox + Math.cos(a) * rr, oy + Math.sin(a) * rr) : ctx.moveTo(ox + Math.cos(a) * rr, oy + Math.sin(a) * rr);
          }
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.25)';
          ctx.beginPath(); ctx.arc(ox - R * 0.25, oy - R * 0.25, R * 0.35, 0, 7); ctx.fill();
        } else if (o.type === 'whirl') {
          ctx.strokeStyle = 'rgba(255,255,255,0.75)';
          ctx.lineWidth = 2.5;
          for (let k = 0; k < 3; k++) {
            ctx.beginPath();
            const a0 = S.time * 4 + (k * Math.PI * 2) / 3;
            for (let j = 0; j <= 14; j++) {
              const rr = R * (j / 14), a = a0 + j * 0.32;
              j ? ctx.lineTo(ox + Math.cos(a) * rr, oy + Math.sin(a) * rr) : ctx.moveTo(ox, oy);
            }
            ctx.stroke();
          }
        } else if (o.type === 'sun') {
          ctx.font = '26px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('☀️', ox, oy + 9 + Math.sin(S.time * 3 + o.seed) * 2);
        } else {
          ctx.strokeStyle = '#e8554e';
          ctx.lineWidth = 4;
          ctx.beginPath(); ctx.ellipse(ox, oy, 12, 8, 0.4, 0, 7); ctx.stroke();
          ctx.strokeStyle = '#ffd166';
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.ellipse(ox, oy, 12, 8, 0.4, 0, 7); ctx.stroke();
        }
      }

      // 배: 접은 모양 그대로
      const sink = G.clamp(S.sinkT / 1.4, 0, 1);
      const bx = w / 2 + S.x * SC + Math.sin(S.time * 40) * S.shake * 4;
      const byy = by + (S.phase === 'aim' ? S.pull * 34 : 0);
      const k = (SC * U) * 1.25 * (1 - sink * 0.7);
      ctx.save();
      ctx.translate(bx, byy);
      ctx.rotate(S.psi + (S.phase === 'sink' ? S.sinkT * 2 : 0));
      if (S.u > 0.1) {
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 2;
        const tail = (A.y0 + A.h - A.mcy) * k;
        ctx.beginPath(); ctx.moveTo(-7, tail + 6); ctx.lineTo(-13, tail + 14 + S.u * 22); ctx.moveTo(7, tail + 6); ctx.lineTo(13, tail + 14 + S.u * 22); ctx.stroke();
      }
      ctx.globalAlpha = 1 - sink;
      ctx.save();
      ctx.scale(Math.max(0.25, Math.cos(S.phi * 1.4)), 1);
      ctx.scale(k, k);
      ctx.translate(-A.mcx, -A.mcy);
      G.drawShape(ctx, craft.shape, S.flash > 0 ? G.shade(craft.color, 0.6 * S.flash) : G.shade(craft.color, -0.35 * S.water), 1 / k);
      ctx.restore();
      // 고무줄 물레방아
      const ty = (A.y0 + A.h - A.mcy) * k;
      ctx.strokeStyle = '#8a6a48'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-10, ty - 4); ctx.lineTo(-10, ty + 12); ctx.moveTo(10, ty - 4); ctx.lineTo(10, ty + 12); ctx.stroke();
      ctx.strokeStyle = '#e8554e'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-10, ty + 8); ctx.lineTo(10, ty + 8); ctx.stroke();
      ctx.fillStyle = '#c9a877';
      const pw = 7 * Math.abs(Math.cos(S.paddle)) + 1.5;
      ctx.fillRect(-6, ty + 8 - pw / 2, 12, pw);
      ctx.restore();
      if (S.phase === 'sink') {
        ctx.strokeStyle = 'rgba(255,255,255,' + (1 - sink) + ')';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(bx, by, 14 + sink * 46, 0, 7); ctx.stroke();
      }
    };
  };
})();
