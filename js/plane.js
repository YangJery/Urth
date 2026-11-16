/* 종이 비행기 날리기 (옆에서 본 화면) */
(function () {
  const G = window.G;
  const START_H = 2.6, GRAV = 9.8, STALL = 0.26;
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  G.PlaneScene = function (craft, model, ui, onEnd) {
    const P = model.phys, q = craft.q;
    const cd0 = P.cd0 * (1 + 0.9 * (1 - q));
    const S = {
      phase: 'aim', x: 0, y: START_H, vx: 0, vy: 0, th: 0.15, t: 0, ctrl: 0, hold: false,
      aim: null, wind: Math.round(G.rand(-0.8, 0.8) * 10) / 10, endT: 0, camY: 0, time: 0, trail: [], ph: G.rand(0, 6),
    };
    const thermals = [];
    for (let x = G.rand(14, 22); x < 600; x += G.rand(13, 26)) thermals.push({ x, w: G.rand(4, 7), s: G.rand(0.9, 1.9) });

    function thermalAt(x, y) {
      for (const T of thermals) {
        const d = Math.abs(x - T.x) / (T.w / 2);
        if (d < 1) return T.s * (1 - d * d) * G.clamp(1.4 - y / 14, 0, 1);
      }
      return 0;
    }

    function stepPhys(dt) {
      const rvx = S.vx - S.wind, rvy = S.vy - thermalAt(S.x, S.y);
      const v = Math.hypot(rvx, rvy), gam = Math.atan2(rvy, rvx);
      S.ctrl += ((S.hold ? 1 : 0) - S.ctrl) * Math.min(1, dt * 6);
      const wob = (1 - q) * 0.07 * P.wob * Math.sin(S.t * 3.3 + S.ph) + 0.012 * P.wob * Math.sin(S.t * 1.7);
      const want = gam + P.trim + S.ctrl * 0.09 + wob;
      S.th += wrap(want - S.th) * Math.min(1, P.pitch * dt);
      const al = wrap(S.th - gam), aa = Math.abs(al);
      let cl = aa < STALL ? 5 * al : Math.sign(al) * Math.max(0.5, 1.3 - 2.5 * (aa - STALL));
      const cd = cd0 + P.ki * cl * cl + (aa > STALL ? 1.4 * (aa - STALL) : 0);
      const L = P.K * v * v * cl, D = P.K * v * v * cd;
      S.vx += (-D * Math.cos(gam) - L * Math.sin(gam)) * dt;
      S.vy += (-D * Math.sin(gam) + L * Math.cos(gam) - GRAV) * dt;
      S.x += S.vx * dt;
      S.y += S.vy * dt;
      S.t += dt;
    }

    function aimInfo() {
      if (!S.aim) return null;
      const dx = S.aim.sx - S.aim.x, dy = S.aim.sy - S.aim.y;
      const power = G.clamp(Math.hypot(dx, dy) / 140, 0, 1);
      const ang = G.clamp(Math.atan2(-dy, dx), -0.35, 1.3);
      return { power, ang };
    }

    this.pointer = function (type, x, y) {
      if (S.phase === 'aim') {
        if (type === 'down') S.aim = { sx: x, sy: y, x, y };
        else if (type === 'move' && S.aim) { S.aim.x = x; S.aim.y = y; }
        else if (type === 'up' && S.aim) {
          const a = aimInfo();
          S.aim = null;
          if (a.power > 0.15) launch(a.ang, a.power);
        }
      } else if (S.phase === 'fly') {
        if (type === 'down') S.hold = true;
        if (type === 'up') S.hold = false;
      }
    };
    this.key = function (code, down) {
      if (code === 'Space' || code === 'ArrowUp') {
        if (S.phase === 'fly') S.hold = down;
      }
    };
    function launch(ang, power) {
      const sp = G.lerp(P.throwMin, P.throwMax, power);
      S.vx = Math.cos(ang) * sp;
      S.vy = Math.sin(ang) * sp;
      S.th = ang;
      S.phase = 'fly';
    }
    this.launch = launch; // 테스트용

    this.update = function (dt) {
      S.time += dt;
      if (S.phase === 'fly') {
        const n = 6;
        for (let i = 0; i < n && S.phase === 'fly'; i++) {
          stepPhys(dt / n);
          if (S.y <= 0.06 || S.t > 180) {
            S.y = Math.max(S.y, 0.06);
            S.phase = 'done';
          }
        }
        if (!S.trail.length || S.x - S.trail[S.trail.length - 1][0] > 0.6 || Math.abs(S.y - S.trail[S.trail.length - 1][1]) > 0.6) {
          S.trail.push([S.x, S.y]);
          if (S.trail.length > 90) S.trail.shift();
        }
      } else if (S.phase === 'done') {
        S.endT += dt;
        if (S.endT > 0.9 && onEnd) {
          const cb = onEnd;
          onEnd = null;
          cb({ dist: Math.max(0, S.x), time: S.t });
        }
      }
      ui.hud({
        a: Math.max(0, S.x).toFixed(1) + ' m', b: S.t.toFixed(1) + ' 초',
        hint: S.phase === 'aim' ? '화면을 뒤로 당겼다 놓으면 날아가요 (새총처럼!)' : S.phase === 'fly' && S.t < 3 ? '꾹 누르면 기수를 들어요. 너무 들면 실속!' : '',
        info: '바람 ' + (S.wind > 0.05 ? '→ 순풍 ' : S.wind < -0.05 ? '← 역풍 ' : '') + Math.abs(S.wind).toFixed(1) + ' m/s',
      });
    };

    this.draw = function (ctx, w, h) {
      const s = G.clamp(w / 20, 24, 42);
      const gy = h * 0.84;
      const camX = S.x - (w * 0.3) / s;
      const wantY = Math.max(0, S.y - (gy - h * 0.34) / s);
      S.camY += (wantY - S.camY) * 0.12;
      const X = (x) => (x - camX) * s, Y = (y) => gy - (y - S.camY) * s;

      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#8fd0f5');
      sky.addColorStop(1, '#e3f5ff');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      // 구름 (시차)
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 9; i++) {
        const span = w + 300;
        const cx = ((G.hash(i) * span - camX * s * 0.25) % span + span) % span - 150;
        const cy = 40 + G.hash(i + 20) * h * 0.45 + S.camY * s * 0.25;
        const r = 18 + G.hash(i + 40) * 18;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, 7); ctx.arc(cx + r, cy + 5, r * 0.8, 0, 7); ctx.arc(cx - r, cy + 6, r * 0.7, 0, 7);
        ctx.fill();
      }
      // 먼 산
      ctx.fillStyle = '#a9d9a4';
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 20) {
        const wx = x + camX * s * 0.4;
        ctx.lineTo(x, Y(0) - 40 - Math.sin(wx * 0.006) * 30 - Math.sin(wx * 0.017) * 14);
      }
      ctx.lineTo(w, h);
      ctx.fill();

      // 상승 기류
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
          const py = Y(0) - (((S.time * 40 * T.s + i * 97) % (h * 0.8)));
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py - 14); ctx.stroke();
        }
      }

      // 땅과 거리 표지
      ctx.fillStyle = '#7cc46b';
      ctx.fillRect(0, Y(0), w, h);
      ctx.fillStyle = '#69b25a';
      ctx.fillRect(0, Y(0), w, 6);
      ctx.font = '700 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      for (let m = Math.max(5, Math.ceil(camX / 5) * 5); m < camX + w / s + 5; m += 5) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(X(m) - 1.5, Y(0) - 16, 3, 16);
        ctx.fillStyle = m % 10 ? '#ffd166' : '#ff7b54';
        ctx.fillRect(X(m), Y(0) - 16, 22, 11);
        ctx.fillStyle = '#4b4239';
        ctx.fillText(m, X(m) + 11, Y(0) - 7);
      }
      // 출발 언덕
      ctx.fillStyle = '#69b25a';
      ctx.beginPath();
      ctx.moveTo(X(-9), Y(0));
      ctx.quadraticCurveTo(X(-2), Y(START_H * 1.6), X(1.4), Y(0));
      ctx.fill();
      ctx.font = '30px system-ui, sans-serif';
      ctx.fillText('🧒', X(-0.9), Y(START_H - 1.35));

      // 궤적
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      S.trail.forEach((p) => { ctx.beginPath(); ctx.arc(X(p[0]), Y(p[1]), 2, 0, 7); ctx.fill(); });

      // 조준 화살표
      const a = aimInfo();
      if (S.phase === 'aim') {
        const ang = a ? a.ang : 0.25, pw = a ? a.power : 0.0;
        if (a) {
          ctx.strokeStyle = 'rgba(255,90,77,0.9)';
          ctx.lineWidth = 4;
          ctx.setLineDash([8, 6]);
          ctx.beginPath();
          ctx.moveTo(X(S.x), Y(S.y));
          ctx.lineTo(X(S.x) + Math.cos(ang) * (30 + pw * 90), Y(S.y) - Math.sin(ang) * (30 + pw * 90));
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = '#4b4239';
          ctx.font = '700 14px system-ui, sans-serif';
          ctx.fillText('힘 ' + Math.round(pw * 100) + '%', X(S.x) + 10, Y(S.y) + 44);
        }
        S.th = ang;
      }

      // 그림자와 비행기
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath();
      ctx.ellipse(X(S.x), Y(0) + 4, G.clamp(18 - S.y, 6, 18), 4, 0, 0, 7);
      ctx.fill();
      ctx.save();
      ctx.translate(X(S.x) - (a ? Math.cos(a.ang) * a.power * 22 : 0), Y(S.y) + (a ? Math.sin(a.ang) * a.power * 22 : 0));
      ctx.rotate(-S.th);
      G.drawCraft(ctx, 'plane', model.id, craft.color, Math.max(44, s * 1.5));
      ctx.restore();
    };
  };
})();
