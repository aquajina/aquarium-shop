/*
============================================================
JS AQUA STATIC CATALOGUE
============================================================

Your catalog.json is NOT changed.

Existing field names:

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

AVAILABILITY RULE:

Number:
    10  = 10 available
    4   = 4 available
    3   = Low Stock
    2   = Low Stock
    1   = Low Stock

0:
    Product is hidden

"cs":
    Coming Soon

============================================================
*/


/* =========================================================
   LOAD JSON
========================================================= */

const CATALOG_URL = "catalog.json";


let catalog = [];

let selectedCategory = "all";

let searchTerm = "";


/* =========================================================
   HTML ELEMENTS
========================================================= */

const grid =
  document.getElementById("catalogGrid");

const statusMessage =
  document.getElementById("statusMessage");

const categoryBar =
  document.getElementById("categoryBar");

const searchPanel =
  document.getElementById("searchPanel");

const searchInput =
  document.getElementById("searchInput");

const modal =
  document.getElementById("productModal");


/* =========================================================
   CHECK COMING SOON
========================================================= */

function isComingSoon(item) {

  return String(item.avail)
    .trim()
    .toLowerCase() === "cs";

}


/* =========================================================
   GET QUANTITY
========================================================= */

function getQuantity(item) {

  if (isComingSoon(item)) {

    return null;

  }


  const quantity =
    Number(item.avail);


  if (!Number.isFinite(quantity)) {

    return 0;

  }


  return Math.max(0, quantity);

}


/* =========================================================
   SHOULD PRODUCT SHOW?
========================================================= */

function isVisible(item) {

  /*
  "cs" = Coming Soon
  */

  if (isComingSoon(item)) {

    return true;

  }


  /*
  0 = don't show
  */

  return getQuantity(item) > 0;

}


/* =========================================================
   AVAILABILITY TEXT
========================================================= */

function getAvailability(item) {


  /*
  COMING SOON
  */

  if (isComingSoon(item)) {

    return {

      label: "Coming Soon",

      className: "coming"

    };

  }


  const quantity =
    getQuantity(item);


  /*
  ZERO = HIDDEN
  */

  if (quantity <= 0) {

    return null;

  }


  /*
  1–3 = LOW STOCK
  */

  if (quantity <= 3) {

    return {

      label:
        `Low Stock · ${quantity} left`,

      className: "low"

    };

  }


  /*
  4+ = AVAILABLE
  */

  return {

    label:
      `${quantity} available`,

    className: "available"

  };

}


/* =========================================================
   MAIN IMAGE
========================================================= */

function getMainImage(item) {


  /*
  Use heroes first
  */

  if (
    Array.isArray(item.heroes) &&
    item.heroes.length > 0
  ) {

    return item.heroes[0];

  }


  /*
  Otherwise use images
  */

  if (
    Array.isArray(item.images) &&
    item.images.length > 0
  ) {

    return item.images[0];

  }


  return "";

}


/* =========================================================
   ALL PRODUCT IMAGES
========================================================= */

function getAllImages(item) {


  const images = [

    ...(Array.isArray(item.images)
      ? item.images
      : []),

    ...(Array.isArray(item.heroes)
      ? item.heroes
      : [])

  ];


  /*
  Remove duplicate URLs
  */

  return [
    ...new Set(
      images.filter(Boolean)
    )
  ];

}


/* =========================================================
   CREATE CATEGORY BUTTONS
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

    <button
      class="category-button active"
      data-category="all">

      All

    </button>

    ${categories.map(category => `

      <button
        class="category-button"
        data-category="${escapeHtml(category)}">

        ${escapeHtml(category)}

      </button>

    `).join("")}

  `;


  /*
  Category button events
  */

  categoryBar
    .querySelectorAll(".category-button")
    .forEach(button => {


      button.addEventListener(
        "click",
        () => {


          selectedCategory =
            button.dataset.category;


          categoryBar
            .querySelectorAll(
              ".category-button"
            )
            .forEach(btn =>
              btn.classList.remove("active")
            );


          button.classList.add("active");


          renderProducts();

        }
      );

    });

}


/* =========================================================
   DISPLAY PRODUCTS
========================================================= */

function renderProducts() {


  /*
  First remove products with avail = 0
  */

  const visibleItems =
    catalog.filter(isVisible);


  /*
  Apply category and search
  */

  const filtered =
    visibleItems.filter(item => {


      const categoryMatch =

        selectedCategory === "all"

        ||

        String(item.category || "")
          .toLowerCase()

          ===

        selectedCategory.toLowerCase();


      const searchableText = [

        item.id,

        item.name,

        item.category,

        item.details,

        item.size,

        item.rate

      ]
        .join(" ")
        .toLowerCase();


      const searchMatch =

        !searchTerm

        ||

        searchableText.includes(
          searchTerm
        );


      return (
        categoryMatch &&
        searchMatch
      );

    });


  /*
  Nothing found
  */

  if (filtered.length === 0) {

    grid.innerHTML = "";

    statusMessage.textContent =
      "No products found.";

    statusMessage.classList.remove(
      "hidden"
    );

    return;

  }


  statusMessage.classList.add(
    "hidden"
  );


  /*
  Sort using your existing "order"
  */

  filtered.sort(
    (a, b) =>
      Number(a.order || 999999)
      -
      Number(b.order || 999999)
  );


  /*
  Create product cards
  */

  grid.innerHTML =

    filtered.map(item => {


      const availability =
        getAvailability(item);


      return `

        <article
          class="product-card"
          data-id="${escapeHtml(item.id)}">


          <div class="product-image-wrap">


            <img

              class="product-image"

              src="${escapeAttribute(
                getMainImage(item)
              )}"

              alt="${escapeAttribute(
                item.name || ""
              )}"

              loading="lazy"

            >


            <span
              class="
                availability-badge
                ${availability.className}
              ">

              ${escapeHtml(
                availability.label
              )}

            </span>


          </div>


          <div class="product-info">


            <div class="product-name">

              ${escapeHtml(
                item.name || ""
              )}

            </div>


            <div class="product-details">

              ${escapeHtml(
                item.details || ""
              )}

            </div>


            <div class="product-bottom">


              <span class="product-price">

                ${escapeHtml(
                  item.rate || ""
                )}

              </span>


              <span class="product-size">

                ${escapeHtml(
                  item.size || ""
                )}

              </span>


            </div>


          </div>


        </article>

      `;

    }).join("");


  /*
  Click product
  */

  grid
    .querySelectorAll(".product-card")
    .forEach(card => {


      card.addEventListener(
        "click",
        () => {


          const item =
            catalog.find(
              product =>
                String(product.id)
                ===
                String(card.dataset.id)
            );


          if (item) {

            openProduct(item);

          }

        }
      );

    });

}


/* =========================================================
   OPEN PRODUCT
========================================================= */

function openProduct(item) {


  document.getElementById(
    "modalCategory"
  ).textContent =
    item.category || "";


  document.getElementById(
    "modalName"
  ).textContent =
    item.name || "";


  document.getElementById(
    "modalSize"
  ).textContent =
    item.size || "";


  document.getElementById(
    "modalId"
  ).textContent =
    item.id
      ? `ID: ${item.id}`
      : "";


  document.getElementById(
    "modalRate"
  ).textContent =
    item.rate || "";


  document.getElementById(
    "modalDetails"
  ).textContent =
    item.details || "";


  /*
  Availability
  */

  const availability =
    getAvailability(item);


  const availabilityElement =
    document.getElementById(
      "modalAvailability"
    );


  availabilityElement.textContent =
    availability
      ? availability.label
      : "";


  /*
  Images
  */

  const images =
    getAllImages(item);


  document.getElementById(
    "modalImages"
  ).innerHTML =


    images.map(src => `

      <img
        src="${escapeAttribute(src)}"
        alt="${escapeAttribute(
          item.name || ""
        )}"
      >

    `).join("");


  /*
  Show popup
  */

  modal.classList.remove(
    "hidden"
  );


  document.body.style.overflow =
    "hidden";

}


/* =========================================================
   CLOSE PRODUCT
========================================================= */

function closeProduct() {


  modal.classList.add(
    "hidden"
  );


  document.body.style.overflow =
    "";

}


/* =========================================================
   SECURITY / HTML ESCAPING
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
   SEARCH
========================================================= */

document
  .getElementById("searchButton")
  .addEventListener(
    "click",
    () => {


      searchPanel.classList.toggle(
        "hidden"
      );


      if (
        !searchPanel.classList.contains(
          "hidden"
        )
      ) {

        searchInput.focus();

      }

    }
  );


searchInput.addEventListener(
  "input",
  event => {


    searchTerm =
      event.target.value
        .trim()
        .toLowerCase();


    renderProducts();

  }
);


/* =========================================================
   CLOSE BUTTON
========================================================= */

document
  .getElementById("closeModal")
  .addEventListener(
    "click",
    closeProduct
  );


document
  .getElementById("modalBackdrop")
  .addEventListener(
    "click",
    closeProduct
  );


/* =========================================================
   ESC KEY
========================================================= */

document.addEventListener(
  "keydown",
  event => {


    if (event.key === "Escape") {

      closeProduct();

    }

  }
);


/* =========================================================
   LOAD catalog.json
========================================================= */

async function loadCatalog() {


  try {


    const response =
      await fetch(
        `${CATALOG_URL}?v=${Date.now()}`
      );


    if (!response.ok) {

      throw new Error(
        `HTTP ${response.status}`
      );

    }


    catalog =
      await response.json();


    if (!Array.isArray(catalog)) {

      throw new Error(
        "catalog.json must contain an array"
      );

    }


    createCategories();

    renderProducts();


  } catch (error) {


    console.error(error);


    statusMessage.textContent =
      "Could not load catalog.json.";

  }

}


/* =========================================================
   START WEBSITE
========================================================= */

loadCatalog();
