/* ============================================================
 * 站点配置：分区清单 + 默认顺序 + 游戏分区的卡带数据
 * 想改分区名称 / 增减分区，只改这里（并同步 index.html 里的 .view）
 * 默认顺序：首页 → 导航 → 下载 → 食谱 → 游戏 → Minecraft
 * 访客调整过的顺序保存在浏览器 localStorage，不会改这份文件
 * ============================================================ */
window.SITE = {
  storageKey: "gx.site.order.v1",
  hiddenKey: "gx.site.hidden.v1",
  home: "home",
  sections: [
    { id: "home", name: "首页", accent: "#2B7FD8" },
    { id: "nav", name: "导航", accent: "#FB7299" },
    { id: "download", name: "下载", accent: "#10B981" },
    { id: "recipe", name: "食谱", accent: "#F59E0B" },
    { id: "game", name: "游戏", accent: "#7C5CFF" },
    { id: "minecraft", name: "Minecraft", accent: "#36D1DC" }
  ],

  /* 游戏分区：iframe 指向 apps/arcade/index.html（由 122.html 改造）
   * games 清单要和 apps/arcade/index.html 里的 register({...}) 保持一致：
   * 新增一个小游戏时，这里补一条就能出现在卡带墙上。
   * bestKey 是街机应用写最高分用的 localStorage 键，别改。 */
  arcade: {
    src: "apps/arcade/index.html",
    bestKey: "mg_scores",
    categories: ["全部", "东方", "街机", "益智", "对弈"],
    games: [
      { id: "touhou", name: "東方妖々夢 · 网页版", icon: "🌸", cat: "东方", desc: "弹幕射击：三面 + 符卡 + 樱点结界，机体与难度可选，进度存在本地。" },
      { id: "snake", name: "贪吃蛇", icon: "🐍", cat: "街机", desc: "方向键 / WASD 转向，吃果子变长，别咬到自己。" },
      { id: "tetris", name: "俄罗斯方块", icon: "🧱", cat: "街机", desc: "七种方块落下，消行得分，速度越叠越快。" },
      { id: "breakout", name: "打砖块", icon: "🧨", cat: "街机", desc: "左右移动挡板，一颗球敲掉整面砖墙。" },
      { id: "invaders", name: "太空侵略者", icon: "👾", cat: "街机", desc: "击落一波波太空敌机，别让它们压到底线。" },
      { id: "pong", name: "乒乓球 Pong", icon: "🏓", cat: "街机", desc: "和电脑对拍，先得 7 分获胜。" },
      { id: "flappy", name: "像素鸟", icon: "🐤", cat: "街机", desc: "点一下扇一次翅膀，穿过水管缝隙。" },
      { id: "2048", name: "2048", icon: "🔢", cat: "益智", desc: "合并相同数字，一路凑出 2048 方块。" },
      { id: "minesweeper", name: "扫雷", icon: "💣", cat: "益智", desc: "三档棋盘，插旗排雷，一步踩空全盘结束。" },
      { id: "memory", name: "记忆翻牌", icon: "🃏", cat: "益智", desc: "翻开两张配对，记住图案位置。" },
      { id: "fifteen", name: "数字华容道", icon: "🧮", cat: "益智", desc: "滑动方块，把 1–15 还原成顺序。" },
      { id: "linklink", name: "连连看", icon: "🀄", cat: "益智", desc: "两张相同图案连线消除，清空棋盘。" },
      { id: "gomoku", name: "五子棋", icon: "⚫", cat: "对弈", desc: "和电脑轮流落子，五子连珠即胜。" },
      { id: "tictactoe", name: "井字棋", icon: "❌", cat: "对弈", desc: "三格连成一线获胜，三档对手强度。" }
    ]
  }
};
