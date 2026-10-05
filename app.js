/*
============================================================
JS AQUA STATIC CATALOGUE
============================================================

Field names used:

order
id
name
category
details
size
rate
avail
images
heroes

Availability rule:

Number   = available count (1-3 = Low Stock badge)
"0"      = hidden
"cs"     = Coming Soon
============================================================
*/

/* =========================================================
   CONFIG
========================================================= */

/* Your WhatsApp number — country code + number, no + or spaces.
   Example Maldives: "9607777777"
   Leave as "" to hide WhatsApp buttons during testing. */
const SHOP_WHATSAPP = "9507589958";

/* Currency label used in the cart total */
const CURRENCY = "MVR";

/* Unique key used to store the cart in the browser */
const CART_KEY = "jsaqua-cart";


/* =========================================================
   LOAD JSON
========================================================= */

const CATALOG_URL = "catalog.json";

let catalog = [];

let selectedCategory = "all";

let searchTerm = "";

/* Cart state: { "F001": { id, name, rate, img, qty }, ... } */
let cart = loadCart();


/* =========================================================
   HTML ELEMENTS
========================================================= */

const grid = document.getElementById("catalogGrid");

const statusMessage = document.getElementById("statusMessage");

const categoryBar = document.getElementById("categoryBar");

const searchPanel = document.getElementById("searchPanel");

const searchInput = document.getElementById("searchInput");

const modal = document.getElementById("productModal");

const modalImages = document.getElementById("modalImages");

const galleryPrev = document.getElementById("galleryPrev");

const galleryNext = document.getElementById("galleryNext");

const galleryDots = document.getElementById("galleryDots");

const addToCartButton = document.getElementById("addToCartButton");

const whatsappButton = document.getElementById("whatsappButton");

const cartButton = document.getElementById("cartButton");

const cartCount = document.getElementById("cartCount");

const cartDrawer = document.getElementById("cartDrawer");

const cartItems = document.getElementById("cartItems");

const cartTotal = document.getElementById("cartTotal");

const cartWhatsappButton = document.getElementById("cartWhatsappButton");

/* Currently open product (for the modal) */
let currentItem = null;

/* Gallery state for the modal */
let galleryIndex = 0;


/* =========================================================
   AVAILABILITY HELPERS
========================================================= */

function isComingSoon(item) {

  return String(item.avail).trim().toLowerCase() === "cs";

}


function getQuantity(item) {

  if (isComingSoon(item)) return null;

  const q = Number(item.avail);

  if (!Number.isFinite(q)) return 0;

  return Math.max(0, q);

}


function isVisible(item) {

  if (isComingSoon(item)) return true;

  return getQuantity(item) > 0;

}


function getAvailability(item) {

  if (isComingSoon(item)) {

    return { label: "Coming Soon", className: "coming" };

  }

  const q = getQuantity(item);

  if (q <= 0) return null;

  if (q <= 3) {

    return { label: `Low Stock · ${q} left`, className: "low" };

  }

  return { label: `${q} available`, className: "available" };

}


/* =========================================================
   IMAGE HELPERS
========================================================= */

function getMainImage(item) {

  if (Array.isArray(item.heroes) && item.heroes.length > 0) {

    return item.heroes[0];

  }

  if (Array.isArray(item.images) && item.images.length > 0) {

    return item.images[0];

  }

  return "";

}


function getAllImages(item) {

  const images = [

    ...(Array.isArray(item.images) ? item.images : []),

    ...(Array.isArray(item.heroes) ? item.heroes : [])

  ];

  return [...new Set(images.filter(Boolean))];

}


/* =========================================================
   CATEGORIES
========================================================= */

function createCategories() {

  const categories = [

    ...new Set(

      catalog

        .filter(isVisible)

        .map(item => item.category)

        .filter(Boolean)

    )

  ];

  categoryBar.innerHTML = `

    <button class="category-button active" data-category="all">All</button>

    ${categories.map(category => `

      <button class="category-button" data-category="${escapeHtml(category)}">

        ${escapeHtml(category)}

      </button>

    `).join("")}

  `;

  categoryBar.querySelectorAll(".category-button").forEach(button => {

    button.addEventListener("click", () => {

      selectedCategory = button.dataset.category;

      categoryBar.querySelectorAll(".category-button").forEach(btn =>

        btn.classList.remove("active")

      );

      button.classList.add("active");

      renderProducts();

    });

  });

}


/* =========================================================
   RENDER PRODUCTS
========================================================= */

function renderProducts() {

  const visibleItems = catalog.filter(isVisible);

  const filtered = visibleItems.filter(item => {

    const categoryMatch =

      selectedCategory === "all"

      ||

      String(item.category || "").toLowerCase() === selectedCategory.toLowerCase();

    const searchableText = [

      item.id,

      item.name,

      item.category,

      item.details,

      item.size,

      item.rate

    ].join(" ").toLowerCase();

    const searchMatch = !searchTerm || searchableText.includes(searchTerm);

    return categoryMatch && searchMatch;

  });

  if (filtered.length === 0) {

    grid.innerHTML = "";

    statusMessage.textContent = "No products found.";

    statusMessage.classList.remove("hidden");

    return;

  }

  statusMessage.classList.add("hidden");

  filtered.sort((a, b) =>

    Number(a.order || 999999) - Number(b.order || 999999)

  );

  grid.innerHTML = filtered.map(item => {

    const availability = getAvailability(item);

    return `

      <article class="product-card" data-id="${escapeHtml(item.id)}">

        <div class="product-image-wrap">

          <img
            class="product-image"
            src="${escapeAttribute(getMainImage(item))}"
            alt="${escapeAttribute(item.name || "")}"
            loading="lazy"
          >

          <span class="availability-badge ${availability.className}">

            ${escapeHtml(availability.label)}

          </span>

        </div>

        <div class="product-info">

          <div class="product-name">

            ${escapeHtml(item.name || "")}

          </div>

          <div class="product-details">

            ${escapeHtml(item.details || "")}

          </div>

          <div class="product-bottom">

            <span class="product-price">

              ${escapeHtml(item.rate || "")}

            </span>

            <span class="product-size">

              ${escapeHtml(item.size || "")}

            </span>

          </div>

        </div>

      </article>

    `;

  }).join("");

  grid.querySelectorAll(".product-card").forEach(card => {

    card.addEventListener("click", () => {

      const item = catalog.find(

        product => String(product.id) === String(card.dataset.id)

      );

      if (item) openProduct(item);

    });

  });

}


/* =========================================================
   OPEN PRODUCT
========================================================= */

function openProduct(item) {

  currentItem = item;

  galleryIndex = 0;

  document.getElementById("modalCategory").textContent = item.category || "";

  document.getElementById("modalName").textContent = item.name || "";

  document.getElementById("modalSize").textContent = item.size || "";

  document.getElementById("modalId").textContent = item.id ? `ID: ${item.id}` : "";

  document.getElementById("modalRate").textContent = item.rate || "";

  document.getElementById("modalDetails").textContent = item.details || "";

  const availability = getAvailability(item);

  document.getElementById("modalAvailability").textContent =
    availability ? availability.label : "";

  renderGallery();

  /* WhatsApp single item */
  if (SHOP_WHATSAPP) {

    whatsappButton.href = buildSingleWhatsAppUrl(item);

    whatsappButton.classList.remove("hidden");

  } else {

    whatsappButton.classList.add("hidden");

  }

  /* Add to cart */
  updateAddToCartButton();

  addToCartButton.disabled = item.avail === "0" || isComingSoon(item);

  /* Show */
  modal.classList.remove("hidden");

  document.body.style.overflow = "hidden";

}


/* =========================================================
   CLOSE PRODUCT
========================================================= */

function closeProduct() {

  modal.classList.add("hidden");

  document.body.style.overflow = "";

  currentItem = null;

}


/* =========================================================
   GALLERY
========================================================= */

function renderGallery() {

  if (!currentItem) return;

  const images = getAllImages(currentItem);

  if (images.length === 0) {

    modalImages.innerHTML = "";

    galleryPrev.classList.add("hidden");

    galleryNext.classList.add("hidden");

    galleryDots.classList.add("hidden");

    return;

  }

  modalImages.innerHTML = images.map(src => `

    <img
      src="${escapeAttribute(src)}"
      alt="${escapeAttribute(currentItem.name || "")}"
      loading="lazy"
    >

  `).join("");

  /* Arrows + dots only when more than one photo */
  if (images.length > 1) {

    galleryPrev.classList.remove("hidden");

    galleryNext.classList.remove("hidden");

    galleryDots.classList.remove("hidden");

    galleryDots.innerHTML = images.map((_, i) => `

      <span class="gallery-dot ${i === galleryIndex ? "active" : ""}"></span>

    `).join("");

    scrollGalleryToIndex();

  } else {

    galleryPrev.classList.add("hidden");

    galleryNext.classList.add("hidden");

    galleryDots.classList.add("hidden");

  }

  galleryIndex = Math.min(galleryIndex, images.length - 1);

}


function scrollGalleryToIndex() {

  const width = modalImages.clientWidth;

  modalImages.scrollTo({ left: width * galleryIndex, behavior: "smooth" });

  updateDots();

}


function updateDots() {

  galleryDots.querySelectorAll(".gallery-dot").forEach((dot, i) => {

    dot.classList.toggle("active", i === galleryIndex);

  });

}


function galleryStep(delta) {

  if (!currentItem) return;

  const images = getAllImages(currentItem);

  if (images.length < 2) return;

  galleryIndex = (galleryIndex + delta + images.length) % images.length;

  scrollGalleryToIndex();

}


/* Detect manual scroll in gallery */

modalImages.addEventListener("scroll", () => {

  const width = modalImages.clientWidth;

  if (width <= 0) return;

  const newIndex = Math.round(modalImages.scrollLeft / width);

  if (newIndex !== galleryIndex) {

    galleryIndex = newIndex;

    updateDots();

  }

});


galleryPrev.addEventListener("click", () => galleryStep(-1));

galleryNext.addEventListener("click", () => galleryStep(1));


/* =========================================================
   CART STORAGE
========================================================= */

function loadCart() {

  try {

    return JSON.parse(localStorage.getItem(CART_KEY) || "{}");

  } catch (e) {

    return {};

  }

}


function saveCart() {

  try {

    localStorage.setItem(CART_KEY, JSON.stringify(cart));

  } catch (e) {}

}


/* =========================================================
   CART ACTIONS
========================================================= */

function addToCart(item) {

  if (!item.id) return;

  if (!cart[item.id]) {

    cart[item.id] = {

      id: item.id,

      name: item.name || "",

      rate: item.rate || "",

      img: getMainImage(item),

      qty: 1

    };

  } else {

    cart[item.id].qty += 1;

  }

  saveCart();

  renderCart();

  updateAddToCartButton();

}


function removeFromCart(id) {

  delete cart[id];

  saveCart();

  renderCart();

  updateAddToCartButton();

}


function setCartQty(id, delta) {

  if (!cart[id]) return;

  cart[id].qty += delta;

  if (cart[id].qty <= 0) delete cart[id];

  saveCart();

  renderCart();

  updateAddToCartButton();

}


function getCartCount() {

  return Object.keys(cart).reduce((sum, key) => sum + cart[key].qty, 0);

}


function getCartTotal() {

  let total = 0;

  let allNumeric = true;

  Object.values(cart).forEach(item => {

    const num = parseFloat(String(item.rate).replace(/[^0-9.]/g, ""));

    if (!Number.isFinite(num)) {

      allNumeric = false;

      return;

    }

    total += num * item.qty;

  });

  return { total, allNumeric };

}


function updateAddToCartButton() {

  if (!currentItem) return;

  const inCart = cart[currentItem.id];

  if (inCart) {

    addToCartButton.textContent = `In Cart · ${inCart.qty}`;

    addToCartButton.classList.add("added");

  } else {

    addToCartButton.textContent = "Add to Cart";

    addToCartButton.classList.remove("added");

  }

}


/* =========================================================
   RENDER CART DRAWER
========================================================= */

function renderCart() {

  const count = getCartCount();

  cartCount.textContent = count;

  cartCount.style.display = count ? "flex" : "none";

  const entries = Object.keys(cart).map(k => [k, cart[k]]);

  if (entries.length === 0) {

    cartItems.innerHTML = `<div class="cart-empty">

      Your cart is empty.<br>Tap any fish to add it.

    </div>`;

    cartTotal.textContent = "—";

    cartWhatsappButton.classList.add("hidden");

    return;

  }

  cartItems.innerHTML = entries.map(([id, item]) => `

    <div class="cart-item" data-id="${escapeHtml(id)}">

      <img src="${escapeAttribute(item.img || "")}" alt="">

      <div class="cart-item-info">

        <div class="cart-item-name">${escapeHtml(item.name)}</div>

        <div class="cart-item-rate">${escapeHtml(item.rate)}</div>

        <div class="cart-qty">

          <button class="qty-button" data-action="minus" data-id="${escapeHtml(id)}">−</button>

          <span class="qty-value">${item.qty}</span>

          <button class="qty-button" data-action="plus" data-id="${escapeHtml(id)}">+</button>

        </div>

      </div>

      <button class="cart-remove" data-id="${escapeHtml(id)}">Remove</button>

    </div>

  `).join("");

  /* Wire up quantity buttons */

  cartItems.querySelectorAll(".qty-button").forEach(btn => {

    btn.addEventListener("click", () => {

      const id = btn.dataset.id;

      const action = btn.dataset.action;

      setCartQty(id, action === "plus" ? 1 : -1);

    });

  });

  cartItems.querySelectorAll(".cart-remove").forEach(btn => {

    btn.addEventListener("click", () => {

      removeFromCart(btn.dataset.id);

    });

  });

  /* Total */

  const { total, allNumeric } = getCartTotal();

  cartTotal.textContent = allNumeric

    ? `${CURRENCY} ${total.toFixed(2)}`

    : "—";

  /* WhatsApp cart message */

  if (SHOP_WHATSAPP) {

    cartWhatsappButton.href = buildCartWhatsAppUrl();

    cartWhatsappButton.classList.remove("hidden");

  } else {

    cartWhatsappButton.classList.add("hidden");

  }

}


/* =========================================================
   CART DRAWER OPEN / CLOSE
========================================================= */

function openCart() {

  renderCart();

  cartDrawer.classList.remove("hidden");

  document.body.style.overflow = "hidden";

}


function closeCart() {

  cartDrawer.classList.add("hidden");

  document.body.style.overflow = "";

}


/* =========================================================
   WHATSAPP MESSAGES
========================================================= */

function buildSingleWhatsAppUrl(item) {

  const lines = [

    "Hi JS AQUA, I'd like to order:",

    `${item.name}${item.id ? " (ID: " + item.id + ")" : ""}`,

    item.size ? `Size: ${item.size}` : "",

    item.rate ? `Rate: ${item.rate}` : ""

  ].filter(Boolean);

  return `https://wa.me/${SHOP_WHATSAPP}?text=${encodeURIComponent(lines.join("\n"))}`;

}


function buildCartWhatsAppUrl() {

  const lines = ["JS AQUA Order", ""];

  Object.values(cart).forEach(item => {

    lines.push(`${item.name}${item.id ? " (ID: " + item.id + ")" : ""}`);

    lines.push(`Qty: ${item.qty} — Rate: ${item.rate}`);

    lines.push("");

  });

  const { total, allNumeric } = getCartTotal();

  if (allNumeric) lines.push(`Total: ${CURRENCY} ${total.toFixed(2)}`);

  lines.push("");

  lines.push("Please confirm availability and delivery.");

  return `https://wa.me/${SHOP_WHATSAPP}?text=${encodeURIComponent(lines.join("\n"))}`;

}


/* =========================================================
   EVENT LISTENERS
========================================================= */

/* Search */

document.getElementById("searchButton").addEventListener("click", () => {

  searchPanel.classList.toggle("hidden");

  if (!searchPanel.classList.contains("hidden")) searchInput.focus();

});


searchInput.addEventListener("input", event => {

  searchTerm = event.target.value.trim().toLowerCase();

  renderProducts();

});


/* Modal close */

document.getElementById("closeModal").addEventListener("click", closeProduct);


document.getElementById("modalBackdrop").addEventListener("click", closeProduct);


/* Add to cart */

addToCartButton.addEventListener("click", () => {

  if (currentItem) addToCart(currentItem);

});


/* Cart open / close */

cartButton.addEventListener("click", openCart);


document.getElementById("closeCart").addEventListener("click", closeCart);


document.getElementById("cartBackdrop").addEventListener("click", closeCart);


/* Keyboard */

document.addEventListener("keydown", event => {

  if (event.key === "Escape") {

    closeProduct();

    closeCart();

  }

  if (event.key === "ArrowLeft") galleryStep(-1);

  if (event.key === "ArrowRight") galleryStep(1);

});


/* =========================================================
   ESCAPE HELPERS
========================================================= */

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


/* =========================================================
   LOAD CATALOG
========================================================= */

async function loadCatalog() {

  try {

    const response = await fetch(`${CATALOG_URL}?v=${Date.now()}`);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    catalog = await response.json();

    if (!Array.isArray(catalog)) {

      throw new Error("catalog.json must contain an array");

    }

    createCategories();

    renderProducts();

    renderCart();

  } catch (error) {

    console.error(error);

    statusMessage.textContent = "Could not load catalog.json.";

  }

}


/* =========================================================
   START
========================================================= */

loadCatalog();