/* 종이 비행기: 접힌 모양(위에서 본 평면)을 얇은 날개로 보고 양력·항력·피치 모멘트를 계산한다.
   - 날개 하중(면적/질량) → 속도,  가로세로비 → 양력 기울기·유도 항력
   - 무게중심이 공력중심보다 앞이면 안정, 뒤면 뒤집히며 떨어짐
   - 좌우 비대칭 → 기울어 선회 */
(function () {
  const G = window.G;
  const U = 0.00105; // 종이 단위 → m (폭 200 = 21cm)
  const GRAV = 9.8, START_H = 1.8, CQ = 2.0;
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  /* 반으로 접고 날개를 접어 내린 비행기는 날개를 90° 펴서 날린다.
     위에서 본 모양 = 한쪽 날개는 그대로, 반대쪽 날개는 접은 선 너머로 펼치고,
     몸통(용골)은 접은 선 위로 납작하게 모은다(질량은 그대로). */
  G.flightShape = function (craft) {
    const w = craft.wings || [];
    if (!w.length || !craft.shape.some((L) => L.t)) return craft.shape;
    const R = G.fold.reflect, l1 = w[0], l2 = w[1] || w[0];
    const dx = l1.b[0] - l1.a[0], dy = l1.b[1] - l1.a[1], dd = dx * dx + dy * dy;
    const squash = (q) => { const u = ((q[0] - l1.a[0]) * dx + (q[1] - l1.a[1]) * dy) / dd, fx = l1.a[0] + u * dx, fy = l1.a[1] + u * dy; return [fx + (q[0] - fx) * 0.05, fy + (q[1] - fy) * 0.05]; };
    const body = [], wing = [];
    craft.shape.forEach((L) => {
      if (L.t === 1) wing.push({ p: L.p, f: L.f });
      else if (L.t === 2) wing.push({ p: L.p.map((q) => R(q, l2.a, l2.b)), f: 1 - L.f });
      else body.push({ p: L.p.map(squash), f: L.f, k: 20 });
    });
    return wing.concat(body);
  };

  // 비행 모양 분석. 용골(몸통)은 좌우 대칭 판정에서 뺀다
  G.planeAnalysis = function (craft) {
    const shape = G.flightShape(craft), keel = shape !== craft.shape, A = G.analyze(shape);
    if (keel) { const W = G.analyze(shape.filter((L) => !L.k)); A.asym = W.asym; A.lean = W.lean; }
    return { shape, keel, A, P: G.PHYS.plane(A, keel) };
  };

  G.PHYS.plane = function (a, keel) {
    const S = a.area * U * U, b = Math.max(a.w * U, 0.01), c = S / b;
    const AR = (b * b) / S;
    let sw = 0, sy = 0;
    a.cols.forEach((col) => { const ch = col.back - col.front; if (ch > 0) { sw += ch; sy += (col.front + 0.25 * ch) * ch; } });
    // 가늘고 긴 날개는 폭이 넓어지는 곳에서 양력이 생긴다 (세장익 이론) → 낮은 가로세로비일수록 이쪽에 가깝다
    let bmax = 0, lw = 0, ly = 0;
    a.rows.forEach((r) => { const bb = Math.max(0, r.right - r.left); if (bb > bmax) { const dl = bb * bb - bmax * bmax; lw += dl; ly += dl * r.y; bmax = bb; } });
    const np = G.lerp(sy / sw, ly / lw, G.clamp((2.2 - AR) / 1.2, 0, 1) * 0.7);
    const P = {
      K: (7.5 * a.area) / a.mass,                 // ρS/2m  (80g/m² 종이)
      cla: (2 * Math.PI * AR) / (AR + 2), ki: Math.min(0.6, 1 / (Math.PI * 0.8 * AR)),
      c, d: (np - a.mcy) * U, dPost: (a.acy - a.mcy) * U,
      ry2: Math.max(a.iyy * U * U, 0.0012),
      cd0: 0.04 + 0.2 * a.asym,
      // 좌우가 다르면 기운다. 손으로 접은 작은 오차(3% 이하)는 봐주고, 용골이 있으면 덜 기운다
      bank: G.clamp(Math.max(0, a.asym - 0.03) * 3 + Math.abs(a.lean) * 3, 0, 0.6) * (keel ? 0.6 : 1),
    };
    const sm = P.d / c; // 정적 여유
    // 꼬리를 살짝 올려 맞춘 트림: 앞이 무거울수록 더 올리지만 한계가 있다
    P.cm0 = G.clamp(P.cla * 0.12 * sm, 0.022, 0.08);
    P.bars = [
      { label: '날개 넓이', v: G.clamp(a.area / a.mass, 0, 1) },
      { label: '앞쪽 무게', v: G.clamp(0.5 + sm * 2.5, 0, 1) },
      { label: '좌우 대칭', v: G.clamp(1 - a.asym * 8, 0, 1) },
    ];
    P.tip = sm < 0.01 ? '무게중심이 뒤쪽이라 공중에서 뒤집히기 쉬워요. 앞쪽을 더 접어 무겁게 해 보세요.'
      : sm > 0.45 ? '앞이 아주 무거워 화살처럼 빨리 떨어져요. 세게, 위로 쏘세요.'
      : a.asym > 0.06 ? '좌우가 달라 한쪽으로 휘어 날아요.'
      : a.area / a.mass > 0.6 ? '날개가 넓어 천천히 오래 떠요. 살살 쏘는 게 좋아요.' : '균형이 좋아요. 곧게 잘 날 거예요!';
    return P;
  };

  G.PlaneScene = function (craft, ui, onEnd) {
    const pa = G.planeAnalysis(craft), fshape = pa.shape, A = pa.A, P = pa.P;
    const S = { phase: 'aim', x: 0, y: START_H, vx: 0, vy: 0, th: 0.2, om: 0, psi: 0, t: 0, aim: null, endT: 0, camY: 0, time: 0, trail: [], lastStretch: 0 };
    const rnd = G.rng(20240917);
    const thermals = [];
    for (let x = rnd(9, 14); x < 300; x += rnd(9, 17)) thermals.push({ x, w: rnd(3, 5), s: rnd(0.5, 1.1) });
    let snd = null;

    function thermalAt(x, y) {
      for (const T of thermals) {
        const d = Math.abs(x - T.x) / (T.w / 2);
        if (d < 1) return T.s * (1 - d * d) * G.clamp(1.3 - y / 9, 0, 1);
      }
      return 0;
    }

    function stepPhys(dt) {
      const rvx = S.vx, rvy = S.vy - thermalAt(S.x, S.y);
      const v = Math.hypot(rvx, rvy), gam = Math.atan2(rvy, rvx);
      const al = wrap(S.th - gam), sa = Math.sin(al), ca = Math.cos(al);
      const k = G.smooth(0.2, 0.38, Math.abs(al)); // 실속 전환
      const clPre = P.cla * al;
      const cl = G.lerp(clPre, 1.1 * Math.sin(2 * al), k);
      const cd = G.lerp(P.cd0 + P.ki * clPre * clPre, P.cd0 + 1.8 * sa * sa, k);
      const q = P.K * v * v;
      const L = q * cl, D = q * cd;
      const Lv = L * Math.cos(P.bank);
      S.vx += (-D * Math.cos(gam) - Lv * Math.sin(gam)) * dt;
      S.vy += (-D * Math.sin(gam) + Lv * Math.cos(gam) - GRAV) * dt;
      // 피치: 트림 모멘트 - 수직력×(공력중심-무게중심) , 감쇠는 암시적으로
      const cn = cl * ca + cd * sa, arm = G.lerp(P.d, P.dPost, k);
      const torque = (q * (P.cm0 * P.c - cn * arm)) / P.ry2;
      const damp = (P.K * v * P.c * P.c * CQ) / (2 * P.ry2) + 0.5;
      S.om = G.clamp((S.om + torque * dt) / (1 + damp * dt), -30, 30);
      S.th += S.om * dt;
      // 비대칭 → 선회
      // 옆으로 휘면 앞으로 나아가는 거리만 줄어든다 (되돌아오지는 않게 최대 약 70°)
      S.psi = Math.min(1.2, S.psi + ((Math.abs(L) * Math.sin(P.bank)) / Math.max(v, 1.5)) * dt);
      S.x += S.vx * Math.cos(S.psi) * dt;
      S.y += S.vy * dt;
      S.t += dt;
    }

    function aimInfo() {
      if (!S.aim) return null;
      const dx = S.aim.sx - S.aim.x, dy = S.aim.sy - S.aim.y;
      return { power: G.clamp(Math.hypot(dx, dy) / 140, 0, 1), ang: G.clamp(Math.atan2(-dy, dx), -0.35, 1.3) };
    }
    function launch(ang, power) {
      const sp = G.lerp(2.5, 9, power); // 고무줄 새총
      S.vx = Math.cos(ang) * sp;
      S.vy = Math.sin(ang) * sp;
      S.th = ang;
      S.phase = 'fly';
      G.sfx.twang();
      snd = G.sfx.loop('plane');
    }
    this.launch = launch;
    this.state = S;
    this.params = P;

    this.pointer = function (type, x, y) {
      if (S.phase !== 'aim') return;
      if (type === 'down') S.aim = { sx: x, sy: y, x, y };
      else if (type === 'move' && S.aim) {
        S.aim.x = x; S.aim.y = y;
        const a = aimInfo();
        if (Math.abs(a.power - S.lastStretch) > 0.08) { S.lastStretch = a.power; G.sfx.stretch(a.power); }
      } else if (type === 'up' && S.aim) {
        const a = aimInfo();
        S.aim = null;
        if (a.power > 0.15) launch(a.ang, a.power);
      }
    };
    this.stop = function () { if (snd) snd.stop(); snd = null; };

    this.update = function (dt) {
      S.time += dt;
      if (S.phase === 'fly') {
        const n = 12;
        for (let i = 0; i < n && S.phase === 'fly'; i++) {
          stepPhys(dt / n);
          if (S.y <= 0.03 || S.t > 120) { S.y = Math.max(S.y, 0.03); S.phase = 'done'; }
        }
        if (snd) snd.set({ v: Math.hypot(S.vx, S.vy) });
        const lt = S.trail[S.trail.length - 1];
        if (!lt || Math.hypot(S.x - lt[0], S.y - lt[1]) > 0.35) { S.trail.push([S.x, S.y]); if (S.trail.length > 110) S.trail.shift(); }
        if (S.phase === 'done') { this.stop(); G.sfx.land(); }
      } else if (S.phase === 'done') {
        S.endT += dt;
        if (S.endT > 0.9 && onEnd) { const cb = onEnd; onEnd = null; cb({ dist: Math.max(0, S.x), time: S.t }); }
      }
      ui.hud({
        a: Math.max(0, S.x).toFixed(1) + ' m', b: S.t.toFixed(1) + ' 초',
        hint: S.phase === 'aim' ? '고무줄을 뒤로 당겼다 놓으세요! 각도와 세기가 중요해요' : '',
        info: S.phase !== 'fly' ? '바람 없음' : Math.cos(S.th) < 0 || S.vx < -0.3 ? '🔄 공중제비! 너무 세게·높이 쐈어요' : S.psi > 0.35 ? '↪ 한쪽으로 휘는 중' : '속도 ' + Math.hypot(S.vx, S.vy).toFixed(1) + ' m/s',
      });
    };

    this.draw = function (ctx, w, h) {
      const s = G.clamp(w / 11, 34, 70);
      const gy = h * 0.84;
      const camX = S.x - (w * 0.3) / s;
      S.camY += (Math.max(0, S.y - (gy - h * 0.34) / s) - S.camY) * 0.12;
      const X = (x) => (x - camX) * s, Y = (y) => gy - (y - S.camY) * s;

      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#8fd0f5');
      sky.addColorStop(1, '#e3f5ff');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 9; i++) {
        const span = w + 300;
        const cx = ((G.hash(i) * span - camX * s * 0.2) % span + span) % span - 150;
        const cy = 40 + G.hash(i + 20) * h * 0.45 + S.camY * s * 0.2;
        const r = 18 + G.hash(i + 40) * 18;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.arc(cx + r, cy + 5, r * 0.8, 0, 7); ctx.arc(cx - r, cy + 6, r * 0.7, 0, 7); ctx.fill();
      }
      ctx.fillStyle = '#a9d9a4';
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 20) {
        const wx = x + camX * s * 0.3;
        ctx.lineTo(x, Y(0) - 40 - Math.sin(wx * 0.006) * 30 - Math.sin(wx * 0.017) * 14);
      }
      ctx.lineTo(w, h);
      ctx.fill();

      for (const T of thermals) {
        const x0 = X(T.x - T.w / 2), x1 = X(T.x + T.w / 2);
        if (x1 < 0 || x0 > w) continue;
        const g = ctx.createLinearGradient(x0, 0, x1, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(0.5, 'rgba(255,250,220,0.35)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x0, 0, x1 - x0, Y(0));
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
          const px = G.lerp(x0, x1, 0.2 + 0.15 * i);
          const py = Y(0) - ((S.time * 40 * T.s + i * 97) % (h * 0.8));
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py - 14); ctx.stroke();
        }
      }

      ctx.fillStyle = '#7cc46b';
      ctx.fillRect(0, Y(0), w, h);
      ctx.fillStyle = '#69b25a';
      ctx.fillRect(0, Y(0), w, 6);
      ctx.font = '700 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      for (let m = Math.max(1, Math.ceil(camX)); m < camX + w / s + 1; m++) {
        const big = m % 5 === 0;
        ctx.fillStyle = '#fff';
        ctx.fillRect(X(m) - 1, Y(0) - (big ? 16 : 5), 2, big ? 16 : 5);
        if (!big) continue;
        ctx.fillStyle = m % 10 ? '#ffd166' : '#ff7b54';
        ctx.fillRect(X(m), Y(0) - 16, 24, 12);
        ctx.fillStyle = '#4b4239';
        ctx.fillText(m, X(m) + 12, Y(0) - 6);
      }
      // 고무줄 새총
      const a = aimInfo();
      const pull = a ? a.power * 0.55 : 0, pang = a ? a.ang : 0.2;
      const px = S.phase === 'aim' ? S.x - Math.cos(pang) * pull : S.x, py = S.phase === 'aim' ? S.y - Math.sin(pang) * pull : S.y;
      ctx.strokeStyle = '#8a6a48';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(0), Y(START_H - 0.35)); ctx.moveTo(X(0) - 9, Y(START_H + 0.05)); ctx.lineTo(X(0), Y(START_H - 0.35)); ctx.lineTo(X(0) + 9, Y(START_H + 0.05)); ctx.stroke();
      ctx.strokeStyle = '#e8554e';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(X(0) - 9, Y(START_H + 0.05));
      if (S.phase === 'aim') ctx.lineTo(X(px), Y(py));
      ctx.lineTo(X(0) + 9, Y(START_H + 0.05)); ctx.stroke();
      ctx.font = '30px system-ui, sans-serif';
      ctx.fillText('🧒', X(-0.75), Y(0.05));

      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      S.trail.forEach((p) => { ctx.beginPath(); ctx.arc(X(p[0]), Y(p[1]), 2, 0, 7); ctx.fill(); });

      if (S.phase === 'aim') {
        S.th = pang;
        if (a) {
          ctx.strokeStyle = 'rgba(75,66,57,0.6)';
          ctx.lineWidth = 3;
          ctx.setLineDash([8, 6]);
          ctx.beginPath(); ctx.moveTo(X(S.x), Y(S.y)); ctx.lineTo(X(S.x) + Math.cos(pang) * (30 + a.power * 90), Y(S.y) - Math.sin(pang) * (30 + a.power * 90)); ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = '#4b4239';
          ctx.font = '700 14px system-ui, sans-serif';
          ctx.fillText('세기 ' + Math.round(a.power * 100) + '% · ' + Math.round((pang * 180) / Math.PI) + '°', X(S.x) + 30, Y(S.y) + 50);
        }
      }

      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath(); ctx.ellipse(X(S.x), Y(0) + 4, G.clamp(20 - S.y * 2, 6, 20), 4, 0, 0, 7); ctx.fill();
      // 접은 모양 그대로, 비스듬히 내려다본 모습으로
      const size = Math.max(54, s * 1.1), k = size / Math.max(A.h, A.w);
      ctx.save();
      ctx.translate(X(px), Y(py));
      ctx.rotate(-S.th);
      ctx.scale(1, 0.34 + 0.4 * P.bank * Math.min(1, S.t));
      ctx.rotate(Math.PI / 2);
      ctx.scale(k, k);
      ctx.translate(-A.mcx, -A.mcy);
      G.drawShape(ctx, fshape, craft.color, 1 / k);
      ctx.restore();
    };
  };
})();
