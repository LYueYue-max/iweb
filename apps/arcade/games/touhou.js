/* ============================================================
 * 東方妖々夢 ～ Perfect Cherry Blossom · WEB EDITION
 * 东方 Project 同人致敬性质的网页弹幕游戏（非原版运行）
 *
 * 说明：
 *  - 美术、音效、弹幕全部由本文件程序生成，不包含任何原版素材；
 *  - 玩法致敬 TH07：弹幕、符卡、樱点与森罗结界、机体 / 难度分类；
 *  - 最高分与通关记录保存在浏览器 localStorage：
 *      touhou_save_v1  —— 详细存档（最高分、最远面数、通关次数、设置）
 *      mg_scores       —— 与街机卡带墙共享的最高分（key: touhou）
 *
 * 接入方式：apps/arcade/index.html 里 load 本文件后
 *   register(window.TOUHOU_GAME()) 注册为一款卡带。
 * ============================================================ */
(function () {
  "use strict";

  var LW = 480;
  var LH = 640;
  var WIDE = false;
  var cvs = null;
  var TAU = Math.PI * 2;
  var SAVE_KEY = "touhou_save_v1";
  var SCORE_KEY = "mg_scores";

  var F_SERIF = "'Noto Serif SC', 'Songti SC', 'SimSun', serif";
  var F_SANS =
    "'Noto Sans SC', -apple-system, 'Segoe UI', 'Microsoft YaHei', sans-serif";
  var F_MONO = "'Fira Code', Consolas, monospace";

  /* ============================================================
   * 小工具
   * ============================================================ */
  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }
  function rnd(a, b) {
    return a + Math.random() * (b - a);
  }
  function rndi(a, b) {
    return Math.floor(a + Math.random() * (b - a + 1));
  }
  function ce(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function comma(n) {
    return String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  function dist2(ax, ay, bx, by) {
    var dx = ax - bx;
    var dy = ay - by;
    return dx * dx + dy * dy;
  }
  function canvasSprite(w, h, draw) {
    var c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    draw(c.getContext("2d"), w, h);
    return c;
  }

  /* ============================================================
   * 音效（Web Audio 程序合成，零外部资源）
   * ============================================================ */
  var AC = null;
  var muted = false;
  var shotSfxAt = 0;

  function ensureAudio() {
    if (AC) {
      if (AC.state === "suspended" && AC.resume) AC.resume();
      return;
    }
    var Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    try {
      AC = new Ctor();
    } catch (e) {
      AC = null;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!AC || muted) return;
    try {
      var t = AC.currentTime;
      var o = AC.createOscillator();
      var g = AC.createGain();
      o.type = type || "square";
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) {
        o.frequency.exponentialRampToValueAtTime(Math.max(24, slideTo), t + dur);
      }
      g.gain.setValueAtTime(Math.max(0.0001, vol), t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(AC.destination);
      o.start(t);
      o.stop(t + dur + 0.03);
    } catch (e) {
      /* 忽略音频错误 */
    }
  }

  function noiseBurst(dur, vol, cutoff) {
    if (!AC || muted) return;
    try {
      var t = AC.currentTime;
      var len = Math.max(1, Math.floor(AC.sampleRate * dur));
      var buf = AC.createBuffer(1, len, AC.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      }
      var src = AC.createBufferSource();
      src.buffer = buf;
      var filter = AC.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = cutoff || 1200;
      var g = AC.createGain();
      g.gain.value = vol;
      src.connect(filter);
      filter.connect(g);
      g.connect(AC.destination);
      src.start(t);
    } catch (e) {
      /* 忽略 */
    }
  }

  function sfx(name) {
    if (!AC || muted) return;
    if (name === "shot") {
      var now = Date.now();
      if (now - shotSfxAt < 95) return;
      shotSfxAt = now;
      tone(1050, 0.045, "square", 0.012, 760);
    } else if (name === "hit") {
      tone(220, 0.05, "square", 0.02, 160);
    } else if (name === "kill") {
      noiseBurst(0.18, 0.05, 900);
    } else if (name === "spell") {
      tone(392, 0.5, "triangle", 0.05, 784);
      tone(523, 0.55, "sine", 0.045, 1046);
    } else if (name === "bomb") {
      noiseBurst(0.45, 0.12, 500);
      tone(90, 0.4, "sawtooth", 0.05, 40);
    } else if (name === "border") {
      tone(220, 0.6, "sine", 0.05, 1320);
      noiseBurst(0.3, 0.03, 2400);
    } else if (name === "death") {
      noiseBurst(0.5, 0.14, 420);
      tone(160, 0.35, "sawtooth", 0.06, 48);
    } else if (name === "select") {
      tone(660, 0.06, "sine", 0.03, 880);
    } else if (name === "pause") {
      tone(440, 0.1, "sine", 0.03, 660);
    } else if (name === "graze") {
      tone(1320, 0.035, "sine", 0.012, 1560);
    } else if (name === "clear") {
      tone(523, 0.16, "triangle", 0.05, 784);
      setTimeout(function () {
        tone(659, 0.2, "triangle", 0.05, 988);
      }, 140);
      setTimeout(function () {
        tone(784, 0.3, "triangle", 0.05, 1175);
      }, 300);
    }
  }

  /* ============================================================
   * 预渲染精灵
   * ============================================================ */
  var SP = { built: false };

  function orbSprite(c1, c2, r) {
    return canvasSprite(r * 4, r * 4, function (g, w, h) {
      var cx = w / 2;
      var cy = h / 2;
      var grad = g.createRadialGradient(cx, cy, 0, cx, cy, r * 2);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.16, c1);
      grad.addColorStop(0.52, c2);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grad;
      g.beginPath();
      g.arc(cx, cy, r * 2, 0, TAU);
      g.fill();
    });
  }

  function riceSprite(c1, c2) {
    return canvasSprite(28, 18, function (g, w, h) {
      g.translate(w / 2, h / 2);
      var grad = g.createLinearGradient(-11, 0, 11, 0);
      grad.addColorStop(0, c2);
      grad.addColorStop(0.5, c1);
      grad.addColorStop(1, c2);
      g.fillStyle = grad;
      g.beginPath();
      g.ellipse(0, 0, 11, 5.5, 0, 0, TAU);
      g.fill();
      g.fillStyle = "rgba(255,255,255,.85)";
      g.beginPath();
      g.ellipse(0, 0, 4, 2, 0, 0, TAU);
      g.fill();
    });
  }

  function scaleSprite(c1, c2) {
    return canvasSprite(24, 24, function (g, w, h) {
      g.translate(w / 2, h / 2);
      var grad = g.createRadialGradient(0, 0, 1, 0, 0, 11);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.35, c1);
      grad.addColorStop(1, c2);
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(0, -10);
      g.lineTo(5.5, 0);
      g.lineTo(0, 10);
      g.lineTo(-5.5, 0);
      g.closePath();
      g.fill();
    });
  }

  function petalSprite() {
    return canvasSprite(20, 20, function (g, w, h) {
      g.translate(w / 2, h / 2);
      g.rotate(-0.35);
      g.fillStyle = "rgba(255,176,214,.9)";
      g.beginPath();
      g.moveTo(0, -8);
      g.bezierCurveTo(7, -7, 7, 5, 0, 8);
      g.bezierCurveTo(-7, 5, -7, -7, 0, -8);
      g.fill();
      g.fillStyle = "rgba(255,255,255,.35)";
      g.beginPath();
      g.ellipse(0, -1, 2.2, 4.4, 0, 0, TAU);
      g.fill();
    });
  }

  function starSprite(color) {
    return canvasSprite(12, 12, function (g, w, h) {
      g.translate(w / 2, h / 2);
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(0, -5);
      g.lineTo(1.6, -1.6);
      g.lineTo(5, 0);
      g.lineTo(1.6, 1.6);
      g.lineTo(0, 5);
      g.lineTo(-1.6, 1.6);
      g.lineTo(-5, 0);
      g.lineTo(-1.6, -1.6);
      g.closePath();
      g.fill();
    });
  }

  function shotSprite(color) {
    return canvasSprite(20, 20, function (g, w, h) {
      var cx = w / 2;
      var cy = h / 2;
      var grad = g.createRadialGradient(cx, cy, 0, cx, cy, 9);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.35, color);
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grad;
      g.beginPath();
      g.arc(cx, cy, 9, 0, TAU);
      g.fill();
    });
  }

  function buildSprites() {
    if (SP.built) return;
    SP.built = true;
    var colors = {
      pink: ["#ffd3e9", "#ff4f9a"],
      blue: ["#d8efff", "#3f9bff"],
      purple: ["#e9dbff", "#8b5cf6"],
      red: ["#ffd8d2", "#ff4d4d"],
      green: ["#d9ffe9", "#22c98a"],
      yellow: ["#fff3cb", "#ffc300"],
      cyan: ["#d9fbff", "#25d9e6"],
      white: ["#ffffff", "#cdd7ff"]
    };
    Object.keys(colors).forEach(function (k) {
      SP["orb_" + k] = orbSprite(colors[k][0], colors[k][1], 6);
      SP["rice_" + k] = riceSprite(colors[k][0], colors[k][1]);
      SP["scale_" + k] = scaleSprite(colors[k][0], colors[k][1]);
      SP["big_" + k] = orbSprite(colors[k][0], colors[k][1], 11);
    });
    SP.petal = petalSprite();
    SP.star = starSprite("rgba(255,255,255,.9)");
    SP.starPink = starSprite("rgba(255,170,215,.95)");
    SP.shots = [
      shotSprite("rgba(255,200,225,.95)"),
      shotSprite("rgba(255,236,170,.95)"),
      shotSprite("rgba(200,225,255,.95)")
    ];
  }

  /* ============================================================
   * 存档
   * ============================================================ */
  function loadSave() {
    try {
      return JSON.parse(localStorage.getItem(SAVE_KEY) || "{}") || {};
    } catch (e) {
      return {};
    }
  }
  function writeSave(save) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch (e) {
      /* 隐私模式忽略 */
    }
  }
  function readScores() {
    try {
      return JSON.parse(localStorage.getItem(SCORE_KEY) || "{}") || {};
    } catch (e) {
      return {};
    }
  }
  function writeBest(score) {
    try {
      var scores = readScores();
      if (score > (Number(scores.touhou) || 0)) {
        scores.touhou = score;
        localStorage.setItem(SCORE_KEY, JSON.stringify(scores));
      }
    } catch (e) {
      /* 忽略 */
    }
  }

  /* ============================================================
   * 配置
   * ============================================================ */
  var CHARS = [
    {
      key: "reimu",
      name: "博丽灵梦",
      short: "灵梦",
      note: "追踪符 · 判定稳",
      color: "#ff5d7a",
      accent: "#ffd3dd"
    },
    {
      key: "marisa",
      name: "雾雨魔理沙",
      short: "魔理沙",
      note: "直线火力 · 高速",
      color: "#ffd35d",
      accent: "#fff2c0"
    },
    {
      key: "sakuya",
      name: "十六夜咲夜",
      short: "咲夜",
      note: "扇形散射 · 覆盖广",
      color: "#8fb9ff",
      accent: "#e4efff"
    }
  ];

  var DIFFS = [
    {
      key: "easy",
      name: "Easy",
      sub: "初雪",
      spd: 0.78,
      dens: 0.72,
      hpMul: 0.75,
      lives: 3,
      bombs: 3,
      scoreMul: 0.8
    },
    {
      key: "normal",
      name: "Normal",
      sub: "夜樱",
      spd: 0.92,
      dens: 0.86,
      hpMul: 1,
      lives: 3,
      bombs: 3,
      scoreMul: 1
    },
    {
      key: "hard",
      name: "Hard",
      sub: "飞雪",
      spd: 1.06,
      dens: 1,
      hpMul: 1.25,
      lives: 3,
      bombs: 2,
      scoreMul: 1.3
    },
    {
      key: "lunatic",
      name: "Lunatic",
      sub: "狂樱",
      spd: 1.22,
      dens: 1.18,
      hpMul: 1.55,
      lives: 2,
      bombs: 2,
      scoreMul: 1.6
    }
  ];

  var MAX_CHERRY = 200;
  var BORDER_TIME = 3.5;

  /* ============================================================
   * 关卡数据
   * ============================================================ */
  function s2f(x) {
    return function (e) {
      fireAimed(e, x, 0.22, 120);
    };
  }

  var STAGES = [
    {
      name: "一面",
      sub: "夜樱 · 西行妖之下",
      moonX: 356,
      bg: ["#1a0f2e", "#331943", "#100a1c"],
      tint: "pink",
      script: [
        { t: 1.0, fn: function () { waveLine(-1, 5, "pink", 28, 0.24); } },
        { t: 4.2, fn: function () { waveLine(1, 5, "pink", 28, 0.24); } },
        { t: 7.6, fn: function () { waveArc("blue", 6, 36); } },
        { t: 11.2, fn: function () { waveLine(-1, 4, "purple", 42, 0.18); waveLine(1, 4, "purple", 42, 0.18); } },
        { t: 15.4, fn: function () { waveRing("pink", 6); } },
        { t: 19.0, fn: function () { waveLine(0, 5, "blue", 46, 0.2); } },
        { t: 23.0, fn: function () { waveSpiral("pink", 8); } },
        { t: 27.4, fn: startBoss }
      ],
      boss: {
        title: "樱の妖精 · 莉莉",
        color: "pink",
        radius: 26,
        spells: [
          {
            name: "花符「樱之舞」",
            hp: 520,
            time: 30,
            cd: 0.62,
            fire: function (b) {
              ringBurst(b.x, b.y, 16 + Math.floor(4 * G.diff.dens), 105, {
                color: "pink",
                spr: "orb",
                r: 4.4
              });
              if (Math.random() < 0.55) {
                for (var i = 0; i < 2; i++) {
                  aimedBullet(b.x, b.y, 150, { color: "blue", spr: "rice", r: 5 });
                }
              }
            }
          }
        ]
      }
    },
    {
      name: "二面",
      sub: "幽明 · 白玉楼的庭师",
      moonX: 120,
      bg: ["#0a1f2e", "#153a4d", "#071019"],
      tint: "cyan",
      script: [
        { t: 0.8, fn: function () { waveLine(-1, 5, "cyan", 40, 0.22); } },
        { t: 3.8, fn: function () { waveLine(1, 5, "cyan", 40, 0.22); } },
        { t: 6.8, fn: function () { waveArc("blue", 7, 42); } },
        { t: 10.6, fn: function () { waveLine(-1, 4, "purple", 55, 0.16); waveLine(1, 4, "purple", 55, 0.16); } },
        { t: 14.8, fn: function () { waveRing("cyan", 5); } },
        { t: 18.4, fn: function () { waveSpiral("blue", 10); } },
        { t: 23.0, fn: function () { waveLine(0, 6, "green", 60, 0.18); } },
        { t: 27.2, fn: startBoss }
      ],
      boss: {
        title: "白玉楼の庭师 · 魂魄妖梦",
        color: "cyan",
        radius: 28,
        spells: [
          {
            name: "庭符「春眠不觉晓」",
            hp: 620,
            time: 32,
            cd: 0.1,
            fire: function (b, dt, t) {
              var ang = (t * 2.6) % TAU;
              for (var i = 0; i < 2; i++) {
                addBullet(b.x, b.y, ang + i * Math.PI, 118, {
                  color: i ? "purple" : "cyan",
                  spr: "scale",
                  r: 4.6
                });
              }
            }
          },
          {
            name: "剑符「小刀乱舞」",
            hp: 700,
            time: 34,
            cd: 0.85,
            fire: function (b) {
              for (var i = 0; i < 5; i++) {
                aimedBullet(b.x, b.y, 140, { color: "white", spr: "rice", r: 4.6, spread: 0.36, offset: (i - 2) * 0.12 });
              }
              if (Math.random() < 0.4) {
                addLaser(b.x, b.y, aimedAngle(b.x, b.y), { color: "cyan", warn: 0.9, active: 0.35, w: 10 });
              }
            }
          }
        ]
      }
    },
    {
      name: "最终面",
      sub: "白玉楼 · 西行寺幽々子",
      moonX: 240,
      bg: ["#220a2e", "#40124a", "#120418"],
      tint: "purple",
      script: [
        { t: 0.8, fn: function () { waveLine(-1, 6, "purple", 55, 0.18); } },
        { t: 3.6, fn: function () { waveLine(1, 6, "purple", 55, 0.18); } },
        { t: 6.6, fn: function () { waveArc("pink", 8, 50); } },
        { t: 10.2, fn: function () { waveLine(-1, 4, "red", 70, 0.14); waveLine(1, 4, "red", 70, 0.14); } },
        { t: 14.0, fn: function () { waveRing("purple", 6); } },
        { t: 17.6, fn: function () { waveSpiral("pink", 12); } },
        { t: 21.6, fn: function () { waveLine(0, 6, "blue", 80, 0.16); } },
        { t: 25.2, fn: startBoss }
      ],
      boss: {
        title: "西行寺 幽々子",
        color: "purple",
        radius: 32,
        spells: [
          {
            name: "幽曲「亡我乡」",
            hp: 760,
            time: 34,
            cd: 0.16,
            fire: function (b, dt, t) {
              var base = (t * 1.9) % TAU;
              for (var i = 0; i < 3; i++) {
                addBullet(b.x, b.y, base + (i * TAU) / 3, 96, {
                  color: "pink",
                  spr: "scale",
                  r: 5
                });
              }
              if (Math.random() < 0.3) {
                ringBurst(b.x, b.y, 10, 78, { color: "purple", spr: "big", r: 8 });
              }
            }
          },
          {
            name: "死符「生死之境」",
            hp: 880,
            time: 36,
            cd: 0.7,
            fire: function (b) {
              for (var i = 0; i < 7; i++) {
                aimedBullet(b.x, b.y, 150, {
                  color: "blue",
                  spr: "rice",
                  r: 4.8,
                  spread: 0.6,
                  offset: (i - 3) * 0.09
                });
              }
              if (Math.random() < 0.5) {
                ringBurst(b.x, b.y, 14, 100, { color: "cyan", spr: "orb", r: 4.4 });
              }
            }
          },
          {
            name: "反魂蝶「西行妖」",
            hp: 980,
            time: 40,
            cd: 0.2,
            fire: function (b, dt, t) {
              var arm = (t * 3.2) % TAU;
              for (var i = 0; i < 2; i++) {
                addBullet(b.x, b.y, arm + i * Math.PI, 108, {
                  color: "red",
                  spr: "rice",
                  r: 5
                });
              }
              if (Math.random() < 0.24) {
                ringBurst(b.x, b.y, 18, 86, { color: "pink", spr: "scale", r: 5 });
              }
              if (Math.random() < 0.2) {
                for (var k = 0; k < 3; k++) {
                  aimedBullet(b.x, b.y, 175, { color: "purple", spr: "big", r: 7.5, spread: 0.18 });
                }
              }
              if (Math.random() < 0.07) {
                addLaser(b.x, b.y, aimedAngle(b.x, b.y) + rnd(-0.2, 0.2), {
                  color: "red",
                  warn: 1,
                  active: 0.4,
                  w: 12
                });
              }
            }
          }
        ]
      }
    }
  ];

  /* ============================================================
   * 状态
   * ============================================================ */
  var M = {
    row: 0,
    char: 0,
    diff: 1,
    rects: []
  };
  var G = null;
  var menuBg = null;
  var menuSave = {};
  var isTouch = false;
  var time = 0;
  var menuPetals = [];
  var apiRef = null;

  function addBullet(x, y, ang, speed, opt) {
    if (!G) return;
    if (G.bullets.length > 1400) return;
    opt = opt || {};
    var s = speed * G.diff.spd;
    var b = {
      x: x,
      y: y,
      vx: Math.cos(ang) * s,
      vy: Math.sin(ang) * s,
      r: opt.r || 4.2,
      spr: opt.spr || "orb",
      color: opt.color || "pink",
      ang: ang,
      grazed: false,
      curve: opt.curve || 0,
      life: 0
    };
    G.bullets.push(b);
  }

  function aimedAngle(x, y) {
    var p = G.player;
    return Math.atan2(p.y - y, p.x - x);
  }

  function aimedBullet(x, y, speed, opt) {
    opt = opt || {};
    var base = aimedAngle(x, y);
    var off = opt.offset || 0;
    addBullet(x, y, base + off, speed, opt);
  }

  function fireAimed(e, count, spread, speed) {
    var base = aimedAngle(e.x, e.y);
    for (var i = 0; i < count; i++) {
      var off = (i - (count - 1) / 2) * spread;
      addBullet(e.x, e.y, base + off, speed, {
        color: e.color,
        spr: "orb",
        r: 4.2
      });
    }
    sfx("hit");
  }

  function ringBurst(x, y, count, speed, opt) {
    var base = Math.random() * TAU;
    for (var i = 0; i < count; i++) {
      addBullet(x, y, base + (i * TAU) / count, speed, opt);
    }
  }

  function addLaser(x, y, ang, opt) {
    if (!G) return;
    opt = opt || {};
    G.lasers.push({
      x: x,
      y: y,
      ang: ang,
      warn: opt.warn || 0.9,
      active: opt.active || 0.35,
      w: opt.w || 10,
      t: 0,
      color: opt.color || "pink",
      hit: false
    });
  }

  function spawnEnemy(cfg) {
    var e = {
      x: cfg.x,
      y: cfg.y == null ? -26 : cfg.y,
      hp: (cfg.hp || 30) * G.diff.hpMul,
      maxHp: (cfg.hp || 30) * G.diff.hpMul,
      r: cfg.r || 12,
      color: cfg.color || "pink",
      score: cfg.score || 80,
      t: 0,
      lastFire: 0,
      flash: 0,
      dead: false,
      kind: cfg.kind || "fairy",
      update: cfg.update || fairyDefault
    };
    G.enemies.push(e);
    return e;
  }

  function fairyDefault(e, dt) {
    e.t += dt;
    if (e.t < 1.15) {
      e.y += 175 * dt;
    } else if (e.t < 2.5) {
      e.y += 20 * dt;
      var cd = 0.95 / G.diff.dens;
      if (e.t - e.lastFire > cd) {
        e.lastFire = e.t;
        fireAimed(e, rndi(1, 2), 0.2, 118);
      }
    } else {
      e.y += 230 * dt;
    }
    if (e.y > LH + 36) e.dead = true;
  }

  function fairySwoop(e, dt) {
    e.t += dt;
    e.y += 120 * dt;
    e.x += Math.sin(e.t * 2.4) * 60 * dt;
    if (e.t > 0.9 && e.t - e.lastFire > 1.3) {
      e.lastFire = e.t;
      ringBurst(e.x, e.y, 6, 95, { color: e.color, spr: "orb", r: 4 });
    }
    if (e.y > LH + 36) e.dead = true;
  }

  function fairyHeavy(e, dt) {
    e.t += dt;
    if (e.t < 2.8) {
      e.y += 120 * dt;
    } else {
      e.y += 40 * dt;
    }
    if (e.t > 1.2 && e.t - e.lastFire > 1.5) {
      e.lastFire = e.t;
      for (var i = 0; i < 3; i++) {
        aimedBullet(e.x, e.y, 110, { color: e.color, spr: "rice", r: 4.6, spread: 0.5, offset: (i - 1) * 0.16 });
      }
    }
    if (e.y > LH + 40) e.dead = true;
  }

  function waveLine(side, count, color, hp, gap) {
    gap = gap || 0.22;
    for (var i = 0; i < count; i++) {
      (function (i) {
        G.delays.push({
          t: i * gap,
          fn: function () {
            var x = side === 0 ? LW / 2 : side < 0 ? 54 : LW - 54;
            spawnEnemy({
              x: x + (side === 0 ? (i - (count - 1) / 2) * 62 : 0),
              y: -30 - Math.abs(i - (count - 1) / 2) * 12,
              hp: hp,
              color: color,
              r: 12,
              score: 80
            });
          }
        });
      })(i);
    }
  }

  function waveArc(color, count, hp) {
    for (var i = 0; i < count; i++) {
      (function (i) {
        G.delays.push({
          t: i * 0.2,
          fn: function () {
            var ang = Math.PI * 0.15 + (i / (count - 1)) * Math.PI * 0.7;
            var cx = LW / 2 + Math.cos(ang) * 210;
            var cy = -40 + Math.sin(ang) * 20;
            spawnEnemy({
              x: cx,
              y: cy,
              hp: hp,
              color: color,
              r: 13,
              score: 100,
              update: fairySwoop
            });
          }
        });
      })(i);
    }
  }

  function waveRing(color, count) {
    for (var i = 0; i < count; i++) {
      (function (i) {
        G.delays.push({
          t: i * 0.16,
          fn: function () {
            spawnEnemy({
              x: 80 + (i / (count - 1)) * (LW - 160),
              y: -26,
              hp: 55,
              color: color,
              r: 14,
              kind: "heavy",
              score: 120,
              update: fairyHeavy
            });
          }
        });
      })(i);
    }
  }

  function waveSpiral(color, count) {
    for (var i = 0; i < count; i++) {
      (function (i) {
        G.delays.push({
          t: i * 0.14,
          fn: function () {
            spawnEnemy({
              x: (i % 2 ? LW - 60 : 60) + Math.sin(i) * 20,
              y: -30,
              hp: 48,
              color: color,
              r: 12,
              score: 110,
              update: function (e, dt) {
                e.t += dt;
                e.x += (i % 2 ? -1 : 1) * 42 * dt;
                e.y += 95 * dt;
                if (e.t > 1 && e.t - e.lastFire > 1.1) {
                  e.lastFire = e.t;
                  fireAimed(e, 3, 0.24, 132);
                }
                if (e.y > LH + 30 || e.x < -30 || e.x > LW + 30) e.dead = true;
              }
            });
          }
        });
      })(i);
    }
  }

  function startBoss() {
    var data = G.stage.boss;
    var spell = data.spells[0];
    G.enemies = [];
    G.delays = [];
    G.boss = {
      data: data,
      x: LW / 2,
      y: LH * 0.24,
      hp: spell.hp * G.diff.hpMul,
      maxHp: spell.hp * G.diff.hpMul,
      spellIndex: 0,
      spellTime: 0,
      attackT: 0,
      t: 0,
      entering: 1.3,
      invuln: true,
      flash: 0
    };
    G.banner = {
      text: data.title,
      sub: spell.name,
      t: 3.2
    };
    sfx("spell");
  }

  function nextSpell() {
    var b = G.boss;
    if (!b) return;
    b.spellIndex++;
    if (b.spellIndex < b.data.spells.length) {
      var spell = b.data.spells[b.spellIndex];
      b.hp = spell.hp * G.diff.hpMul;
      b.maxHp = b.hp;
      b.spellTime = 0;
      b.attackT = 0;
      b.invuln = true;
      b.enterT = 0.9;
      G.banner = {
        text: b.data.title,
        sub: spell.name,
        t: 2.8
      };
      G.flash = 0.45;
      clearBullets(true);
      sfx("spell");
    } else {
      defeatBoss();
    }
  }

  function defeatBoss() {
    var b = G.boss;
    if (!b) return;
    var px = b.x;
    var py = b.y;
    G.boss = null;
    G.bossDefeatT = 1.4;
    G.score += Math.round(2400 * G.diff.scoreMul);
    G.flash = 0.8;
    G.shake = 14;
    clearBullets(true);
    for (var i = 0; i < 46; i++) {
      G.particles.push({
        x: px + rnd(-26, 26),
        y: py + rnd(-26, 26),
        vx: rnd(-260, 260),
        vy: rnd(-260, 260),
        life: rnd(0.4, 1.2),
        max: 1.2,
        size: rnd(2, 5),
        color: i % 2 ? "#ffd3e9" : "#c9a6ff"
      });
    }
    sfx("kill");
    sfx("clear");
  }

  /* ============================================================
   * 游戏流程
   * ============================================================ */
  function makeBackground(stage) {
    return canvasSprite(LW, LH, function (g) {
      var grad = g.createLinearGradient(0, 0, 0, LH);
      grad.addColorStop(0, stage.bg[0]);
      grad.addColorStop(0.58, stage.bg[1]);
      grad.addColorStop(1, stage.bg[2]);
      g.fillStyle = grad;
      g.fillRect(0, 0, LW, LH);

      // 月晕
      var moonX = stage.moonX ? (stage.moonX / 480) * LW : LW * 0.72;
      var moonY = LH * 0.2;
      var moonR = Math.min(LW, LH) * 0.3;
      var mg = g.createRadialGradient(moonX, moonY, 10, moonX, moonY, moonR * 2.6);
      mg.addColorStop(0, "rgba(255,246,225,.34)");
      mg.addColorStop(0.45, "rgba(255,226,196,.10)");
      mg.addColorStop(1, "rgba(255,226,196,0)");
      g.fillStyle = mg;
      g.beginPath();
      g.arc(moonX, moonY, moonR * 2.6, 0, TAU);
      g.fill();
      g.fillStyle = "rgba(255,248,232,.30)";
      g.beginPath();
      g.arc(moonX, moonY, moonR * 0.62, 0, TAU);
      g.fill();

      // 樱花色氛围光
      var tintRgb = stage.tint === "cyan" ? "120,220,255" : "255,150,200";
      var sg = g.createRadialGradient(
        LW * 0.28,
        LH * 0.4,
        10,
        LW * 0.28,
        LH * 0.4,
        300
      );
      sg.addColorStop(0, "rgba(" + tintRgb + ",.12)");
      sg.addColorStop(1, "rgba(" + tintRgb + ",0)");
      g.fillStyle = sg;
      g.fillRect(0, 0, LW, LH);

      // 星星
      for (var i = 0; i < Math.round(90 * Math.min(1.7, LW / 480)); i++) {
        var sx = rnd(0, LW);
        var sy = rnd(0, LH * 0.72);
        var a = rnd(0.08, 0.6);
        g.fillStyle = "rgba(255,255,255," + a + ")";
        g.fillRect(sx, sy, rnd(0.8, 1.8), rnd(0.8, 1.8));
      }

      // 远景剪影：山 / 樱花树
      g.fillStyle = "rgba(0,0,0,.34)";
      g.beginPath();
      g.moveTo(0, LH * 0.62);
      for (var x = 0; x <= LW; x += 24) {
        g.lineTo(x, LH * 0.62 - Math.sin(x * 0.017 + 1.2) * 26 - Math.sin(x * 0.041) * 10);
      }
      g.lineTo(LW, LH);
      g.lineTo(0, LH);
      g.closePath();
      g.fill();

      g.fillStyle = "rgba(0,0,0,.45)";
      g.beginPath();
      g.moveTo(0, LH * 0.74);
      for (var x2 = 0; x2 <= LW; x2 += 18) {
        g.lineTo(x2, LH * 0.74 - Math.sin(x2 * 0.026 + 3.4) * 14);
      }
      g.lineTo(LW, LH);
      g.lineTo(0, LH);
      g.closePath();
      g.fill();

      // 底部压暗，保证弹幕可读
      var bottom = g.createLinearGradient(0, LH * 0.55, 0, LH);
      bottom.addColorStop(0, "rgba(0,0,0,0)");
      bottom.addColorStop(1, "rgba(0,0,0,.42)");
      g.fillStyle = bottom;
      g.fillRect(0, LH * 0.55, LW, LH * 0.45);
    });
  }

  function makePetals() {
    var list = [];
    for (var i = 0; i < 32; i++) {
      list.push({
        x: rnd(-20, LW + 20),
        y: rnd(-LH, LH),
        vx: rnd(-14, 14),
        vy: rnd(20, 58),
        rot: rnd(0, TAU),
        spin: rnd(-1.8, 1.8),
        s: rnd(0.45, 1.15),
        a: rnd(0.28, 0.72)
      });
    }
    return list;
  }

  function beginRun() {
    ensureAudio();
    var save = loadSave();
    var diff = DIFFS[M.diff];
    G = {
      char: M.char,
      diff: diff,
      diffIndex: M.diff,
      score: 0,
      lives: diff.lives,
      bombs: diff.bombs,
      graze: 0,
      cherry: 0,
      border: 0,
      borderCd: 0,
      scoreMul: diff.scoreMul,
      player: {
        x: LW / 2,
        y: LH - 96,
        invuln: 1.5,
        shotCd: 0,
        slow: false,
        touchSlow: false,
        drag: null
      },
      touchShoot: isTouch || window.innerWidth < 760,
      mouseShoot: false,
      shots: [],
      bullets: [],
      enemies: [],
      lasers: [],
      particles: [],
      pops: [],
      delays: [],
      petals: makePetals(),
      boss: null,
      bossDefeatT: 0,
      stageIndex: 0,
      stage: null,
      stageTime: 0,
      scriptIndex: 0,
      paused: false,
      mode: "play",
      time: 0,
      shake: 0,
      flash: 0,
      banner: null,
      hudAt: 0,
      newBest: false,
      fps: 0,
      frames: 0,
      fpsAt: 0,
      save: save
    };
    startStage(0);
  }

  function startStage(index) {
    var stage = STAGES[index];
    G.stageIndex = index;
    G.stage = stage;
    G.stageTime = 0;
    G.scriptIndex = 0;
    G.enemies = [];
    G.bullets = [];
    G.shots = [];
    G.lasers = [];
    G.delays = [];
    G.boss = null;
    G.bossDefeatT = 0;
    G.mode = "play";
    G.bg = makeBackground(stage);
    G.petals = makePetals();
    G.banner = {
      text: stage.name,
      sub: stage.sub,
      t: 2.8
    };
    G.flash = 0.4;
    sfx("spell");
  }

  function finishRun(cleared) {
    if (!G) return;
    G.mode = cleared ? "clear" : "over";
    G.paused = false;
    G.banner = null;
    G.pops = [];
    if (cleared) G.score += Math.round(12000 * G.diff.scoreMul);
    clearBullets(false);
    G.enemies = [];
    G.lasers = [];
    G.delays = [];
    G.boss = null;

    var save = loadSave();
    var newBest = G.score > (Number(save.best) || 0);
    G.newBest = newBest;
    save.best = Math.max(Number(save.best) || 0, G.score);
    save.bestStage = Math.max(Number(save.bestStage) || 0, G.stageIndex + 1);
    save.plays = (Number(save.plays) || 0) + 1;
    save.lastChar = M.char;
    save.lastDiff = M.diff;
    save.muted = muted;
    if (cleared) {
      save.clears = (Number(save.clears) || 0) + 1;
      save.lastClear = Date.now();
    }
    writeSave(save);
    writeBest(G.score);
    G.save = save;
    menuSave = save;
    if (apiRef && apiRef.finish) {
      apiRef.finish(
        G.score,
        "面 " + (G.stageIndex + 1) + " · 擦弹 " + G.graze
      );
    }
    sfx(cleared ? "clear" : "death");
  }

  function backToMenu() {
    G = null;
    M.row = 0;
    M.resultRects = [];
    menuSave = loadSave();
  }

  /* ============================================================
   * 更新：自机 / 射击 / 敌人 / 子弹 / 激光 / 粒子
   * ============================================================ */
  var keys = {};

  function updatePlayer(dt) {
    var p = G.player;
    var slow = p.slow || p.touchSlow || keys["slow"];
    var speed = (slow ? 148 : 292) * (WIDE ? 1.55 : 1);
    var dx = (keys["right"] ? 1 : 0) - (keys["left"] ? 1 : 0);
    var dy = (keys["down"] ? 1 : 0) - (keys["up"] ? 1 : 0);
    if (dx && dy) {
      var inv = 1 / Math.SQRT2;
      dx *= inv;
      dy *= inv;
    }
    p.x += dx * speed * dt;
    p.y += dy * speed * dt;
    p.x = clamp(p.x, 14, LW - 14);
    p.y = clamp(p.y, 92, LH - 34);
    p.invuln = Math.max(0, p.invuln - dt);

    if (keys["shoot"] || G.touchShoot || G.mouseShoot) {
      p.shotCd -= dt;
      if (p.shotCd <= 0) {
        playerFire();
        p.shotCd = G.char === 2 ? 0.1 : 0.085;
      }
    } else {
      p.shotCd = Math.min(p.shotCd, 0.03);
    }
  }

  function addShot(x, y, ang, speed, dmg, opt) {
    opt = opt || {};
    G.shots.push({
      x: x,
      y: y,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      r: opt.r || 4,
      dmg: dmg,
      homing: !!opt.homing,
      life: 2.2,
      color: opt.color || "#ffe6f2"
    });
  }

  function playerFire() {
    var p = G.player;
    var base = -Math.PI / 2;
    if (G.char === 0) {
      addShot(p.x - 7, p.y - 14, base, 760, 11, { r: 4.6 });
      addShot(p.x + 7, p.y - 14, base, 760, 11, { r: 4.6 });
      addShot(p.x, p.y - 20, base + rnd(-0.06, 0.06), 680, 13, {
        r: 5,
        homing: true,
        color: "#ffc2dc"
      });
    } else if (G.char === 1) {
      addShot(p.x - 10, p.y - 12, base, 900, 12, { r: 4.2, color: "#fff0b8" });
      addShot(p.x, p.y - 18, base, 940, 13, { r: 4.2, color: "#fff0b8" });
      addShot(p.x + 10, p.y - 12, base, 900, 12, { r: 4.2, color: "#fff0b8" });
    } else {
      for (var i = -2; i <= 2; i++) {
        addShot(p.x, p.y - 14, base + i * 0.14, 820, 8.5, {
          r: 3.8,
          color: "#cfe4ff"
        });
      }
    }
    sfx("shot");
  }

  function nearestTarget(x, y) {
    var best = null;
    var bestD = Infinity;
    for (var i = 0; i < G.enemies.length; i++) {
      var e = G.enemies[i];
      if (e.dead) continue;
      var d = dist2(x, y, e.x, e.y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    if (G.boss) {
      var db = dist2(x, y, G.boss.x, G.boss.y);
      if (db < bestD) best = G.boss;
    }
    return best;
  }

  function updateShots(dt) {
    var targets = G.boss;
    for (var i = G.shots.length - 1; i >= 0; i--) {
      var s = G.shots[i];
      if (s.homing) {
        var target = targets || nearestTarget(s.x, s.y);
        if (target) {
          var want = Math.atan2(target.y - s.y, target.x - s.x);
          var cur = Math.atan2(s.vy, s.vx);
          var diff = Math.atan2(Math.sin(want - cur), Math.cos(want - cur));
          cur += clamp(diff, -0.16, 0.16);
          var sp = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
          s.vx = Math.cos(cur) * sp;
          s.vy = Math.sin(cur) * sp;
        }
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      if (
        s.life <= 0 ||
        s.y < -30 ||
        s.x < -30 ||
        s.x > LW + 30 ||
        s.y > LH + 30
      ) {
        G.shots.splice(i, 1);
        continue;
      }
      // 命中敌人
      var hit = false;
      for (var j = 0; j < G.enemies.length; j++) {
        var e = G.enemies[j];
        if (e.dead) continue;
        if (dist2(s.x, s.y, e.x, e.y) < (e.r + s.r) * (e.r + s.r)) {
          e.hp -= s.dmg;
          e.flash = 0.08;
          hit = true;
          spark(s.x, s.y, e.color);
          if (e.hp <= 0) killEnemy(e, j);
          break;
        }
      }
      if (!hit && G.boss && !G.boss.invuln) {
        var b = G.boss;
        if (dist2(s.x, s.y, b.x, b.y) < (b.data.radius + s.r) * (b.data.radius + s.r)) {
          b.hp -= s.dmg;
          b.flash = 0.08;
          spark(s.x, s.y, "pink");
          if (b.hp <= 0) nextSpell();
          hit = true;
        }
      }
      if (hit) G.shots.splice(i, 1);
    }
  }

  function killEnemy(e, index) {
    e.dead = true;
    if (index != null && G.enemies[index] === e) {
      G.enemies.splice(index, 1);
    } else {
      var k = G.enemies.indexOf(e);
      if (k >= 0) G.enemies.splice(k, 1);
    }
    G.score += Math.round(e.score * G.scoreMul);
    G.cherry = Math.min(MAX_CHERRY, G.cherry + (e.kind === "heavy" ? 12 : 3));
    if (e.kind === "heavy") G.score += Math.round(60 * G.scoreMul);
    pop(e.x, e.y, "+" + Math.round(e.score * G.scoreMul));
    for (var i = 0; i < 8; i++) {
      G.particles.push({
        x: e.x,
        y: e.y,
        vx: rnd(-130, 130),
        vy: rnd(-130, 130),
        life: rnd(0.25, 0.6),
        max: 0.6,
        size: rnd(1.6, 3.6),
        color: "#ffc9e2"
      });
    }
    sfx("kill");
  }

  function updateEnemies(dt) {
    for (var i = G.enemies.length - 1; i >= 0; i--) {
      var e = G.enemies[i];
      if (e.dead) continue;
      e.flash = Math.max(0, e.flash - dt);
      e.update(e, dt);
      if (e.dead) {
        G.enemies.splice(i, 1);
      }
    }
  }

  function updateBullets(dt) {
    var p = G.player;
    var wentOut = false;
    for (var i = G.bullets.length - 1; i >= 0; i--) {
      var b = G.bullets[i];
      b.life += dt;
      if (b.curve) {
        var a = Math.atan2(b.vy, b.vx) + b.curve * dt;
        var sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        b.vx = Math.cos(a) * sp;
        b.vy = Math.sin(a) * sp;
        b.ang = a;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (
        b.y > LH + 48 ||
        b.y < -80 ||
        b.x < -80 ||
        b.x > LW + 80
      ) {
        G.bullets.splice(i, 1);
        wentOut = true;
        continue;
      }

      if (p.invuln > 0 || G.border > 0) {
        continue;
      }

      var d2 = dist2(b.x, b.y, p.x, p.y);
      var hitR = b.r + 3.2;
      if (d2 < hitR * hitR) {
        G.bullets.splice(i, 1);
        hitPlayer();
        return;
      }
      if (!b.grazed) {
        var grazeR = b.r + 17;
        if (d2 < grazeR * grazeR) {
          b.grazed = true;
          G.graze++;
          G.cherry = Math.min(MAX_CHERRY, G.cherry + 1);
          G.score += Math.round((G.border > 0 ? 15 : 10) * G.scoreMul);
          if (Math.random() < 0.16) sfx("graze");
          spark(b.x, b.y, "white");
        }
      }
    }
    if (wentOut) {
      /* 保留占位，避免 lint 报未使用 */
    }
  }

  function updateLasers(dt) {
    var p = G.player;
    for (var i = G.lasers.length - 1; i >= 0; i--) {
      var l = G.lasers[i];
      l.t += dt;
      if (l.t > l.warn + l.active) {
        G.lasers.splice(i, 1);
        continue;
      }
      if (
        l.t >= l.warn &&
        p.invuln <= 0 &&
        G.border <= 0
      ) {
        var dx = p.x - l.x;
        var dy = p.y - l.y;
        var along = dx * Math.cos(l.ang) + dy * Math.sin(l.ang);
        var perp = Math.abs(-dx * Math.sin(l.ang) + dy * Math.cos(l.ang));
        if (along > 0 && perp < l.w / 2 + 3) {
          hitPlayer();
          G.lasers.splice(i, 1);
          return;
        }
      }
    }
  }

  function updateParticles(dt) {
    for (var i = G.particles.length - 1; i >= 0; i--) {
      var pt = G.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) {
        G.particles.splice(i, 1);
        continue;
      }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.96;
      pt.vy *= 0.96;
    }
    for (var j = G.pops.length - 1; j >= 0; j--) {
      var pop = G.pops[j];
      pop.life -= dt;
      pop.y -= 26 * dt;
      if (pop.life <= 0) G.pops.splice(j, 1);
    }
  }

  function updatePetals(dt) {
    if (!G) return;
    for (var i = 0; i < G.petals.length; i++) {
      var p = G.petals[i];
      p.x += (p.vx + Math.sin(G.time * 0.8 + i) * 10) * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      if (p.y > LH + 20) {
        p.y = -20;
        p.x = rnd(-20, LW + 20);
      }
      if (p.x < -30) p.x = LW + 20;
      if (p.x > LW + 30) p.x = -20;
    }
  }

  function updateDelays(dt) {
    for (var i = G.delays.length - 1; i >= 0; i--) {
      var d = G.delays[i];
      d.t -= dt;
      if (d.t <= 0) {
        G.delays.splice(i, 1);
        d.fn();
      }
    }
  }

  function updateBoss(dt) {
    var b = G.boss;
    if (!b) return;
    b.t += dt;
    b.flash = Math.max(0, b.flash - dt);
    b.x = clamp(LW / 2 + Math.sin(b.t * 0.55) * (WIDE ? 220 : 108), 96, LW - 96);
    b.y = LH * 0.24 + Math.sin(b.t * 0.9) * 8;

    if (b.entering > 0) {
      b.entering -= dt;
      if (b.entering <= 0) b.invuln = false;
      return;
    }
    if (b.enterT > 0) {
      b.enterT -= dt;
      if (b.enterT <= 0) b.invuln = false;
      return;
    }
    if (b.invuln) return;

    var spell = b.data.spells[b.spellIndex];
    b.spellTime += dt;
    b.attackT += dt;
    var cd = spell.cd / G.diff.dens;
    while (b.attackT >= cd) {
      b.attackT -= cd;
      spell.fire(b, cd, b.spellTime);
    }
    if (b.spellTime >= spell.time && b.hp > 0) {
      // 时间到：本张符卡结束，扣掉剩余血量
      b.hp = 0;
    }
    if (b.hp <= 0) {
      nextSpell();
    }
  }

  function updateStage(dt) {
    if (!G.stage) return;
    G.stageTime += dt;
    var script = G.stage.script;
    while (
      G.scriptIndex < script.length &&
      G.stageTime >= script[G.scriptIndex].t
    ) {
      var entry = script[G.scriptIndex];
      G.scriptIndex++;
      entry.fn();
    }
  }

  function updateGame(dt) {
    G.time += dt;
    G.shake = Math.max(0, G.shake - dt * 30);
    G.flash = Math.max(0, G.flash - dt * 2.2);
    G.border = Math.max(0, G.border - dt);
    if (G.border <= 0 && G.borderCd > 0) G.borderCd = Math.max(0, G.borderCd - dt);

    updatePetals(dt);
    updatePlayer(dt);
    updateShots(dt);
    updateEnemies(dt);
    updateBullets(dt);
    updateLasers(dt);
    updateParticles(dt);
    updateDelays(dt);
    updateBoss(dt);
    updateStage(dt);

    if (G.particles.length > 180) {
      G.particles.splice(0, G.particles.length - 180);
    }

    if (G.bossDefeatT > 0) {
      G.bossDefeatT -= dt;
      if (G.bossDefeatT <= 0) {
        if (G.stageIndex >= STAGES.length - 1) {
          finishRun(true);
        } else {
          G.mode = "stageclear";
          G.stageClearT = 2.1;
          G.banner = {
            text: "面通过",
            sub: G.stage.name + " · 继续前进",
            t: 2.1
          };
        }
      }
    }
    if (G.banner) {
      G.banner.t -= dt;
      if (G.banner.t <= 0) G.banner = null;
    }

    // 顶栏 HUD（122 街机外壳）低频同步
    if (G.hudAt <= 0) {
      G.hudAt = 0.25;
      if (apiRef && apiRef.hud) {
        apiRef.hud(G.score);
      }
    } else {
      G.hudAt -= dt;
    }
    G.frames++;
    if (G.time - G.fpsAt >= 1) {
      G.fps = G.frames;
      G.frames = 0;
      G.fpsAt = G.time;
    }
  }

  function updateStageClear(dt) {
    G.stageClearT -= dt;
    G.flash = Math.max(0, G.flash - dt);
    updatePetals(dt);
    updateParticles(dt);
    if (G.banner) {
      G.banner.t -= dt;
      if (G.banner.t <= 0) G.banner = null;
    }
    if (G.stageClearT <= 0) {
      startStage(G.stageIndex + 1);
      G.flash = 0.4;
    }
  }

  /* ============================================================
   * 受击 / 炸弹 / 结界
   * ============================================================ */
  function hitPlayer() {
    if (!G || G.player.invuln > 0 || G.border > 0) return;
    G.lives--;
    G.bombs = Math.min(3, G.bombs + 1);
    G.shake = 18;
    G.flash = 0.9;
    G.player.invuln = 2.6;
    clearBullets(true);
    sfx("death");
    if (G.lives <= 0) {
      G.mode = "over";
      G.lives = 0;
      finishRun(false);
    }
  }

  function clearBullets(convert) {
    if (!G) return;
    var n = G.bullets.length;
    for (var i = 0; i < Math.min(n, 90); i++) {
      var b = G.bullets[i];
      G.particles.push({
        x: b.x,
        y: b.y,
        vx: rnd(-90, 90),
        vy: rnd(-90, 90),
        life: rnd(0.2, 0.55),
        max: 0.55,
        size: rnd(1.2, 3),
        color: "#ffd4e8"
      });
    }
    if (convert) G.score += Math.round(n * 4 * G.scoreMul);
    G.bullets = [];
  }

  function useBomb() {
    if (!G || G.mode !== "play" || G.paused || G.bombs <= 0) return;
    G.bombs--;
    G.player.invuln = Math.max(G.player.invuln, 1.8);
    G.shake = 12;
    G.flash = 0.7;
    clearBullets(true);
    if (G.boss && !G.boss.invuln) {
      G.boss.hp -= 260;
      G.boss.flash = 0.3;
      if (G.boss.hp <= 0) nextSpell();
    }
    for (var i = 0; i < 34; i++) {
      var a = rnd(0, TAU);
      G.particles.push({
        x: G.player.x,
        y: G.player.y,
        vx: Math.cos(a) * rnd(120, 460),
        vy: Math.sin(a) * rnd(120, 460),
        life: rnd(0.3, 0.85),
        max: 0.85,
        size: rnd(2, 5),
        color: i % 2 ? "#ffe6a8" : "#ffd3e9"
      });
    }
    sfx("bomb");
    pop(G.player.x, G.player.y - 30, "BOMB!");
  }

  function useBorder() {
    if (!G || G.mode !== "play" || G.paused) return;
    if (G.cherry < MAX_CHERRY || G.border > 0) return;
    G.cherry = 0;
    G.border = BORDER_TIME;
    G.player.invuln = Math.max(G.player.invuln, BORDER_TIME);
    clearBullets(true);
    G.flash = 0.8;
    G.shake = 8;
    for (var i = 0; i < 40; i++) {
      var a = rnd(0, TAU);
      G.particles.push({
        x: G.player.x,
        y: G.player.y,
        vx: Math.cos(a) * rnd(80, 320),
        vy: Math.sin(a) * rnd(80, 320),
        life: rnd(0.4, 1.1),
        max: 1.1,
        size: rnd(1.8, 4.4),
        color: i % 3 ? "#ffc2e2" : "#ffffff"
      });
    }
    sfx("border");
    pop(G.player.x, G.player.y - 34, "森罗结界");
  }

  function spark(x, y, color) {
    if (!G) return;
    G.particles.push({
      x: x,
      y: y,
      vx: rnd(-40, 40),
      vy: rnd(-40, 40),
      life: 0.18,
      max: 0.18,
      size: rnd(1, 2.4),
      color: color === "white" ? "#ffffff" : "#ffd3e9"
    });
  }

  function pop(x, y, text) {
    if (!G) return;
    G.pops.push({
      x: x,
      y: y,
      text: text,
      life: 0.9
    });
  }

  /* ============================================================
   * 绘制
   * ============================================================ */
  function drawPetals(ctx) {
    if (!G) return;
    for (var i = 0; i < G.petals.length; i++) {
      var p = G.petals[i];
      ctx.save();
      ctx.globalAlpha = p.a;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(p.s, p.s);
      ctx.drawImage(SP.petal, -10, -10);
      ctx.restore();
    }
  }

  function drawBackground(ctx, bg, petals) {
    ctx.drawImage(bg, 0, 0);
    if (petals) {
      for (var i = 0; i < petals.length; i++) {
        var p = petals[i];
        ctx.save();
        ctx.globalAlpha = p.a;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(p.s, p.s);
        ctx.drawImage(SP.petal, -10, -10);
        ctx.restore();
      }
    }
  }

  function drawBullet(ctx, b) {
    var img = SP[b.spr + "_" + b.color] || SP.orb_pink;
    if (b.spr === "rice") {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.ang + Math.PI / 2);
      ctx.drawImage(img, -14, -9);
      ctx.restore();
    } else if (b.spr === "scale") {
      /* 菱形对称：不做旋转，省掉每颗子弹的 canvas 状态切换 */
      ctx.drawImage(img, b.x - 12, b.y - 12);
    } else if (b.spr === "big") {
      ctx.drawImage(img, b.x - 22, b.y - 22);
    } else {
      ctx.drawImage(img, b.x - 12, b.y - 12);
    }
  }

  function drawLasers(ctx) {
    for (var i = 0; i < G.lasers.length; i++) {
      var l = G.lasers[i];
      var active = l.t >= l.warn;
      var ex = l.x + Math.cos(l.ang) * 1000;
      var ey = l.y + Math.sin(l.ang) * 1000;
      ctx.save();
      ctx.lineCap = "round";
      if (!active) {
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = "#ffd3e9";
        ctx.lineWidth = 1.4;
        ctx.setLineDash([6, 8]);
        ctx.beginPath();
        ctx.moveTo(l.x, l.y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      } else {
        var alpha = l.t > l.warn + l.active - 0.1 ? 0.4 : 1;
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = "rgba(255,120,180,.32)";
        ctx.lineWidth = l.w + 10;
        ctx.beginPath();
        ctx.moveTo(l.x, l.y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.strokeStyle = "#fff0f7";
        ctx.lineWidth = l.w * 0.42;
        ctx.beginPath();
        ctx.moveTo(l.x, l.y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawEnemy(ctx, e) {
    var color = e.color || "pink";
    var cols = {
      pink: "#ff86c2",
      blue: "#74b6ff",
      purple: "#b18cff",
      cyan: "#6fe6f0",
      green: "#6fe0a8",
      red: "#ff8a7a",
      yellow: "#ffd76a",
      white: "#ffffff"
    };
    var main = cols[color] || cols.pink;
    ctx.save();
    ctx.translate(e.x, e.y);
    // 翅膀
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = "#e8f2ff";
    ctx.beginPath();
    ctx.ellipse(-12, -2, 9, 5, -0.5, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(12, -2, 9, 5, 0.5, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    // 身体
    ctx.fillStyle = e.flash > 0 ? "#ffffff" : main;
    ctx.beginPath();
    ctx.arc(0, 0, e.kind === "heavy" ? 15 : 11, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.35)";
    ctx.beginPath();
    ctx.arc(-3, -3, 3.4, 0, TAU);
    ctx.fill();
    // 眼睛
    ctx.fillStyle = "#201425";
    ctx.beginPath();
    ctx.arc(-4, 1, 1.6, 0, TAU);
    ctx.arc(4, 1, 1.6, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawBoss(ctx, b) {
    var t = b.t;
    var r = b.data.radius;
    ctx.save();
    ctx.translate(b.x, b.y);
    // 光环
    ctx.globalAlpha = 0.35 + Math.sin(t * 2) * 0.08;
    var halo = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 2.2);
    halo.addColorStop(0, "rgba(255,180,220,.55)");
    halo.addColorStop(1, "rgba(255,180,220,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, r * 2.2, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    // 身体
    ctx.fillStyle = b.flash > 0 ? "#ffffff" : "#f3e2ff";
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#c9a6ff";
    ctx.beginPath();
    ctx.arc(0, r * 0.32, r * 0.72, 0, Math.PI);
    ctx.fill();
    // 眼睛
    ctx.fillStyle = "#24152c";
    ctx.beginPath();
    ctx.arc(-r * 0.34, -r * 0.1, 3.1, 0, TAU);
    ctx.arc(r * 0.34, -r * 0.1, 3.1, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.7)";
    ctx.beginPath();
    ctx.arc(-r * 0.34 + 1, -r * 0.1 - 1, 1.1, 0, TAU);
    ctx.arc(r * 0.34 + 1, -r * 0.1 - 1, 1.1, 0, TAU);
    ctx.fill();
    // 飘带
    ctx.strokeStyle = "rgba(255,190,235,.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r * 0.8, r * 0.7);
    ctx.quadraticCurveTo(-r * 1.8, r * 1.4 + Math.sin(t * 2) * 8, -r * 1.1, r * 2.1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(r * 0.8, r * 0.7);
    ctx.quadraticCurveTo(r * 1.8, r * 1.4 - Math.sin(t * 2) * 8, r * 1.1, r * 2.1);
    ctx.stroke();
    ctx.restore();
  }

  function drawPlayer(ctx) {
    var p = G.player;
    var t = G.time;
    var char = CHARS[G.char];
    ctx.save();
    ctx.translate(p.x, p.y);

    if (G.border > 0) {
      ctx.save();
      ctx.globalAlpha = 0.4 + Math.sin(t * 8) * 0.12;
      ctx.strokeStyle = "#ffd3e9";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 2, 30, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = "#ffc2e2";
      ctx.beginPath();
      ctx.arc(0, 2, 30, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    var blink = p.invuln > 0 && Math.floor(t * 18) % 2 === 0;
    ctx.globalAlpha = blink ? 0.4 : 1;
    // 飞行轨迹
    ctx.globalAlpha *= 0.9;
    ctx.strokeStyle = "rgba(255,255,255,.25)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-5, 12);
    ctx.lineTo(-8, 24 + Math.sin(t * 10) * 3);
    ctx.moveTo(5, 12);
    ctx.lineTo(8, 24 - Math.sin(t * 10) * 3);
    ctx.stroke();
    ctx.globalAlpha = blink ? 0.4 : 1;

    // 身体 / 裙
    ctx.fillStyle = char.color;
    ctx.beginPath();
    ctx.moveTo(-9, 4);
    ctx.quadraticCurveTo(0, 16, 9, 4);
    ctx.lineTo(7, -8);
    ctx.lineTo(-7, -8);
    ctx.closePath();
    ctx.fill();
    // 白色上衣
    ctx.fillStyle = G.char === 1 ? "#2a2530" : "#fff7fb";
    ctx.beginPath();
    ctx.ellipse(0, -7, 6.5, 7, 0, 0, TAU);
    ctx.fill();
    // 头
    ctx.fillStyle = "#ffe9d8";
    ctx.beginPath();
    ctx.arc(0, -18, 6.6, 0, TAU);
    ctx.fill();
    // 头发
    ctx.fillStyle = G.char === 1 ? "#f5d06a" : G.char === 2 ? "#d8deef" : "#241a2c";
    ctx.beginPath();
    ctx.arc(0, -20, 7.2, Math.PI * 0.9, Math.PI * 2.1);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-6.4, -17, 2.2, 6, 0.3, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(6.4, -17, 2.2, 6, -0.3, 0, TAU);
    ctx.fill();
    // 发饰 / 帽子
    if (G.char === 0) {
      ctx.fillStyle = "#ff3b6b";
      ctx.beginPath();
      ctx.ellipse(0, -25.4, 5.2, 2.6, 0, 0, TAU);
      ctx.fill();
    } else if (G.char === 1) {
      ctx.fillStyle = "#2a2530";
      ctx.beginPath();
      ctx.ellipse(0, -25, 10, 3, 0, 0, TAU);
      ctx.fill();
      ctx.fillRect(-5.4, -32, 10.8, 8);
    } else {
      ctx.fillStyle = "#f2f6ff";
      ctx.beginPath();
      ctx.ellipse(0, -25.4, 7, 2.4, 0, 0, TAU);
      ctx.fill();
    }
    // 判定点 / 低速
    if (p.slow || p.touchSlow || keys["slow"] || G.border > 0) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "rgba(255,255,255,.85)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 2, 7.4, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = "#ff3355";
      ctx.beginPath();
      ctx.arc(0, 2, 3.2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.95)";
      ctx.beginPath();
      ctx.arc(0, 2, 1.3, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawShots(ctx) {
    var img = SP.shots && SP.shots[G.char];
    if (!img) return;
    for (var i = 0; i < G.shots.length; i++) {
      var s = G.shots[i];
      ctx.drawImage(img, s.x - 10, s.y - 10);
    }
  }

  function drawParticles(ctx) {
    for (var i = 0; i < G.particles.length; i++) {
      var p = G.particles[i];
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    for (var j = 0; j < G.pops.length; j++) {
      var pop = G.pops[j];
      ctx.globalAlpha = clamp(pop.life / 0.9, 0, 1);
      ctx.font = "13px " + F_SANS;
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff3c0";
      ctx.fillText(pop.text, pop.x, pop.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawHUD(ctx) {
    var p = G.player;
    // 顶栏
    ctx.fillStyle = "rgba(8,4,16,.62)";
    ctx.fillRect(0, 0, LW, 58);
    ctx.strokeStyle = "rgba(255,180,220,.25)";
    ctx.beginPath();
    ctx.moveTo(0, 58);
    ctx.lineTo(LW, 58);
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.fillStyle = "#ffe9f4";
    ctx.font = "600 12px " + F_SANS;
    ctx.fillText("SCORE", 14, 18);
    ctx.font = "700 20px " + F_MONO;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(comma(G.score), 14, 40);

    ctx.font = "11px " + F_SANS;
    ctx.fillStyle = "rgba(255,226,240,.6)";
    ctx.fillText(
      "BEST " + comma(Math.max(Number(G.save && G.save.best) || 0, G.score)),
      108,
      39
    );

    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255,236,246,.82)";
    ctx.font = "600 12px " + F_SANS;
    ctx.fillText(G.stage.name + " · " + G.diff.name + " · " + CHARS[G.char].short, LW - 14, 20);
    ctx.fillStyle = "rgba(255,220,235,.55)";
    ctx.font = "11px " + F_MONO;
    ctx.fillText("GRAZE " + G.graze + "   CHERRY " + Math.floor(G.cherry), LW - 14, 39);

    // 残机 / Bomb
    ctx.textAlign = "left";
    var y = LH - 22;
    ctx.font = "12px " + F_SANS;
    ctx.fillStyle = "rgba(255,235,245,.9)";
    for (var i = 0; i < Math.max(0, G.lives); i++) {
      drawHeart(ctx, 16 + i * 16, y, 5.2);
    }
    for (var j = 0; j < G.bombs; j++) {
      drawStar(ctx, 16 + j * 16, y - 20, 4.6, "#ffe08a");
    }

    // 樱点条
    var bx = LW - 150;
    var by = LH - 26;
    ctx.fillStyle = "rgba(255,255,255,.16)";
    ctx.fillRect(bx, by, 132, 6);
    var ratio = clamp(G.cherry / MAX_CHERRY, 0, 1);
    ctx.fillStyle = G.cherry >= MAX_CHERRY ? "#fff1b8" : "#ff8fc8";
    ctx.fillRect(bx, by, 132 * ratio, 6);
    ctx.font = "10px " + F_SANS;
    ctx.textAlign = "right";
    ctx.fillStyle =
      G.cherry >= MAX_CHERRY ? "#fff1b8" : "rgba(255,230,242,.65)";
    ctx.fillText(
      G.cherry >= MAX_CHERRY ? "C · 森罗结界就绪" : "樱点 " + Math.floor(G.cherry) + " / " + MAX_CHERRY,
      LW - 18,
      by - 5
    );
    if (G.border > 0) {
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffe9b8";
      ctx.font = "600 13px " + F_SANS;
      ctx.fillText("森罗结界  " + G.border.toFixed(1) + "s", LW / 2, LH - 62);
    }

    // BOSS 血条
    if (G.boss) {
      drawBossBar(ctx, G.boss);
    }

    // 符卡 / 面名 banner
    if (G.banner) {
      var a = clamp(G.banner.t > 2.2 ? (3.2 - G.banner.t) * 3 : G.banner.t * 2, 0, 1);
      ctx.globalAlpha = a;
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff5fb";
      ctx.font = "600 22px " + F_SERIF;
      ctx.fillText(G.banner.text, LW / 2, 240);
      if (G.banner.sub) {
        ctx.font = "13px " + F_SANS;
        ctx.fillStyle = "rgba(255,226,240,.9)";
        ctx.fillText(G.banner.sub, LW / 2, 264);
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawHeart(ctx, x, y, r) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, r * 0.9);
    ctx.bezierCurveTo(-r * 1.6, -r * 0.2, -r * 0.6, -r * 1.2, 0, -r * 0.45);
    ctx.bezierCurveTo(r * 0.6, -r * 1.2, r * 1.6, -r * 0.2, 0, r * 0.9);
    ctx.fillStyle = "#ff6f9c";
    ctx.fill();
    ctx.restore();
  }

  function drawStar(ctx, x, y, r, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var ang = -Math.PI / 2 + (i * Math.PI) / 5;
      var rr = i % 2 ? r * 0.44 : r;
      if (i === 0) ctx.moveTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
      else ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  function drawBossBar(ctx, b) {
    var n = b.data.spells.length;
    var x = 74;
    var w = LW - 148;
    var y = 46;
    var segW = (w - (n - 1) * 5) / n;
    for (var i = 0; i < n; i++) {
      var sx = x + i * (segW + 5);
      ctx.fillStyle = "rgba(255,255,255,.14)";
      ctx.fillRect(sx, y, segW, 5);
      if (i < b.spellIndex) {
        ctx.fillStyle = "rgba(255,255,255,.24)";
        ctx.fillRect(sx, y, segW, 5);
      } else if (i === b.spellIndex) {
        var ratio = clamp(b.hp / b.maxHp, 0, 1);
        ctx.fillStyle = "#ff6fb0";
        ctx.fillRect(sx, y, segW * ratio, 5);
      }
    }
    ctx.textAlign = "center";
    ctx.font = "11px " + F_SANS;
    ctx.fillStyle = "rgba(255,226,240,.8)";
    ctx.fillText(b.data.title, LW / 2, y - 6);
  }

  function drawGameOverlay(ctx) {
    if (G.paused) {
      ctx.fillStyle = "rgba(8,4,16,.68)";
      ctx.fillRect(0, 0, LW, LH);
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff3fa";
      ctx.font = "600 28px " + F_SERIF;
      ctx.fillText("暂停", LW / 2, 300);
      ctx.font = "13px " + F_SANS;
      ctx.fillStyle = "rgba(255,226,240,.8)";
      ctx.fillText("P / ⏸ 继续   ·   R 重开   ·   Esc 返回大厅", LW / 2, 332);
    } else if (G.mode === "over" || G.mode === "clear") {
      ctx.fillStyle = "rgba(8,4,16,.72)";
      ctx.fillRect(0, 0, LW, LH);
      ctx.textAlign = "center";
      ctx.fillStyle = G.mode === "clear" ? "#ffe9b8" : "#fff3fa";
      ctx.font = "600 30px " + F_SERIF;
      ctx.fillText(G.mode === "clear" ? "恭喜通关" : "游戏结束", LW / 2, 190);
      ctx.font = "13px " + F_SANS;
      ctx.fillStyle = "rgba(255,226,240,.78)";
      ctx.fillText(
        "到达 " + G.stage.name + " · " + G.diff.name + " · " + CHARS[G.char].short,
        LW / 2,
        220
      );
      ctx.font = "700 34px " + F_MONO;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(comma(G.score), LW / 2, 278);
      ctx.font = "12px " + F_SANS;
      ctx.fillStyle = "rgba(255,226,240,.7)";
      ctx.fillText(
        "最高分 " + comma(Math.max(Number(G.save && G.save.best) || 0, G.score)),
        LW / 2,
        302
      );
      ctx.fillText("擦弹 " + G.graze + " · 面 " + (G.stageIndex + 1), LW / 2, 324);
      if (G.newBest) {
        ctx.fillStyle = "#fff1b8";
        ctx.font = "600 15px " + F_SANS;
        ctx.fillText("★ 新纪录 ★", LW / 2, 356);
      }

      // 按钮
      var bw = 150;
      var bh = 42;
      var b1 = { x: LW / 2 - bw - 8, y: 400, w: bw, h: bh };
      var b2 = { x: LW / 2 + 8, y: 400, w: bw, h: bh };
      drawButton(ctx, b1, "再来一局", true);
      drawButton(ctx, b2, "返回菜单", false);
      M.resultRects = [
        { x: b1.x, y: b1.y, w: b1.w, h: b1.h, act: "again" },
        { x: b2.x, y: b2.y, w: b2.w, h: b2.h, act: "menu" }
      ];
      ctx.font = "11px " + F_SANS;
      ctx.fillStyle = "rgba(255,226,240,.55)";
      ctx.fillText("Z 再来一局 · X 返回菜单", LW / 2, 472);
    }
  }

  function drawButton(ctx, r, label, primary) {
    ctx.save();
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(r.x, r.y, r.w, r.h, 12);
    } else {
      ctx.rect(r.x, r.y, r.w, r.h);
    }
    ctx.fillStyle = primary ? "rgba(255,110,177,.92)" : "rgba(255,255,255,.12)";
    ctx.fill();
    ctx.strokeStyle = primary ? "#ffd3e9" : "rgba(255,255,255,.3)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillStyle = primary ? "#1d0812" : "#fff3fa";
    ctx.font = "600 15px " + F_SANS;
    ctx.fillText(label, r.x + r.w / 2, r.y + 27);
    ctx.restore();
  }

  function drawMenu(ctx) {
    ensureMenuPetals();
    ctx.drawImage(menuBg, 0, 0);
    for (var i = 0; i < menuPetals.length; i++) {
      var p = menuPetals[i];
      ctx.save();
      ctx.globalAlpha = p.a;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(p.s, p.s);
      ctx.drawImage(SP.petal, -10, -10);
      ctx.restore();
    }

    if (WIDE) {
      drawMenuWideBody(ctx);
      return;
    }

    // 标题
    ctx.textAlign = "center";
    ctx.save();
    ctx.shadowColor = "rgba(255,110,177,.75)";
    ctx.shadowBlur = 26;
    ctx.fillStyle = "#fff6fb";
    ctx.font = "700 46px " + F_SERIF;
    ctx.fillText("東方妖々夢", LW / 2, 96);
    ctx.restore();
    ctx.fillStyle = "#ffc2e2";
    ctx.font = "italic 14px " + F_SERIF;
    ctx.fillText("～ Perfect Cherry Blossom · WEB EDITION ～", LW / 2, 122);
    ctx.fillStyle = "rgba(255,226,240,.62)";
    ctx.font = "11px " + F_SANS;
    ctx.fillText("程序生成美术与音效 · 玩法致敬原版 · 非原版运行", LW / 2, 144);

    // 机体
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,236,246,.6)";
    ctx.font = "600 12px " + F_SANS;
    ctx.fillText("机体", 42, 190);
    var cw = 126;
    var gap = 12;
    var startX = LW / 2 - (cw * 3 + gap * 2) / 2;
    for (var c = 0; c < 3; c++) {
      var x = startX + c * (cw + gap);
      var y = 200;
      var selected = M.char === c;
      ctx.save();
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, cw, 104, 14);
      else ctx.rect(x, y, cw, 104);
      ctx.fillStyle = selected ? "rgba(255,110,177,.22)" : "rgba(255,255,255,.06)";
      ctx.fill();
      ctx.strokeStyle = selected ? "#ffb3d4" : "rgba(255,255,255,.16)";
      ctx.lineWidth = selected ? 1.8 : 1;
      ctx.stroke();
      ctx.restore();
      // 小人
      drawMenuChar(ctx, x + cw / 2, y + 42, c);
      ctx.textAlign = "center";
      ctx.fillStyle = selected ? "#fff6fb" : "rgba(255,236,246,.78)";
      ctx.font = "600 13px " + F_SANS;
      ctx.fillText(CHARS[c].short, x + cw / 2, y + 74);
      ctx.fillStyle = "rgba(255,226,240,.55)";
      ctx.font = "10px " + F_SANS;
      ctx.fillText(CHARS[c].note, x + cw / 2, y + 91);
      M.rects.push({ x: x, y: y, w: cw, h: 104, act: "char", value: c });
    }

    // 难度
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,236,246,.6)";
    ctx.font = "600 12px " + F_SANS;
    ctx.fillText("难度", 42, 336);
    var dw = 86;
    var dgap = 8;
    var dstart = LW / 2 - (dw * 4 + dgap * 3) / 2;
    for (var d = 0; d < 4; d++) {
      var dx = dstart + d * (dw + dgap);
      var dy = 346;
      var on = M.diff === d;
      ctx.save();
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(dx, dy, dw, 34, 10);
      else ctx.rect(dx, dy, dw, 34);
      ctx.fillStyle = on ? "rgba(255,110,177,.9)" : "rgba(255,255,255,.07)";
      ctx.fill();
      ctx.strokeStyle = on ? "#ffd3e9" : "rgba(255,255,255,.16)";
      ctx.stroke();
      ctx.restore();
      ctx.textAlign = "center";
      ctx.fillStyle = on ? "#1d0812" : "rgba(255,236,246,.8)";
      ctx.font = "600 12px " + F_SANS;
      ctx.fillText(DIFFS[d].name, dx + dw / 2, dy + 16);
      ctx.font = "9px " + F_SANS;
      ctx.fillStyle = on ? "rgba(29,8,18,.7)" : "rgba(255,226,240,.45)";
      ctx.fillText(DIFFS[d].sub, dx + dw / 2, dy + 28);
      M.rects.push({ x: dx, y: dy, w: dw, h: 34, act: "diff", value: d });
    }

    // 开始按钮
    var save = menuSave || {};
    var bw = 208;
    var bx = LW / 2 - bw / 2;
    var by = 414;
    ctx.save();
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, by, bw, 50, 14);
    else ctx.rect(bx, by, bw, 50);
    ctx.fillStyle = "rgba(255,110,177,.94)";
    ctx.fill();
    ctx.strokeStyle = "#ffd3e9";
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
    ctx.textAlign = "center";
    ctx.fillStyle = "#210913";
    ctx.font = "700 17px " + F_SANS;
    ctx.fillText("开始游戏  Z", LW / 2, by + 26);
    ctx.font = "10px " + F_SANS;
    ctx.fillStyle = "rgba(33,9,19,.66)";
    ctx.fillText(DIFFS[M.diff].name + " · " + CHARS[M.char].short, LW / 2, by + 41);
    M.rects.push({ x: bx, y: by, w: bw, h: 50, act: "start" });

    // 最高分 / 记录
    ctx.font = "12px " + F_SANS;
    ctx.fillStyle = "rgba(255,236,246,.72)";
    ctx.textAlign = "center";
    ctx.fillText(
      "最高分 " + comma(Number(save.best) || 0) +
        "   ·   最远 " + (Number(save.bestStage) || 0) + " 面" +
        "   ·   通关 " + (Number(save.clears) || 0) + " 次",
      LW / 2,
      498
    );
    ctx.fillStyle = "rgba(255,226,240,.45)";
    ctx.font = "10.5px " + F_SANS;
    ctx.fillText("存档保存在本地浏览器 · 换设备不会同步", LW / 2, 516);

    // 操作提示
    ctx.font = "11px " + F_SANS;
    ctx.fillStyle = "rgba(255,236,246,.58)";
    ctx.fillText("菜单：←→ 机体 · ↑↓ 难度 · Z 开始", LW / 2, 560);
    ctx.fillText("游戏：方向键移动 · Z 射击 · X 炸弹 · C 结界 · Shift 低速", LW / 2, 578);
    ctx.fillText("P 暂停 · F 全屏 · 手机：拖拽 + 下方按钮 · Esc 返回大厅", LW / 2, 596);

    // 右上角：全屏 / 音效
    var my = 24;
    var fx = LW - 158;
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,.10)";
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(fx, my, 66, 26, 13);
    else ctx.rect(fx, my, 66, 26);
    ctx.fill();
    ctx.fillStyle = "rgba(255,236,246,.72)";
    ctx.font = "11px " + F_SANS;
    ctx.fillText("⛶ 全屏", fx + 33, my + 17);
    M.rects.push({ x: fx, y: my, w: 66, h: 26, act: "full" });

    var mx = LW - 84;
    ctx.fillStyle = muted ? "rgba(255,255,255,.2)" : "rgba(255,110,177,.28)";
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(mx, my, 64, 26, 13);
    else ctx.rect(mx, my, 64, 26);
    ctx.fill();
    ctx.fillStyle = muted ? "rgba(255,236,246,.5)" : "#ffd3e9";
    ctx.font = "11px " + F_SANS;
    ctx.fillText(muted ? "♪ 静音" : "♪ 音效", mx + 32, my + 17);
    M.rects.push({ x: mx, y: my, w: 64, h: 26, act: "mute" });

    // 分类角标
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,255,255,.4)";
    ctx.font = "10px " + F_MONO;
    ctx.fillText("TOUHOU / STG", 24, 40);
  }


  function drawMenuWideBody(ctx) {
    ctx.textAlign = "left";
    ctx.save();
    ctx.shadowColor = "rgba(255,110,177,.75)";
    ctx.shadowBlur = 26;
    ctx.fillStyle = "#fff6fb";
    ctx.font = "700 44px " + F_SERIF;
    ctx.fillText("東方妖々夢", 64, 92);
    ctx.restore();
    ctx.fillStyle = "#ffc2e2";
    ctx.font = "italic 14px " + F_SERIF;
    ctx.fillText("～ Perfect Cherry Blossom · WEB EDITION ～", 66, 120);
    ctx.fillStyle = "rgba(255,226,240,.62)";
    ctx.font = "11px " + F_SANS;
    ctx.fillText("程序生成美术与音效 · 玩法致敬原版 · 非原版运行", 66, 142);

    ctx.fillStyle = "rgba(255,236,246,.6)";
    ctx.font = "600 12px " + F_SANS;
    ctx.fillText("机体", 64, 188);

    var cw = 146;
    var ch = 108;
    var cg = 12;
    for (var c = 0; c < 3; c++) {
      var x = 64 + c * (cw + cg);
      var y = 198;
      var selected = M.char === c;
      ctx.save();
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, cw, ch, 14);
      else ctx.rect(x, y, cw, ch);
      ctx.fillStyle = selected ? "rgba(255,110,177,.22)" : "rgba(255,255,255,.06)";
      ctx.fill();
      ctx.strokeStyle = selected ? "#ffb3d4" : "rgba(255,255,255,.16)";
      ctx.lineWidth = selected ? 1.8 : 1;
      ctx.stroke();
      ctx.restore();
      drawMenuChar(ctx, x + cw / 2, y + 40, c);
      ctx.textAlign = "center";
      ctx.fillStyle = selected ? "#fff6fb" : "rgba(255,236,246,.78)";
      ctx.font = "600 13px " + F_SANS;
      ctx.fillText(CHARS[c].short, x + cw / 2, y + 72);
      ctx.fillStyle = "rgba(255,226,240,.55)";
      ctx.font = "10px " + F_SANS;
      ctx.fillText(CHARS[c].note, x + cw / 2, y + 90);
      M.rects.push({ x: x, y: y, w: cw, h: ch, act: "char", value: c });
    }

    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,236,246,.6)";
    ctx.font = "600 12px " + F_SANS;
    ctx.fillText("难度", 64, 348);
    var dw = 86;
    var dg = 8;
    for (var d = 0; d < 4; d++) {
      var dx = 64 + d * (dw + dg);
      var dy = 358;
      var on = M.diff === d;
      ctx.save();
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(dx, dy, dw, 34, 10);
      else ctx.rect(dx, dy, dw, 34);
      ctx.fillStyle = on ? "rgba(255,110,177,.9)" : "rgba(255,255,255,.07)";
      ctx.fill();
      ctx.strokeStyle = on ? "#ffd3e9" : "rgba(255,255,255,.16)";
      ctx.stroke();
      ctx.restore();
      ctx.textAlign = "center";
      ctx.fillStyle = on ? "#1d0812" : "rgba(255,236,246,.8)";
      ctx.font = "600 12px " + F_SANS;
      ctx.fillText(DIFFS[d].name, dx + dw / 2, dy + 16);
      ctx.font = "9px " + F_SANS;
      ctx.fillStyle = on ? "rgba(29,8,18,.7)" : "rgba(255,226,240,.45)";
      ctx.fillText(DIFFS[d].sub, dx + dw / 2, dy + 28);
      M.rects.push({ x: dx, y: dy, w: dw, h: 34, act: "diff", value: d });
    }

    var bw = 232;
    var bx = 64;
    var by = 416;
    ctx.save();
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, by, bw, 50, 14);
    else ctx.rect(bx, by, bw, 50);
    ctx.fillStyle = "rgba(255,110,177,.94)";
    ctx.fill();
    ctx.strokeStyle = "#ffd3e9";
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
    ctx.textAlign = "center";
    ctx.fillStyle = "#210913";
    ctx.font = "700 17px " + F_SANS;
    ctx.fillText("开始游戏  Z", bx + bw / 2, by + 26);
    ctx.font = "10px " + F_SANS;
    ctx.fillStyle = "rgba(33,9,19,.66)";
    ctx.fillText(DIFFS[M.diff].name + " · " + CHARS[M.char].short, bx + bw / 2, by + 41);
    M.rects.push({ x: bx, y: by, w: bw, h: 50, act: "start" });

    var save = menuSave || {};
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,236,246,.72)";
    ctx.font = "12px " + F_SANS;
    ctx.fillText("最高分 " + comma(Number(save.best) || 0), 64, 500);
    ctx.fillStyle = "rgba(255,226,240,.45)";
    ctx.font = "10.5px " + F_SANS;
    ctx.fillText(
      "最远 " + (Number(save.bestStage) || 0) + " 面 · 通关 " + (Number(save.clears) || 0) + " 次",
      64,
      518
    );

    var rx = LW - 360;
    ctx.fillStyle = "rgba(255,236,246,.72)";
    ctx.font = "600 13px " + F_SANS;
    ctx.fillText("操作", rx, 210);
    ctx.font = "11.5px " + F_SANS;
    ctx.fillStyle = "rgba(255,236,246,.55)";
    var tips = [
      "鼠标移动 — 自机跟手",
      "左键按住 — 射击",
      "右键 — 炸弹",
      "滚轮 — 森罗结界",
      "方向键 / WASD — 移动",
      "Z / X / C — 射击 / 炸弹 / 结界",
      "Shift — 低速 · P — 暂停",
      "F — 全屏 · Esc — 返回大厅"
    ];
    for (var i = 0; i < tips.length; i++) {
      ctx.fillText(tips[i], rx, 240 + i * 24);
    }

    var my = 24;
    var fx = LW - 158;
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,.1)";
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(fx, my, 66, 26, 13);
    else ctx.rect(fx, my, 66, 26);
    ctx.fill();
    ctx.fillStyle = "rgba(255,236,246,.72)";
    ctx.font = "11px " + F_SANS;
    ctx.fillText("⛶ 全屏", fx + 33, my + 17);
    M.rects.push({ x: fx, y: my, w: 66, h: 26, act: "full" });

    var mx = LW - 84;
    ctx.fillStyle = muted ? "rgba(255,255,255,.2)" : "rgba(255,110,177,.28)";
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(mx, my, 64, 26, 13);
    else ctx.rect(mx, my, 64, 26);
    ctx.fill();
    ctx.fillStyle = muted ? "rgba(255,236,246,.5)" : "#ffd3e9";
    ctx.font = "11px " + F_SANS;
    ctx.fillText(muted ? "♪ 静音" : "♪ 音效", mx + 32, my + 17);
    M.rects.push({ x: mx, y: my, w: 64, h: 26, act: "mute" });

    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,255,255,.4)";
    ctx.font = "10px " + F_MONO;
    ctx.fillText("TOUHOU / STG · 16:9", 64, 32);
  }

  function drawMenuChar(ctx, x, y, index) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1.5, 1.5);
    var char = CHARS[index];
    // 裙
    ctx.fillStyle = char.color;
    ctx.beginPath();
    ctx.moveTo(-8, 2);
    ctx.quadraticCurveTo(0, 12, 8, 2);
    ctx.lineTo(6, -6);
    ctx.lineTo(-6, -6);
    ctx.closePath();
    ctx.fill();
    // 身
    ctx.fillStyle = index === 1 ? "#2a2530" : "#fff7fb";
    ctx.beginPath();
    ctx.ellipse(0, -7, 5.6, 6, 0, 0, TAU);
    ctx.fill();
    // 头
    ctx.fillStyle = "#ffe9d8";
    ctx.beginPath();
    ctx.arc(0, -16, 5.6, 0, TAU);
    ctx.fill();
    // 发
    ctx.fillStyle = index === 1 ? "#f5d06a" : index === 2 ? "#d8deef" : "#241a2c";
    ctx.beginPath();
    ctx.arc(0, -18, 6.2, Math.PI * 0.9, Math.PI * 2.1);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-5.4, -15, 1.9, 5, 0.3, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(5.4, -15, 1.9, 5, -0.3, 0, TAU);
    ctx.fill();
    if (index === 1) {
      ctx.fillStyle = "#2a2530";
      ctx.beginPath();
      ctx.ellipse(0, -23, 8.4, 2.6, 0, 0, TAU);
      ctx.fill();
    }
    if (index === 0) {
      ctx.fillStyle = "#ff3b6b";
      ctx.beginPath();
      ctx.ellipse(0, -22.5, 4.4, 2.2, 0, 0, TAU);
      ctx.fill();
    }
    if (index === 2) {
      ctx.fillStyle = "#f2f6ff";
      ctx.beginPath();
      ctx.ellipse(0, -22.5, 6, 2, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  var menuPetalsInited = false;
  function ensureMenuPetals() {
    if (menuPetalsInited) return;
    menuPetalsInited = true;
    menuPetals = makePetals();
  }

  function updateMenuPetals(dt) {
    ensureMenuPetals();
    for (var i = 0; i < menuPetals.length; i++) {
      var p = menuPetals[i];
      p.x += (p.vx + Math.sin(time * 0.7 + i) * 8) * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      if (p.y > LH + 20) {
        p.y = -20;
        p.x = rnd(-20, LW + 20);
      }
      if (p.x < -30) p.x = LW + 20;
      if (p.x > LW + 30) p.x = -20;
    }
  }

  /* ============================================================
   * 输入
   * ============================================================ */
  function keyToAction(key) {
    if (key === "ArrowUp" || key === "w" || key === "W") return "up";
    if (key === "ArrowDown" || key === "s" || key === "S") return "down";
    if (key === "ArrowLeft" || key === "a" || key === "A") return "left";
    if (key === "ArrowRight" || key === "d" || key === "D") return "right";
    if (key === "Shift") return "slow";
    return null;
  }

  function onKeyDown(e) {
    ensureAudio();
    var action = keyToAction(e.key);
    if (action) {
      keys[action] = true;
      e.preventDefault();
    }

    /* 菜单：←→ 选机体，↑↓ 选难度；游戏中方向键只移动自机 */
    if (!G) {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        M.char = (M.char + 2) % 3;
        sfx("select");
        return;
      }
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        M.char = (M.char + 1) % 3;
        sfx("select");
        return;
      }
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
        M.diff = (M.diff + 3) % 4;
        sfx("select");
        return;
      }
      if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
        M.diff = (M.diff + 1) % 4;
        sfx("select");
        return;
      }
    }

    if (e.key === "z" || e.key === "Z" || e.key === "Enter") {
      if (!G) {
        beginRun();
      } else if (G.mode === "over" || G.mode === "clear") {
        beginRun();
      }
      keys["shoot"] = true;
      e.preventDefault();
    } else if (e.key === "x" || e.key === "X") {
      if (G && G.mode === "play") {
        useBomb();
      } else if (G && (G.mode === "over" || G.mode === "clear")) {
        backToMenu();
      }
      e.preventDefault();
    } else if (e.key === "c" || e.key === "C") {
      if (G && G.mode === "play") useBorder();
      e.preventDefault();
    } else if (e.key === "p" || e.key === "P") {
      if (G && G.mode === "play") {
        G.paused = !G.paused;
        sfx("pause");
      }
      e.preventDefault();
    } else if (e.key === "m" || e.key === "M") {
      toggleMute();
      e.preventDefault();
    } else if (e.key === "f" || e.key === "F") {
      requestFullscreen();
      e.preventDefault();
    } else if (e.key === "r" || e.key === "R") {
      if (G) beginRun();
      e.preventDefault();
    }
  }

  function onKeyUp(e) {
    var action = keyToAction(e.key);
    if (action) keys[action] = false;
    if (e.key === "z" || e.key === "Z") keys["shoot"] = false;
  }

  function toggleMute() {
    muted = !muted;
    var save = loadSave();
    save.muted = muted;
    writeSave(save);
    menuSave = save;
    sfx("select");
  }

  function fallbackParentFullscreen() {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "arcade:fullscreen" }, "*");
      }
    } catch (e) {
      /* 忽略 */
    }
  }

  function requestFullscreen() {
    ensureAudio();
    try {
      if (document.fullscreenElement) {
        var exit = document.exitFullscreen();
        if (exit && exit.catch) exit.catch(function () {});
        return;
      }
      var el = document.documentElement;
      if (el && el.requestFullscreen) {
        var p = el.requestFullscreen();
        if (p && p.catch) p.catch(fallbackParentFullscreen);
        return;
      }
    } catch (e) {
      /* 回退给父页面 */
    }
    fallbackParentFullscreen();
  }

  function toLocal(cvs, ev) {
    var r = cvs.getBoundingClientRect();
    return {
      x: ((ev.clientX - r.left) / r.width) * LW,
      y: ((ev.clientY - r.top) / r.height) * LH
    };
  }

  function onPointerDown(e) {
    ensureAudio();
    var pt = toLocal(cvs, e);
    if (!G) {
      for (var i = 0; i < M.rects.length; i++) {
        var r = M.rects[i];
        if (pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h) {
          if (r.act === "char") {
            M.char = r.value;
            sfx("select");
          } else if (r.act === "diff") {
            M.diff = r.value;
            sfx("select");
          } else if (r.act === "start") {
            beginRun();
          } else if (r.act === "mute") {
            toggleMute();
          } else if (r.act === "full") {
            requestFullscreen();
          }
          return;
        }
      }
      return;
    }

    if (G.mode === "over" || G.mode === "clear") {
      var rects = M.resultRects || [];
      for (var j = 0; j < rects.length; j++) {
        var rr = rects[j];
        if (pt.x >= rr.x && pt.x <= rr.x + rr.w && pt.y >= rr.y && pt.y <= rr.y + rr.h) {
          if (rr.act === "again") beginRun();
          else backToMenu();
          return;
        }
      }
      return;
    }

    if (G.mode === "play" && !G.paused) {
      if (e.pointerType === "mouse") {
        if (e.button === 0) {
          G.mouseShoot = true;
          keys["shoot"] = true;
        } else if (e.button === 2) {
          useBomb();
        }
        return;
      }
      G.player.drag = {
        x: e.clientX,
        y: e.clientY,
        px: G.player.x,
        py: G.player.y
      };
      G.touchShoot = true;
      try {
        cvs.setPointerCapture(e.pointerId);
      } catch (err) {
        /* 忽略 */
      }
    }
  }

  function onPointerMove(e) {
    if (!G || G.mode !== "play" || G.paused) return;
    if (e.pointerType === "mouse") {
      var pt = toLocal(cvs, e);
      G.player.x = clamp(pt.x, 14, LW - 14);
      G.player.y = clamp(pt.y, 92, LH - 34);
      return;
    }
    if (!G.player.drag) return;
    var r = cvs.getBoundingClientRect();
    var dx = ((e.clientX - G.player.drag.x) / r.width) * LW;
    var dy = ((e.clientY - G.player.drag.y) / r.height) * LH;
    G.player.x = clamp(G.player.drag.px + dx, 14, LW - 14);
    G.player.y = clamp(G.player.drag.py + dy, 92, LH - 34);
  }

  function onPointerUp(e) {
    if (!G) return;
    if (e.pointerType === "mouse") {
      G.mouseShoot = false;
      keys["shoot"] = false;
      return;
    }
    G.player.drag = null;
  }

  /* ============================================================
   * 挂载
   * ============================================================ */
  function mount(stageEl, api) {
    apiRef = api;
    isTouch =
      "ontouchstart" in window ||
      (navigator.maxTouchPoints || 0) > 0 ||
      (window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
    WIDE = !isTouch && window.innerWidth >= 900;
    LW = WIDE ? 960 : 480;
    LH = WIDE ? 540 : 640;
    buildSprites();
    ensureAudio();
    menuBg = makeBackground(STAGES[0]);

    var save = loadSave();
    menuSave = save;
    muted = !!save.muted;
    M.char = clamp(Number(save.lastChar) || 0, 0, 2);
    M.diff = clamp(Number(save.lastDiff) || 1, 0, 3);

    var wrap = ce("div", "canvas-wrap");
    cvs = ce("canvas");
    wrap.appendChild(cvs);
    stageEl.appendChild(wrap);

    var ctx = cvs.getContext("2d");

    var pad = ce("div", "pad touhou-pad");
    var btnBomb = ce("button", "pad-btn", "炸弹");
    var btnBorder = ce("button", "pad-btn", "结界");
    var btnSlow = ce("button", "pad-btn", "低速");
    btnBomb.title = "炸弹 X";
    btnBorder.title = "森罗结界 C";
    btnSlow.title = "低速 Shift";
    pad.appendChild(btnBomb);
    pad.appendChild(btnBorder);
    pad.appendChild(btnSlow);
    stageEl.appendChild(pad);

    function bindHold(btn, onDown, onUp) {
      btn.addEventListener("pointerdown", function (e) {
        e.preventDefault();
        ensureAudio();
        btn.classList.add("is-down");
        onDown();
      });
      var up = function () {
        btn.classList.remove("is-down");
        if (onUp) onUp();
      };
      btn.addEventListener("pointerup", up);
      btn.addEventListener("pointerleave", up);
      btn.addEventListener("pointercancel", up);
    }

    bindHold(btnBomb, function () {
      ensureAudio();
      if (G && G.mode === "play") useBomb();
    });
    bindHold(btnBorder, function () {
      ensureAudio();
      if (G && G.mode === "play") useBorder();
    });
    bindHold(
      btnSlow,
      function () {
        if (G) G.player.touchSlow = true;
      },
      function () {
        if (G) G.player.touchSlow = false;
      }
    );

  function resizeCanvas() {
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    cvs.width = Math.round(LW * dpr);
    cvs.height = Math.round(LH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var aw = wrap.clientWidth;
    var ah = wrap.clientHeight;
    if (!aw || !ah) return;
    var s = Math.min(aw / LW, ah / LH);
    cvs.style.width = Math.floor(LW * s) + "px";
    cvs.style.height = Math.floor(LH * s) + "px";
  }
    api.on(window, "resize", resizeCanvas);
    requestAnimationFrame(resizeCanvas);

    api.on(window, "keydown", onKeyDown);
    api.on(window, "keyup", onKeyUp);
    api.on(cvs, "pointerdown", onPointerDown);
    api.on(cvs, "pointermove", onPointerMove);
    api.on(cvs, "pointerup", onPointerUp);
    api.on(cvs, "contextmenu", function (e) {
      e.preventDefault();
    });
    api.on(cvs, "wheel", function (e) {
      e.preventDefault();
      if (G && G.mode === "play" && !G.paused) useBorder();
    }, { passive: false });
    api.on(cvs, "pointerleave", function () {
      if (!G) return;
      G.mouseShoot = false;
      keys["shoot"] = false;
      G.player.drag = null;
    });
    api.on(cvs, "pointercancel", onPointerUp);
    api.on(window, "blur", function () {
      keys = {};
      if (G) G.player.drag = null;
    });
    api.onPause(function () {
      if (G && G.mode === "play") {
        G.paused = !G.paused;
        sfx("pause");
      }
    });
    api.onRestart(function () {
      if (G) beginRun();
    });

    var last = performance.now();
    api.loop(function () {
      var nowT = performance.now();
      var dt = Math.min((nowT - last) / 1000, 0.05);
      last = nowT;
      time += dt;

      if (!G) {
        updateMenuPetals(dt);
        M.rects = [];
        drawMenu(ctx);
      } else {
        if (G.mode === "play" && !G.paused) {
          updateGame(dt);
        } else if (G.mode === "stageclear") {
          updateStageClear(dt);
        } else if (G.paused) {
          updatePetals(dt);
        }

        // 背景
        if (G.bg) ctx.drawImage(G.bg, 0, 0);
        else ctx.fillStyle = "#0b0818";
        if (G.bg) {
          /* 花瓣单独绘制，保持飘动 */
          for (var i = 0; i < G.petals.length; i++) {
            var p = G.petals[i];
            ctx.save();
            ctx.globalAlpha = p.a;
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.scale(p.s, p.s);
            ctx.drawImage(SP.petal, -10, -10);
            ctx.restore();
          }
        }

        var shakeX = 0;
        var shakeY = 0;
        if (G.shake > 0) {
          shakeX = rnd(-G.shake, G.shake) * 0.5;
          shakeY = rnd(-G.shake, G.shake) * 0.5;
        }
        ctx.save();
        ctx.translate(shakeX, shakeY);
        drawLasers(ctx);
        for (var j = 0; j < G.bullets.length; j++) drawBullet(ctx, G.bullets[j]);
        for (var k = 0; k < G.enemies.length; k++) drawEnemy(ctx, G.enemies[k]);
        if (G.boss) drawBoss(ctx, G.boss);
        drawShots(ctx);
        drawPlayer(ctx);
        drawParticles(ctx);
        ctx.restore();

        if (G.flash > 0) {
          ctx.fillStyle = "rgba(255,220,240," + G.flash * 0.35 + ")";
          ctx.fillRect(0, 0, LW, LH);
        }

        drawHUD(ctx);
        drawGameOverlay(ctx);
      }
    });

    window.__TOUHOU__ = {
      state: function () {
        if (!G) {
          return {
            mode: "menu",
            char: M.char,
            diff: M.diff,
            best: Number(loadSave().best) || 0
          };
        }
        return {
          mode: G.mode,
          paused: G.paused,
          score: G.score,
          lives: G.lives,
          bombs: G.bombs,
          cherry: G.cherry,
          border: G.border,
          graze: G.graze,
          stage: G.stageIndex + 1,
          stageTime: Math.round(G.stageTime * 10) / 10,
          bullets: G.bullets.length,
          shots: G.shots.length,
          enemies: G.enemies.length,
          viewW: LW,
          viewH: LH,
          boss: G.boss ? G.boss.spellIndex : -1,
          bossHp: G.boss ? Math.round(G.boss.hp) : 0,
          player: { x: Math.round(G.player.x), y: Math.round(G.player.y) },
          fps: G.fps
        };
      },
      start: function () {
        beginRun();
      },
      bomb: function () {
        useBomb();
      },
      border: function () {
        useBorder();
      },
      cheat: function (n) {
        if (G) G.score += n;
      },
      cherry: function (n) {
        if (G) G.cherry = clamp(n, 0, MAX_CHERRY);
      },
      boss: function () {
        if (G) startBoss();
      },
      god: function () {
        if (G) G.player.invuln = 9999;
      },
      kill: function () {
        if (G && G.mode === "play") {
          G.lives = 1;
          G.player.invuln = 0;
          hitPlayer();
        }
      }
    };

    return function cleanup() {
      try {
        delete window.__TOUHOU__;
      } catch (e) {
        window.__TOUHOU__ = null;
      }
    };
  }

  /* ============================================================
   * 导出
   * ============================================================ */
  window.TOUHOU_GAME = function () {
    return {
      id: "touhou",
      name: "東方妖々夢 · 网页版",
      icon: "🌸",
      tags: ["东方"],
      mount: mount
    };
  };
})();
