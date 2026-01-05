(function () {
  let bundleData = {};

  // Biến global cho Lazy Observer
  let lazyObserver;

  async function init() {
    console.log("DHD Bundle: Start Engine V5 (Optimized)");
    // eslint-disable-next-line no-undef
    const shop = (window.Shopify && Shopify.shop) || window.location.hostname;
    const apiUrl = window.BUNDLE_APP_URL || "/apps/dhdbundle";

    // Khởi tạo IntersectionObserver một lần duy nhất
    lazyObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const target = entry.target;
                const labels = target._dhdLabels;
                if (labels) {
                    console.log("⚡ Lazy Loading Label for visible element:", target);
                    applyLabelToTarget(target, labels, false);
                }
                // Xử lý xong thì ngừng theo dõi để tiết kiệm resource
                observer.unobserve(target);
                target._dhdLabels = null; // Clear data reference
            }
        });
    }, {
        rootMargin: "200px 0px", // Load trước khi scroll tới 200px
        threshold: 0.01
    });

    try {
      const res = await fetch(`${apiUrl}?shop=${shop}`);
      if (!res.ok) throw new Error("API Proxy Error");
      const data = await res.json();
      bundleData = data.products || {};

      console.group("DHD Bundle: Data Loaded");
      console.log("Shop Domain:", shop);
      console.log(
        "Total Products with Labels:",
        Object.keys(bundleData).length,
      );
      console.log("Full Data Object:", bundleData);

      // Hiển thị bảng tóm tắt các sản phẩm và số lượng label của chúng
      const summary = Object.entries(bundleData).map(([handle, labels]) => ({
        "Product Handle": handle,
        "Labels Count": labels.length,
        "Labels Text": labels.map((l) => l.text).join(", "),
      }));
      if (summary.length > 0) {
        console.table(summary);
      }
      console.groupEnd();

      runEngine();
      observe();
    } catch (e) {
      console.error("DHD Bundle Init Error:", e);
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

  function runEngine() {
    scanAllProducts();
    if (window.location.pathname.includes("/products/")) {
      setTimeout(injectPDPLabel, 500);
      setTimeout(injectPDPLabel, 2000);
    }
  }

  function scanAllProducts() {
    // Chỉ chọn những link CHƯA được xử lý (tối ưu phần 3: Caching)
    // Nhưng để đếm được cached thì ta query hết và check thủ công
    const allLinks = document.querySelectorAll('a[href*="/products/"]');
    let newCount = 0;
    let skippedCount = 0;

    allLinks.forEach((link) => {
      // Check Cache
      if (link.dataset.dhdProcessed === "true") {
          skippedCount++;
          return;
      }

      // Mark as processed
      link.dataset.dhdProcessed = "true";
      newCount++;

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

      if (bundleData[handle]) {
        const labels = bundleData[handle].filter(
          (l) => l.showOnCollection !== false,
        );
        if (labels.length > 0) queueForProcessing(handle, link, labels);
      }
    });

    if (newCount > 0) {
        console.log(`🚀 Scan Report: Found ${newCount} new items, Skipped ${skippedCount} cached items.`);
    }
  }

  // Hàm thay thế cho findImageAndApply cũ, hỗ trợ Lazy Loading
  function queueForProcessing(handle, link, labels) {
    let img = link.querySelector("img");

    // 2. Nếu không có (ví dụ link overlay full card), tìm ảnh xung quanh
    if (!img) {
      // Tìm trong card cha gần nhất
      const card = link.closest(
        ".card, .product-card, .grid-view-item, .product-item, .collection-product-card",
      );
      if (card) {
        // Ưu tiên ảnh trong các container media chuẩn của Shopify
        img =
          card.querySelector(
            ".media img, .card__media img, .product-card__image img",
          ) || card.querySelector("img");
      }
    }

    if (!img) {
      // console.log(`DHD Bundle: No image found for ${handle}`);
      return;
    }

    // 3. Tìm thẻ cha hợp lệ (ưu tiên DIV, A, FIGURE, LI)
    let target = img.parentElement;

    // Bỏ qua các thẻ chỉ mang tính chất wrap ảnh đơn thuần hoặc thẻ inline yếu
    while (
      target &&
      (target.tagName === "IMG" || target.tagName === "PICTURE")
    ) {
      target = target.parentElement;
    }

    // Cố gắng tìm một container "vững chắc" hơn nếu thẻ hiện tại là thẻ lạ
    let safeTarget = target;
    let attempts = 0;
    const validTags = [
      "DIV",
      "A",
      "LI",
      "FIGURE",
      "TD",
      "ARTICLE",
      "SECTION",
    ];

    while (
      safeTarget &&
      !validTags.includes(safeTarget.tagName) &&
      attempts < 3
    ) {
      if (safeTarget.parentElement) {
        safeTarget = safeTarget.parentElement;
        attempts++;
      } else {
        break;
      }
    }

    if (safeTarget && validTags.includes(safeTarget.tagName)) {
      target = safeTarget;
    }

    if (!target) return;

    // Tối ưu phần 4: Lazy Loading
    // Thay vì gắn label ngay, ta gửi target cho Observer theo dõi
    // Lưu data vào property của element để dùng sau
    target._dhdLabels = labels;
    if (lazyObserver) {
        lazyObserver.observe(target);
    } else {
        // Fallback nếu trình duyệt quá cổ không có IntersectionObserver
        applyLabelToTarget(target, labels, false);
    }
  }

  function injectPDPLabel() {
    const match = window.location.pathname.match(/\/products\/([^/?]+)/);
    if (!match) return;
    const handle = match[1];
    const labels = bundleData[handle];
    if (!labels) return;

    const pdpLabels = labels.filter((l) => l.showOnPDP !== false);
    if (pdpLabels.length === 0) return;

    // Tìm tất cả ảnh tiềm năng trong khu vực media sản phẩm
    const candidates = Array.from(
      document.querySelectorAll(
        ".product__media img, .product-single__media img, .product-gallery img, [data-product-media-wrapper] img, .product__media-list img, .product-images img",
      ),
    );

    // Lọc những ảnh thực sự đang hiển thị (Visible)
    // offsetWidth > 0 check xem element có chiếm diện tích không (loại display:none)
    // check visibility style để loại element bị ẩn nhưng vẫn chiếm chỗ
    let visibleImages = candidates.filter((img) => {
      const style = window.getComputedStyle(img);
      return (
        img.offsetWidth > 50 &&
        img.offsetHeight > 50 &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0"
      );
    });

    // Nếu không tìm thấy bằng class chuẩn, fallback về tìm toàn trang
    if (visibleImages.length === 0) {
      visibleImages = Array.from(document.querySelectorAll("img")).filter(
        (img) => img.offsetWidth > 250,
      );
    }

    if (visibleImages.length === 0) return;

    // Chiến thuật chọn ảnh Main:
    // 1. Ưu tiên ảnh đang được Active (trong slider/gallery)
    let mainImg = visibleImages.find((img) =>
      img.closest(
        ".is-active, .swiper-slide-active, .product__media-item--variant-active, .active",
      ),
    );

    // 2. Nếu không thấy active, chọn ảnh hiển thị đầu tiên trong danh sách (thường là ảnh đại diện)
    // Tránh việc sort theo size vì ảnh Zoom ẩn thường to nhất
    if (!mainImg) {
      mainImg = visibleImages[0];
    }

    // Tìm target để gắn label
    let target = mainImg.parentElement;
    while (
      target &&
      (target.tagName === "IMG" || target.tagName === "PICTURE")
    ) {
      target = target.parentElement;
    }

    const container = mainImg.closest(
      '.product__media-item, [class*="media"], [class*="gallery"], [class*="image"]',
    );
    if (container && container.tagName !== "IMG") target = container;

    if (target) {
      console.log(`DHD Bundle: PDP Target found for ${handle}`, target);
      applyLabelToTarget(target, pdpLabels, true);
    }
  }

  function applyLabelToTarget(wrapper, labels, isPDP = false) {
    if (!wrapper || wrapper.tagName === "IMG" || wrapper.tagName === "PICTURE")
      return;

    // Xử lý display: contents (thường gặp ở thẻ picture hoặc theme mới)
    // Thẻ có display: contents không tạo ra box nên không chứa được absolute
    let actualWrapper = wrapper;
    let computedStyle = window.getComputedStyle(actualWrapper);
    
    if (computedStyle.display === "contents") {
        console.warn("DHD Bundle: Wrapper has display: contents. Climbing up one level.", actualWrapper);
        actualWrapper = actualWrapper.parentElement;
        computedStyle = window.getComputedStyle(actualWrapper);
    }

    console.groupCollapsed(`DHD Bundle: Injecting to ${actualWrapper.tagName} (${isPDP ? 'PDP' : 'Listing'})`);
    console.log("Target Wrapper:", actualWrapper);
    console.log("Dimensions:", actualWrapper.offsetWidth, "x", actualWrapper.offsetHeight);
    console.log("Computed Position:", computedStyle.position);
    console.log("Computed Display:", computedStyle.display);

    if (actualWrapper.style.position !== "relative" && computedStyle.position === "static") {
      console.log("-> Force position: relative");
      actualWrapper.style.setProperty("position", "relative", "important");
    }
    
    if (actualWrapper.tagName === "A" && computedStyle.display === "inline") {
        console.log("-> Force display: inline-block for Link tag");
        actualWrapper.style.setProperty("display", "inline-block", "important");
    }

    const existingIds = Array.from(
      actualWrapper.querySelectorAll(".dhd-bundle-label"),
    ).map((el) => el.dataset.labelId);
    const newIds = labels.map((l) => String(l.id));
    if (
      existingIds.length === newIds.length &&
      existingIds.every((id) => newIds.includes(id))
    ) {
      console.log("-> Labels already exist. Skipping.");
      console.groupEnd();
      return;
    }

    actualWrapper.querySelectorAll(".dhd-bundle-label").forEach((el) => el.remove());

    const usedOffsets = {
      "top-left": 10,
      "top-right": 10,
      "bottom-left": 10,
      "bottom-right": 10,
    };
    const isSmall = actualWrapper.offsetWidth < 180;

    labels.forEach((label) => {
      console.log(`-> Adding label [${label.text}] at [${label.position}]`);
      const pos = label.position || "top-left";
      const el = document.createElement("div");
      el.className = `dhd-bundle-label dhd-bundle-label-${label.id}`;
      el.dataset.labelId = label.id;

      const iconSvg = getIconSvg(label.icon);
      const fontSize = isPDP ? "12px" : isSmall ? "10px" : "10px";
      const padding = isPDP ? "5px 12px" : isSmall ? "3px 7px" : "3px 8px";
      const iconSize = isPDP ? "16px" : isSmall ? "12px" : "13px";

      // Sử dụng setProperty !important cho các thuộc tính quan trọng
      el.style.setProperty("position", "absolute", "important");
      el.style.setProperty("z-index", "999999", "important");
      el.style.setProperty("display", "flex", "important");
      el.style.setProperty("align-items", "center", "important");
      el.style.setProperty("justify-content", "center", "important");
      el.style.setProperty("opacity", "1", "important");
      el.style.setProperty("visibility", "visible", "important");
      el.style.setProperty("pointer-events", "none", "important");
      
      Object.assign(el.style, {
        gap: "5px",
        backgroundColor: label.bgColor,
        color: label.textColor,
        padding: padding,
        fontSize: fontSize,
        fontWeight: "700",
        textTransform: "uppercase",
        borderRadius:
          label.shape === "pill"
            ? "50px"
            : label.shape === "rounded"
              ? "4px"
              : "0",
        boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
        lineHeight: "1.2",
        whiteSpace: "nowrap",
        fontFamily: "inherit",
        boxSizing: "border-box",
        width: "fit-content",
        maxWidth: "92%",
        margin: "0",
        letterSpacing: "0.5px",
      });

      const parts = pos.split("-");
      el.style.setProperty(parts[0], `${usedOffsets[pos]}px`, "important");
      el.style.setProperty(parts[1], isPDP ? "20px" : "8px", "important");

      el.innerHTML = `${iconSvg ? `<span style="display:flex; width:${iconSize}; height:${iconSize}; align-items:center;">${iconSvg}</span>` : ""}<span>${label.text}</span>`;

      actualWrapper.appendChild(el);
      usedOffsets[pos] += isPDP ? 45 : isSmall ? 25 : 35;
    });
  }

  function observe() {
    let timeout;
    const observer = new MutationObserver(() => {
      clearTimeout(timeout);
      timeout = setTimeout(runEngine, 600);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  init();
})();
