/* 섹션 / 모델 정의와 완성품 스프라이트 */
(function () {
  const G = window.G;

  G.SECTIONS = {
    plane: {
      name: '종이 비행기', emoji: '✈️', verb: '날리기', place: '언덕 위에서 날려 보내요',
      metrics: [
        { key: 'dist', label: '비행 거리', unit: 'm', digits: 1 },
        { key: 'time', label: '체공 시간', unit: '초', digits: 1 },
      ],
      stats: { a: '속도', b: '활공', c: '안정' },
    },
    boat: {
      name: '종이 배', emoji: '⛵', verb: '띄우기', place: '냇물에 띄워 떠내려 보내요',
      metrics: [
        { key: 'dist', label: '항해 거리', unit: 'm', digits: 1 },
        { key: 'time', label: '버틴 시간', unit: '초', digits: 1 },
      ],
      stats: { a: '속도', b: '튼튼함', c: '조종' },
    },
    car: {
      name: '종이 자동차', emoji: '🚗', verb: '달리기', place: '언덕길 도로를 달려요',
      metrics: [
        { key: 'dist', label: '주행 거리', unit: 'm', digits: 1 },
        { key: 'speed', label: '최고 속도', unit: 'km/h', digits: 1 },
      ],
      stats: { a: '힘', b: '구름성', c: '태엽' },
    },
  };

  /* 접기 단계: line = 접는 선(현재 좌표), handle = 잡고 옮길 점. crease = 접었다 펴기 */
  G.MODELS = {
    plane: [
      {
        id: 'dart', name: '다트', desc: '뾰족하고 빠른 직선형. 힘껏 던지면 멀리 뻗어요.',
        paper: [200, 280], stats: { a: 0.95, b: 0.5, c: 0.75 },
        phys: { K: 0.4, cd0: 0.07, ki: 0.12, trim: 0.1, throwMin: 6, throwMax: 14, pitch: 8, wob: 0.6 },
        steps: [
          { text: '반으로 접었다 펴서 중심선을 만들어요', line: [[100, 0], [100, 280]], handle: [0, 0], crease: true },
          { text: '왼쪽 위 모서리를 중심선에 맞춰 접어요', line: [[100, 0], [0, 100]], handle: [0, 0] },
          { text: '오른쪽 위 모서리도 중심선에 맞춰 접어요', line: [[100, 0], [200, 100]], handle: [200, 0] },
          { text: '왼쪽 빗변을 한 번 더 중심선으로 접어요', line: [[100, 0], [0, 241.4]], handle: [0, 100] },
          { text: '오른쪽 빗변도 중심선으로 접어요', line: [[100, 0], [200, 241.4]], handle: [200, 100] },
          { text: '중심선을 따라 반으로 접어요', line: [[100, 0], [100, 280]], handle: [0, 280] },
          { text: '날개를 접어 내려요', line: [[130, 0], [130, 280]], handle: [200, 280] },
        ],
      },
      {
        id: 'glider', name: '글라이더', desc: '넓은 날개로 천천히, 오래 떠 있어요.',
        paper: [200, 280], stats: { a: 0.45, b: 0.95, c: 0.6 },
        phys: { K: 1.0, cd0: 0.05, ki: 0.08, trim: 0.12, throwMin: 4, throwMax: 9, pitch: 6, wob: 1.0 },
        steps: [
          { text: '반으로 접었다 펴서 중심선을 만들어요', line: [[100, 0], [100, 280]], handle: [0, 0], crease: true },
          { text: '왼쪽 위 모서리를 중심선에 맞춰 접어요', line: [[100, 0], [0, 100]], handle: [0, 0] },
          { text: '오른쪽 위 모서리도 중심선에 맞춰 접어요', line: [[100, 0], [200, 100]], handle: [200, 0] },
          { text: '뾰족한 코를 아래로 접어 내려요', line: [[0, 70], [200, 70]], handle: [100, 0] },
          { text: '새로 생긴 왼쪽 모서리를 중심으로 접어요', line: [[100, 70], [0, 170]], handle: [30, 70] },
          { text: '오른쪽 모서리도 중심으로 접어요', line: [[100, 70], [200, 170]], handle: [170, 70] },
          { text: '중심선을 따라 반으로 접어요', line: [[100, 0], [100, 280]], handle: [0, 280] },
          { text: '넓은 날개를 접어 내려요', line: [[125, 0], [125, 280]], handle: [200, 280] },
        ],
      },
      {
        id: 'jumbo', name: '점보', desc: '뭉툭한 코의 균형형. 접기 쉽고 안정적이에요.',
        paper: [200, 280], stats: { a: 0.7, b: 0.7, c: 0.95 },
        phys: { K: 0.6, cd0: 0.062, ki: 0.1, trim: 0.11, throwMin: 5, throwMax: 12, pitch: 7, wob: 0.3 },
        steps: [
          { text: '반으로 접었다 펴서 중심선을 만들어요', line: [[100, 0], [100, 280]], handle: [0, 0], crease: true },
          { text: '왼쪽 위 모서리를 중심선에 맞춰 접어요', line: [[100, 0], [0, 100]], handle: [0, 0] },
          { text: '오른쪽 위 모서리도 중심선에 맞춰 접어요', line: [[100, 0], [200, 100]], handle: [200, 0] },
          { text: '코끝을 아래로 접어 뭉툭하게 만들어요', line: [[0, 50], [200, 50]], handle: [100, 0] },
          { text: '중심선을 따라 반으로 접어요', line: [[100, 0], [100, 280]], handle: [0, 280] },
          { text: '날개를 접어 내려요', line: [[140, 0], [140, 280]], handle: [200, 280] },
        ],
      },
    ],
    boat: [
      {
        id: 'classic', name: '클래식 배', desc: '누구나 아는 그 종이배. 고르게 잘 버텨요.',
        paper: [200, 280], stats: { a: 0.65, b: 0.75, c: 0.7 },
        phys: { speed: 1.0, tough: 1.0, agile: 1.0 },
        steps: [
          { text: '위에서 아래로 반을 접어요', line: [[0, 140], [200, 140]], handle: [0, 0] },
          { text: '왼쪽 위 모서리를 가운데로 접어요', line: [[100, 140], [0, 240]], handle: [0, 140] },
          { text: '오른쪽 위 모서리도 가운데로 접어요', line: [[100, 140], [200, 240]], handle: [200, 140] },
          { text: '아래 띠를 위로 접어 올려요', line: [[0, 240], [200, 240]], handle: [0, 280] },
          { text: '띠의 왼쪽 귀퉁이를 접어 넣어요', line: [[0, 220], [20, 240]], handle: [0, 240] },
          { text: '오른쪽 귀퉁이도 접고 양쪽을 벌리면 완성!', line: [[200, 220], [180, 240]], handle: [200, 240] },
        ],
      },
      {
        id: 'canoe', name: '카누', desc: '길고 날렵해서 빠르지만 물이 잘 들어와요.',
        paper: [280, 200], stats: { a: 0.95, b: 0.45, c: 0.85 },
        phys: { speed: 1.3, tough: 0.7, agile: 1.25 },
        steps: [
          { text: '반으로 접었다 펴서 중심선을 만들어요', line: [[0, 100], [280, 100]], handle: [0, 0], crease: true },
          { text: '위쪽 변을 중심선에 맞춰 접어요', line: [[0, 50], [280, 50]], handle: [0, 0] },
          { text: '아래쪽 변도 중심선에 맞춰 접어요', line: [[0, 150], [280, 150]], handle: [0, 200] },
          { text: '왼쪽 위 모서리를 중심선으로 접어요', line: [[50, 50], [0, 100]], handle: [0, 50] },
          { text: '왼쪽 아래 모서리도 접어요', line: [[50, 150], [0, 100]], handle: [0, 150] },
          { text: '오른쪽 위 모서리를 중심선으로 접어요', line: [[230, 50], [280, 100]], handle: [280, 50] },
          { text: '오른쪽 아래 모서리도 접어요', line: [[230, 150], [280, 100]], handle: [280, 150] },
          { text: '반으로 접고 속을 벌리면 완성!', line: [[0, 100], [280, 100]], handle: [140, 50] },
        ],
      },
      {
        id: 'sail', name: '돛단배', desc: '느긋하지만 아주 튼튼해요. 접기도 쉬워요.',
        paper: [220, 220], stats: { a: 0.45, b: 0.95, c: 0.5 },
        phys: { speed: 0.8, tough: 1.4, agile: 0.75 },
        steps: [
          { text: '대각선으로 접어 세모를 만들어요', line: [[0, 0], [220, 220]], handle: [220, 0] },
          { text: '아래쪽을 위로 접어 선체를 만들어요', line: [[0, 165], [220, 165]], handle: [220, 220] },
          { text: '뒤쪽 귀퉁이를 접어 올려요', line: [[0, 125], [40, 165]], handle: [0, 165] },
        ],
      },
    ],
    car: [
      {
        id: 'sedan', name: '세단', desc: '무난한 만능 자동차. 어디서든 잘 달려요.',
        paper: [280, 200], stats: { a: 0.7, b: 0.75, c: 0.7 },
        phys: { power: 5.6, crr: 0.055, cd: 0.05, tank: 5.5 },
        steps: [
          { text: '위에서 아래로 반을 접어요', line: [[0, 100], [280, 100]], handle: [0, 0] },
          { text: '뒤쪽 위 모서리를 접어 트렁크를 만들어요', line: [[70, 100], [0, 150]], handle: [0, 100] },
          { text: '앞쪽 위 모서리를 접어 앞유리를 만들어요', line: [[195, 100], [280, 160]], handle: [280, 100] },
          { text: '뒤 범퍼 아래 귀퉁이를 접어요', line: [[0, 180], [20, 200]], handle: [0, 200] },
          { text: '앞 범퍼 아래 귀퉁이도 접어요', line: [[280, 180], [260, 200]], handle: [280, 200] },
        ],
      },
      {
        id: 'racer', name: '레이서', desc: '낮고 날렵한 경주차. 빠르지만 태엽이 금방 풀려요.',
        paper: [280, 200], stats: { a: 0.95, b: 0.85, c: 0.45 },
        phys: { power: 7.5, crr: 0.045, cd: 0.035, tank: 3.4 },
        steps: [
          { text: '반으로 접었다 펴서 중심선을 만들어요', line: [[0, 100], [280, 100]], handle: [0, 0], crease: true },
          { text: '위쪽 변을 중심선에 맞춰 접어요', line: [[0, 50], [280, 50]], handle: [0, 0] },
          { text: '아래쪽 변도 중심선에 맞춰 접어요', line: [[0, 150], [280, 150]], handle: [0, 200] },
          { text: '중심선을 따라 반으로 접어요', line: [[0, 100], [280, 100]], handle: [0, 50] },
          { text: '앞코를 비스듬히 접어 쐐기 모양으로', line: [[190, 100], [280, 135]], handle: [280, 100] },
          { text: '뒤쪽 모서리를 접어 스포일러 모양을 잡아요', line: [[25, 100], [0, 125]], handle: [0, 100] },
        ],
      },
      {
        id: 'truck', name: '트럭', desc: '묵직하고 힘이 좋아 언덕에 강해요. 태엽도 넉넉!',
        paper: [280, 200], stats: { a: 0.6, b: 0.5, c: 0.95 },
        phys: { power: 5.0, crr: 0.068, cd: 0.06, tank: 7.5 },
        steps: [
          { text: '위에서 아래로 반을 접어요', line: [[0, 100], [280, 100]], handle: [0, 0] },
          { text: '앞쪽 끝을 안으로 접어 범퍼를 만들어요', line: [[250, 100], [250, 200]], handle: [280, 200] },
          { text: '운전석 모서리를 비스듬히 접어요', line: [[205, 100], [250, 135]], handle: [250, 100] },
          { text: '짐칸 뒤 귀퉁이를 접어요', line: [[0, 182], [18, 200]], handle: [0, 200] },
        ],
      },
    ],
  };

  Object.keys(G.MODELS).forEach((sec) => G.MODELS[sec].forEach((m) => (m.section = sec)));

  G.findModel = (section, id) => G.MODELS[section].find((m) => m.id === id);

  /* ---------- 완성품 스프라이트 (옆모습, 오른쪽을 향함) ---------- */
  function poly(ctx, pts, k, fill, stroke) {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0] * k, p[1] * k) : ctx.moveTo(p[0] * k, p[1] * k)));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = Math.max(1, k * 0.035);
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  }
  function wheel(ctx, x, y, r, k, spin) {
    ctx.save();
    ctx.translate(x * k, y * k);
    ctx.rotate(spin || 0);
    ctx.beginPath();
    ctx.arc(0, 0, r * k, 0, Math.PI * 2);
    ctx.fillStyle = '#4b4239';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, r * k * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = '#efe6d3';
    ctx.fill();
    ctx.strokeStyle = '#4b4239';
    ctx.lineWidth = Math.max(1, k * 0.04);
    ctx.beginPath();
    ctx.moveTo(-r * k * 0.45, 0);
    ctx.lineTo(r * k * 0.45, 0);
    ctx.stroke();
    ctx.restore();
  }

  const SPR = {
    plane: {
      dart(ctx, k, c, ln) {
        poly(ctx, [[1, 0.02], [-1, -0.12], [-1, -0.46]], k, G.shade(c, 0.35), ln);
        poly(ctx, [[1, 0.02], [-1, -0.12], [-0.82, 0.24]], k, c, ln);
        poly(ctx, [[1, 0.02], [-1, -0.12], [-0.95, -0.02]], k, G.shade(c, -0.18), null);
      },
      glider(ctx, k, c, ln) {
        poly(ctx, [[0.8, 0], [0.3, -0.42], [-1, -0.66], [-1, -0.1]], k, G.shade(c, 0.35), ln);
        poly(ctx, [[0.86, 0.02], [-1, -0.1], [-0.8, 0.2], [0.6, 0.14]], k, c, ln);
        poly(ctx, [[0.86, 0.02], [-1, -0.1], [-0.96, -0.02]], k, G.shade(c, -0.18), null);
      },
      jumbo(ctx, k, c, ln) {
        poly(ctx, [[0.8, -0.04], [0.45, -0.36], [-1, -0.54], [-1, -0.1]], k, G.shade(c, 0.35), ln);
        poly(ctx, [[0.88, -0.05], [0.88, 0.1], [-0.78, 0.3], [-1, -0.1]], k, c, ln);
        poly(ctx, [[0.88, -0.05], [0.88, 0.1], [0.62, 0.13], [0.62, -0.06]], k, G.shade(c, -0.18), null);
      },
    },
    boat: {
      classic(ctx, k, c, ln) {
        poly(ctx, [[-0.34, -0.08], [0, -0.72], [0.34, -0.08]], k, G.shade(c, 0.4), ln);
        poly(ctx, [[-1, -0.12], [1, -0.12], [0.58, 0.38], [-0.58, 0.38]], k, c, ln);
        poly(ctx, [[-1, -0.12], [1, -0.12], [0.86, 0.04], [-0.86, 0.04]], k, G.shade(c, -0.15), null);
      },
      canoe(ctx, k, c, ln) {
        poly(ctx, [[-1, -0.2], [-0.6, 0.02], [0.6, 0.02], [1, -0.2], [0.62, 0.3], [-0.62, 0.3]], k, c, ln);
        poly(ctx, [[-0.6, 0.02], [0.6, 0.02], [0.66, 0.12], [-0.66, 0.12]], k, G.shade(c, -0.15), null);
      },
      sail(ctx, k, c, ln) {
        poly(ctx, [[-0.2, -0.08], [-0.2, -0.95], [0.62, -0.08]], k, G.shade(c, 0.45), ln);
        poly(ctx, [[-0.3, -0.08], [-0.3, -0.6], [-0.72, -0.08]], k, G.shade(c, 0.25), ln);
        poly(ctx, [[-0.95, -0.06], [1, -0.06], [0.62, 0.36], [-0.7, 0.36]], k, c, ln);
      },
    },
    car: {
      sedan(ctx, k, c, ln, spin) {
        poly(ctx, [[-1, 0.3], [-1, -0.05], [-0.62, -0.1], [-0.4, -0.5], [0.3, -0.5], [0.58, -0.1], [1, 0], [1, 0.3]], k, c, ln);
        poly(ctx, [[-0.34, -0.42], [-0.02, -0.42], [-0.02, -0.12], [-0.5, -0.12]], k, G.shade(c, 0.55), null);
        poly(ctx, [[0.06, -0.42], [0.26, -0.42], [0.46, -0.12], [0.06, -0.12]], k, G.shade(c, 0.55), null);
        wheel(ctx, -0.58, 0.32, 0.23, k, spin);
        wheel(ctx, 0.6, 0.32, 0.23, k, spin);
      },
      racer(ctx, k, c, ln, spin) {
        poly(ctx, [[-1, -0.42], [-0.78, -0.42], [-0.78, -0.1], [-0.2, -0.28], [0.2, -0.24], [1, 0.14], [1, 0.3], [-1, 0.3]], k, c, ln);
        poly(ctx, [[-0.14, -0.2], [0.16, -0.18], [0.4, -0.04], [-0.2, -0.04]], k, G.shade(c, 0.55), null);
        poly(ctx, [[-1.04, -0.5], [-0.7, -0.5], [-0.7, -0.4], [-1.04, -0.4]], k, G.shade(c, -0.25), ln);
        wheel(ctx, -0.6, 0.3, 0.25, k, spin);
        wheel(ctx, 0.62, 0.32, 0.22, k, spin);
      },
      truck(ctx, k, c, ln, spin) {
        poly(ctx, [[-1, 0.3], [-1, -0.3], [0.2, -0.3], [0.2, 0.3]], k, G.shade(c, -0.15), ln);
        poly(ctx, [[0.2, 0.3], [0.2, -0.62], [0.66, -0.62], [0.98, -0.18], [0.98, 0.3]], k, c, ln);
        poly(ctx, [[0.32, -0.52], [0.62, -0.52], [0.84, -0.2], [0.32, -0.2]], k, G.shade(c, 0.55), null);
        wheel(ctx, -0.62, 0.34, 0.25, k, spin);
        wheel(ctx, 0.6, 0.34, 0.25, k, spin);
      },
    },
  };

  // 원점 중심, 가로 길이 size 로 그린다
  G.drawCraft = (ctx, section, id, color, size, spin) => {
    const fn = SPR[section][id];
    if (fn) fn(ctx, size / 2, color, 'rgba(60,45,30,0.55)', spin);
  };
})();
