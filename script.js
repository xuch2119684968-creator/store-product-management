/*
 * 前台商品查询逻辑
 * 后台保存的资料会存放在 localStorage；首次使用时从 data.json 读取初始数据。
 */
(function () {
  "use strict";

  var STORAGE_KEY = "price-query-system-data-v1";
  var ICONS = {
    "袜子": "🧦",
    "手套": "🧤",
    "帽子": "🧢",
    "内衣": "👚",
    "内裤": "🩲",
    "背心": "🎽",
    "瑜伽服": "🧘",
    "裤袜": "🧦",
    "保暖衣": "🧥",
    "保暖裤": "👖"
  };

  var state = {
    categories: [],
    products: []
  };

  var elements = {
    input: document.getElementById("searchInput"),
    clear: document.getElementById("clearSearch"),
    grid: document.getElementById("productGrid"),
    status: document.getElementById("statusMessage"),
    count: document.getElementById("resultCount"),
    title: document.getElementById("resultTitle"),
    keywords: document.getElementById("popularKeywords"),
    cardTemplate: document.getElementById("productCardTemplate")
  };

  function readLocalData() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!Array.isArray(data.products) || !Array.isArray(data.categories)) return null;
      return data;
    } catch (error) {
      console.warn("无法读取浏览器本地商品数据：", error);
      return null;
    }
  }

  function normalize(value) {
    return String(value || "")
      .toLocaleLowerCase()
      .replace(/\s+/g, "")
      .trim();
  }

  function formatPrice(value) {
    return "¥" + Number(value || 0).toFixed(2);
  }

  function getIcon(product) {
    if (product.image && product.image.indexOf("placeholder:") === 0) {
      return product.image.slice("placeholder:".length) || ICONS[product.category] || "🛍️";
    }
    return ICONS[product.category] || "🛍️";
  }

  function isImageUrl(value) {
    return /^(data:image\/|https?:\/\/)/i.test(String(value || ""));
  }

  function productMatches(product, query) {
    if (!query) return true;

    var searchableText = normalize(
      [
        product.name,
        product.category,
        product.remark,
        product.searchKeywords,
        product.pinyin
      ].join(" ")
    );
    var parts = String(query)
      .split(/\s+/)
      .map(normalize)
      .filter(Boolean);

    return parts.every(function (part) {
      return searchableText.indexOf(part) !== -1;
    });
  }

  function setStatus(message, isError) {
    elements.status.textContent = message;
    elements.status.hidden = !message;
    elements.status.classList.toggle("is-error", Boolean(isError));
  }

  function renderKeywordChips() {
    elements.keywords.replaceChildren();
    state.categories.slice(0, 9).forEach(function (category) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "keyword-chip";
      chip.textContent = category;
      chip.addEventListener("click", function () {
        elements.input.value = category;
        renderProducts();
        elements.input.focus();
      });
      elements.keywords.appendChild(chip);
    });
  }

  function makeProductCard(product) {
    var fragment = elements.cardTemplate.content.cloneNode(true);
    var image = fragment.querySelector("img");
    var placeholder = fragment.querySelector(".placeholder-icon");

    if (isImageUrl(product.image)) {
      image.src = product.image;
      image.alt = product.name;
      image.hidden = false;
      placeholder.hidden = true;
    } else {
      placeholder.textContent = getIcon(product);
    }

    fragment.querySelector(".category-tag").textContent = product.category || "未分类";
    fragment.querySelector(".product-id").textContent = product.id || "";
    fragment.querySelector(".product-name").textContent = product.name || "未命名商品";
    fragment.querySelector(".product-remark").textContent = product.remark || "暂无备注";
    fragment.querySelector(".product-price").textContent = formatPrice(product.price);
    return fragment;
  }

  function renderProducts() {
    var query = elements.input.value.trim();
    var results = state.products.filter(function (product) {
      return productMatches(product, query);
    });
    var title = query ? "“" + query + "” 的搜索结果" : "全部商品";

    elements.title.textContent = title;
    elements.count.textContent = "共 " + results.length + " 件商品";
    elements.clear.disabled = !query;
    elements.grid.replaceChildren();

    if (!results.length) {
      var empty = document.createElement("div");
      empty.className = "empty-state";
      empty.innerHTML = "<strong>没有找到相关商品</strong><br><span>可尝试输入商品名称、分类或拼音关键词。</span>";
      elements.grid.appendChild(empty);
      return;
    }

    var documentFragment = document.createDocumentFragment();
    results.forEach(function (product) {
      documentFragment.appendChild(makeProductCard(product));
    });
    elements.grid.appendChild(documentFragment);
  }

  async function loadData() {
    var localData = readLocalData();
    if (localData) {
      state = localData;
      setStatus("");
      renderKeywordChips();
      renderProducts();
      return;
    }

    try {
      var response = await fetch("data.json", { cache: "no-store" });
      if (!response.ok) throw new Error("HTTP " + response.status);
      var data = await response.json();
      if (!Array.isArray(data.products) || !Array.isArray(data.categories)) {
        throw new Error("data.json 的格式不正确");
      }
      state = data;
      setStatus("");
      renderKeywordChips();
      renderProducts();
    } catch (error) {
      console.error(error);
      setStatus(
        "商品数据加载失败。请使用本地静态服务器打开项目（例如 VS Code 的 Live Server），再刷新页面。",
        true
      );
      elements.count.textContent = "";
    }
  }

  elements.input.addEventListener("input", renderProducts);
  elements.clear.addEventListener("click", function () {
    elements.input.value = "";
    renderProducts();
    elements.input.focus();
  });

  window.addEventListener("storage", function (event) {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      var updated = JSON.parse(event.newValue);
      if (Array.isArray(updated.products) && Array.isArray(updated.categories)) {
        state = updated;
        renderKeywordChips();
        renderProducts();
      }
    } catch (error) {
      console.warn("同步后台数据失败：", error);
    }
  });

  loadData();
})();
