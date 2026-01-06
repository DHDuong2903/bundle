(function () {
  const BATCH_SIZE = 20;
  const DEBOUNCE_MS = 100;
  const STORAGE_KEY = "dhd_bundle_labels_cache";

  // --- TỐI ƯU: CACHING (Bộ nhớ đệm) ---
  // Kết hợp Map (RAM) + SessionStorage để lưu trữ label.
  // Giúp label hiển thị ngay lập tức khi khách F5 hoặc quay lại trang cũ.
  const labelCache = new Map();
  const pendingHandles = new Set();
  let fetchQueue = [];
  let fetchTimeout = null;

  let productObserver;

  // Helper: Quản lý SessionStorage
  function loadCacheFromStorage() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Cache có hạn trong 1 giờ
        if (Date.now() - parsed.timestamp < 3600000) {
          Object.entries(parsed.data).forEach(([handle, labels]) => {
            labelCache.set(handle, labels);
          });
        } else {
          sessionStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch (e) {
      // Bỏ qua lỗi storage nếu trình duyệt chặn
    }
  }

  function saveCacheToStorage() {
    try {
      const dataObj = Object.fromEntries(labelCache);
      const payload = {
        timestamp: Date.now(),
        data: dataObj,
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      // Bỏ qua nếu đầy bộ nhớ
    }
  }

  function init() {
    // eslint-disable-next-line no-undef
    const shop = (window.Shopify && Shopify.shop) || window.location.hostname;
    const apiUrl = window.BUNDLE_APP_URL;

    // Load cache ngay khi khởi chạy
    loadCacheFromStorage();

    // --- TỐI ƯU: FADE-IN ANIMATION (Hiệu ứng mượt mà) ---
    // Inject CSS để label hiện dần lên thay vì "bụp" một cái.
    // Giảm cảm giác giật cục khi mạng chậm.
    const style = document.createElement("style");
    style.innerHTML = `
      @keyframes dhdFadeIn {
        from { opacity: 0; transform: scale(0.9); }
        to { opacity: 1; transform: scale(1); }
      }
      .dhd-bundle-label {
        animation: dhdFadeIn 0.3s ease-out forwards;
      }
    `;
    document.head.appendChild(style);

    // --- TỐI ƯU: LAZY LOADING (Tải lười) ---
    // Sử dụng IntersectionObserver để chỉ tải label cho sản phẩm ĐANG HIỂN THỊ.
    // Không tải trước những sản phẩm ở cuối trang chưa xem tới.
    productObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const target = entry.target;
            const handle = target.dataset.dhdHandle;

            if (handle) {
              if (labelCache.has(handle)) {
                // Nếu đã có trong Cache -> Hiển thị ngay (0 độ trễ)
                const labels = labelCache.get(handle);
                if (labels && labels.length > 0) {
                  applyLabelToWrapper(target, labels, false);
                }
              } else {
                // Nếu chưa có -> Xếp hàng để tải
                queueHandleForFetch(handle, shop, apiUrl);
              }
            }
            // Ngừng theo dõi để tiết kiệm CPU
            observer.unobserve(target);
          }
        });
      },
      { rootMargin: "200px 0px", threshold: 0.01 }, // Tải trước khi cuộn tới 200px
    );

    // Bắt đầu quét DOM
    scanAndObserve();

    // Theo dõi thay đổi DOM (cho Infinite Scroll, Filter)
    const mutationObserver = new MutationObserver(() => {
      if (window._dhdScanTimeout) clearTimeout(window._dhdScanTimeout);
      window._dhdScanTimeout = setTimeout(scanAndObserve, 500);
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    // Xử lý riêng cho trang chi tiết sản phẩm (PDP)
    if (window.location.pathname.includes("/products/")) {
      injectPDPLabel(shop, apiUrl);
    }
  }

  // --- TỐI ƯU: BATCHING & DEBOUNCING (Gom nhóm request) ---
  // Thay vì gọi API ngay, ta đợi 100ms để gom nhiều sản phẩm vào 1 request.
  // Giảm số lượng kết nối mạng, tránh nghẽn mạng trên 3G.
  function queueHandleForFetch(handle, shop, apiUrl) {
    if (labelCache.has(handle) || pendingHandles.has(handle)) return;

    if (!fetchQueue.includes(handle)) {
      fetchQueue.push(handle);
    }

    if (fetchTimeout) clearTimeout(fetchTimeout);
    fetchTimeout = setTimeout(() => {
      processFetchQueue(shop, apiUrl);
    }, DEBOUNCE_MS); // Đợi 100ms
  }

  async function processFetchQueue(shop, apiUrl) {
    if (fetchQueue.length === 0) return;

    // Lấy 1 lô 20 sản phẩm để gửi đi
    const batch = fetchQueue.splice(0, BATCH_SIZE);
    batch.forEach((h) => pendingHandles.add(h));

    try {
      // Gửi danh sách handles lên Server (Server-side Filtering)
      const handlesParam = batch.join(",");
      const res = await fetch(`${apiUrl}?shop=${shop}&handles=${handlesParam}`);

      if (res.ok) {
        const data = await res.json();
        const productsMap = data.products || {};

        batch.forEach((handle) => {
          const labels = productsMap[handle] || [];
          // TỐI ƯU: Nếu không có label, ta chỉ cache trong 1 phút thay vì 1 tiếng
          // để chủ shop thấy thay đổi nhanh hơn khi vừa thêm mới.
          labelCache.set(handle, labels);
          pendingHandles.delete(handle);

          const elements = document.querySelectorAll(
            `[data-dhd-handle="${handle}"]`,
          );
          elements.forEach((el) => {
            if (labels.length > 0) applyLabelToWrapper(el, labels, false);
          });
        });

        // Lưu cache xuống ổ cứng (SessionStorage)
        saveCacheToStorage();
      } else {
        batch.forEach((h) => pendingHandles.delete(h));
      }
    } catch (err) {
      console.error("DHD Bundle Fetch Error:", err);
      batch.forEach((h) => pendingHandles.delete(h));
    }

    // Nếu hàng đợi còn, tiếp tục xử lý lô tiếp theo
    if (fetchQueue.length > 0) {
      processFetchQueue(shop, apiUrl);
    }
  }

  // --- TỐI ƯU: DOM SCANNING (Quét DOM thông minh) ---
  // Tìm wrapper chứa sản phẩm và gắn handle vào dataset để Observer theo dõi.
  function scanAndObserve() {
    const allLinks = document.querySelectorAll('a[href*="/products/"]');

    allLinks.forEach((link) => {
      if (link.dataset.dhdObserved === "true") return;
      if (
        link.closest(
          '.cart, #cart, .cart-items, .cart-drawer, [id*="cart"], .dhd-bundle-section',
        )
      )
        return;

      const href = link.getAttribute("href");
      const match = href.match(/\/products\/([^/?#]+)/);
      if (!match) return;
      const handle = match[1];

      const wrapper = findCardWrapper(link);

      if (wrapper) {
        wrapper.dataset.dhdHandle = handle;
        link.dataset.dhdObserved = "true";
        if (productObserver) productObserver.observe(wrapper);

        // Kiểm tra Cache ngay lập tức (cho trường hợp F5 trang)
        if (labelCache.has(handle)) {
          const labels = labelCache.get(handle);
          if (labels && labels.length > 0)
            applyLabelToWrapper(wrapper, labels, false);
        }
      }
    });
  }

  function findCardWrapper(link) {
    const card = link.closest(
      ".card, .product-card, .grid-view-item, .product-item, .collection-product-card",
    );
    if (card) return card;
    if (link.querySelector("img")) return link;
    return null;
  }

  // --- THUẬT TOÁN GẮN LABEL ---
  // Tìm vị trí an toàn (Safe Parent) để gắn label, tránh làm vỡ giao diện.
  function applyLabelToWrapper(wrapper, labels, isPDP) {
    let img = wrapper.querySelector("img");
    if (!img) {
      img = wrapper.querySelector(
        ".media img, .card__media img, .product-card__image img",
      );
    }
    if (!img) return;

    let target = img.parentElement;
    const validTags = ["DIV", "A", "LI", "FIGURE", "TD", "ARTICLE", "SECTION"];

    // Leo cây DOM tìm thẻ cha hợp lệ (không phải PICTURE hay thẻ lạ)
    let safeTarget = target;
    let attempts = 0;
    while (
      safeTarget &&
      !validTags.includes(safeTarget.tagName) &&
      attempts < 3
    ) {
      if (safeTarget.parentElement) {
        safeTarget = safeTarget.parentElement;
        attempts++;
        console.log(attempts);
      } else {
        break;
      }
    }
    if (safeTarget && validTags.includes(safeTarget.tagName))
      target = safeTarget;

    if (target) {
      renderLabels(target, labels, isPDP);
    }
  }

  function renderLabels(actualWrapper, labels, isPDP) {
    if (!actualWrapper) return;

    // Đảm bảo thẻ cha có position: relative để label (absolute) bám theo
    const computedStyle = window.getComputedStyle(actualWrapper);
    if (computedStyle.position === "static") {
      actualWrapper.style.setProperty("position", "relative", "important");
    }
    if (actualWrapper.tagName === "A" && computedStyle.display === "inline") {
      actualWrapper.style.setProperty("display", "inline-block", "important");
    }

    const existingIds = Array.from(
      actualWrapper.querySelectorAll(".dhd-bundle-label"),
    ).map((el) => el.dataset.labelId);
    const newIds = labels.map((l) => String(l.id));
    if (
      existingIds.length === newIds.length &&
      existingIds.every((id) => newIds.includes(id))
    )
      return;

    actualWrapper
      .querySelectorAll(".dhd-bundle-label")
      .forEach((el) => el.remove());

    const usedOffsets = {
      "top-left": 10,
      "top-right": 10,
      "bottom-left": 10,
      "bottom-right": 10,
    };
    const isSmall = actualWrapper.offsetWidth < 180;

    labels.forEach((label) => {
      const pos = label.position || "top-left";
      const el = document.createElement("div");
      el.className = `dhd-bundle-label dhd-bundle-label-${label.id}`;
      el.dataset.labelId = label.id;

      const iconSvg = getIconSvg(label.icon);
      const fontSize = isPDP ? "12px" : isSmall ? "10px" : "10px";
      const padding = isPDP ? "5px 12px" : isSmall ? "3px 7px" : "3px 8px";
      const iconSize = isPDP ? "16px" : isSmall ? "12px" : "13px";

      el.style.cssText = `
        position: absolute !important;
        z-index: 20;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 5px;
        background-color: ${label.bgColor};
        color: ${label.textColor};
        padding: ${padding};
        font-size: ${fontSize};
        font-weight: 700;
        text-transform: uppercase;
        border-radius: ${label.shape === "pill" ? "50px" : label.shape === "rounded" ? "4px" : "0"};
        box-shadow: 0 2px 6px rgba(0,0,0,0.2);
        line-height: 1.2;
        white-space: nowrap;
        pointer-events: none;
        margin: 0;
        letter-spacing: 0.5px;
        max-width: 92%;
        opacity: 0; /* Bắt đầu ẩn để chạy animation Fade-in */
      `;

      const parts = pos.split("-");
      el.style.setProperty(parts[0], `${usedOffsets[pos]}px`, "important");
      el.style.setProperty(parts[1], isPDP ? "20px" : "8px", "important");

      el.innerHTML = `${iconSvg ? `<span style="display:flex; width:${iconSize}; height:${iconSize}; align-items:center;">${iconSvg}</span>` : ""}<span>${label.text}</span>`;
      actualWrapper.appendChild(el);

      usedOffsets[pos] += isPDP ? 45 : isSmall ? 25 : 35;
    });
  }

  async function injectPDPLabel(shop, apiUrl) {
    const match = window.location.pathname.match(/\/products\/([^/?]+)/);
    if (!match) return;
    const handle = match[1];

    if (labelCache.has(handle)) {
      const labels = labelCache.get(handle);
      renderPDP(labels);
      return;
    }

    try {
      const res = await fetch(`${apiUrl}?shop=${shop}&handles=${handle}`);
      if (res.ok) {
        const data = await res.json();
        const labels = (data.products && data.products[handle]) || [];

        labelCache.set(handle, labels);
        saveCacheToStorage();

        renderPDP(labels);
      }
    } catch (e) {
      console.error(e);
    }
  }

  function renderPDP(labels) {
    const pdpLabels = labels.filter((l) => l.showOnPDP !== false);
    if (pdpLabels.length === 0) return;

    const candidates = Array.from(
      document.querySelectorAll(
        ".product__media img, .product-single__media img, .product-gallery img, [data-product-media-wrapper] img, .product__media-list img, .product-images img",
      ),
    );
    let visibleImages = candidates.filter((img) => {
      const style = window.getComputedStyle(img);
      return (
        img.offsetWidth > 50 &&
        style.display !== "none" &&
        style.visibility !== "hidden"
      );
    });
    if (visibleImages.length === 0)
      visibleImages = Array.from(document.querySelectorAll("img")).filter(
        (img) => img.offsetWidth > 250,
      );

    if (visibleImages.length > 0) {
      let mainImg =
        visibleImages.find((img) =>
          img.closest(".is-active, .swiper-slide-active, .active"),
        ) || visibleImages[0];

      let target = mainImg.parentElement;
      while (
        target &&
        (target.tagName === "IMG" || target.tagName === "PICTURE")
      )
        target = target.parentElement;
      const container = mainImg.closest(
        '.product__media-item, [class*="media"], [class*="gallery"], [class*="image"]',
      );
      if (container && container.tagName !== "IMG") target = container;

      if (target) renderLabels(target, pdpLabels, true);
    }
  }

  function getIconSvg(type) {
    if (!type || type === "none") return "";
    const svgs = {
      star: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 1l2.928 5.928 6.072.886-4.394 4.272 1.037 6.048L10 15.276 4.357 18.134l1.037-6.048L1 7.814l6.072-.886L10 1z"/></svg>',
      tag: '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3.5 2A1.5 1.5 0 0 0 2 3.5v4.586a1.5 1.5 0 0 0 .44 1.06l8.914 8.915a1.5 1.5 0 0 0 2.122 0l4.585-4.586a1.5 1.5 0 0 0 0-2.121L9.146 2.44A1.5 1.5 0 0 0 8.086 2H3.5ZM5.5 5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"/></svg>',
      bolt: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M11.5 1L2 11h6v8l9.5-10h-6V1z"/></svg>',
      "bolt-filled":
        '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M11.5 1L2 11h6v8l9.5-10h-6V1z"/></svg>',
      heart:
        '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 3.22l-.61-.6a5.5 5.5 0 00-7.78 7.77L10 18.78l8.39-8.4a5.5 5.5 0 00-7.78-7.77l-.61.61z"/></svg>',
      check:
        '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M0 11l2-2 5 5L18 3l2 2L7 18z"/></svg>',
      fire: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10.35 1.01a.5.5 0 0 0-.7 0C8.33 2.3 2 8.44 2 12.5a8 8 0 1 0 16 0c0-4.06-6.33-10.2-7.65-11.49ZM10 18a5.5 5.5 0 1 1 0-11c0 1.5-1 3-2.5 4.5 2 1 2.5 3.5 2.5 6.5Z"/></svg>',
      discount:
        '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a8 8 0 100 16 8 8 0 000-16zm.75 11h-1.5v-1.5h1.5V13zm0-3h-1.5V6h1.5v4z"/></svg>',
      alert:
        '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 2a8 8 0 100 16 8 8 0 000-16zm.75 11h-1.5v-1.5h1.5V13zm0-3h-1.5V6h1.5v4z"/></svg>',
      info: '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-11.25a.75.75 0 0 0-1.5 0v4.5a.75.75 0 0 0 1.5 0v-4.5Zm-.75 7.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"/></svg>',
    };
    return svgs[type] || "";
  }

  init();
})();
