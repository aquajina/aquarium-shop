/* ============ CONFIG ============ */
const SHOP_WHATSAPP = '';        // e.g. '9607777777' — leave '' to hide buttons
const CURRENCY = 'MVR';
const CHUNK = 15;                // items per infinite-scroll batch

/* ================================ */
const PLACEHOLDER = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">' +
  '<rect width="100%" height="100%" fill="#16394a"/>' +
  '<text x="50%" y="50%" font-family="sans-serif" font-size="20" fill="#7fa3b3" ' +
  'text-anchor="middle" dominant-baseline="middle">No image</text></svg>'
);

/* ================= RESIZE HELPERS =================
   Adds Cloudinary transforms to raw URLs at display time.
   Non-Cloudinary URLs pass through unchanged. */
function cloudResize(url, size) {
  if (!url) return PLACEHOLDER;
  if (!url.includes('res.cloudinary.com')) return url;
  if (!url.includes('/upload/')) return url;
  const t = `w_${size},h_${size},c_fill,q_auto,f_auto`;
  if (url.includes('/upload/' + t)) return url;
  return url.replace('/upload/', '/upload/' + t + '/');
}
function thumbUrl(url) { return cloudResize(url, 400); }
function heroUrl(url)  { return cloudResize(url, 900); }

/* ================= STATE ================= */
const state = {
  all: [], filtered: [], shown: 0,
  query: '', category: 'All',
  current: null, galleryIdx: 0,
  cart: loadCart()
};
const $ = id => document.getElementById(id);

/* ================= INIT ================= */
document.addEventListener('DOMContentLoaded', init);

async function init() {
  $('year').textContent = new Date().getFullYear();

  $('search').addEventListener('input', e => {
    state.query = e.target.value.toLowerCase().trim();
    resetFeed();
  });

  $('focus').addEventListener('click', e => {
    if (e.target.hasAttribute('data-close')) closeFocus();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeFocus(); closeCart(); }
    if (e.key === 'ArrowLeft') galleryPrev();
    if (e.key === 'ArrowRight') galleryNext();
  });

  $('cart-btn').addEventListener('click', openCart);
  $('cart').addEventListener('click', e => {
    if (e.target.hasAttribute('data-cart-close')) closeCart();
  });

  $('gal-prev').addEventListener('click', galleryPrev);
  $('gal-next').addEventListener('click', galleryNext);

  try {
    const res = await fetch('catalog.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('Bad JSON');

    /* Filter out anything marked 'out' or missing */
    state.all = data
      .filter(r => r.avail && r.avail !== 'out')
      .filter(r => r.id && r.name)
      .sort(byOrder);

    buildChips();
    resetFeed();
    setupInfinite();
    setupZoom();
    setupSwipe();
    renderCart();
  } catch (err) {
    console.error(err);
    showState('Catalogue unavailable', 'Please refresh in a moment.');
  }
}

/* ================= SORT / FILTER ================= */
function byOrder(a, b) {
  const A = a.order, B = b.order;
  const aH = typeof A === 'number', bH = typeof B === 'number';
  if (aH && bH) return A - B;
  if (aH) return -1;
  if (bH) return 1;
  return String(a.name || '').localeCompare(String(b.name || ''));
}

function buildChips() {
  const set = new Set();
  state.all.forEach(f => { if (f.category) set.add(f.category); });
  const cats = ['All', ...Array.from(set).sort()];
  const box = $('cats');
  box.innerHTML = '';
  cats.forEach(c => {
    const b = document.createElement('button');
    b.className = 'chip' + (c === state.category ? ' on' : '');
    b.textContent = c;
    b.onclick = () => {
      state.category = c;
      box.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b));
      resetFeed();
    };
    box.appendChild(b);
  });
}

/* ================= FEED ================= */
function resetFeed() {
  applyFilters();
  state.shown = 0;
  $('feed').innerHTML = '';
  $('state').hidden = true;

  if (!state.filtered.length) {
    $('count').textContent = '';
    showState(state.all.length ? 'Nothing matches' : 'No fish available',
      state.all.length ? 'Try a different search or category.' : 'Check back soon.');
    return;
  }
  setLayoutMode(state.filtered.length);
  renderChunk();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function applyFilters() {
  const q = state.query, cat = state.category;
  state.filtered = state.all.filter(f => {
    if (cat !== 'All' && f.category !== cat) return false;
    if (!q) return true;
    return [f.id, f.name, f.category, f.details, f.size, f.rate]
      .some(v => String(v || '').toLowerCase().includes(q));
  });
}

function setLayoutMode(count) {
  const mode = count <= 10 ? '1' : count <= 30 ? '2' : '3';
  $('feed').setAttribute('data-mode', mode);
}

function renderChunk() {
  const start = state.shown;
  const end = Math.min(start + CHUNK, state.filtered.length);
  const frag = document.createDocumentFragment();
  for (let i = start; i < end; i++) frag.appendChild(makeTile(state.filtered[i], i - start));
  $('feed').appendChild(frag);
  state.shown = end;
  $('count').textContent = state.shown < state.filtered.length
    ? `${state.shown} of ${state.filtered.length}`
    : `${state.filtered.length} fish`;
}

function setupInfinite() {
  new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) return;
    if (state.shown >= state.filtered.length) return;
    renderChunk();
  }, { rootMargin: '600px 0px' }).observe($('sentinel'));
}

/* ================= TILE ================= */
function makeTile(f, i) {
  const tile = document.createElement('article');
  tile.className = 'tile' + (f.avail === 'coming' ? ' coming' : '');
  tile.style.animationDelay = (i * 25) + 'ms';

  const img = document.createElement('img');
  img.loading = 'lazy';
  img.decoding = 'async';
  img.alt = f.name;
  const first = (f.images && f.images[0]) || '';
  img.src = thumbUrl(first);
  img.addEventListener('load',  () => img.classList.add('ready'), { once: true });
  img.addEventListener('error', () => { img.src = PLACEHOLDER; img.classList.add('ready'); }, { once: true });
  tile.appendChild(img);

  if (f.avail === 'low')         tile.appendChild(el('span', 'tile-badge warn', 'Low Stock'));
  else if (f.avail === 'coming') tile.appendChild(el('span', 'tile-badge soon', 'Coming Soon'));

  if (f.avail !== 'coming') {
    const add = document.createElement('button');
    add.className = 'tile-add';
    add.type = 'button';
    add.setAttribute('aria-label', 'Add to cart');
    add.textContent = '+';
    add.addEventListener('click', e => {
      e.stopPropagation();
      addToCart(f);
      add.classList.add('added');
      add.textContent = '✓';
      setTimeout(() => { add.classList.remove('added'); add.textContent = '+'; }, 900);
    });
    tile.appendChild(add);
  }

  const overlay = document.createElement('div');
  overlay.className = 'tile-overlay';
  overlay.appendChild(el('div', 'tile-name', f.name));
  if (f.rate) overlay.appendChild(el('div', 'tile-rate', f.rate));
  tile.appendChild(overlay);

  tile.addEventListener('click', () => openFocus(f));
  return tile;
}

/* ================= FOCUS (detail view) ================= */
function openFocus(f) {
  state.current = f;
  state.galleryIdx = 0;

  const firstHero = (f.heroes && f.heroes[0]) || (f.images && f.images[0]) || '';
  $('focus-blur').style.backgroundImage = `url("${heroUrl(firstHero)}")`;

  $('f-name').textContent = f.name;
  $('f-cat').textContent = f.category || '';
  $('f-cat').style.display = f.category ? '' : 'none';
  $('f-details').textContent = f.details || '';
  $('f-details').style.display = f.details ? '' : 'none';
  $('f-id').textContent    = f.id || '—';
  $('f-size').textContent  = f.size || '—';
  $('f-rate').textContent  = f.rate || '—';
  $('f-avail').textContent = availLabel(f.avail);

  const wa = $('f-order');
  if (SHOP_WHATSAPP) {
    const lines = [
      `Hi, I'd like to order:`,
      `${f.name}${f.id ? ' (ID ' + f.id + ')' : ''}`,
      f.size ? `Size: ${f.size}` : '',
      f.rate ? `Rate: ${f.rate}` : ''
    ].filter(Boolean).join('\n');
    wa.href = `https://wa.me/${SHOP_WHATSAPP}?text=${encodeURIComponent(lines)}`;
    wa.style.display = '';
  } else {
    wa.style.display = 'none';
  }

  const addBtn = $('f-add');
  if (f.avail === 'coming') {
    addBtn.disabled = true;
    addBtn.textContent = 'Coming Soon';
    addBtn.onclick = null;
  } else {
    addBtn.disabled = false;
    addBtn.textContent = 'Add to Cart';
    addBtn.onclick = () => {
      addToCart(f);
      addBtn.textContent = '✓ Added';
      setTimeout(() => { addBtn.textContent = 'Add to Cart'; closeFocus(); }, 700);
    };
  }

  renderGallery();
  resetZoom();

  const focusEl = $('focus');
  focusEl.hidden = false;
  requestAnimationFrame(() => focusEl.classList.add('open'));
  document.body.style.overflow = 'hidden';
}

function closeFocus() {
  const focusEl = $('focus');
  if (!focusEl.classList.contains('open')) return;
  focusEl.classList.remove('open');
  document.body.style.overflow = '';
  resetZoom();
  setTimeout(() => { focusEl.hidden = true; }, 320);
}

function renderGallery() {
  const f = state.current;
  const imgs = (f.heroes && f.heroes.length) ? f.heroes : (f.images || []);
  $('f-img').src = imgs.length ? heroUrl(imgs[state.galleryIdx]) : PLACEHOLDER;
  $('f-img').alt = f.name;

  const dotsBox = $('f-dots');
  dotsBox.innerHTML = '';
  if (imgs.length > 1) {
    imgs.forEach((_, i) => {
      const d = document.createElement('span');
      d.className = 'dot' + (i === state.galleryIdx ? ' on' : '');
      dotsBox.appendChild(d);
    });
    dotsBox.style.display = 'flex';
    $('gal-prev').style.display = '';
    $('gal-next').style.display = '';
  } else {
    dotsBox.style.display = 'none';
    $('gal-prev').style.display = 'none';
    $('gal-next').style.display = 'none';
  }
}

function galleryPrev() {
  if (!state.current) return;
  const imgs = (state.current.heroes && state.current.heroes.length)
    ? state.current.heroes : (state.current.images || []);
  if (imgs.length < 2) return;
  state.galleryIdx = (state.galleryIdx - 1 + imgs.length) % imgs.length;
  resetZoom();
  renderGallery();
}
function galleryNext() {
  if (!state.current) return;
  const imgs = (state.current.heroes && state.current.heroes.length)
    ? state.current.heroes : (state.current.images || []);
  if (imgs.length < 2) return;
  state.galleryIdx = (state.galleryIdx + 1) % imgs.length;
  resetZoom();
  renderGallery();
}

function setupSwipe() {
  const wrap = $('zoom-wrap');
  let startX = 0, startY = 0, moved = false;

  wrap.addEventListener('touchstart', e => {
    if (e.touches.length === 1) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      moved = false;
    }
  }, { passive: true });

  wrap.addEventListener('touchmove', e => {
    if (e.touches.length === 1 && zoomState.scale <= 1) {
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) moved = true;
    }
  }, { passive: true });

  wrap.addEventListener('touchend', e => {
    if (moved || zoomState.scale > 1) return;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) galleryNext(); else galleryPrev();
    }
  }, { passive: true });
}

/* ================= PINCH-ZOOM ================= */
let zoomState = { scale: 1, tx: 0, ty: 0 };
function resetZoom() { zoomState = { scale: 1, tx: 0, ty: 0 }; applyZoom(); }
function applyZoom() {
  const img = $('f-img');
  if (!img) return;
  img.style.transform = `translate(${zoomState.tx}px, ${zoomState.ty}px) scale(${zoomState.scale})`;
}

function setupZoom() {
  const wrap = $('zoom-wrap');
  if (!wrap) return;
  let startDist = 0, startScale = 1;
  let startX = 0, startY = 0, startTx = 0, startTy = 0;
  let lastTap = 0, zooming = false;
  const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  wrap.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      zooming = true; wrap.classList.add('zooming');
      startDist = dist(e.touches); startScale = zoomState.scale; e.preventDefault();
    } else if (e.touches.length === 1) {
      startX = e.touches[0].clientX; startY = e.touches[0].clientY;
      startTx = zoomState.tx; startTy = zoomState.ty;
    }
  }, { passive: false });

  wrap.addEventListener('touchmove', e => {
    if (e.touches.length === 2) {
      e.preventDefault();
      zoomState.scale = clamp(startScale * (dist(e.touches) / startDist), 1, 5);
      applyZoom();
    } else if (e.touches.length === 1 && zoomState.scale > 1) {
      e.preventDefault();
      zoomState.tx = startTx + (e.touches[0].clientX - startX);
      zoomState.ty = startTy + (e.touches[0].clientY - startY);
      applyZoom();
    }
  }, { passive: false });

  wrap.addEventListener('touchend', e => {
    if (zooming && e.touches.length < 2) {
      zooming = false; wrap.classList.remove('zooming');
      if (zoomState.scale < 1.05) { zoomState = { scale: 1, tx: 0, ty: 0 }; applyZoom(); }
    }
    const now = Date.now();
    if (e.changedTouches.length === 1 && now - lastTap < 300) {
      wrap.classList.add('zooming');
      zoomState = zoomState.scale > 1.5
        ? { scale: 1, tx: 0, ty: 0 }
        : { scale: 2.5, tx: 0, ty: 0 };
      applyZoom();
      setTimeout(() => wrap.classList.remove('zooming'), 240);
    }
    lastTap = now;
  }, { passive: true });

  wrap.addEventListener('dblclick', () => {
    wrap.classList.add('zooming');
    zoomState = zoomState.scale > 1.5
      ? { scale: 1, tx: 0, ty: 0 }
      : { scale: 2.5, tx: 0, ty: 0 };
    applyZoom();
    setTimeout(() => wrap.classList.remove('zooming'), 240);
  });
}

/* ================= CART ================= */
function loadCart() {
  try { return JSON.parse(localStorage.getItem('aquarium-cart') || '{}'); }
  catch { return {}; }
}
function saveCart() {
  try { localStorage.setItem('aquarium-cart', JSON.stringify(state.cart)); } catch {}
}

function addToCart(f) {
  if (!f.id) return;
  if (!state.cart[f.id]) {
    state.cart[f.id] = {
      id: f.id, name: f.name, rate: f.rate,
      img: (f.images && f.images[0]) || '',
      size: f.size || '', qty: 1
    };
  } else {
    state.cart[f.id].qty += 1;
  }
  saveCart();
  renderCart();
  pulseCartButton();
}

function setQty(k, delta) {
  if (!state.cart[k]) return;
  state.cart[k].qty += delta;
  if (state.cart[k].qty <= 0) delete state.cart[k];
  saveCart();
  renderCart();
}
function removeItem(k) { delete state.cart[k]; saveCart(); renderCart(); }
function cartCount() {
  return Object.values(state.cart).reduce((n, it) => n + it.qty, 0);
}

function renderCart() {
  const n = cartCount();
  $('cart-count').textContent = n;
  $('cart-count').style.display = n ? 'grid' : 'none';

  const box = $('cart-items');
  const entries = Object.entries(state.cart);

  if (!entries.length) {
    box.innerHTML = '<div class="cart-empty">Your cart is empty.<br>Tap + on any fish to add.</div>';
    $('cart-total').textContent = '—';
    $('cart-send').style.display = 'none';
    return;
  }

  box.innerHTML = '';
  let totalNum = 0, allNumeric = true;

  entries.forEach(([k, it]) => {
    const rateNum = parseFloat(String(it.rate).replace(/[^0-9.]/g, ''));
    if (!isNaN(rateNum)) totalNum += rateNum * it.qty;
    else allNumeric = false;

    const row = document.createElement('div');
    row.className = 'cart-item';

    const img = document.createElement('img');
    img.src = thumbUrl(it.img);
    img.alt = it.name;
    img.onerror = () => { img.src = PLACEHOLDER; };
    row.appendChild(img);

    const info = document.createElement('div');
    info.className = 'cart-item-info';
    info.appendChild(el('div', 'cart-item-name', it.name || 'Unnamed'));
    info.appendChild(el('div', 'cart-item-rate', it.rate || '—'));

    const qty = document.createElement('div');
    qty.className = 'cart-item-qty';
    const minus = document.createElement('button');
    minus.className = 'qty-btn'; minus.textContent = '−';
    minus.onclick = () => setQty(k, -1);
    const num = el('span', 'qty-num', String(it.qty));
    const plus = document.createElement('button');
    plus.className = 'qty-btn'; plus.textContent = '+';
    plus.onclick = () => setQty(k, +1);
    qty.append(minus, num, plus);
    info.appendChild(qty);
    row.appendChild(info);

    const rm = document.createElement('button');
    rm.className = 'cart-remove'; rm.textContent = 'Remove';
    rm.onclick = () => removeItem(k);
    row.appendChild(rm);

    box.appendChild(row);
  });

  $('cart-total').textContent = allNumeric
    ? `${CURRENCY} ${totalNum.toFixed(2)}`
    : '—';

  if (SHOP_WHATSAPP) {
    const lines = ['Aquarium Shop Order\n'];
    entries.forEach(([_, it]) => {
      lines.push(`${it.name}${it.id ? ' (ID ' + it.id + ')' : ''}`);
      lines.push(`Qty: ${it.qty} — Rate: ${it.rate || ''}\n`);
    });
    if (allNumeric) lines.push(`Total: ${CURRENCY} ${totalNum.toFixed(2)}`);
    lines.push('\nPlease confirm availability and delivery.');
    $('cart-send').href = `https://wa.me/${SHOP_WHATSAPP}?text=${encodeURIComponent(lines.join('\n'))}`;
    $('cart-send').style.display = '';
  } else {
    $('cart-send').style.display = 'none';
  }
}

function openCart() {
  const e = $('cart'); e.hidden = false;
  requestAnimationFrame(() => e.classList.add('open'));
  document.body.style.overflow = 'hidden';
}
function closeCart() {
  const e = $('cart');
  if (!e.classList.contains('open')) return;
  e.classList.remove('open');
  document.body.style.overflow = '';
  setTimeout(() => { e.hidden = true; }, 300);
}
function pulseCartButton() {
  $('cart-btn').animate(
    [{ transform: 'translateY(-50%) scale(1)' },
     { transform: 'translateY(-50%) scale(1.18)' },
     { transform: 'translateY(-50%) scale(1)' }],
    { duration: 280, easing: 'ease-out' });
}

/* ================= HELPERS ================= */
function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
function availLabel(a) {
  return a === 'low' ? 'Low Stock'
       : a === 'coming' ? 'Coming Soon'
       : a === 'out' ? 'Out of Stock'
       : 'Available';
}
function showState(title, msg) {
  const box = $('state');
  box.innerHTML = '';
  box.appendChild(el('strong', null, title));
  box.appendChild(document.createTextNode(msg));
  box.hidden = false;
}
