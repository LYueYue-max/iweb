/* ============================================================
 * 站点主逻辑
 *  - 分区路由（#/home、#/nav…）
 *  - 资源管理器式面包屑 + 分区标签
 *  - 分区顺序：默认固定；自定义入口只在设置里，保存后固定
 *  - 电脑 / 手机自动识别
 *  - 导航搜索、滚动显现、提示条
 * ============================================================ */
(function () {
  "use strict";

  var SITE = window.SITE || {};
  var sections = SITE.sections || [];
  var byId = {};
  sections.forEach(function (s) {
    byId[s.id] = s;
  });

  var DEFAULT_ORDER = sections.map(function (s) {
    return s.id;
  });
  var HOME = SITE.home || (DEFAULT_ORDER[0] || "home");
  var STORAGE_KEY = SITE.storageKey || "gx.site.order.v1";

  var root = document.documentElement;
  var $ = function (sel, ctx) {
    return (ctx || document).querySelector(sel);
  };
  var $$ = function (sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  };

  var tabsEl = $("#tabs");
  var drawerList = $("#drawerList");
  var crumbsEl = $("#crumbs");
  var deviceBadge = $("#deviceBadge");
  var envInfo = $("#envInfo");
  var toastEl = $("#toast");
  var scrim = $("#scrim");
  var drawer = $("#drawer");
  var modal = $("#settingsModal");
  var orderList = $("#orderList");

  var views = {};
  $$(".view").forEach(function (v) {
    views[v.dataset.view] = v;
  });

  var order = loadOrder();
  var current = null;
  var trail = loadTrail(); // 面包屑访问记录

  /* ---------------- 分区显示 / 隐藏 ---------------- */
  var HIDDEN_KEY = SITE.hiddenKey || "gx.site.hidden.v1";
  var FIXED_VISIBLE = ["home", "minecraft"];
  var visibilityList = $("#visibilityList");
  var hidden = loadHidden();

  function loadHidden() {
    var saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(HIDDEN_KEY) || "[]");
    } catch (e) {
      saved = null;
    }
    if (!Array.isArray(saved)) return [];
    return saved.filter(function (id) {
      return byId[id] && FIXED_VISIBLE.indexOf(id) === -1;
    });
  }

  function saveHidden() {
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify(hidden));
    } catch (e) {
      /* 忽略 */
    }
  }

  function isHidden(id) {
    return hidden.indexOf(id) !== -1;
  }

  function setHidden(id, on) {
    if (!byId[id] || FIXED_VISIBLE.indexOf(id) !== -1) return;
    var idx = hidden.indexOf(id);
    if (on && idx === -1) hidden.push(id);
    else if (!on && idx !== -1) hidden.splice(idx, 1);
    saveHidden();
    renderTabs();
    renderDrawer();
    renderOrderList();
    renderVisibilityList();
    if (current) renderCrumbs(current);
    toast(on ? "已隐藏「" + byId[id].name + "」" : "已显示「" + byId[id].name + "」");
  }

  function renderVisibilityList() {
    if (!visibilityList) return;
    visibilityList.innerHTML = "";
    DEFAULT_ORDER.forEach(function (id) {
      var s = byId[id];
      if (!s) return;
      var fixed = FIXED_VISIBLE.indexOf(id) !== -1;
      var li = document.createElement("li");
      li.className = "visibility-item";
      li.innerHTML =
        '<span class="visibility-item__name">' +
        escapeHtml(s.name) +
        "</span>" +
        (fixed ? '<span class="visibility-item__fixed">固定</span>' : "") +
        '<label class="vis-switch"><input type="checkbox" data-vis="' +
        id +
        '"' +
        (!fixed && isHidden(id) ? "" : " checked") +
        (fixed ? " disabled" : "") +
        "><span></span></label>";
      visibilityList.appendChild(li);
    });
  }

  /* ---------------- 面包屑历史 ---------------- */
  function loadTrail() {
    try {
      var saved = JSON.parse(sessionStorage.getItem("gx.site.trail.v1") || "null");
      if (Array.isArray(saved)) {
        saved = saved.filter(function (id) {
          return byId[id];
        });
        if (saved.length) return saved;
      }
    } catch (e) {
      /* 忽略隐私模式限制 */
    }
    return [HOME];
  }

  function saveTrail() {
    try {
      sessionStorage.setItem("gx.site.trail.v1", JSON.stringify(trail));
    } catch (e) {
      /* 忽略 */
    }
  }

  function pushTrail(id) {
    var last = trail[trail.length - 1];
    if (last === id) return;
    var idx = trail.indexOf(id);
    if (idx !== -1) {
      trail = trail.slice(0, idx + 1);
    } else {
      trail.push(id);
    }
    if (trail.length > 6) trail = trail.slice(-6);
    saveTrail();
  }

  /* ---------------- 顺序存取 ---------------- */
  function loadOrder() {
    var saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    } catch (e) {
      saved = null;
    }
    if (
      Array.isArray(saved) &&
      saved.length === DEFAULT_ORDER.length &&
      DEFAULT_ORDER.every(function (id) {
        return saved.indexOf(id) !== -1;
      })
    ) {
      return saved.slice();
    }
    return DEFAULT_ORDER.slice();
  }

  function saveOrder(next) {
    order = next.slice();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
    } catch (e) {
      /* 隐私模式下写不进去也不影响本次会话 */
    }
  }

  /* ---------------- 路由 ---------------- */
  function parseHash() {
    var h = location.hash || "";
    if (h.indexOf("#/") !== 0) return null;
    var id = h.slice(2);
    return byId[id] ? id : null;
  }

  function go(id, replace) {
    if (!byId[id]) id = HOME;
    var target = "#/" + id;
    if (location.hash === target) {
      activate(id);
      return;
    }
    if (replace && history.replaceState) {
      history.replaceState(null, "", target);
      activate(id);
    } else {
      location.hash = target;
    }
  }

  function activate(id) {
    if (!byId[id]) id = HOME;

    /* 离开游戏分区时顺手关机：iframe 里的游戏不会在后台空转 */
    if (id !== "game" && arcadeEl && arcadeEl.classList.contains("is-on")) {
      closeArcade(true);
    }

    /* 游戏分区：页面锁定滚动；手机进入沉浸模式 */
    document.body.classList.toggle("arcade-mode", id === "game");
    document.body.classList.toggle("nav-mode", id === "nav");
    if (id === "game") {
      document.body.classList.toggle("arcade-immersive", !!(mqMobile && mqMobile.matches));
    } else {
      document.body.classList.remove("arcade-immersive");
    }

    /* 食谱应用按需加载：第一次进入食谱分区才请求，之后切换不重载 */
    if (id === "recipe") loadRecipeFrame();

    var changed = id !== current;
    current = id;

    Object.keys(views).forEach(function (key) {
      views[key].classList.toggle("is-active", key === id);
    });

    $$(".tab").forEach(function (tab) {
      tab.classList.toggle("is-active", tab.dataset.goto === id);
      tab.setAttribute("aria-selected", tab.dataset.goto === id ? "true" : "false");
    });
    $$(".drawer__item").forEach(function (item) {
      item.classList.toggle("is-active", item.dataset.goto === id);
    });

    pushTrail(id);
    renderCrumbs(id);
    document.title = "共创工作室 · " + (byId[id] ? byId[id].name : "");
    bindReveal(views[id]);
    if (changed) {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }

  /* 食谱 iframe：第一次进入分区时才真正加载 */
  function loadRecipeFrame(reload) {
    var frame = $("#recipeFrame");
    if (!frame) return;
    var src = frame.getAttribute("data-src");
    if (!src) return;
    if (reload || !frame.getAttribute("src")) {
      var loading = $("#recipeLoading");
      if (loading) loading.classList.remove("is-ready");
      frame.src = src;
    }
  }

  function bindRecipeFrame() {
    var frame = $("#recipeFrame");
    var loading = $("#recipeLoading");
    if (!frame || !loading) return;
    frame.addEventListener("load", function () {
      loading.classList.add("is-ready");
    });
  }

  /* ---------------- 顶栏渲染 ---------------- */
  function renderTabs() {
    tabsEl.innerHTML = "";
    var shown = 0;
    order.forEach(function (id) {
      var s = byId[id];
      if (!s || isHidden(id)) return;
      shown++;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tab";
      btn.dataset.goto = id;
      btn.setAttribute("role", "tab");
      btn.style.setProperty("--tab-accent", s.accent);
      btn.innerHTML =
        '<span class="tab__dot"></span><span>' + escapeHtml(s.name) + "</span>";
      btn.addEventListener("click", function () {
        go(id);
      });
      tabsEl.appendChild(btn);
    });
    var hint = document.createElement("span");
    hint.className = "tabs__hint";
    hint.textContent = "共 " + shown + " 个分区";
    tabsEl.appendChild(hint);
  }

  function renderDrawer() {
    drawerList.innerHTML = "";
    order.forEach(function (id) {
      var s = byId[id];
      if (!s || isHidden(id)) return;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "drawer__item";
      btn.dataset.goto = id;
      btn.style.setProperty("--tab-accent", s.accent);
      btn.innerHTML =
        '<span class="drawer__dot"></span><span>' + escapeHtml(s.name) + "</span>";
      btn.addEventListener("click", function () {
        closeDrawer();
        go(id);
      });
      drawerList.appendChild(btn);
    });
  }

  /* 面包屑：站点 › 访问轨迹（可点击回切） */
  function renderCrumbs(id) {
    crumbsEl.innerHTML = "";

    var width = window.innerWidth;
    var isPhone = width < 560;
    var maxShown = isPhone ? 2 : width < 900 ? 3 : 6;
    var shown = trail.slice(-maxShown);
    var truncated = shown.length < trail.length;

    /* 手机上省掉「站点」根节点，把宽度留给最近两个分区 */
    if (!isPhone) {
      var homeBtn = document.createElement("button");
      homeBtn.type = "button";
      homeBtn.className = "crumb";
      homeBtn.textContent = "站点";
      homeBtn.title = "回到首页";
      homeBtn.addEventListener("click", function () {
        go(HOME);
      });
      crumbsEl.appendChild(homeBtn);
    }

    function addSep(text) {
      var sep = document.createElement("span");
      sep.className = "crumb-sep";
      sep.textContent = text || "›";
      sep.setAttribute("aria-hidden", "true");
      crumbsEl.appendChild(sep);
    }

    if (truncated && !isPhone) {
      var ell = document.createElement("span");
      ell.className = "crumb-sep";
      ell.textContent = "…";
      ell.title =
        "更早的分区：" +
        trail
          .slice(0, trail.length - shown.length)
          .map(function (tid) {
            return byId[tid].name;
          })
          .join(" → ");
      crumbsEl.appendChild(ell);
    }

    shown.forEach(function (tid, index) {
      var isCurrent = index === shown.length - 1;
      if (crumbsEl.childNodes.length) addSep();
      var node;
      if (isCurrent) {
        node = document.createElement("span");
        node.className = "crumb crumb--current";
        node.setAttribute("aria-current", "page");
      } else {
        node = document.createElement("button");
        node.type = "button";
        node.className = "crumb";
        node.title = "切换到 " + byId[tid].name;
        node.addEventListener("click", function () {
          go(tid);
        });
      }
      node.textContent = byId[tid] ? byId[tid].name : "";
      crumbsEl.appendChild(node);
    });

    if (id && (!shown.length || shown[shown.length - 1] !== id)) {
      if (crumbsEl.childNodes.length) addSep();
      var cur = document.createElement("span");
      cur.className = "crumb crumb--current";
      cur.setAttribute("aria-current", "page");
      cur.textContent = byId[id] ? byId[id].name : "";
      crumbsEl.appendChild(cur);
    }

    // 保证当前分区始终可见（内容超宽时滚到末尾）
    crumbsEl.scrollLeft = crumbsEl.scrollWidth;
  }

  /* ---------------- 滚动显现 ---------------- */
  var io =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          function (entries) {
            entries.forEach(function (entry) {
              if (entry.isIntersecting) {
                entry.target.classList.add("is-visible");
                io.unobserve(entry.target);
              }
            });
          },
          { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
        )
      : null;

  function bindReveal(view) {
    if (!view) return;
    if (io) {
      $$(".reveal", view).forEach(function (el) {
        if (!el.classList.contains("is-visible")) io.observe(el);
      });
    } else {
      $$(".reveal", view).forEach(function (el) {
        el.classList.add("is-visible");
      });
    }
  }

  /* ---------------- 设置面板 ---------------- */
  function openSettings() {
    renderOrderList();
    renderVisibilityList();
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    var card = $(".modal__card", modal);
    if (card) card.focus();
  }

  function closeSettings() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function renderOrderList() {
    orderList.innerHTML = "";
    order.forEach(function (id) {
      var s = byId[id];
      if (!s) return;
      var li = document.createElement("li");
      li.className = "order-item";
      li.dataset.id = id;
      li.style.setProperty("--tab-accent", s.accent);
      li.innerHTML =
        '<span class="order-item__handle" aria-hidden="true">' +
        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">' +
        '<path d="M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01"/></svg>' +
        "</span>" +
        '<span class="order-item__dot"></span>' +
        '<span class="order-item__name">' +
        escapeHtml(s.name) +
        (isHidden(id) ? ' <em class="order-item__hidden">隐藏</em>' : "") +
        "</span>" +
        '<span class="order-item__moves">' +
        '<button type="button" data-move="up" aria-label="上移">↑</button>' +
        '<button type="button" data-move="down" aria-label="下移">↓</button>' +
        "</span>";
      orderList.appendChild(li);
    });
    updateMoveButtons();
  }

  function updateMoveButtons() {
    var items = $$(".order-item", orderList);
    items.forEach(function (item, index) {
      var up = $('[data-move="up"]', item);
      var down = $('[data-move="down"]', item);
      if (up) up.disabled = index === 0;
      if (down) down.disabled = index === items.length - 1;
    });
  }

  function readListOrder() {
    return $$(".order-item", orderList).map(function (item) {
      return item.dataset.id;
    });
  }

  /* 拖动排序（鼠标 / 触摸都可用） */
  orderList.addEventListener("pointerdown", function (e) {
    var handle = e.target.closest(".order-item__handle");
    if (!handle) return;
    var item = handle.closest(".order-item");
    if (!item) return;
    e.preventDefault();
    item.classList.add("is-dragging");

    function move(ev) {
      var y = ev.clientY;
      var siblings = $$(".order-item", orderList).filter(function (el) {
        return el !== item;
      });
      var ref = null;
      for (var i = 0; i < siblings.length; i++) {
        var rect = siblings[i].getBoundingClientRect();
        if (y < rect.top + rect.height / 2) {
          ref = siblings[i];
          break;
        }
      }
      if (ref) {
        orderList.insertBefore(item, ref);
      } else {
        orderList.appendChild(item);
      }
      updateMoveButtons();
    }

    function up() {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
      item.classList.remove("is-dragging");
    }

    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", up);
  });

  orderList.addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-move]");
    if (!btn) return;
    var item = btn.closest(".order-item");
    if (!item) return;
    if (btn.dataset.move === "up" && item.previousElementSibling) {
      orderList.insertBefore(item, item.previousElementSibling);
    } else if (btn.dataset.move === "down" && item.nextElementSibling) {
      orderList.insertBefore(item.nextElementSibling, item);
    }
    updateMoveButtons();
  });

  function applySavedOrder() {
    var next = readListOrder();
    if (next.length !== DEFAULT_ORDER.length) return;
    saveOrder(next);
    renderTabs();
    renderDrawer();
    activate(current || HOME);
    closeSettings();
    toast("分区顺序已固定，刷新后依然生效");
  }

  function resetOrder() {
    order = DEFAULT_ORDER.slice();
    renderOrderList();
    toast("已恢复默认顺序，点“保存并固定”后生效");
  }

  /* ================= 游戏分区 · 街机厅 ================= */
  var ARCADE = SITE.arcade || null;
  var ARCADE_ACCENTS = {
    东方: "#FF6FB0",
    街机: "#7C5CFF",
    益智: "#F0A21B",
    对弈: "#10B981"
  };

  var arcadeEl = $("#arcade");
  var arcadeScreen = $("#arcadeScreen");
  var arcadeFrame = $("#arcadeFrame");
  var arcadeTitle = $("#arcadeTitle");
  var arcadeMeta = $("#arcadeMeta");
  var arcadeFullBtn = $("#arcadeFullBtn");
  var arcadePauseBtn = $("#arcadePauseBtn");
  var arcadeBackBtn = $("#arcadeBackBtn");
  var arcadeStandby = $("#arcadeStandby");
  var arcadeBoot = $("#arcadeBoot");
  var arcadeLobby = $("#arcadeLobby");
  var arcadeHint = $("#arcadeHint");
  var gameGrid = $("#gameGrid");
  var gameFilters = $("#gameFilters");
  var gameSearch = $("#gameSearch");
  var gameCount = $("#gameCount");
  var gameEmpty = $("#gameEmpty");

  var arcade = {
    games: ARCADE && ARCADE.games ? ARCADE.games : [],
    categories: ARCADE && ARCADE.categories ? ARCADE.categories : ["全部"],
    cat: "全部",
    term: "",
    current: null,
    phase: "standby",
    paused: false,
    frameReady: false,
    pendingId: null,
    pendingLobby: false,
    bootTimer: null
  };

  function gameById(id) {
    for (var i = 0; i < arcade.games.length; i++) {
      if (arcade.games[i].id === id) return arcade.games[i];
    }
    return null;
  }

  function readScores() {
    if (!ARCADE) return {};
    try {
      return JSON.parse(localStorage.getItem(ARCADE.bestKey) || "{}") || {};
    } catch (e) {
      return {};
    }
  }

  function gameAccent(game) {
    return ARCADE_ACCENTS[game.cat] || "#7C5CFF";
  }

  function renderGameFilters() {
    if (!gameFilters) return;
    gameFilters.innerHTML = "";
    arcade.categories.forEach(function (cat) {
      var count = 0;
      arcade.games.forEach(function (game) {
        if (cat === "全部" || game.cat === cat) count++;
      });
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "game-filter" + (cat === arcade.cat ? " is-on" : "");
      btn.dataset.cat = cat;
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", cat === arcade.cat ? "true" : "false");
      btn.innerHTML = "<span>" + escapeHtml(cat) + "</span><i>" + count + "</i>";
      gameFilters.appendChild(btn);
    });
  }

  function renderGameGrid() {
    if (!gameGrid) return;
    var q = (arcade.term || "").trim().toLowerCase();
    var scores = readScores();
    var html = "";
    var shown = 0;

    arcade.games.forEach(function (game, gameIndex) {
      var hitCat = arcade.cat === "全部" || game.cat === arcade.cat;
      var hay = (game.name + " " + game.cat + " " + game.desc).toLowerCase();
      var hitTerm = !q || hay.indexOf(q) !== -1;
      if (!hitCat || !hitTerm) return;
      shown++;

      var best = Number(scores[game.id]) || 0;
      var live = arcade.current === game.id ? " is-live" : "";
      var num = String(gameIndex + 1).padStart(2, "0");
      html +=
        '<button type="button" class="game-card' +
        live +
        '" data-game="' +
        game.id +
        '" style="--game-accent:' +
        gameAccent(game) +
        '" aria-label="进入游戏 ' +
        escapeHtml(game.name) +
        '">' +
        '<span class="game-card__top">' +
        '<span class="game-card__no">' + num + "</span>" +
        '<span class="game-card__title"><b>' + escapeHtml(game.name) + "</b><em>" +
        escapeHtml(game.en || "") + "</em></span>" +
        "</span>" +
        '<span class="game-card__desc">' +
        escapeHtml(game.desc) +
        "</span>" +
        '<span class="game-card__foot">' +
        '<span class="game-card__cat">' + escapeHtml(game.cat) + "</span>" +
        '<span class="game-card__best">最高 <b data-best="' +
        game.id +
        '">' +
        best +
        "</b></span>" +
        '<span class="game-card__play">进入游戏</span>' +
        "</span>" +
        "</button>";
    });

    gameGrid.innerHTML = html;
    if (gameEmpty) gameEmpty.hidden = shown !== 0;

    if (gameCount) {
      if (q) {
        gameCount.textContent = "匹配 " + shown + " / " + arcade.games.length + " 款";
      } else {
        var cats = {};
        arcade.games.forEach(function (game) {
          cats[game.cat] = (cats[game.cat] || 0) + 1;
        });
        var parts = [];
        arcade.categories.forEach(function (cat) {
          if (cat !== "全部" && cats[cat]) parts.push(cat + " " + cats[cat]);
        });
        gameCount.textContent =
          "共 " + arcade.games.length + " 款 · " + parts.join(" / ");
      }
    }
  }

  function refreshBestScores() {
    if (!gameGrid) return;
    var scores = readScores();
    $$("[data-best]", gameGrid).forEach(function (el) {
      var v = Number(scores[el.dataset.best]) || 0;
      el.textContent = v;
    });
  }

  function updateLiveCard() {
    if (!gameGrid) return;
    $$(".game-card", gameGrid).forEach(function (card) {
      card.classList.toggle("is-live", card.dataset.game === arcade.current);
    });
  }

  function setArcadeBar(title, meta) {
    if (arcadeTitle) arcadeTitle.textContent = title;
    if (arcadeMeta) arcadeMeta.textContent = meta;
  }

  function postToArcade(msg) {
    if (!arcadeFrame || !arcadeFrame.contentWindow) return;
    try {
      arcadeFrame.contentWindow.postMessage(msg, "*");
    } catch (e) {
      /* iframe 还没起来时忽略 */
    }
  }

  function frameHashId() {
    try {
      return (arcadeFrame.contentWindow.location.hash || "").replace(/^#\/?/, "");
    } catch (e) {
      return "";
    }
  }


  var powerAudio = null;
  function powerSfx(on) {
    try {
      if (!powerAudio) {
        powerAudio = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (powerAudio.state === "suspended") powerAudio.resume();
      var t = powerAudio.currentTime;
      var osc = powerAudio.createOscillator();
      var gain = powerAudio.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(on ? 140 : 420, t);
      osc.frequency.exponentialRampToValueAtTime(on ? 520 : 80, t + 0.45);
      gain.gain.setValueAtTime(0.035, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      osc.connect(gain);
      gain.connect(powerAudio.destination);
      osc.start(t);
      osc.stop(t + 0.55);
    } catch (e) {
      /* 忽略音频错误 */
    }
  }

  function showPlayControls() {
    if (arcadePauseBtn) {
      arcadePauseBtn.hidden = false;
      arcadePauseBtn.textContent = "⏸ 暂停";
    }
    if (arcadeBackBtn) arcadeBackBtn.hidden = false;
    arcade.paused = false;
  }

  function resetPlayControls() {
    if (arcadePauseBtn) arcadePauseBtn.hidden = true;
    if (arcadeBackBtn) arcadeBackBtn.hidden = true;
    arcade.paused = false;
  }

  function toggleArcadePause() {
    if (!arcadeFrame || arcade.phase !== "playing") return;
    try {
      var doc = arcadeFrame.contentDocument;
      var btn = doc && doc.querySelector("#btnPause");
      if (!btn || btn.classList.contains("hidden")) {
        toast("该游戏不支持暂停");
        return;
      }
      btn.click();
      arcade.paused = !arcade.paused;
      if (arcadePauseBtn) {
        arcadePauseBtn.textContent = arcade.paused ? "▶ 继续" : "⏸ 暂停";
      }
    } catch (e) {
      toast("暂停失败，请重试");
    }
  }

  function showStandby() {
    if (!arcadeEl) return;
    clearTimeout(arcade.bootTimer);
    arcade.phase = "standby";
    arcade.current = null;
    arcadeEl.classList.remove("is-on", "is-booting", "is-lobby", "is-playing");
    if (arcadeStandby) arcadeStandby.hidden = false;
    if (arcadeBoot) arcadeBoot.hidden = true;
    if (arcadeLobby) arcadeLobby.hidden = true;
    if (arcadeHint) arcadeHint.textContent = "按电源开机 · 点卡带进入游戏";
    setArcadeBar("街机厅", "按电源键开机");
    if (arcadeFrame) {
      try {
        arcadeFrame.removeAttribute("src");
      } catch (e) {
        /* 忽略 */
      }
    }
    arcade.frameReady = false;
    resetPlayControls();
    updateLiveCard();
    updateFullLabel();
  }

  function powerOn() {
    if (!arcadeEl) return;
    if (arcade.phase !== "standby") return;
    arcade.phase = "booting";
    powerSfx(true);
    arcadeEl.classList.add("is-on", "is-booting");
    if (arcadeStandby) arcadeStandby.hidden = true;
    if (arcadeLobby) arcadeLobby.hidden = true;
    if (arcadeBoot) arcadeBoot.hidden = false;
    setArcadeBar("街机厅", "系统启动中…");
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    clearTimeout(arcade.bootTimer);
    arcade.bootTimer = setTimeout(function () {
      arcade.phase = "lobby";
      arcadeEl.classList.remove("is-booting");
      arcadeEl.classList.add("is-lobby");
      if (arcadeBoot) arcadeBoot.hidden = true;
      if (arcadeLobby) arcadeLobby.hidden = false;
      setArcadeBar("街机厅 · " + arcade.games.length + " 款", "选择游戏");
      if (arcadeHint) arcadeHint.textContent = "点卡带进入游戏 · ⏻ 关机";
      renderGameGrid();
    }, reduce ? 260 : 1800);
  }

  function backToLobby() {
    if (!arcadeEl) return;
    if (arcade.phase === "standby") return;
    if (arcade.frameReady) postToArcade({ type: "arcade:lobby" });
    arcade.current = null;
    arcade.phase = "lobby";
    resetPlayControls();
    arcadeEl.classList.remove("is-playing");
    arcadeEl.classList.add("is-lobby", "is-on");
    if (arcadeStandby) arcadeStandby.hidden = true;
    if (arcadeBoot) arcadeBoot.hidden = true;
    if (arcadeLobby) arcadeLobby.hidden = false;
    setArcadeBar("街机厅 · " + arcade.games.length + " 款", "选择游戏");
    if (arcadeHint) arcadeHint.textContent = "点卡带进入游戏 · ⏻ 关机";
    updateLiveCard();
    renderGameGrid();
  }

  function closeArcade(notify) {
    if (!arcadeEl) return;
    if (arcade.phase === "shutting") return;
    clearTimeout(arcade.bootTimer);
    if (notify !== false && arcade.frameReady) {
      postToArcade({ type: "arcade:lobby" });
    }
    if (document.fullscreenElement) {
      try {
        document.exitFullscreen();
      } catch (e) {
        /* 忽略 */
      }
    }
    document.body.classList.remove("arcade-locked");
    if (arcade.phase === "standby") {
      showStandby();
      return;
    }
    arcade.phase = "shutting";
    powerSfx(false);
    arcadeEl.classList.remove("is-on");
    arcadeEl.classList.add("is-shutting");
    setTimeout(function () {
      arcadeEl.classList.remove("is-shutting");
      showStandby();
    }, 760);
  }

  function startGame(id) {
    if (!ARCADE || !arcadeFrame) return;
    var game = gameById(id);
    if (!game) return;

    if (arcade.phase === "standby" || arcade.phase === "booting") {
      if (arcade.phase === "standby") powerOn();
      setTimeout(function () {
        if (arcade.phase === "lobby") startGame(id);
      }, 1900);
      return;
    }

    arcade.current = id;
    arcade.phase = "playing";
    arcade.pendingLobby = false;
    showPlayControls();
    arcadeEl.classList.add("is-playing", "is-on");
    arcadeEl.classList.remove("is-lobby");
    if (arcadeLobby) arcadeLobby.hidden = true;
    if (arcadeStandby) arcadeStandby.hidden = true;
    if (arcadeBoot) arcadeBoot.hidden = true;
    setArcadeBar((game.icon || "🎮") + " " + game.name, "运行中 · " + game.cat);
    updateLiveCard();

    if (!arcade.frameReady) {
      arcade.pendingId = id;
      var src = ARCADE.src + "#/" + id;
      if (arcadeFrame.getAttribute("src") !== src) {
        arcadeFrame.setAttribute("src", src);
      }
    } else {
      postToArcade({ type: "arcade:open", id: id });
    }

    refreshBestScores();
    setTimeout(function () {
      try {
        arcadeFrame.focus();
      } catch (e) {
        /* 忽略 */
      }
    }, 90);
  }

  function randomGame() {
    if (!arcade.games.length) return;
    var pick = arcade.games[Math.floor(Math.random() * arcade.games.length)];
    startGame(pick.id);
  }

  function isArcadeFullscreen() {
    return (
      document.fullscreenElement === arcadeEl ||
      (arcadeEl && arcadeEl.classList.contains("is-fullscreen"))
    );
  }

  function updateFullLabel() {
    if (!arcadeFullBtn) return;
    arcadeFullBtn.textContent = isArcadeFullscreen() ? "⤡ 退出全屏" : "⛶ 全屏";
  }

  function cssFullscreen() {
    if (!arcadeEl) return;
    arcadeEl.classList.add("is-fullscreen");
    document.body.classList.add("arcade-locked");
    updateFullLabel();
    setTimeout(function () {
      try {
        arcadeFrame.focus();
      } catch (e) {
        /* 忽略 */
      }
    }, 60);
  }

  function toggleArcadeFull() {
    if (!arcadeEl) return;

    if (document.fullscreenElement) {
      var p = document.exitFullscreen();
      if (p && p.catch) p.catch(function () {});
      return;
    }

    if (arcadeEl.classList.contains("is-fullscreen")) {
      arcadeEl.classList.remove("is-fullscreen");
      document.body.classList.remove("arcade-locked");
      updateFullLabel();
      return;
    }

    var request = arcadeEl.requestFullscreen || arcadeEl.webkitRequestFullscreen;
    if (!request) {
      cssFullscreen();
      return;
    }
    try {
      var result = request.call(arcadeEl);
      if (result && result.then) {
        result
          .then(function () {
            arcadeEl.classList.add("is-fullscreen");
            document.body.classList.add("arcade-locked");
            updateFullLabel();
            setTimeout(function () {
              try {
                arcadeFrame.focus();
              } catch (e) {
                /* 忽略 */
              }
            }, 60);
          })
          .catch(cssFullscreen);
      } else {
        cssFullscreen();
      }
    } catch (e) {
      cssFullscreen();
    }
  }

  function onArcadeMessage(ev) {
    if (arcadeFrame && ev.source && ev.source !== arcadeFrame.contentWindow) return;
    var data = ev.data;
    if (!data || typeof data !== "object") return;

    if (data.type === "arcade:state") {
      if (data.id) {
        var game =
          gameById(data.id) || {
            id: data.id,
            name: data.name || data.id,
            icon: data.icon || "🎮",
            cat: ""
          };
        arcade.current = game.id;
        arcade.phase = "playing";
        showPlayControls();
        if (arcadeEl) arcadeEl.classList.add("is-playing", "is-on");
        if (arcadeLobby) arcadeLobby.hidden = true;
        setArcadeBar(
          (game.icon || "🎮") + " " + game.name,
          game.cat ? "运行中 · " + game.cat : "运行中"
        );
        updateLiveCard();
        refreshBestScores();
      } else if (arcade.phase === "playing") {
        backToLobby();
      }
    } else if (data.type === "arcade:escape") {
      if (isArcadeFullscreen()) {
        if (document.fullscreenElement) {
          var p = document.exitFullscreen();
          if (p && p.catch) p.catch(function () {});
        } else {
          arcadeEl.classList.remove("is-fullscreen");
          document.body.classList.remove("arcade-locked");
          updateFullLabel();
        }
      } else if (arcade.phase === "playing") {
        backToLobby();
      } else {
        closeArcade();
      }
    } else if (data.type === "arcade:fullscreen") {
      if (!isArcadeFullscreen()) toggleArcadeFull();
    }
  }

  function initArcade() {
    if (!ARCADE || !arcadeEl) return;

    renderGameFilters();
    renderGameGrid();
    showStandby();

    if (gameFilters) {
      gameFilters.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-cat]");
        if (!btn) return;
        arcade.cat = btn.dataset.cat;
        renderGameFilters();
        renderGameGrid();
      });
    }

    if (gameGrid) {
      gameGrid.addEventListener("click", function (e) {
        var card = e.target.closest("[data-game]");
        if (!card) return;
        startGame(card.dataset.game);
      });
    }

    if (gameSearch) {
      gameSearch.addEventListener("input", function () {
        arcade.term = gameSearch.value;
        renderGameGrid();
      });
    }

    if (arcadeFrame) {
      arcadeFrame.addEventListener("load", function () {
        arcade.frameReady = true;
        var want = arcade.pendingId;
        arcade.pendingId = null;
        if (arcade.pendingLobby) {
          arcade.pendingLobby = false;
          postToArcade({ type: "arcade:lobby" });
          return;
        }
        if (want && frameHashId() !== want) {
          postToArcade({ type: "arcade:open", id: want });
        }
      });
    }

    window.addEventListener("message", onArcadeMessage);
    window.addEventListener("storage", function (e) {
      if (ARCADE && e.key === ARCADE.bestKey) refreshBestScores();
    });
    document.addEventListener("fullscreenchange", function () {
      var on = document.fullscreenElement === arcadeEl;
      if (arcadeEl) arcadeEl.classList.toggle("is-fullscreen", on);
      document.body.classList.toggle("arcade-locked", on);
      updateFullLabel();
    });
  }

  /* ---------------- 抽屉 / 弹窗 ---------------- */
  function openDrawer() {
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    scrim.hidden = false;
    requestAnimationFrame(function () {
      scrim.classList.add("is-open");
    });
    document.body.style.overflow = "hidden";
  }

  function closeDrawer() {
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    scrim.classList.remove("is-open");
    setTimeout(function () {
      if (!scrim.classList.contains("is-open")) scrim.hidden = true;
    }, 300);
    document.body.style.overflow = "";
  }

  scrim.addEventListener("click", closeDrawer);

  modal.addEventListener("click", function (e) {
    if (e.target === modal) closeSettings();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;

    if (addressModal && addressModal.classList.contains("is-open")) {
      // 地址弹窗只允许点「确定」关闭，Esc 不关闭
      return;
    }
    if (siteSearch && !siteSearch.hidden) {
      closeSiteSearch();
      return;
    }
    if (modal.classList.contains("is-open")) {
      closeSettings();
      return;
    }
    if (drawer.classList.contains("is-open")) {
      closeDrawer();
      return;
    }

    /* 街机屏：全屏时先退全屏，再按一次才关机 */
    if (arcadeEl && arcadeEl.classList.contains("is-fullscreen")) {
      if (document.fullscreenElement) {
        var p = document.exitFullscreen();
        if (p && p.catch) p.catch(function () {});
      } else {
        arcadeEl.classList.remove("is-fullscreen");
        document.body.classList.remove("arcade-locked");
        updateFullLabel();
      }
      return;
    }
    if (arcadeEl && arcadeEl.classList.contains("is-on")) {
      closeArcade(true);
    }
  });

  /* ---------------- 提示条 ---------------- */
  var toastTimer = null;
  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("is-open");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove("is-open");
    }, 2200);
  }

  /* ---------------- 设备识别 ---------------- */
  var mqMobile = window.matchMedia("(max-width: 768px)");
  function applyDevice() {
    var mobile = mqMobile.matches;
    root.dataset.device = mobile ? "mobile" : "desktop";
    if (deviceBadge) deviceBadge.textContent = mobile ? "手机版" : "电脑版";
    if (envInfo) {
      envInfo.textContent =
        (mobile ? "手机 / 窄屏" : "电脑 / 宽屏") +
        " · 视口宽 " +
        window.innerWidth +
        "px · 断点 768px 自动切换";
    }
    if (current === "game") {
      document.body.classList.toggle("arcade-immersive", mobile);
    } else {
      document.body.classList.remove("arcade-immersive");
    }
    if (current) renderCrumbs(current);
    NAV_PER_PAGE = 6;
    if (navState) navState.page = 1;
    renderNav();
  }

  /* ---------------- 其它交互 ---------------- */
  function bindPageActions() {
    document.addEventListener("click", function (e) {
      var actBtn = e.target.closest("[data-act]");
      if (actBtn) {
        var act = actBtn.dataset.act;
        if (act === "back") history.back();
        else if (act === "forward") history.forward();
        else if (act === "refresh") {
          if (current === "recipe") {
            loadRecipeFrame(true);
            toast("已重新载入食谱应用");
          } else {
            activate(current);
            toast("已刷新当前分区");
          }
        } else if (act === "settings") openSettings();
        else if (act === "close-settings") closeSettings();
        else if (act === "menu") openDrawer();
        else if (act === "close-drawer") closeDrawer();
        else if (act === "save-order") applySavedOrder();
        else if (act === "reset-order") resetOrder();
        else if (act === "arcade-close") closeArcade(true);
        else if (act === "arcade-full") toggleArcadeFull();
        else if (act === "arcade-lucky") randomGame();
        else if (act === "arcade-power") powerOn();
        else if (act === "arcade-pause") toggleArcadePause();
        else if (act === "arcade-back") backToLobby();
        else if (act === "arcade-exit") go(HOME);
        else if (act === "show-address") {
          e.preventDefault();
          openAddressModal(actBtn);
        }
        else if (act === "copy-address") copyAddress();
        else if (act === "confirm-address") closeAddressModal();
        else if (act === "site-search") openSiteSearch();
        else if (act === "pcl2-download") {
          e.preventDefault();
          copyToClipboard("2460", true);
          toast("密码已复制，1.8 秒后打开下载页…");
          setTimeout(function () {
            window.open("https://wwbpj.lanzouw.com/iNP074cpznte", "_blank", "noopener");
          }, 1800);
        }
        return;
      }

      var alertBtn = e.target.closest("[data-alert]");
      if (alertBtn) {
        e.preventDefault();
        alert(alertBtn.dataset.alert);
        return;
      }

      var scrollBtn = e.target.closest("[data-scroll-to]");
      if (scrollBtn) {
        var target = document.getElementById(scrollBtn.dataset.scrollTo);
        if (target) {
          e.preventDefault();
          var top =
            target.getBoundingClientRect().top +
            window.pageYOffset -
            (parseInt(getComputedStyle(root).getPropertyValue("--header-h"), 10) || 104) -
            16;
          window.scrollTo({ top: top, behavior: "smooth" });
        }
      }
    });
  }

  /* ---------------- 导航：分类 / 设备过滤 / 分页 ---------------- */
  var NAV_SITES = window.NAV_SITES || [];
  var NAV_CATS = window.NAV_CATS || [{ key: "all", name: "全部" }];
  var NAV_PER_PAGE = 6;
  var navGrid = $("#navGrid");
  var navFilters = $("#navFilters");
  var navSearch = $("#navSearch");
  var navCount = $("#navCount");
  var navEmpty = $("#navEmpty");
  var navPager = $("#navPager");
  var navDevice = $("#navDevice");
  var navState = { cat: "all", term: "", page: 1 };

  function navSiteDevice() {
    return mqMobile.matches ? "mobile" : "pc";
  }

  function navFiltered() {
    var q = (navState.term || "").trim().toLowerCase();
    var device = navSiteDevice();
    return NAV_SITES.filter(function (site) {
      if (site.devices && site.devices.indexOf(device) === -1) return false;
      if (navState.cat !== "all" && site.cat !== navState.cat) return false;
      if (!q) return true;
      return (
        site.name + " " + site.desc + " " + site.url
      ).toLowerCase().indexOf(q) !== -1;
    });
  }

  function navCatName(key) {
    for (var i = 0; i < NAV_CATS.length; i++) {
      if (NAV_CATS[i].key === key) return NAV_CATS[i].name;
    }
    return key;
  }

  function renderNavFilters() {
    if (!navFilters) return;
    navFilters.innerHTML = "";
    var device = navSiteDevice();
    NAV_CATS.forEach(function (cat) {
      var count = 0;
      NAV_SITES.forEach(function (site) {
        if (site.devices && site.devices.indexOf(device) === -1) return;
        if (cat.key === "all" || site.cat === cat.key) count++;
      });
      if (cat.key !== "all" && count === 0) return;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "nav-filter" + (navState.cat === cat.key ? " is-on" : "");
      btn.dataset.cat = cat.key;
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", navState.cat === cat.key ? "true" : "false");
      btn.textContent = cat.name + " " + count;
      navFilters.appendChild(btn);
    });
  }

  function renderNav() {
    if (!navGrid) return;
    var list = navFiltered();
    var pages = Math.max(1, Math.ceil(list.length / NAV_PER_PAGE));
    if (navState.page > pages) navState.page = pages;
    if (navState.page < 1) navState.page = 1;
    var start = (navState.page - 1) * NAV_PER_PAGE;
    var pageList = list.slice(start, start + NAV_PER_PAGE);

    renderNavFilters();

    var html = "";
    pageList.forEach(function (site) {
      var host = site.url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      html +=
        '<article class="nav-card" style="--nav-accent:' +
        (site.accent || "#2B7FD8") +
        '">' +
        '<div class="nav-card__top">' +
        '<span class="nav-card__badge">' +
        escapeHtml(site.badge || String(site.name).charAt(0)) +
        "</span>" +
        '<span class="nav-card__name">' +
        escapeHtml(site.name) +
        "</span>" +
        '<span class="nav-card__cat">' +
        escapeHtml(navCatName(site.cat)) +
        "</span>" +
        "</div>" +
        '<p class="nav-card__desc">' +
        escapeHtml(site.desc) +
        "</p>" +
        '<div class="nav-card__foot">' +
        '<span class="nav-card__url">' +
        escapeHtml(host) +
        "</span>" +
        '<a class="btn btn--sm" href="' +
        site.url +
        '" target="_blank" rel="noopener noreferrer">打开</a>' +
        "</div>" +
        "</article>";
    });
    navGrid.innerHTML = html;
    if (navEmpty) navEmpty.hidden = list.length !== 0;
    if (navCount) {
      navCount.textContent = navState.term
        ? "匹配 " + list.length + " 个站点"
        : "共 " + list.length + " 个站点";
    }
    if (navDevice) {
      navDevice.textContent =
        navSiteDevice() === "mobile" ? "手机端可用站点" : "电脑端可用站点";
    }

    if (navPager) {
      navPager.innerHTML = "";
      if (pages > 1) {
        navPager.hidden = false;
        var prev = document.createElement("button");
        prev.type = "button";
        prev.className = "nav-page";
        prev.textContent = "上一页";
        prev.disabled = navState.page <= 1;
        prev.dataset.page = String(navState.page - 1);
        navPager.appendChild(prev);
        for (var p = 1; p <= pages; p++) {
          var pb = document.createElement("button");
          pb.type = "button";
          pb.className = "nav-page" + (p === navState.page ? " is-on" : "");
          pb.textContent = String(p);
          pb.dataset.page = String(p);
          navPager.appendChild(pb);
        }
        var next = document.createElement("button");
        next.type = "button";
        next.className = "nav-page";
        next.textContent = "下一页";
        next.disabled = navState.page >= pages;
        next.dataset.page = String(navState.page + 1);
        navPager.appendChild(next);
      } else {
        navPager.hidden = true;
      }
    }
  }

  function initNav() {
    if (!navGrid) return;
    renderNav();
    if (navFilters) {
      navFilters.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-cat]");
        if (!btn) return;
        navState.cat = btn.dataset.cat;
        navState.page = 1;
        renderNav();
      });
    }
    if (navSearch) {
      navSearch.addEventListener("input", function () {
        navState.term = navSearch.value;
        navState.page = 1;
        renderNav();
      });
    }
    if (navPager) {
      navPager.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-page]");
        if (!btn || btn.disabled) return;
        var page = Number(btn.dataset.page);
        if (!isFinite(page)) return;
        navState.page = page;
        renderNav();
      });
    }
  }

  
  /* ---------------- 全站搜索 ---------------- */
  var siteSearch = $("#siteSearch");
  var siteSearchInput = $("#siteSearchInput");
  var siteSearchResults = $("#siteSearchResults");
  var siteSearchItems = [];

  function buildSiteSearchIndex() {
    var items = [];
    var device = mqMobile.matches ? "mobile" : "pc";
    sections.forEach(function (s) {
      if (isHidden(s.id)) return;
      items.push({
        type: "分区",
        name: s.name,
        desc: "切换到「" + s.name + "」",
        run: function () { go(s.id); }
      });
    });
    (window.NAV_SITES || []).forEach(function (site) {
      if (site.devices && site.devices.indexOf(device) === -1) return;
      items.push({
        type: "网站",
        name: site.name,
        desc: site.desc,
        run: function () { window.open(site.url, "_blank", "noopener"); }
      });
    });
    if (SITE.arcade && SITE.arcade.games) {
      SITE.arcade.games.forEach(function (game) {
        items.push({
          type: "游戏",
          name: game.name,
          desc: game.desc + (game.id === "touhou" ? " 东方 妖妖梦" : ""),
          run: function () {
            go("game");
            setTimeout(function () { startGame(game.id); }, 350);
          }
        });
      });
    }
    $$(".dl-card").forEach(function (card) {
      var h = card.querySelector("h3");
      if (!h) return;
      var ver = card.querySelector(".dl-card__version");
      items.push({
        type: "下载",
        name: h.textContent.trim(),
        desc: "下载分区 · " + (ver ? ver.textContent.trim() : ""),
        run: function () {
          go("download");
          setTimeout(function () {
            card.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 350);
        }
      });
    });
    return items;
  }

  function renderSiteSearch(query) {
    if (!siteSearchResults) return;
    var q = (query || "").trim().toLowerCase();
    if (!q) {
      siteSearchResults.innerHTML =
        '<p class="site-search__empty">输入关键词，搜索分区、网站、游戏和下载</p>';
      return;
    }
    var hits = siteSearchItems
      .filter(function (item) {
        return (
          item.name + " " + item.desc + " " + item.type
        ).toLowerCase().indexOf(q) !== -1;
      })
      .slice(0, 12);
    if (!hits.length) {
      siteSearchResults.innerHTML = '<p class="site-search__empty">没有找到匹配内容</p>';
      return;
    }
    siteSearchResults.innerHTML = hits
      .map(function (item) {
        return (
          '<button type="button" class="site-search__item" data-search-idx="' +
          siteSearchItems.indexOf(item) +
          '">' +
          '<span class="site-search__type">' +
          escapeHtml(item.type) +
          "</span>" +
          '<span class="site-search__name">' +
          escapeHtml(item.name) +
          "</span>" +
          '<span class="site-search__desc">' +
          escapeHtml(item.desc) +
          "</span>" +
          "</button>"
        );
      })
      .join("");
  }

  function openSiteSearch() {
    if (!siteSearch) return;
    siteSearchItems = buildSiteSearchIndex();
    siteSearch.hidden = false;
    if (siteSearchInput) {
      siteSearchInput.hidden = false;
      siteSearchInput.value = "";
      siteSearchInput.focus();
    }
    if (crumbsEl) crumbsEl.hidden = true;
    var searchBtn = $("#addrSearch");
    if (searchBtn) searchBtn.hidden = true;
    if (deviceBadge) deviceBadge.hidden = true;
    renderSiteSearch("");
  }

  function closeSiteSearch() {
    if (siteSearch) siteSearch.hidden = true;
    if (siteSearchInput) siteSearchInput.hidden = true;
    if (crumbsEl) crumbsEl.hidden = false;
    var searchBtn = $("#addrSearch");
    if (searchBtn) searchBtn.hidden = false;
    if (deviceBadge) deviceBadge.hidden = false;
  }

  function initSiteSearch() {
    if (!siteSearch) return;
    if (siteSearchInput) {
      siteSearchInput.addEventListener("input", function () {
        renderSiteSearch(siteSearchInput.value);
      });
      siteSearchInput.addEventListener("keydown", function (e) {
        if (e.key === "Escape") closeSiteSearch();
        if (e.key === "Enter") {
          var first =
            siteSearchResults &&
            siteSearchResults.querySelector("[data-search-idx]");
          if (first) first.click();
        }
      });
    }
    if (siteSearchResults) {
      siteSearchResults.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-search-idx]");
        if (!btn) return;
        var item = siteSearchItems[Number(btn.dataset.searchIdx)];
        if (!item) return;
        closeSiteSearch();
        item.run();
      });
    }
    if (crumbsEl) {
      // 捕获阶段拦截：点面包屑只进入搜索，不再触发面包屑自身的分区跳转
      crumbsEl.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        openSiteSearch();
      }, true);
    }
    document.addEventListener("click", function (e) {
      if (!siteSearch || siteSearch.hidden) return;
      if (siteSearch.contains(e.target)) return;
      if (e.target.closest(".addr")) return;
      closeSiteSearch();
    });
  }

  /* ---------------- 服务器地址弹窗 ---------------- */
  var addressModal = $("#addressModal");
  var addressValue = $("#addressValue");
  var addressText = "";

  function openAddressModal(btn) {
    if (!addressModal) return;
    addressText = (btn && btn.dataset.address) || "暂停服务 404";
    if (addressValue) addressValue.textContent = addressText;
    addressModal.classList.add("is-open");
    addressModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    var card = $(".modal__card", addressModal);
    if (card) card.focus();
  }

  function closeAddressModal() {
    if (!addressModal) return;
    addressModal.classList.remove("is-open");
    addressModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function copyToClipboard(text, silent) {
    function done() {
      if (!silent) toast("已复制地址");
    }
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.top = "-1000px";
      document.body.appendChild(ta);
      ta.select();
      try {
        var ok = document.execCommand("copy");
        if (ok) done();
        else toast("复制失败，请手动选择");
      } catch (e) {
        toast("复制失败，请手动选择");
      }
      document.body.removeChild(ta);
    }
    if (!text) {
      toast("暂无地址");
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else {
      fallback();
    }
  }

  function copyAddress() {
    copyToClipboard(addressText || (addressValue ? addressValue.textContent : ""));
  }

  function initAddressModal() {
    if (addressValue) addressValue.addEventListener("click", copyAddress);
    if (!addressModal) return;
    var confirmBtn = addressModal.querySelector('[data-act="confirm-address"]');
    if (confirmBtn) confirmBtn.addEventListener("click", closeAddressModal);
    addressModal.addEventListener("click", function (e) {
      var card = addressModal.querySelector(".modal__card");
      if (e.target.closest("button, .address-value")) return;
      if (e.target !== addressModal && !e.target.closest(".modal__card")) return;
      if (!confirmBtn) return;
      confirmBtn.classList.remove("is-pulse");
      void confirmBtn.offsetWidth;
      confirmBtn.classList.add("is-pulse");
      setTimeout(function () {
        confirmBtn.classList.remove("is-pulse");
      }, 700);
    });
  }

  /* ---------------- 启动 ---------------- */
  function init() {
    renderTabs();
    renderDrawer();
    bindPageActions();
    if (visibilityList) {
      visibilityList.addEventListener("change", function (e) {
        var input = e.target.closest("[data-vis]");
        if (!input) return;
        setHidden(input.dataset.vis, !input.checked);
      });
    }
    initNav();
    initSiteSearch();
    initAddressModal();
    bindRecipeFrame();
    applyDevice();
    initArcade();

    if (mqMobile.addEventListener) mqMobile.addEventListener("change", applyDevice);
    else if (mqMobile.addListener) mqMobile.addListener(applyDevice);
    window.addEventListener("resize", debounce(applyDevice, 180));

    var initial = parseHash();
    if (!initial) {
      initial = HOME;
      if (history.replaceState) history.replaceState(null, "", "#/" + HOME);
    }
    activate(initial);

    var yearEl = document.getElementById("year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    window.addEventListener("hashchange", function () {
      var id = parseHash();
      if (id) {
        activate(id);
      } else if (!location.hash || (location.hash || "").indexOf("#/") === 0) {
        // 空 hash，或指向一个已被隐藏/不存在的分区（如旧的 #/recipe）→ 回首页
        go(HOME, true);
      }
    });
  }

  function debounce(fn, wait) {
    var t = null;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, wait);
    };
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
