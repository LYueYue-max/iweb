/* ============================================================
 * 东方妖々梦 —— TH07 Web 复刻（iframe 卡带）
 * 完整游戏位于 games/th07/，WASD 移动 / 空格射击 / Z 兼容
 * ============================================================ */
(function () {
  function boot() {
    if (typeof register !== "function") {
      setTimeout(boot, 30);
      return;
    }

    register({
    id: "touhou",
    name: "東方妖々夢",
    icon: "🌸",
    tags: ["东方"],
    mount: function (stage, api) {
      var frame = document.createElement("iframe");
      frame.className = "th07-embed";
      frame.src = "games/th07/index.html";
      frame.title = "東方妖々夢";
      frame.setAttribute("allowfullscreen", "");
      stage.appendChild(frame);

      api.onPause(function () {
        try {
          var w = frame.contentWindow;
          w.dispatchEvent(new w.KeyboardEvent("keydown", { code: "Escape", key: "Escape", bubbles: true }));
          w.dispatchEvent(new w.KeyboardEvent("keyup", { code: "Escape", key: "Escape", bubbles: true }));
        } catch (e) {
          /* iframe 未就绪时忽略 */
        }
      });

      api.onRestart(function () {
        try {
          frame.contentWindow.location.reload();
        } catch (e) {
          frame.src = frame.src;
        }
      });

      return function () {
        frame.src = "about:blank";
      };
    }
    });

    if (typeof route === "function" && location.hash === "#/touhou") {
      route();
    }
  }

  boot();
})();
