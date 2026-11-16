/* 공통 유틸: 수학, 색상, 저장소, 순위표 */
(function () {
  const G = (window.G = {});

  G.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  G.lerp = (a, b, t) => a + (b - a) * t;
  G.rand = (a, b) => a + Math.random() * (b - a);
  G.dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  G.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // 결정적 해시 난수 (배경 배치용)
  G.hash = (n) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  // f>0 이면 흰색 쪽으로, f<0 이면 검정 쪽으로 섞는다
  G.shade = (hex, f) => {
    const c = hexToRgb(hex);
    const t = f > 0 ? 255 : 0;
    const k = Math.abs(f);
    return 'rgb(' + c.map((v) => Math.round(v + (t - v) * k)).join(',') + ')';
  };

  G.COLORS = ['#e8554e', '#f2a33a', '#f3cf4f', '#5bb974', '#3caea3', '#4a8fe7', '#8e6fd8', '#f08bb4', '#efe9dc'];

  /* ---------- localStorage ---------- */
  const PREFIX = 'origami-racers:';
  G.store = {
    get(key, def) {
      try {
        const v = localStorage.getItem(PREFIX + key);
        return v == null ? def : JSON.parse(v);
      } catch (e) {
        return def;
      }
    },
    set(key, val) {
      try {
        localStorage.setItem(PREFIX + key, JSON.stringify(val));
      } catch (e) {
        /* 저장 불가 환경에서는 조용히 무시 */
      }
    },
  };

  /* ---------- 순위표 ---------- */
  const LB_MAX = 20;
  G.lb = {
    get(section, metric) {
      return G.store.get('lb:' + section + ':' + metric, []);
    },
    // 순위(1부터)를 돌려준다. 순위권 밖이면 0
    add(section, metric, entry) {
      const list = G.lb.get(section, metric);
      list.push(entry);
      list.sort((a, b) => b.value - a.value);
      const rank = list.indexOf(entry) + 1;
      G.store.set('lb:' + section + ':' + metric, list.slice(0, LB_MAX));
      return rank <= LB_MAX ? rank : 0;
    },
  };

  G.grade = (q) => (q >= 0.9 ? 'S' : q >= 0.75 ? 'A' : q >= 0.55 ? 'B' : 'C');
  // 접기 정밀도가 성능에 미치는 배율 (0.6 ~ 1.0)
  G.eff = (q) => 0.6 + 0.4 * q;
})();
