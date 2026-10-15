/*
============================================================
JS AQUA STATIC CATALOGUE
============================================================

Files:
  index.html
  style.css
  app.js
  catalog.json

Catalogue fields:
  order, id, name, category, details, size,
  rate, avail, images, heroes

Availability:
  Number > 3  = Available
  Number 1–3  = Low Stock
  Number 0    = Hidden
  "cs"        = Coming Soon
============================================================
*/

/* =========================
   CONFIGURATION
   ========================= */

const SHOP_WHATSAPP = "9607589958";
const CURRENCY = "MVR";
const CART_KEY = "jsaqua-cart";
const CATALOG_URL = "catalog.json";

/* =========================
   STATE
   ========================= */

let catalog = [];
let selectedCategory = "all";
let searchTerm = "";
let cart = loadCart();
let currentItem = null;
let galleryIndex = 0;

/* =========================
   HTML ELEMENTS
   ========================= */

const grid = document.getElementById("catalogGrid");
const statusMessage = document.getElementById("statusMessage");
const categoryBar = document.getElementById("categoryBar");

const searchButton = document.getElementById("searchButton");
const searchPanel = document.getElementById("searchPanel");
const searchInput = document.getElementById("searchInput");

const modal = document.getElementById("productModal");
const modalImages = document.getElementById("modalImages");
const galleryPrev = document.getElementById("galleryPrev");
const galleryNext = document.getElementById("galleryNext");
const galleryDots = document.getElementById("galleryDots");

const addToCartButton = document.getElementById("addToCartButton");
const whatsappButton = document.getElementById("whatsappButton");

const cartDrawer = document.getElementById("cartDrawer");
const cartItems = document.getElementById("cartItems");
const cartTotal = document.getElementById("cartTotal");
const cartWhatsappButton = document.getElementById("cartWhatsappButton");

const headerCartButton = document.getElementById("headerCartButton");
const headerCartCount = document.getElementById("headerCartCount");

/* =========================
   PRICE FORMAT
   ========================= */

function formatPrice(rate) {
  const value = String(rate ?? "").trim();

  if (!value) return "Price on request";

  const number = value.replace(/[^0-9.]/g, "");

  if (!number) return value;

  return `${CURRENCY} ${number}/-`;
}

function getNumericPrice(rate) {
  const value = String(rate ?? "").trim();

  if (!value) return null;

  const cleaned = value.replace(/[^0-9.]/g, "");

  if (!cleaned) return null;

  const number = Number(cleaned);

  return Number.isFinite(number) ? number : null;
}

/* =========================
   AVAILABILITY
   ========================= */

function isComingSoon(item) {
  return String(item.avail ?? "").trim().toLowerCase() === "cs";
}

function getQuantity(item) {
  if (isComingSoon(item)) return null;

  const quantity = Number(item.avail);

  if (!Number.isFinite(quantity)) return 0;

  return Math.max(0, quantity);
}

function isVisible(item) {
  if (isComingSoon(item)) return true;

  return getQuantity(item) > 0;
}

function getAvailability(item) {
  if (isComingSoon(item)) {
    return {
      label: "Coming Soon",
      className: "coming"
    };
  }

  const quantity = getQuantity(item);

  if (quantity <= 0) return null;

  if (quantity <= 3) {
    return {
      label: "Low Stock",
      className: "low"
    };
  }

  return {
    label: "Available",
    className: "available"
  };
}

/* =========================
   IMAGE HELPERS
   ========================= */

function getMainImage(item) {
  if (Array.isArray(item.heroes) && item.heroes.length) {
    return item.heroes[0];
  }

  if (Array.isArray(item.images) && item.images.length) {
    return item.images[0];
  }

  return "";
}

function getAllImages(item) {
  const images = [
    ...(Array.isArray(item.images) ? item.images : []),
    ...(Array.isArray(item.heroes) ? item.heroes : [])
  ];

  return [...new Set(
    images.filter(src => typeof src === "string" && src.trim())
  )];
}

/* =========================
   SAFE HTML HELPERS
   ========================= */

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

/* Only allow normal web image links */

function safeImageUrl(value) {
  const src = String(value ?? "").trim();

  if (!src) return "";

  try {
    const url = new URL(src, window.location.href);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return "";
    }

    return url.href;
  } catch (error) {
    return "";
  }
}

/* =========================
   WHATSAPP LINKS
   ========================= */

function buildSingleWhatsAppUrl(item) {
  const lines = [
    "Hi JS AQUA, I'd like to order:",
    `${item.name || "Fish"}${item.id ? ` (ID: ${item.id})` : ""}`,
    item.size ? `Size: ${item.size}` : "",
    item.rate ? `Rate: ${formatPrice(item.rate)}` : "",
    "",
    "Please confirm availability and delivery."
  ].filter(line => line !== "");

  return `https://wa.me/${SHOP_WHATSAPP}?text=${
    encodeURIComponent(lines.join("\n"))
  }`;
}

function buildCartWhatsAppUrl() {
  const lines = [
    "Hi JS AQUA, I'd like to place an order.",
    ""
  ];

  Object.values(cart).forEach(item => {
    lines.push(
      `${item.name}${item.id ? ` (ID: ${item.id})` : ""}`
    );

    lines.push(`Quantity: ${item.qty}`);
    lines.push(`Rate: ${formatPrice(item.rate)}`);

    const price = getNumericPrice(item.rate);

    if (price !== null) {
      lines.push(
        `Subtotal: ${CURRENCY} ${(price * item.qty).toFixed(2)}/-`
      );
    }

    lines.push("");
  });

  const total = getCartTotal();

  if (total.allNumeric) {
    lines.push(`Estimated total: ${CURRENCY} ${total.total.toFixed(2)}/-`);
  } else {
    lines.push("Please confirm the total price.");
  }

  lines.push("");
  lines.push("Please confirm availability and delivery.");

  return `https://wa.me/${SHOP_WHATSAPP}?text=${
    encodeURIComponent(lines.join("\n"))
  }`;
}

/* =========================
   CATEGORY FILTERS
   ========================= */

function createCategories() {
  const categories = [
    ...new Set(
      catalog
        .filter(isVisible)
        .map(item => String(item.category ?? "").trim())
        .filter(Boolean)
    )
  ];

  categoryBar.innerHTML = `
    <button
      class="category-button ${selectedCategory === "all" ? "active" : ""}"
      data-category="all"
      type="button">
      All
    </button>

    ${categories.map(category => `
      <button
        class="category-button ${
          selectedCategory.toLowerCase() === category.toLowerCase()
            ? "active"
            : ""
        }"
        data-category="${escapeAttribute(category)}"
        type="button">
        ${escapeHtml(category)}
      </button>
    `).join("")}
  `;

  categoryBar.querySelectorAll(".category-button").forEach(button => {
    button.addEventListener("click", () => {
      selectedCategory = button.dataset.category || "all";

      categoryBar.querySelectorAll(".category-button").forEach(btn => {
        btn.classList.toggle("active", btn === button);
      });

      renderProducts();
    });
  });
}

/* =========================
   RENDER PRODUCTS
   ========================= */

function renderProducts() {
  const filtered = catalog
    .filter(isVisible)
    .filter(item => {
      const categoryMatch =
        selectedCategory === "all" ||
        String(item.category ?? "").toLowerCase() ===
          selectedCategory.toLowerCase();

      const searchableText = [
        item.id,
        item.name,
        item.category,
        item.details,
        item.size,
        item.rate
      ].join(" ").toLowerCase();

      const searchMatch = searchableText.includes(searchTerm);

      return categoryMatch && searchMatch;
    })
    .sort((a, b) =>
      Number(a.order || 999999) - Number(b.order || 999999)
    );

  if (!filtered.length) {
    grid.innerHTML = "";

    statusMessage.textContent = catalog.length
      ? "No products found."
      : "No products are available yet.";

    statusMessage.classList.remove("hidden");
    return;
  }

  statusMessage.classList.add("hidden");

  grid.innerHTML = filtered.map(item => {
    const id = String(item.id ?? "");
    const availability = getAvailability(item);
    const image = safeImageUrl(getMainImage(item));
    const comingSoon = isComingSoon(item);
    const inCart = cart[id];

    return `
      <article class="product-card" data-id="${escapeAttribute(id)}">

        <div
          class="product-image-wrap"
          data-open-product="${escapeAttribute(id)}"
          role="button"
          tabindex="0"
          aria-label="View ${escapeAttribute(item.name || "product")}">

          ${
            image
              ? `<img
                   class="product-image"
                   src="${escapeAttribute(image)}"
                   alt="${escapeAttribute(item.name || "")}"
                   loading="lazy"
                 >`
              : `<div class="image-placeholder">Image unavailable</div>`
          }

          ${
            availability
              ? `<span class="availability-badge ${availability.className}">
                   ${escapeHtml(availability.label)}
                 </span>`
              : ""
          }
        </div>

        <div class="product-info">

          <div class="product-name">
            ${escapeHtml(item.name || "Unnamed product")}
          </div>

          <div class="product-price">
            ${escapeHtml(formatPrice(item.rate))}
          </div>

          <div class="product-actions">

            <a
              class="product-action product-whatsapp"
              href="${escapeAttribute(buildSingleWhatsAppUrl(item))}"
              target="_blank"
              rel="noopener noreferrer">
              WhatsApp
            </a>

            <button
              class="product-action product-add ${inCart ? "added" : ""}"
              data-add-product="${escapeAttribute(id)}"
              type="button"
              ${comingSoon ? "disabled" : ""}>
              ${
                comingSoon
                  ? "Coming Soon"
                  : inCart
                    ? `In Cart (${inCart.qty})`
                    : "Add to Cart"
              }
            </button>

          </div>
        </div>
      </article>
    `;
  }).join("");

  /* Open the product popup when the image is tapped */

  grid.querySelectorAll("[data-open-product]").forEach(element => {
    const open = () => {
      const item = findProduct(element.dataset.openProduct);
      if (item) openProduct(item);
    };

    element.addEventListener("click", open);

    element.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
  });

  /* Add products to cart */

  grid.querySelectorAll("[data-add-product]").forEach(button => {
    button.addEventListener("click", () => {
      const item = findProduct(button.dataset.addProduct);

      if (!item || isComingSoon(item)) return;

      addToCart(item);
    });
  });
}

function findProduct(id) {
  return catalog.find(item => String(item.id) === String(id));
}

/* =========================
   OPEN PRODUCT POPUP
   ========================= */

function openProduct(item) {
  currentItem = item;
  galleryIndex = 0;

  document.getElementById("modalCategory").textContent =
    item.category || "";

  document.getElementById("modalName").textContent =
    item.name || "Unnamed product";

  document.getElementById("modalSize").textContent =
    item.size ? `Size: ${item.size}` : "";

  document.getElementById("modalId").textContent =
    item.id ? `ID: ${item.id}` : "";

  document.getElementById("modalRate").textContent =
    formatPrice(item.rate);

  document.getElementById("modalDetails").textContent =
    item.details || "No additional details available.";

  const availability = getAvailability(item);

  document.getElementById("modalAvailability").textContent =
    availability ? availability.label : "";

  renderGallery();

  whatsappButton.href = buildSingleWhatsAppUrl(item);

  addToCartButton.disabled = isComingSoon(item);
  updateAddToCartButton();

  modal.classList.remove("hidden");
  document.body.classList.add("no-scroll");
}

function closeProduct() {
  modal.classList.add("hidden");
  currentItem = null;
  updateBodyScroll();
}

function updateBodyScroll() {
  const productOpen = !modal.classList.contains("hidden");
  const cartOpen = !cartDrawer.classList.contains("hidden");

  document.body.classList.toggle(
    "no-scroll",
    productOpen || cartOpen
  );
}

/* =========================
   IMAGE GALLERY
   ========================= */

function renderGallery() {
  if (!currentItem) return;

  const images = getAllImages(currentItem)
    .map(safeImageUrl)
    .filter(Boolean);

  if (!images.length) {
    modalImages.innerHTML = `
      <div class="image-placeholder">
        Image unavailable
      </div>
    `;

    galleryPrev.classList.add("hidden");
    galleryNext.classList.add("hidden");
    galleryDots.classList.add("hidden");
    return;
  }

  modalImages.innerHTML = images.map((src, index) => `
    <img
      src="${escapeAttribute(src)}"
      alt="${escapeAttribute(currentItem.name || "Product image")} ${index + 1}"
      ${index === 0 ? 'fetchpriority="high"' : 'loading="lazy"'}
    >
  `).join("");

  galleryIndex = Math.min(galleryIndex, images.length - 1);

  if (images.length > 1) {
    galleryPrev.classList.remove("hidden");
    galleryNext.classList.remove("hidden");
    galleryDots.classList.remove("hidden");

    galleryDots.innerHTML = images.map((_, index) => `
      <span
        class="gallery-dot ${index === galleryIndex ? "active" : ""}">
      </span>
    `).join("");

    scrollGalleryToIndex(false);
  } else {
    galleryPrev.classList.add("hidden");
    galleryNext.classList.add("hidden");
    galleryDots.classList.add("hidden");
    galleryDots.innerHTML = "";
  }
}

function scrollGalleryToIndex(smooth = true) {
  const width = modalImages.clientWidth;

  if (!width) return;

  modalImages.scrollTo({
    left: width * galleryIndex,
    behavior: smooth ? "smooth" : "auto"
  });

  updateGalleryDots();
}

function updateGalleryDots() {
  galleryDots.querySelectorAll(".gallery-dot").forEach((dot, index) => {
    dot.classList.toggle("active", index === galleryIndex);
  });
}

function galleryStep(direction) {
  if (!currentItem) return;

  const images = getAllImages(currentItem).map(safeImageUrl).filter(Boolean);

  if (images.length < 2) return;

  galleryIndex =
    (galleryIndex + direction + images.length) % images.length;

  scrollGalleryToIndex();
}

let galleryScrollTimeout;

modalImages.addEventListener("scroll", () => {
  const width = modalImages.clientWidth;

  if (!width) return;

  window.clearTimeout(galleryScrollTimeout);

  galleryScrollTimeout = window.setTimeout(() => {
    const index = Math.round(modalImages.scrollLeft / width);
    galleryIndex = Math.max(0, index);
    updateGalleryDots();
  }, 80);
});

galleryPrev.addEventListener("click", () => galleryStep(-1));
galleryNext.addEventListener("click", () => galleryStep(1));

/* =========================
   CART STORAGE
   ========================= */

function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_KEY) || "{}");

    if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
      return {};
    }

    Object.keys(saved).forEach(id => {
      const item = saved[id];

      if (
        !item ||
        !Number.isFinite(Number(item.qty)) ||
        Number(item.qty) < 1
      ) {
        delete saved[id];
        return;
      }

      item.qty = Math.floor(Number(item.qty));
    });

    return saved;
  } catch (error) {
    return {};
  }
}

function saveCart() {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  } catch (error) {
    console.warn("Could not save cart in this browser.", error);
  }
}

/* =========================
   CART ACTIONS
   ========================= */

function addToCart(item) {
  if (!item || !item.id || isComingSoon(item)) return;

  const id = String(item.id);

  if (!cart[id]) {
    cart[id] = {
      id,
      name: item.name || "",
      rate: item.rate || "",
      img: getMainImage(item),
      qty: 1
    };
  } else {
    cart[id].qty += 1;

    /* Refresh product information if it has changed */

    cart[id].name = item.name || cart[id].name;
    cart[id].rate = item.rate || cart[id].rate;
    cart[id].img = getMainImage(item) || cart[id].img;
  }

  saveCart();
  renderProducts();
  renderCart();
  updateAddToCartButton();
}

function removeFromCart(id) {
  delete cart[id];

  saveCart();
  renderProducts();
  renderCart();
  updateAddToCartButton();
}

function setCartQty(id, change) {
  if (!cart[id]) return;

  cart[id].qty += change;

  if (cart[id].qty <= 0) {
    delete cart[id];
  }

  saveCart();
  renderProducts();
  renderCart();
  updateAddToCartButton();
}

function getCartCount() {
  return Object.values(cart).reduce(
    (sum, item) => sum + Number(item.qty || 0),
    0
  );
}

function getCartTotal() {
  let total = 0;
  let allNumeric = true;

  Object.values(cart).forEach(item => {
    const price = getNumericPrice(item.rate);

    if (price === null) {
      allNumeric = false;
      return;
    }

    total += price * item.qty;
  });

  return { total, allNumeric };
}

function updateAddToCartButton() {
  if (!currentItem) return;

  const inCart = cart[String(currentItem.id)];

  if (isComingSoon(currentItem)) {
    addToCartButton.textContent = "Coming Soon";
    addToCartButton.disabled = true;
    addToCartButton.classList.remove("added");
    return;
  }

  addToCartButton.disabled = false;

  if (inCart) {
    addToCartButton.textContent = `In Cart · ${inCart.qty}`;
    addToCartButton.classList.add("added");
  } else {
    addToCartButton.textContent = "Add to Cart";
    addToCartButton.classList.remove("added");
  }
}

/* =========================
   RENDER CART
   ========================= */

function renderCart() {
  const count = getCartCount();

  headerCartCount.textContent = count;
  headerCartCount.classList.toggle("hidden", count === 0);

  const entries = Object.entries(cart);

  if (!entries.length) {
    cartItems.innerHTML = `
      <div class="cart-empty">
        Your cart is empty.<br>
        Browse the catalogue and add your favourite fish.
      </div>
    `;

    cartTotal.textContent = "—";
    cartWhatsappButton.classList.add("hidden");
    return;
  }

  cartItems.innerHTML = entries.map(([id, item]) => {
    const image = safeImageUrl(item.img);

    return `
      <div class="cart-item" data-id="${escapeAttribute(id)}">

        ${
          image
            ? `<img
                 src="${escapeAttribute(image)}"
                 alt="${escapeAttribute(item.name)}"
                 loading="lazy"
               >`
            : `<div class="cart-item-image-placeholder"></div>`
        }

        <div class="cart-item-info">
          <div class="cart-item-name">
            ${escapeHtml(item.name)}
          </div>

          <div class="cart-item-rate">
            ${escapeHtml(formatPrice(item.rate))}
          </div>

          <div class="cart-qty">
            <button
              class="qty-button"
              data-action="minus"
              data-id="${escapeAttribute(id)}"
              type="button"
              aria-label="Decrease quantity">
              −
            </button>

            <span class="qty-value">${item.qty}</span>

            <button
              class="qty-button"
              data-action="plus"
              data-id="${escapeAttribute(id)}"
              type="button"
              aria-label="Increase quantity">
              +
            </button>
          </div>
        </div>

        <button
          class="cart-remove"
          data-remove-id="${escapeAttribute(id)}"
          type="button">
          Remove
        </button>

      </div>
    `;
  }).join("");

  cartItems.querySelectorAll("[data-action]").forEach(button => {
    button.addEventListener("click", () => {
      const change = button.dataset.action === "plus" ? 1 : -1;
      setCartQty(button.dataset.id, change);
    });
  });

  cartItems.querySelectorAll("[data-remove-id]").forEach(button => {
    button.addEventListener("click", () => {
      removeFromCart(button.dataset.removeId);
    });
  });

  const result = getCartTotal();

  cartTotal.textContent = result.allNumeric
    ? `${CURRENCY} ${result.total.toFixed(2)}/-`
    : "Please confirm";

  cartWhatsappButton.href = buildCartWhatsAppUrl();
  cartWhatsappButton.classList.remove("hidden");
}

/* =========================
   OPEN / CLOSE CART
   ========================= */

function openCart() {
  renderCart();

  cartDrawer.classList.remove("hidden");
  updateBodyScroll();
}

function closeCart() {
  cartDrawer.classList.add("hidden");
  updateBodyScroll();
}

/* =========================
   EVENT LISTENERS
   ========================= */

searchButton.addEventListener("click", () => {
  searchPanel.classList.toggle("hidden");

  if (!searchPanel.classList.contains("hidden")) {
    searchInput.focus();
  }
});

searchInput.addEventListener("input", event => {
  searchTerm = event.target.value.trim().toLowerCase();
  renderProducts();
});

headerCartButton.addEventListener("click", openCart);

document.getElementById("closeModal").addEventListener(
  "click",
  closeProduct
);

document.getElementById("modalBackdrop").addEventListener(
  "click",
  closeProduct
);

addToCartButton.addEventListener("click", () => {
  if (currentItem) addToCart(currentItem);
});

document.getElementById("closeCart").addEventListener(
  "click",
  closeCart
);

document.getElementById("cartBackdrop").addEventListener(
  "click",
  closeCart
);

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeProduct();
    closeCart();
  }

  if (!modal.classList.contains("hidden")) {
    if (event.key === "ArrowLeft") galleryStep(-1);
    if (event.key === "ArrowRight") galleryStep(1);
  }
});

/* =========================
   LOAD CATALOGUE
   ========================= */

async function loadCatalog() {
  statusMessage.textContent = "Loading catalogue...";
  statusMessage.classList.remove("hidden");

  try {
    const response = await fetch(
      `${CATALOG_URL}?v=${Date.now()}`
    );

    if (!response.ok) {
      throw new Error(`Could not load catalogue: HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("catalog.json must contain a JSON array.");
    }

    catalog = data.filter(item => item && typeof item === "object");

    /* Remove cart entries for products that no longer exist */

    const validIds = new Set(catalog.map(item => String(item.id)));

    Object.keys(cart).forEach(id => {
      if (!validIds.has(id)) delete cart[id];
    });

    saveCart();

    createCategories();
    renderProducts();
    renderCart();

  } catch (error) {
    console.error("JS AQUA catalogue error:", error);

    grid.innerHTML = "";

    statusMessage.textContent =
      "Could not load the catalogue. Please check catalog.json and try again.";

    statusMessage.classList.remove("hidden");
  }
}

/* =========================
   START
   ========================= */

loadCatalog();
