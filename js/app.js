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

  /* ---------------- 顶栏渲染 ---------------- */
  function renderTabs() {
    tabsEl.innerHTML = "";
    order.forEach(function (id) {
      var s = byId[id];
      if (!s) return;
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
    hint.textContent = "共 " + order.length + " 个分区";
    tabsEl.appendChild(hint);
  }

  function renderDrawer() {
    drawerList.innerHTML = "";
    order.forEach(function (id) {
      var s = byId[id];
      if (!s) return;
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

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (modal.classList.contains("is-open")) closeSettings();
      if (drawer.classList.contains("is-open")) closeDrawer();
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
    if (current) renderCrumbs(current);
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
          // 食谱入口已隐藏（见 js/data.js 与 index.html 的注释）；
          // 这段保留着，恢复食谱分区后刷新按钮会自动重新载入菜谱应用
          if (current === "recipe") {
            var frame = $("#recipeFrame");
            if (frame) frame.src = frame.src;
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

  /* 导航搜索 */
  function bindNavSearch() {
    var input = $("#navSearch");
    var grid = $("#navGrid");
    var empty = $("#navEmpty");
    var count = $("#navCount");
    if (!input || !grid) return;

    var cards = $$(".link-card", grid);
    function refresh(term) {
      var q = (term || "").trim().toLowerCase();
      var shown = 0;
      cards.forEach(function (card) {
        var hit = !q || card.textContent.toLowerCase().indexOf(q) !== -1;
        card.style.display = hit ? "" : "none";
        if (hit) shown++;
      });
      if (empty) empty.hidden = shown !== 0;
      if (count) {
        count.textContent = q
          ? "匹配 " + shown + " / " + cards.length + " 个站点"
          : "共 " + cards.length + " 个站点";
      }
    }
    input.addEventListener("input", function () {
      refresh(input.value);
    });
    refresh("");
  }

  /* ---------------- 启动 ---------------- */
  function init() {
    renderTabs();
    renderDrawer();
    bindPageActions();
    bindNavSearch();
    applyDevice();

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
