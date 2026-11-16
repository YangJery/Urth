/* 섹션 정의와 '도안'(따라 접기 안내). 성능은 도안이 아니라 실제로 접힌 모양에서 계산된다. */
(function () {
  const G = window.G;

  G.SECTIONS = {
    plane: {
      name: '종이 비행기', emoji: '✈️', verb: '날리기', place: '고무줄 새총으로 쏘아 날려요',
      paper: [200, 280], front: 'up', frontLabel: '↑ 이쪽이 기수(앞)',
      metrics: [
        { key: 'dist', label: '비행 거리', unit: 'm', digits: 1 },
        { key: 'time', label: '체공 시간', unit: '초', digits: 1 },
      ],
    },
    boat: {
      name: '종이 배', emoji: '⛵', verb: '띄우기', place: '고무줄 물레방아로 냇물을 달려요',
      paper: [200, 280], front: 'up', frontLabel: '↑ 이쪽이 뱃머리(앞)',
      metrics: [
        { key: 'dist', label: '항해 거리', unit: 'm', digits: 1 },
        { key: 'time', label: '버틴 시간', unit: '초', digits: 1 },
      ],
    },
    car: {
      name: '종이 자동차', emoji: '🚗', verb: '달리기', place: '고무줄 동력으로 언덕길을 달려요',
      paper: [280, 200], front: 'right', frontLabel: '옆모습 · 앞은 오른쪽 → · 아래에 바퀴',
      metrics: [
        { key: 'dist', label: '주행 거리', unit: 'm', digits: 1 },
        { key: 'speed', label: '최고 속도', unit: 'km/h', digits: 1 },
      ],
    },
  };

  /* line = 접는 선, handle = 잡는 점, crease = 접었다 펴기 */
  const centerV = { text: '반으로 접었다 펴서 중심선을 만들어요', line: [[100, 0], [100, 280]], handle: [0, 0], crease: true };
  const cornerL = { text: '왼쪽 위 모서리를 중심선에 맞춰 접어요', line: [[100, 0], [0, 100]], handle: [0, 0] };
  const cornerR = { text: '오른쪽 위 모서리도 중심선에 맞춰 접어요', line: [[100, 0], [200, 100]], handle: [200, 0] };

  G.MODELS = {
    plane: [
      {
        id: 'dart', name: '다트', desc: '앞이 무겁고 뾰족한 기본형.', paper: [200, 280],
        steps: [centerV, cornerL, cornerR,
          { text: '왼쪽 빗변을 한 번 더 중심선으로 접어요', line: [[100, 0], [0, 241.4]], handle: [0, 100] },
          { text: '오른쪽 빗변도 중심선으로 접어요', line: [[100, 0], [200, 241.4]], handle: [200, 100] }],
      },
      {
        id: 'glider', name: '글라이더', desc: '날개가 넓어 천천히 떠요.', paper: [200, 280],
        steps: [centerV, cornerL, cornerR,
          { text: '뾰족한 코를 아래로 접어 내려요', line: [[0, 70], [200, 70]], handle: [100, 0] },
          { text: '새로 생긴 왼쪽 모서리를 중심으로 접어요', line: [[100, 70], [0, 170]], handle: [30, 70] },
          { text: '오른쪽 모서리도 중심으로 접어요', line: [[100, 70], [200, 170]], handle: [170, 70] }],
      },
      {
        id: 'swallow', name: '제비', desc: '앞이 묵직해 곧고 멀리 날아요.', paper: [200, 280],
        steps: [centerV, cornerL, cornerR,
          { text: '세모 꼭짓점을 아래로 접어 내려요', line: [[0, 100], [200, 100]], handle: [100, 0] },
          { text: '왼쪽 위 모서리를 비스듬히 가운데로 접어요', line: [[100, 100], [20, 220]], handle: [0, 100] },
          { text: '오른쪽 위 모서리도 똑같이 접어요', line: [[100, 100], [180, 220]], handle: [200, 100] }],
      },
    ],
    boat: [
      {
        id: 'canoe', name: '카누', desc: '길고 날렵한 선체.', paper: [200, 280],
        steps: [centerV,
          { text: '왼쪽 변을 중심선에 맞춰 접어요', line: [[50, 0], [50, 280]], handle: [0, 0] },
          { text: '오른쪽 변도 중심선에 맞춰 접어요', line: [[150, 0], [150, 280]], handle: [200, 0] },
          { text: '뱃머리 왼쪽 모서리를 접어요', line: [[50, 50], [100, 0]], handle: [50, 0] },
          { text: '뱃머리 오른쪽 모서리를 접어요', line: [[150, 50], [100, 0]], handle: [150, 0] },
          { text: '꼬리 왼쪽 모서리를 접어요', line: [[50, 230], [100, 280]], handle: [50, 280] },
          { text: '꼬리 오른쪽 모서리를 접어요', line: [[150, 230], [100, 280]], handle: [150, 280] }],
      },
      {
        id: 'barge', name: '넓적배', desc: '넓고 두꺼워 잘 버텨요.', paper: [200, 280],
        steps: [
          { text: '아래쪽을 위로 접어 바닥을 두껍게 해요', line: [[0, 200], [200, 200]], handle: [0, 280] },
          { text: '왼쪽 위 모서리를 가운데로 접어 뱃머리를 만들어요', line: [[100, 0], [0, 100]], handle: [0, 0] },
          { text: '오른쪽 위 모서리도 가운데로 접어요', line: [[100, 0], [200, 100]], handle: [200, 0] }],
      },
    ],
    car: [
      {
        id: 'sedan', name: '세단', desc: '무난한 옆모습.', paper: [280, 200],
        steps: [
          { text: '위에서 아래로 반을 접어요', line: [[0, 100], [280, 100]], handle: [0, 0] },
          { text: '뒤쪽 위 모서리를 접어 트렁크를 만들어요', line: [[70, 100], [0, 150]], handle: [0, 100] },
          { text: '앞쪽 위 모서리를 접어 앞유리를 만들어요', line: [[195, 100], [280, 160]], handle: [280, 100] }],
      },
      {
        id: 'racer', name: '레이서', desc: '낮고 납작한 쐐기 모양.', paper: [280, 200],
        steps: [
          { text: '반으로 접었다 펴서 중심선을 만들어요', line: [[0, 100], [280, 100]], handle: [0, 0], crease: true },
          { text: '위쪽 변을 중심선에 맞춰 접어요', line: [[0, 50], [280, 50]], handle: [0, 0] },
          { text: '아래쪽 변도 중심선에 맞춰 접어요', line: [[0, 150], [280, 150]], handle: [0, 200] },
          { text: '중심선을 따라 반으로 접어요', line: [[0, 100], [280, 100]], handle: [0, 50] },
          { text: '앞코를 비스듬히 접어 쐐기 모양으로', line: [[190, 100], [280, 135]], handle: [280, 100] }],
      },
      {
        id: 'truck', name: '트럭', desc: '높고 각진 상자 모양.', paper: [280, 200],
        steps: [
          { text: '위에서 아래로 반을 접어요', line: [[0, 100], [280, 100]], handle: [0, 0] },
          { text: '앞쪽 끝을 안으로 접어 범퍼를 만들어요', line: [[250, 100], [250, 200]], handle: [280, 200] },
          { text: '운전석 모서리를 비스듬히 접어요', line: [[205, 100], [250, 135]], handle: [250, 100] }],
      },
    ],
  };
  Object.keys(G.MODELS).forEach((sec) => G.MODELS[sec].forEach((m) => (m.section = sec)));
  G.findModel = (section, id) => G.MODELS[section].find((m) => m.id === id);
})();
