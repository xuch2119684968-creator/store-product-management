/*
 * 后台管理逻辑
 * 静态网页不能直接覆盖服务器上的 data.json，所以编辑内容保存在 localStorage，
 * 并支持下载当前 JSON，方便手动替换 data.json 做长期备份。
 */
(function () {
  "use strict";

  var STORAGE_KEY = "price-query-system-data-v1";
  var MAX_IMAGE_SIZE = 2 * 1024 * 1024;
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

  var state = { categories: [], products: [] };
  var initialData = null;
  var currentImage = "";
  var toastTimer = null;

  var elements = {
    categoryList: document.getElementById("categoryList"),
    categoryCount: document.getElementById("categoryCount"),
    addCategoryForm: document.getElementById("addCategoryForm"),
    newCategory: document.getElementById("newCategoryInput"),
    tableBody: document.getElementById("productTableBody"),
    productCount: document.getElementById("productCount"),
    search: document.getElementById("adminSearchInput"),
    addProduct: document.getElementById("addProductButton"),
    resetData: document.getElementById("resetDataButton"),
    exportData: document.getElementById("exportDataButton"),
    modal: document.getElementById("productModal"),
    modalTitle: document.getElementById("modalTitle"),
    closeModal: document.getElementById("closeModalButton"),
    cancelModal: document.getElementById("cancelModalButton"),
    form: document.getElementById("productForm"),
    id: document.getElementById("productIdInput"),
    name: document.getElementById("productNameInput"),
    category: document.getElementById("productCategoryInput"),
    price: document.getElementById("productPriceInput"),
    keywords: document.getElementById("productKeywordsInput"),
    remark: document.getElementById("productRemarkInput"),
    imageInput: document.getElementById("productImageInput"),
    imagePreview: document.getElementById("imagePreviewImg"),
    imageIcon: document.getElementById("imagePreviewIcon"),
    clearImage: document.getElementById("clearImageButton"),
    toast: document.getElementById("toast")
  };

  function clone(data) {
    return JSON.parse(JSON.stringify(data));
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

  function isImageUrl(value) {
    return /^(data:image\/|https?:\/\/)/i.test(String(value || ""));
  }

  function getIcon(category, image) {
    if (String(image || "").indexOf("placeholder:") === 0) {
      return String(image).slice("placeholder:".length) || ICONS[category] || "🛍️";
    }
    return ICONS[category] || "🛍️";
  }

  function setPreview(image, category) {
    currentImage = image || "placeholder:" + (ICONS[category] || "🛍️");
    if (isImageUrl(currentImage)) {
      elements.imagePreview.src = currentImage;
      elements.imagePreview.hidden = false;
      elements.imageIcon.hidden = true;
    } else {
      elements.imagePreview.removeAttribute("src");
      elements.imagePreview.hidden = true;
      elements.imageIcon.hidden = false;
      elements.imageIcon.textContent = getIcon(category, currentImage);
    }
  }

  function showToast(message, type) {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.className = "toast " + (type || "");
    elements.toast.hidden = false;
    toastTimer = setTimeout(function () {
      elements.toast.hidden = true;
    }, 3000);
  }

  function readLocalData() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!Array.isArray(data.categories) || !Array.isArray(data.products)) return null;
      return data;
    } catch (error) {
      console.warn("无法读取本地数据：", error);
      return null;
    }
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      renderAll();
      return true;
    } catch (error) {
      console.error(error);
      showToast("保存失败：浏览器本地空间可能不足，请先下载 JSON 备份。", "error");
      return false;
    }
  }

  function productMatches(product, query) {
    if (!query) return true;
    var source = normalize(
      [
        product.name,
        product.category,
        product.remark,
        product.searchKeywords,
        product.pinyin
      ].join(" ")
    );
    return String(query)
      .split(/\s+/)
      .map(normalize)
      .filter(Boolean)
      .every(function (part) {
        return source.indexOf(part) !== -1;
      });
  }

  function createTextCell(row, value, className) {
    var cell = row.insertCell();
    if (className) cell.className = className;
    cell.textContent = value;
    return cell;
  }

  function createButton(label, action, id, className) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "action-button " + (className || "");
    button.textContent = label;
    button.dataset.action = action;
    button.dataset.id = id;
    return button;
  }

  function renderCategories() {
    elements.categoryList.replaceChildren();
    elements.categoryCount.textContent = state.categories.length + " 个";

    state.categories.forEach(function (category) {
      var item = document.createElement("span");
      item.className = "category-item";
      item.append(document.createTextNode(category));

      var productNumber = state.products.filter(function (product) {
        return product.category === category;
      }).length;
      var remove = document.createElement("button");
      remove.type = "button";
      remove.title = productNumber ? "该分类下还有商品，不能删除" : "删除分类";
      remove.textContent = "×";
      remove.disabled = productNumber > 0;
      remove.dataset.category = category;
      item.appendChild(remove);
      elements.categoryList.appendChild(item);
    });
  }

  function renderTable() {
    var query = elements.search.value.trim();
    var products = state.products.filter(function (product) {
      return productMatches(product, query);
    });
    elements.productCount.textContent = "共 " + state.products.length + " 件商品";
    elements.tableBody.replaceChildren();

    if (!products.length) {
      var emptyRow = document.createElement("tr");
      var emptyCell = document.createElement("td");
      emptyCell.colSpan = 5;
      emptyCell.className = "empty-table";
      emptyCell.textContent = query ? "没有匹配的商品" : "还没有商品，点击“新增商品”开始添加。";
      emptyRow.appendChild(emptyCell);
      elements.tableBody.appendChild(emptyRow);
      return;
    }

    products.forEach(function (product) {
      var row = document.createElement("tr");
      var productCell = row.insertCell();
      var productInfo = document.createElement("div");
      productInfo.className = "table-product";
      var thumbnail = document.createElement("div");
      thumbnail.className = "table-thumb";
      if (isImageUrl(product.image)) {
        var img = document.createElement("img");
        img.src = product.image;
        img.alt = "";
        thumbnail.appendChild(img);
      } else {
        thumbnail.textContent = getIcon(product.category, product.image);
      }
      var nameBox = document.createElement("span");
      var name = document.createElement("strong");
      name.textContent = product.name;
      var productId = document.createElement("small");
      productId.textContent = product.id;
      nameBox.append(name, productId);
      productInfo.append(thumbnail, nameBox);
      productCell.appendChild(productInfo);

      createTextCell(row, product.category || "未分类");
      createTextCell(row, formatPrice(product.price), "table-price");
      createTextCell(row, product.remark || "—");

      var actionCell = row.insertCell();
      var actions = document.createElement("div");
      actions.className = "table-actions";
      actions.append(
        createButton("编辑", "edit", product.id),
        createButton("删除", "delete", product.id, "delete")
      );
      actionCell.appendChild(actions);
      elements.tableBody.appendChild(row);
    });
  }

  function renderAll() {
    renderCategories();
    renderTable();
  }

  function populateCategorySelect(selectedCategory) {
    elements.category.replaceChildren();
    state.categories.forEach(function (category) {
      var option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      option.selected = category === selectedCategory;
      elements.category.appendChild(option);
    });
  }

  function openModal(product) {
    var isEditing = Boolean(product);
    elements.form.reset();
    elements.imageInput.value = "";
    elements.id.value = isEditing ? product.id : "";
    elements.name.value = isEditing ? product.name : "";
    elements.price.value = isEditing ? Number(product.price).toFixed(2) : "";
    elements.keywords.value = isEditing ? product.searchKeywords || product.pinyin || "" : "";
    elements.remark.value = isEditing ? product.remark || "" : "";
    populateCategorySelect(isEditing ? product.category : state.categories[0]);
    setPreview(isEditing ? product.image : "", elements.category.value);
    elements.modalTitle.textContent = isEditing ? "编辑商品" : "新增商品";
    elements.modal.hidden = false;
    document.body.style.overflow = "hidden";
    setTimeout(function () {
      elements.name.focus();
    }, 20);
  }

  function closeModal() {
    elements.modal.hidden = true;
    document.body.style.overflow = "";
  }

  function generateId() {
    var id;
    do {
      id = "P" + Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
    } while (
      state.products.some(function (product) {
        return product.id === id;
      })
    );
    return id;
  }

  function handleProductSubmit(event) {
    event.preventDefault();
    var name = elements.name.value.trim();
    var category = elements.category.value;
    var price = Number(elements.price.value);

    if (!name || !category || !Number.isFinite(price) || price < 0) {
      showToast("请填写正确的商品名称、分类和售价。", "error");
      return;
    }

    var product = {
      id: elements.id.value || generateId(),
      name: name,
      category: category,
      price: Math.round(price * 100) / 100,
      image: currentImage || "placeholder:" + (ICONS[category] || "🛍️"),
      remark: elements.remark.value.trim(),
      searchKeywords: elements.keywords.value.trim()
    };
    var index = state.products.findIndex(function (item) {
      return item.id === product.id;
    });

    if (index === -1) {
      state.products.unshift(product);
    } else {
      state.products[index] = product;
    }

    if (persist()) {
      closeModal();
      showToast(index === -1 ? "商品已新增。" : "商品已更新。", "success");
    }
  }

  function deleteProduct(id) {
    var product = state.products.find(function (item) {
      return item.id === id;
    });
    if (!product) return;
    if (!window.confirm("确定删除“" + product.name + "”吗？此操作无法撤销。")) return;
    state.products = state.products.filter(function (item) {
      return item.id !== id;
    });
    if (persist()) showToast("商品已删除。", "success");
  }

  function addCategory(event) {
    event.preventDefault();
    var category = elements.newCategory.value.trim();
    if (!category) return;
    if (
      state.categories.some(function (item) {
        return item === category;
      })
    ) {
      showToast("该分类已存在。", "error");
      return;
    }
    state.categories.push(category);
    elements.newCategory.value = "";
    if (persist()) showToast("新分类已添加。", "success");
  }

  function removeCategory(category) {
    if (
      state.products.some(function (product) {
        return product.category === category;
      })
    ) {
      showToast("该分类下仍有商品，请先修改或删除这些商品。", "error");
      return;
    }
    if (!window.confirm("删除分类“" + category + "”吗？")) return;
    state.categories = state.categories.filter(function (item) {
      return item !== category;
    });
    if (persist()) showToast("分类已删除。", "success");
  }

  function handleImageUpload(event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type.match(/^image\//)) {
      showToast("请选择图片文件。", "error");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      showToast("图片不能超过 2MB。", "error");
      event.target.value = "";
      return;
    }
    var reader = new FileReader();
    reader.onload = function (loadEvent) {
      setPreview(loadEvent.target.result, elements.category.value);
    };
    reader.onerror = function () {
      showToast("图片读取失败，请重新选择。", "error");
    };
    reader.readAsDataURL(file);
  }

  function exportData() {
    var blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json;charset=utf-8"
    });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "data-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
    showToast("JSON 文件已下载。", "success");
  }

  async function loadData() {
    try {
      var response = await fetch("data.json", { cache: "no-store" });
      if (!response.ok) throw new Error("HTTP " + response.status);
      var data = await response.json();
      if (!Array.isArray(data.categories) || !Array.isArray(data.products)) {
        throw new Error("data.json 格式错误");
      }
      initialData = clone(data);
      state = readLocalData() || clone(initialData);
      renderAll();
    } catch (error) {
      console.error(error);
      var row = document.createElement("tr");
      var cell = document.createElement("td");
      cell.colSpan = 5;
      cell.className = "empty-table";
      cell.textContent = "无法读取 data.json。请通过本地静态服务器打开本项目后重试。";
      row.appendChild(cell);
      elements.tableBody.replaceChildren(row);
      showToast("数据加载失败。", "error");
    }
  }

  elements.addProduct.addEventListener("click", function () {
    if (!state.categories.length) {
      showToast("请先新增一个商品分类。", "error");
      return;
    }
    openModal(null);
  });
  elements.closeModal.addEventListener("click", closeModal);
  elements.cancelModal.addEventListener("click", closeModal);
  elements.form.addEventListener("submit", handleProductSubmit);
  elements.addCategoryForm.addEventListener("submit", addCategory);
  elements.search.addEventListener("input", renderTable);
  elements.imageInput.addEventListener("change", handleImageUpload);
  elements.clearImage.addEventListener("click", function () {
    elements.imageInput.value = "";
    setPreview("", elements.category.value);
  });
  elements.category.addEventListener("change", function () {
    if (!isImageUrl(currentImage)) setPreview("", elements.category.value);
  });
  elements.exportData.addEventListener("click", exportData);
  elements.resetData.addEventListener("click", function () {
    if (!initialData) return;
    if (!window.confirm("恢复为 data.json 的初始 50 条测试商品？当前本地修改会被覆盖。")) return;
    state = clone(initialData);
    if (persist()) showToast("已恢复初始测试数据。", "success");
  });

  elements.categoryList.addEventListener("click", function (event) {
    var button = event.target.closest("button[data-category]");
    if (button && !button.disabled) removeCategory(button.dataset.category);
  });
  elements.tableBody.addEventListener("click", function (event) {
    var button = event.target.closest("button[data-action]");
    if (!button) return;
    var product = state.products.find(function (item) {
      return item.id === button.dataset.id;
    });
    if (button.dataset.action === "edit" && product) openModal(product);
    if (button.dataset.action === "delete") deleteProduct(button.dataset.id);
  });
  elements.modal.addEventListener("click", function (event) {
    if (event.target === elements.modal) closeModal();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !elements.modal.hidden) closeModal();
  });

  loadData();
})();
