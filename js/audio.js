/* 효과음: Web Audio 로 직접 합성 (음원 파일 없음) */
(function () {
  const G = window.G;
  let ac = null, master = null, noiseBuf = null;
  let muted = G.store.get('muted', false);

  function ensure() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = muted ? 0 : 0.9;
    master.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  function noise() {
    const n = ac.createBufferSource();
    n.buffer = noiseBuf;
    n.loop = true;
    return n;
  }
  function env(g, t0, a, peak, dur) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  }
  // 단발음: 오실레이터
  function tone(type, f0, f1, dur, peak, delay) {
    if (!ensure()) return;
    const t = ac.currentTime + (delay || 0);
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, 0.01, peak, dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  // 단발음: 걸러낸 잡음
  function burst(type, f0, f1, dur, peak, q) {
    if (!ensure()) return;
    const t = ac.currentTime;
    const n = noise(), f = ac.createBiquadFilter(), g = ac.createGain();
    f.type = type;
    f.Q.value = q || 1;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, 0.01, peak, dur);
    n.connect(f).connect(g).connect(master);
    n.start(t);
    n.stop(t + dur + 0.05);
  }

  const sfx = (G.sfx = {
    unlock: ensure,
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      G.store.set('muted', muted);
      if (ensure()) master.gain.value = muted ? 0 : 0.9;
      return muted;
    },
    click() { tone('triangle', 660, 880, 0.07, 0.12); },
    fold() { burst('bandpass', 2600, 900, 0.22, 0.5, 0.8); burst('highpass', 5000, 3000, 0.08, 0.2); },
    crease() { burst('bandpass', 3500, 1800, 0.12, 0.3, 1.2); },
    stretch(p) { tone('sawtooth', 110 + p * 160, 120 + p * 170, 0.06, 0.04); },
    twang() { tone('sawtooth', 240, 70, 0.35, 0.3); tone('triangle', 480, 120, 0.25, 0.2); burst('bandpass', 1800, 500, 0.25, 0.35, 0.7); },
    ding() { tone('sine', 880, 0, 0.25, 0.22); tone('sine', 1320, 0, 0.35, 0.18, 0.08); },
    thud() { tone('sine', 140, 45, 0.25, 0.6); burst('lowpass', 900, 200, 0.2, 0.5); },
    splash() { burst('bandpass', 1400, 400, 0.45, 0.6, 0.6); burst('highpass', 3000, 6000, 0.25, 0.2); },
    bubble() { [0, 0.12, 0.22, 0.38, 0.5].forEach((d, i) => tone('sine', 260 + i * 60, 620 + i * 80, 0.12, 0.2, d)); },
    land() { burst('bandpass', 1200, 300, 0.35, 0.45, 0.5); tone('sine', 110, 60, 0.15, 0.3); },
    fanfare() { [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, 0, 0.3, 0.2, i * 0.11)); },
    // 뱃고동
    horn() {
      if (!ensure()) return;
      const t = ac.currentTime, f = ac.createBiquadFilter(), g = ac.createGain();
      f.type = 'lowpass';
      f.frequency.value = 700;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.4, t + 0.12);
      g.gain.setValueAtTime(0.4, t + 0.95);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.35);
      [146.8, 147.9, 185, 220.5].forEach((hz) => {
        const o = ac.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = hz;
        o.connect(f);
        o.start(t);
        o.stop(t + 1.4);
      });
      f.connect(g).connect(master);
    },
    /* 지속음. 돌려주는 객체의 set() 으로 매 프레임 조절, stop() 으로 끈다 */
    loop(kind) {
      if (!ensure()) return { set() {}, stop() {} };
      const out = ac.createGain();
      out.gain.value = 0;
      out.connect(master);
      const nodes = [];
      const T = () => ac.currentTime;
      const osc = (type, hz) => { const o = ac.createOscillator(); o.type = type; o.frequency.value = hz; o.start(); nodes.push(o); return o; };
      const filt = (type, hz, q) => { const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = hz; f.Q.value = q || 0.7; return f; };
      const gain = (v) => { const g = ac.createGain(); g.gain.value = v; return g; };
      const nz = () => { const n = noise(); n.start(); nodes.push(n); return n; };
      let set;
      if (kind === 'plane') {
        // 프로펠러 웅웅 + 바람 가르는 소리
        const o1 = osc('sawtooth', 90), o2 = osc('square', 181), lp = filt('lowpass', 520), trem = gain(0.6), lfo = osc('sine', 26), lg = gain(0.4);
        lfo.connect(lg).connect(trem.gain);
        o1.connect(lp); o2.connect(gain(0.35)).connect(lp);
        const drone = gain(0);
        lp.connect(trem).connect(drone).connect(out);
        const wf = filt('bandpass', 900, 0.6), wind = gain(0);
        nz().connect(wf).connect(wind).connect(out);
        out.gain.value = 1;
        set = (p) => { // p.v 속도(m/s)
          const k = G.clamp(p.v / 12, 0, 1.3);
          o1.frequency.setTargetAtTime(70 + k * 70, T(), 0.08);
          o2.frequency.setTargetAtTime(141 + k * 140, T(), 0.08);
          lfo.frequency.setTargetAtTime(18 + k * 22, T(), 0.1);
          drone.gain.setTargetAtTime(0.05 + k * 0.07, T(), 0.1);
          wf.frequency.setTargetAtTime(500 + k * 1500, T(), 0.1);
          wind.gain.setTargetAtTime(0.03 + k * 0.22, T(), 0.1);
        };
      } else if (kind === 'boat') {
        // 물결 소리 + 통통통 물레방아
        const wf = filt('lowpass', 600), wg = gain(0.12), slow = osc('sine', 0.35), sg = gain(0.07);
        slow.connect(sg).connect(wg.gain);
        nz().connect(wf).connect(wg).connect(out);
        const put = osc('triangle', 95), gate = gain(0), lfo = osc('square', 7), lg = gain(0);
        lfo.connect(lg).connect(gate.gain);
        put.connect(filt('lowpass', 400)).connect(gate).connect(out);
        out.gain.value = 1;
        set = (p) => { // p.thrust 0..1, p.u 속도
          lg.gain.setTargetAtTime(p.thrust > 0 ? 0.16 : 0, T(), 0.05);
          lfo.frequency.setTargetAtTime(5 + p.thrust * 9, T(), 0.1);
          wf.frequency.setTargetAtTime(450 + G.clamp(p.u, 0, 1.5) * 700, T(), 0.2);
        };
      } else {
        // 자동차: 고무줄 엔진 부르릉
        const o1 = osc('sawtooth', 50), o2 = osc('square', 25), lp = filt('lowpass', 500, 2), eg = gain(0);
        o1.connect(lp); o2.connect(gain(0.6)).connect(lp);
        lp.connect(eg).connect(out);
        const rf = filt('bandpass', 300, 0.5), road = gain(0);
        nz().connect(rf).connect(road).connect(out);
        out.gain.value = 1;
        set = (p) => { // p.v 속도, p.drive 0..1
          const f = 38 + Math.abs(p.v) * 26;
          o1.frequency.setTargetAtTime(f, T(), 0.05);
          o2.frequency.setTargetAtTime(f / 2, T(), 0.05);
          lp.frequency.setTargetAtTime(350 + Math.abs(p.v) * 160 + p.drive * 500, T(), 0.05);
          eg.gain.setTargetAtTime(p.drive > 0 ? 0.1 + p.drive * 0.1 : 0.025, T(), 0.06);
          road.gain.setTargetAtTime(G.clamp(Math.abs(p.v) / 8, 0, 1) * 0.12, T(), 0.1);
        };
      }
      return {
        set(p) { set(p); },
        stop() {
          out.gain.setTargetAtTime(0, T(), 0.08);
          setTimeout(() => { nodes.forEach((n) => { try { n.stop(); } catch (e) { /* 이미 멈춤 */ } }); out.disconnect(); }, 400);
        },
      };
    },
  });
  void sfx;
})();
