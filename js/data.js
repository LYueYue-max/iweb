/* ============================================================
 * 站点配置：分区清单 + 默认顺序
 * 想改分区名称 / 增减分区，只改这里（并同步 index.html 里的 .view）
 * 默认顺序：首页 → 导航 → 下载 → Minecraft
 * 访客调整过的顺序保存在浏览器 localStorage，不会改这份文件
 * ============================================================ */
window.SITE = {
  storageKey: "gx.site.order.v1",
  home: "home",
  sections: [
    { id: "home", name: "首页", accent: "#2B7FD8" },
    { id: "nav", name: "导航", accent: "#FB7299" },
    { id: "download", name: "下载", accent: "#10B981" },
    /* 食谱入口暂时隐藏（不是删除）：
     * 取消下面这一行前面的 // 即可恢复；同时还要去掉 index.html 里
     * “分区四：食谱”那一段外层包住的 HTML 注释标记。 */
    // { id: "recipe", name: "食谱", accent: "#F59E0B" },
    { id: "minecraft", name: "Minecraft", accent: "#36D1DC" }
  ]
};
