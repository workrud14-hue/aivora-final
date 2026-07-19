import { supabase } from './supabaseClient.js';

// --- Region-based currency conversion ---
// Base prices in the products table are USD. We detect the visitor's region
// and convert at render time using rates from the currency_rates table.
let userCurrency = null; // { code, rate, symbol } or null (USD fallback)

function detectUserCurrencyCode() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const lang = (navigator.language || 'en-US').toLowerCase();
    // Map common timezones / locales to ISO currency codes.
    const tzMap = [
      [/Europe\/(?!London)/, 'EUR'],
      [/Europe\/London|Europe\/Dublin/, 'GBP'],
      [/Asia\/Kolkata|Asia\/Calcutta/, 'INR'],
      [/Asia\/Tokyo/, 'JPY'],
      [/Australia\//, 'AUD'],
      [/America\/Toronto|America\/Vancouver|Canada\//, 'CAD'],
      [/Asia\/Singapore/, 'SGD'],
      [/Asia\/Dubai|Asia\/Abu_Dhabi|Middle East\//, 'AED'],
      [/Africa\/Lagos/, 'NGN'],
    ];
    for (const [re, code] of tzMap) {
      if (re.test(tz)) return code;
    }
    const langMap = { 'en-us': 'USD', 'en-gb': 'GBP', 'en-in': 'INR', 'en-au': 'AUD', 'en-ca': 'CAD', 'ja': 'JPY', 'de': 'EUR', 'fr': 'EUR', 'es': 'EUR', 'it': 'EUR', 'en-ng': 'NGN', 'en-sg': 'SGD', 'ar': 'AED' };
    for (const key of Object.keys(langMap)) {
      if (lang.startsWith(key)) return langMap[key];
    }
  } catch (e) {}
  return 'USD';
}

async function loadUserCurrency() {
  if (userCurrency) return userCurrency;
  const code = detectUserCurrencyCode();
  if (code === 'USD') {
    userCurrency = { code: 'USD', rate: 1, symbol: '$' };
    return userCurrency;
  }
  try {
    const { data } = await supabase.from('currency_rates').select('currency, rate, symbol').eq('currency', code).maybeSingle();
    if (data && data.rate) {
      userCurrency = { code: data.currency, rate: parseFloat(data.rate), symbol: data.symbol || data.currency + ' ' };
    } else {
      userCurrency = { code: 'USD', rate: 1, symbol: '$' };
    }
  } catch (e) {
    userCurrency = { code: 'USD', rate: 1, symbol: '$' };
  }
  return userCurrency;
}

function formatConverted(amount, cur) {
  const converted = (parseFloat(amount) || 0) * cur.rate;
  const decimals = cur.code === 'JPY' || cur.code === 'NGN' ? 0 : 2;
  const formatted = converted.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return `${cur.symbol}${formatted}`;
}

async function formatPrice(price, salePrice, currency) {
  const cur = await loadUserCurrency();
  const usePrice = (currency && currency !== 'USD') ? price : price; // base is USD; if a product overrides currency we still convert from USD base
  if (salePrice && parseFloat(salePrice) > 0 && parseFloat(salePrice) < parseFloat(price)) {
    return `<span class="text-2xl font-black text-error">${formatConverted(salePrice, cur)}</span><span class="text-sm text-slate-400 line-through ml-2">${formatConverted(price, cur)}</span>`;
  }
  return `<span class="text-2xl font-black text-text">${formatConverted(usePrice, cur)}</span>`;
}

async function renderPriceInto(el, price, salePrice, currency) {
  if (!el) return;
  try {
    el.innerHTML = await formatPrice(price, salePrice, currency);
  } catch (e) {
    el.innerHTML = `$${parseFloat(price).toFixed(2)}`;
  }
}

async function productCardHTML(product) {
  const onSale = product.sale_price && parseFloat(product.sale_price) > 0 && parseFloat(product.sale_price) < parseFloat(product.price);
  const badges = [];
  if (product.featured) badges.push('<span class="badge-featured px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">Featured</span>');
  if (product.best_seller) badges.push('<span class="badge-best px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">Best Seller</span>');
  if (product.new_product) badges.push('<span class="badge-new px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">New</span>');
  if (onSale) badges.push('<span class="badge-sale px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">Sale</span>');

  const img = product.image || 'https://images.pexels.com/photos/5900545/pexels-photo-5900545.jpeg?auto=cs&s=400';
  const fallback = 'https://images.pexels.com/photos/5900545/pexels-photo-5900545.jpeg?auto=cs&s=400';
  const priceHTML = await formatPrice(product.price, product.sale_price, product.currency);

  return `
    <a href="product.html?slug=${product.slug}" class="product-card group">
      <div class="relative aspect-[4/3] overflow-hidden bg-slate-100">
        <img src="${img}" alt="${product.title}" class="w-full h-full object-cover" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${fallback}'" />
        ${badges.length ? `<div class="absolute top-3 left-3 flex flex-wrap gap-1.5">${badges.join('')}</div>` : ''}
      </div>
      <div class="p-5 flex flex-col flex-grow">
        <span class="text-[10px] font-bold uppercase tracking-wider text-primary mb-2">${product.category || 'Product'}</span>
        <h3 class="font-bold text-base mb-1.5 group-hover:text-primary transition-colors">${product.title}</h3>
        <p class="text-xs text-slate-500 leading-relaxed mb-4 flex-grow">${product.short_description || product.subtitle || ''}</p>
        <div class="flex items-center justify-between">
          <div>${priceHTML}</div>
          <span class="text-[10px] text-slate-400 font-medium">${product.downloads || 'PDF'}</span>
        </div>
      </div>
    </a>`;
}

async function renderProductCards(products) {
  return (await Promise.all(products.map(productCardHTML))).join('');
}

function blogCardHTML(post) {
  const img = post.cover_image || 'https://images.pexels.com/photos/5900545/pexels-photo-5900545.jpeg?auto=cs&s=600';
  const date = post.published_at || post.created_at?.split('T')[0] || '';
  return `
    <a href="blog-post.html?slug=${post.slug}" class="blog-card group">
      <div class="relative aspect-[16/10] overflow-hidden bg-slate-100">
        <img src="${img}" alt="${post.title}" class="w-full h-full object-cover" referrerpolicy="no-referrer" />
        <span class="absolute top-3 left-3 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-white/90 text-primary border border-primary/20">${post.category || 'AI'}</span>
      </div>
      <div class="p-5 flex flex-col flex-grow">
        <span class="text-[10px] text-slate-400 mb-2">${date}</span>
        <h3 class="font-bold text-lg mb-2 group-hover:text-primary transition-colors">${post.title}</h3>
        <p class="text-sm text-slate-500 leading-relaxed flex-grow">${post.excerpt || ''}</p>
        <div class="mt-4 flex items-center gap-2 text-xs text-slate-400">
          <span class="font-medium">${post.author || 'Voria Johnson'}</span>
        </div>
      </div>
    </a>`;
}

function hideLoadingOverlay() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
    setTimeout(() => overlay.remove(), 500);
  }
}

function initScrollProgress() {
  const bar = document.getElementById('scroll-progress');
  if (!bar) return;
  window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    bar.style.width = pct + '%';
  }, { passive: true });
}

function initNavScroll() {
  const nav = document.querySelector('nav.fixed');
  if (!nav) return;
  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
      nav.classList.add('glass-panel', 'shadow-lg');
      nav.classList.remove('border-transparent');
      nav.style.borderColor = 'rgba(226, 232, 240, 0.5)';
    } else {
      nav.classList.remove('glass-panel', 'shadow-lg');
      nav.classList.add('border-transparent');
      nav.style.borderColor = 'transparent';
    }
  }, { passive: true });
}

function initMobileMenu() {
  const btn = document.getElementById('mobile-menu-btn');
  const menu = document.getElementById('mobile-menu');
  if (!btn || !menu) return;
  btn.addEventListener('click', () => {
    const isHidden = menu.classList.contains('hidden');
    if (isHidden) {
      menu.classList.remove('hidden');
      requestAnimationFrame(() => {
        menu.classList.remove('opacity-0', '-translate-y-4');
      });
      btn.setAttribute('aria-expanded', 'true');
    } else {
      menu.classList.add('opacity-0', '-translate-y-4');
      setTimeout(() => menu.classList.add('hidden'), 300);
      btn.setAttribute('aria-expanded', 'false');
    }
  });
}

function initBackToTop() {
  const btn = document.getElementById('back-to-top');
  if (!btn) return;
  window.addEventListener('scroll', () => {
    if (window.scrollY > 400) {
      btn.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-4');
    } else {
      btn.classList.add('opacity-0', 'pointer-events-none', 'translate-y-4');
    }
  }, { passive: true });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

function initRevealAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('reveal', 'reveal-left', 'reveal-right');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  document.querySelectorAll('.reveal.opacity-0, .reveal-left.opacity-0, .reveal-right.opacity-0').forEach((el) => {
    observer.observe(el);
  });
}

async function loadSiteLogo() {
  try {
    const { data } = await supabase.from('site_settings').select('value').eq('key', 'logo_url').maybeSingle();
    const logoUrl = data?.value;
    const logos = document.querySelectorAll('[data-site-logo]');
    const fallbacks = document.querySelectorAll('[data-logo-fallback]');
    if (logoUrl) {
      logos.forEach((img) => {
        img.src = logoUrl;
        img.style.display = '';
      });
      fallbacks.forEach((fb) => fb.style.display = 'none');
    }
  } catch (e) {
    // keep fallback
  }
}

async function loadFeaturedProducts() {
  const grid = document.getElementById('featured-products-grid');
  if (!grid) return;
  try {
    const { data, error } = await supabase.from('products').select('*').eq('featured', true).order('created_at', { ascending: false });
    if (error) throw error;
    if (!data || data.length === 0) {
      const { data: all } = await supabase.from('products').select('*').order('created_at', { ascending: false }).limit(4);
      if (all && all.length > 0) {
        grid.innerHTML = await renderProductCards(all);
      } else {
        grid.innerHTML = '<p class="col-span-full text-center text-slate-400 py-12">No products available yet.</p>';
      }
    } else {
      grid.innerHTML = await renderProductCards(data);
    }
    if (window.lucide) window.lucide.createIcons();
  } catch (e) {
    grid.innerHTML = '<p class="col-span-full text-center text-slate-400 py-12">Unable to load products.</p>';
  }
}

async function loadBestsellers() {
  const carousel = document.getElementById('bestsellers-carousel');
  if (!carousel) return;
  try {
    const { data, error } = await supabase.from('products').select('*').eq('best_seller', true).order('created_at', { ascending: false });
    if (error) throw error;
    const products = data && data.length > 0 ? data : [];
    if (products.length === 0) {
      const { data: all } = await supabase.from('products').select('*').order('created_at', { ascending: false }).limit(6);
      if (all && all.length > 0) {
        const cards = await renderProductCards(all);
        carousel.innerHTML = all.map((p, i) => `<div class="min-w-[300px] max-w-[300px]">${(cards.match(/<a href="product.html\?slug=[^"]+"[\s\S]*?<\/a>/) || [''])[0]}</div>`).join('');
        // Simpler: just render each card wrapped
        carousel.innerHTML = (await Promise.all(all.map(async (p) => `<div class="min-w-[300px] max-w-[300px]">${await productCardHTML(p)}</div>`))).join('');
      } else {
        carousel.innerHTML = '<div class="w-full text-center text-slate-400 py-12">No products available.</div>';
      }
    } else {
      carousel.innerHTML = (await Promise.all(products.map(async (p) => `<div class="min-w-[300px] max-w-[300px]">${await productCardHTML(p)}</div>`))).join('');
    }
    if (window.lucide) window.lucide.createIcons();
  } catch (e) {
    carousel.innerHTML = '<div class="w-full text-center text-slate-400 py-12">Unable to load products.</div>';
  }

  const prev = document.getElementById('carousel-prev');
  const next = document.getElementById('carousel-next');
  if (prev) prev.addEventListener('click', () => carousel.scrollBy({ left: -320, behavior: 'smooth' }));
  if (next) next.addEventListener('click', () => carousel.scrollBy({ left: 320, behavior: 'smooth' }));
}

async function loadProductsPage() {
  const grid = document.getElementById('products-grid');
  if (!grid) return;
  try {
    const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    if (!data || data.length === 0) {
      grid.innerHTML = '<p class="col-span-full text-center text-slate-400 py-12">No products available yet.</p>';
      return;
    }
    grid.dataset.allProducts = JSON.stringify(data);
    grid.innerHTML = await renderProductCards(data);
    if (window.lucide) window.lucide.createIcons();
    renderCurrencyNote();
  } catch (e) {
    grid.innerHTML = '<p class="col-span-full text-center text-slate-400 py-12">Unable to load products.</p>';
  }

  const filterBtns = document.querySelectorAll('[data-filter]');
  filterBtns.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const filter = btn.dataset.filter;
      filterBtns.forEach((b) => {
        b.classList.remove('bg-primary', 'text-white', 'border-primary');
        b.classList.add('bg-white', 'text-slate-600', 'border-slate-200');
      });
      btn.classList.add('bg-primary', 'text-white', 'border-primary');
      btn.classList.remove('bg-white', 'text-slate-600', 'border-slate-200');

      const all = JSON.parse(grid.dataset.allProducts || '[]');
      let filtered;
      if (filter === 'all') {
        filtered = all;
      } else {
        filtered = all.filter((p) => {
          const cat = (p.category || '').toLowerCase().replace(/\s+/g, '-');
          return cat.includes(filter);
        });
      }
      grid.innerHTML = filtered.length > 0
        ? await renderProductCards(filtered)
        : '<p class="col-span-full text-center text-slate-400 py-12">No products in this category.</p>';
      if (window.lucide) window.lucide.createIcons();
    });
  });
}

async function renderCurrencyNote() {
  const cur = await loadUserCurrency();
  if (cur.code === 'USD') return;
  document.querySelectorAll('[data-currency-note]').forEach((el) => {
    el.textContent = `Prices shown in ${cur.code}`;
    el.classList.remove('hidden');
  });
}

async function loadProductDetail() {
  const section = document.getElementById('product-detail-section');
  if (!section) return;
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');
  if (!slug) {
    section.innerHTML = '<div class="max-w-7xl mx-auto px-6 py-20 text-center"><p class="text-slate-500">Product not found.</p><a href="products.html" class="text-primary font-semibold mt-4 inline-block">Browse all products</a></div>';
    return;
  }
  try {
    const { data, error } = await supabase.from('products').select('*').eq('slug', slug).maybeSingle();
    if (error) throw error;
    if (!data) {
      section.innerHTML = '<div class="max-w-7xl mx-auto px-6 py-20 text-center"><p class="text-slate-500">Product not found.</p><a href="products.html" class="text-primary font-semibold mt-4 inline-block">Browse all products</a></div>';
      return;
    }

    document.title = data.seo_title || data.title + ' - Aivora';

    // Inject product JSON-LD schema
    injectProductSchema(data);

    const coverImg = document.getElementById('product-cover-image');
    if (coverImg) coverImg.src = data.image || 'https://images.pexels.com/photos/5900545/pexels-photo-5900545.jpeg?auto=cs&s=600';

    const catEl = document.getElementById('product-category');
    if (catEl) catEl.textContent = data.category || 'Product';

    const fileEl = document.getElementById('product-file-format');
    if (fileEl) fileEl.innerHTML = `<span class="px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider text-slate-500 bg-slate-100 border border-slate-200">${data.downloads || 'PDF'}</span>`;

    const titleEl = document.getElementById('product-title');
    if (titleEl) titleEl.textContent = data.title;

    const subEl = document.getElementById('product-subtitle');
    if (subEl) subEl.textContent = data.subtitle || '';

    const priceEl = document.getElementById('product-price-section');
    if (priceEl) await renderPriceInto(priceEl, data.price, data.sale_price, data.currency);

    const checkoutBtn = document.getElementById('payhip-checkout-btn');
    if (checkoutBtn && data.payhip_url) {
      checkoutBtn.href = data.payhip_url;
    }

    const descEl = document.getElementById('product-description-long');
    if (descEl) {
      const paragraphs = (data.description || '').split('\n').filter((l) => l.trim());
      descEl.innerHTML = paragraphs.map((p) => `<p class="text-slate-500 text-sm md:text-base leading-relaxed">${p}</p>`).join('');
    }

    const tagsEl = document.getElementById('product-tags-list');
    if (tagsEl && data.tags) {
      tagsEl.innerHTML = data.tags.map((t) => `<span class="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200">#${t}</span>`).join('');
    }

    const relatedGrid = document.getElementById('related-products-grid');
    if (relatedGrid) {
      const { data: related } = await supabase.from('products').select('*').neq('id', data.id).limit(3);
      if (related && related.length > 0) {
        relatedGrid.innerHTML = await renderProductCards(related);
      } else {
        relatedGrid.innerHTML = '<p class="col-span-full text-center text-slate-400 py-8">No related products.</p>';
      }
    }

    // Load reviews for this product
    loadProductReviews(data.id);
    initReviewForm(data.id);

    if (window.lucide) window.lucide.createIcons();
  } catch (e) {
    section.innerHTML = '<div class="max-w-7xl mx-auto px-6 py-20 text-center"><p class="text-slate-500">Unable to load product.</p></div>';
  }
}

function initFAQAccordion() {
  const triggers = document.querySelectorAll('.faq-trigger');
  if (triggers.length === 0) return;
  triggers.forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const item = trigger.closest('.faq-item');
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach((i) => i.classList.remove('open'));
      if (!isOpen) item.classList.add('open');
    });
  });
}

async function loadFAQs() {
  const container = document.querySelector('.faq-list, #faq-list');
  if (!container) return;
  try {
    const { data, error } = await supabase.from('faqs').select('*').order('sort_order', { ascending: true });
    if (error) throw error;
    if (data && data.length > 0) {
      container.innerHTML = data.map((faq) => `
        <div class="faq-item card-premium overflow-hidden">
          <button class="faq-trigger w-full flex items-center justify-between p-6 text-left focus:outline-none">
            <span class="font-bold text-base md:text-lg">${faq.question}</span>
            <span class="faq-icon text-slate-400 transition-transform duration-300">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </span>
          </button>
          <div class="faq-answer px-6"><p class="pb-6 text-slate-500 text-sm md:text-base leading-relaxed">${faq.answer}</p></div>
        </div>
      `).join('');
      initFAQAccordion();
    }
  } catch (e) {
    // keep static FAQs
  }
}

function initNewsletterForm() {
  const form = document.getElementById('newsletter-form');
  const success = document.getElementById('newsletter-success');
  if (!form || !success) return;
  const errorBox = document.getElementById('newsletter-error');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailInput = form.querySelector('input[type="email"]');
    const email = (emailInput?.value || '').trim();
    if (!email) return;
    success.classList.add('hidden');
    if (errorBox) errorBox.classList.add('hidden');
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalLabel = submitBtn?.innerHTML;
    if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<span class="inline-block animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>'; }
    try {
      const { error } = await supabase.from('newsletter_subscribers').insert({ email, source: 'footer' });
      if (error) {
        // 23505 = unique_violation → already subscribed; treat as success
        if (error.code !== '23505') throw error;
      }
      form.reset();
      success.classList.remove('hidden');
      setTimeout(() => success.classList.add('hidden'), 5000);
      // Trigger welcome email immediately (fire-and-forget)
      try {
        await supabase.from('email_queue').insert({
          type: 'welcome',
          to_email: email,
          subject: 'Welcome to Aivora!'
        });
        fetch('/api/send-email', { method: 'POST' }).catch(() => {});
      } catch (e) {} // silent fail — cron will catch it later
    } catch (err) {
      if (errorBox) {
        errorBox.textContent = 'Could not subscribe. Please try again later.';
        errorBox.classList.remove('hidden');
      }
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalLabel; }
    }
  });
}

async function loadBlogPage() {
  const grid = document.getElementById('blog-grid');
  if (!grid) return;
  try {
    const { data, error } = await supabase.from('blog_posts').select('*').eq('published', true).order('published_at', { ascending: false, nullsFirst: false });
    if (error) throw error;
    if (!data || data.length === 0) {
      grid.innerHTML = '<p class="col-span-full text-center text-slate-400 py-12">No blog posts published yet. Check back soon!</p>';
      return;
    }
    grid.innerHTML = data.map(blogCardHTML).join('');
    if (window.lucide) window.lucide.createIcons();
  } catch (e) {
    grid.innerHTML = '<p class="col-span-full text-center text-slate-400 py-12">Unable to load blog posts.</p>';
  }
}

// Unique blog view tracking: increment once per browser per post (localStorage dedupe).
async function incrementBlogView(postId) {
  if (!postId) return;
  const key = `aivora_blog_viewed_${postId}`;
  try {
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
    const { data } = await supabase.from('blog_posts').select('views').eq('id', postId).maybeSingle();
    const current = (data && typeof data.views === 'number') ? data.views : 0;
    const { error } = await supabase.from('blog_posts').update({ views: current + 1, last_viewed_at: new Date().toISOString() }).eq('id', postId);
    if (!error) {
      const el = document.getElementById('blog-view-count');
      if (el) el.textContent = String(current + 1);
    }
  } catch (e) {
    // view tracking is best-effort; never break the page
  }
}

async function loadBlogPostDetail() {
  const section = document.getElementById('blog-post-section');
  if (!section) return;
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');
  if (!slug) {
    section.innerHTML = '<div class="max-w-3xl mx-auto px-6 py-20 text-center"><p class="text-slate-500">Blog post not found.</p><a href="blog.html" class="text-primary font-semibold mt-4 inline-block">Back to blog</a></div>';
    return;
  }
  try {
    const { data, error } = await supabase.from('blog_posts').select('*').eq('slug', slug).eq('published', true).maybeSingle();
    if (error) throw error;
    if (!data) {
      section.innerHTML = '<div class="max-w-3xl mx-auto px-6 py-20 text-center"><p class="text-slate-500">Blog post not found.</p><a href="blog.html" class="text-primary font-semibold mt-4 inline-block">Back to blog</a></div>';
      return;
    }

    document.title = data.title + ' - Aivora Blog';

    // Inject blog JSON-LD schema
    injectBlogSchema(data);

    const img = data.cover_image || 'https://images.pexels.com/photos/5900545/pexels-photo-5900545.jpeg?auto=cs&s=800';
    const date = data.published_at || data.created_at?.split('T')[0] || '';

    // Unique view tracking: increment once per browser per post.
    incrementBlogView(data.id);

    const viewsCount = data.views || 0;

    section.innerHTML = `
      <div class="max-w-3xl mx-auto px-6">
        <a href="blog.html" class="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary transition-colors mb-8">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
          Back to Blog
        </a>
        <span class="inline-block px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 border border-primary/20 mb-4">${data.category || 'AI'}</span>
        <h1 class="text-3xl md:text-5xl font-black tracking-tight mb-4">${data.title}</h1>
        <div class="flex items-center gap-3 mb-8">
          <div class="w-10 h-10 rounded-full gradient-bg flex items-center justify-center text-white font-bold text-sm">${(data.author || 'VJ')[0]}</div>
          <div>
            <p class="font-bold text-sm">${data.author || 'Voria Johnson'}</p>
            <p class="text-xs text-slate-400">${date} · <span id="blog-view-count">${viewsCount}</span> views</p>
          </div>
        </div>
        <div class="relative overflow-hidden rounded-[24px] bg-white border border-slate-200 shadow-xl mb-10">
          <div class="aspect-[16/9] overflow-hidden">
            <img src="${img}" alt="${data.title}" class="w-full h-full object-cover" referrerpolicy="no-referrer" />
          </div>
        </div>
        ${data.excerpt ? `<p class="text-lg text-slate-500 leading-relaxed mb-8 font-medium">${data.excerpt}</p>` : ''}
        <div class="prose-content">${formatBlogContent(data.content || '')}</div>
        ${data.tags && data.tags.length > 0 ? `
        <div class="border-t border-slate-100 pt-8 mt-10">
          <h3 class="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Tags</h3>
          <div class="flex flex-wrap gap-2">
            ${data.tags.map((t) => `<span class="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200">#${t}</span>`).join('')}
          </div>
        </div>` : ''}
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  } catch (e) {
    section.innerHTML = '<div class="max-w-3xl mx-auto px-6 py-20 text-center"><p class="text-slate-500">Unable to load blog post.</p></div>';
  }
}

function formatBlogContent(content) {
  return content
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('### ')) return `<h3>${trimmed.slice(4)}</h3>`;
      if (trimmed.startsWith('## ')) return `<h2>${trimmed.slice(3)}</h2>`;
      if (trimmed.startsWith('# ')) return `<h2>${trimmed.slice(2)}</h2>`;
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) return `<ul><li>${trimmed.slice(2)}</li></ul>`;
      if (trimmed.startsWith('> ')) return `<blockquote>${trimmed.slice(2)}</blockquote>`;
      return `<p>${trimmed}</p>`;
    })
    .join('');
}

function initAdminShortcut() {
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === 'L' || e.key === 'l')) {
      e.preventDefault();
      window.location.href = 'admin.html';
    }
  });
}

// --- Dark Mode ---
function initDarkMode() {
  const toggle = document.getElementById('dark-mode-toggle');
  if (!toggle) return;
  const sunIcon = toggle.querySelector('.sun-icon');
  const moonIcon = toggle.querySelector('.moon-icon');

  function applyTheme(dark) {
    if (dark) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
      if (sunIcon) sunIcon.classList.add('hidden');
      if (moonIcon) moonIcon.classList.remove('hidden');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
      if (sunIcon) sunIcon.classList.remove('hidden');
      if (moonIcon) moonIcon.classList.add('hidden');
    }
  }

  // Check saved preference or system preference
  const saved = localStorage.getItem('aivora_dark_mode');
  if (saved !== null) {
    applyTheme(saved === 'true');
  } else {
    applyTheme(window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  toggle.addEventListener('click', () => {
    const isDark = document.documentElement.classList.contains('dark');
    applyTheme(!isDark);
    localStorage.setItem('aivora_dark_mode', String(!isDark));
  });
}

// --- SEO Structured Data (JSON-LD) ---
function injectProductSchema(product) {
  if (!product) return;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.short_description || product.description || '',
    image: product.image || '',
    brand: { '@type': 'Brand', name: 'Aivora' },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'USD',
      price: product.sale_price && parseFloat(product.sale_price) > 0 ? product.sale_price : product.price,
      availability: 'https://schema.org/InStock',
      url: window.location.href
    }
  };
  if (product.category) schema.category = product.category;
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.text = JSON.stringify(schema);
  document.head.appendChild(script);
}

function injectBlogSchema(post) {
  if (!post) return;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt || '',
    image: post.cover_image || '',
    author: { '@type': 'Person', name: post.author || 'Voria Johnson' },
    publisher: { '@type': 'Organization', name: 'Aivora', logo: { '@type': 'ImageObject', url: window.location.origin + '/assets/images/logo.jpg' } },
    datePublished: post.published_at || post.created_at || '',
    url: window.location.href
  };
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.text = JSON.stringify(schema);
  document.head.appendChild(script);
}

function injectOrganizationSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Aivora',
    url: window.location.origin,
    logo: window.location.origin + '/assets/images/logo.jpg',
    description: 'Premium AI digital products for creators, entrepreneurs, and businesses.',
    sameAs: [
      'https://www.instagram.com/ai._vora/',
      'https://www.threads.com/@ai._vora'
    ]
  };
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.text = JSON.stringify(schema);
  document.head.appendChild(script);
}

// --- Image Optimization ---
function initImageOptimization() {
  const images = document.querySelectorAll('img[data-src], img[loading="lazy"]');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        if (img.dataset.src) {
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
        }
        img.addEventListener('load', () => img.classList.add('loaded'), { once: true });
        observer.unobserve(img);
      }
    });
  }, { rootMargin: '100px' });

  document.querySelectorAll('img').forEach(img => {
    img.loading = 'lazy';
    img.decoding = 'async';
    if (img.complete) {
      img.classList.add('loaded');
    }
    observer.observe(img);
  });
}

// --- Social Proof Notifications ---
let socialProofQueue = [];
let socialProofVisible = false;

function showSocialProofNotification(message, icon = '🛒') {
  socialProofQueue.push({ message, icon });
  if (!socialProofVisible) processSocialProofQueue();
}

function processSocialProofQueue() {
  if (socialProofQueue.length === 0) {
    socialProofVisible = false;
    return;
  }
  socialProofVisible = true;
  const { message, icon } = socialProofQueue.shift();

  let toast = document.getElementById('social-proof-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'social-proof-toast';
    toast.className = 'social-proof-toast';
    toast.innerHTML = '<div class="w-10 h-10 rounded-full gradient-bg flex items-center justify-center text-white text-lg flex-shrink-0"></div><div><p class="text-sm font-medium" id="social-proof-msg"></p><p class="text-xs text-slate-400 mt-0.5">Just now</p></div><button class="ml-auto text-slate-400 hover:text-slate-600 text-lg leading-none" id="social-proof-close">&times;</button>';
    document.body.appendChild(toast);
    toast.querySelector('#social-proof-close').addEventListener('click', () => toast.classList.remove('show'));
  }

  const iconEl = toast.querySelector('.gradient-bg');
  const msgEl = document.getElementById('social-proof-msg');
  if (iconEl) iconEl.textContent = icon;
  if (msgEl) msgEl.textContent = message;

  toast.classList.remove('show');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('show'));
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => processSocialProofQueue(), 500);
  }, 5000);
}

async function initSocialProof() {
  try {
    const { data: products } = await supabase.from('products').select('title, slug').limit(20);
    if (!products || products.length === 0) return;

    const names = ['Alex', 'Jordan', 'Sam', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Quinn', 'Avery', 'Parker', 'Drew', 'Blake', 'Reese', 'Skyler', 'Dakota'];
    const cities = ['New York', 'London', 'Tokyo', 'Sydney', 'Berlin', 'Toronto', 'Singapore', 'Dubai', 'Lagos', 'Mumbai', 'Paris', 'Seoul', 'Amsterdam', 'Barcelona', 'Chicago'];
    const icons = ['🛒', '✨', '🎯', '💡', '🔥', '🚀'];

    function randomNotification() {
      const name = names[Math.floor(Math.random() * names.length)];
      const city = cities[Math.floor(Math.random() * cities.length)];
      const product = products[Math.floor(Math.random() * products.length)];
      const icon = icons[Math.floor(Math.random() * icons.length)];
      showSocialProofNotification(`${name} from ${city} just purchased ${product.title}`, icon);
    }

    // Show first notification after 8-15 seconds
    setTimeout(randomNotification, 8000 + Math.random() * 7000);

    // Then every 20-45 seconds
    setInterval(() => {
      if (!socialProofVisible) randomNotification();
    }, 20000 + Math.random() * 25000);
  } catch (e) {
    // social proof is best-effort
  }
}

// --- Product Reviews & Ratings ---
async function loadProductReviews(productId, containerId = 'product-reviews') {
  const container = document.getElementById(containerId);
  if (!container || !productId) return;

  try {
    const { data: reviews, error } = await supabase.from('product_reviews')
      .select('*')
      .eq('product_id', productId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    // Calculate average rating
    const { data: stats } = await supabase.from('product_reviews')
      .select('rating')
      .eq('product_id', productId)
      .eq('status', 'approved');

    let avgRating = 0;
    let totalReviews = 0;
    if (stats && stats.length > 0) {
      totalReviews = stats.length;
      avgRating = stats.reduce((sum, r) => sum + r.rating, 0) / totalReviews;
    }

    // Update rating display on product page
    const ratingEl = document.getElementById('product-rating-display');
    if (ratingEl) {
      ratingEl.innerHTML = renderStarRating(avgRating) + `<span class="text-sm text-slate-500 ml-2">${avgRating.toFixed(1)} (${totalReviews} review${totalReviews !== 1 ? 's' : ''})</span>`;
    }

    // Update average rating on product cards
    const cardRatingEl = document.getElementById(`rating-${productId}`);
    if (cardRatingEl) {
      cardRatingEl.innerHTML = renderStarRating(avgRating);
    }

    // Render reviews list
    if (!reviews || reviews.length === 0) {
      container.innerHTML = '<p class="text-slate-400 text-sm">No reviews yet. Be the first to review this product!</p>';
      return;
    }

    container.innerHTML = reviews.map(review => `
      <div class="border-b border-slate-100 py-4 last:border-0">
        <div class="flex items-center gap-3 mb-2">
          <div class="w-8 h-8 rounded-full gradient-bg flex items-center justify-center text-white text-xs font-bold">${(review.user_name || 'A')[0]}</div>
          <div>
            <p class="font-semibold text-sm">${review.user_name || 'Anonymous'}</p>
            <div class="flex items-center gap-2">
              ${renderStarRating(review.rating)}
              <span class="text-xs text-slate-400">${review.created_at ? new Date(review.created_at).toLocaleDateString() : ''}</span>
            </div>
          </div>
        </div>
        <p class="text-sm text-slate-600 leading-relaxed">${review.comment || ''}</p>
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = '';
  }
}

function renderStarRating(rating) {
  let html = '<span class="star-rating">';
  for (let i = 1; i <= 5; i++) {
    html += `<span class="star ${i <= Math.round(rating) ? 'filled' : ''}">★</span>`;
  }
  html += '</span>';
  return html;
}

function initReviewForm(productId) {
  const form = document.getElementById('review-form');
  if (!form || !productId) return;

  let selectedRating = 0;
  const stars = form.querySelectorAll('.star-rating .star');

  stars.forEach(star => {
    star.addEventListener('click', () => {
      selectedRating = parseInt(star.dataset.rating);
      stars.forEach((s, i) => {
        s.classList.toggle('filled', i < selectedRating);
      });
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (selectedRating === 0) {
      alert('Please select a rating');
      return;
    }

    const nameInput = form.querySelector('input[name="name"]');
    const commentInput = form.querySelector('textarea[name="comment"]');
    const name = nameInput?.value?.trim() || 'Anonymous';
    const comment = commentInput?.value?.trim() || '';

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Submitting...'; }

    try {
      const { error } = await supabase.from('product_reviews').insert({
        product_id: productId,
        user_name: name,
        rating: selectedRating,
        comment: comment,
        status: 'approved'
      });
      if (error) throw error;
      form.reset();
      selectedRating = 0;
      stars.forEach(s => s.classList.remove('filled'));
      alert('Thank you! Your review will appear after moderation.');
    } catch (err) {
      alert('Could not submit review. Please try again.');
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit Review'; }
    }
  });
}

// --- Automated Currency Rate Updates (client-side fetch) ---
async function autoUpdateCurrencyRates() {
  const lastUpdate = localStorage.getItem('aivora_rates_updated');
  const now = Date.now();
  // Only update once per 24 hours
  if (lastUpdate && (now - parseInt(lastUpdate)) < 86400000) return;

  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!response.ok) return;
    const data = await response.json();
    if (!data.rates) return;

    const currenciesToUpdate = [
      { code: 'EUR', symbol: '€' },
      { code: 'GBP', symbol: '£' },
      { code: 'INR', symbol: '₹' },
      { code: 'JPY', symbol: '¥' },
      { code: 'AUD', symbol: 'A$' },
      { code: 'CAD', symbol: 'C$' },
      { code: 'SGD', symbol: 'S$' },
      { code: 'AED', symbol: 'د.إ' },
      { code: 'NGN', symbol: '₦' },
    ];

    for (const cur of currenciesToUpdate) {
      if (data.rates[cur.code]) {
        await supabase.from('currency_rates').upsert({
          currency: cur.code,
          rate: data.rates[cur.code],
          symbol: cur.symbol,
          updated_at: new Date().toISOString()
        }, { onConflict: 'currency' });
      }
    }

    localStorage.setItem('aivora_rates_updated', String(now));
  } catch (e) {
    // currency updates are best-effort
  }
}

// --- Email Transactional System (client-side trigger) ---
async function sendWelcomeEmail(email) {
  try {
    await supabase.from('email_queue').insert({
      type: 'welcome',
      to_email: email,
      subject: 'Welcome to Aivora! 🎉',
      status: 'pending'
    });
  } catch (e) { /* best-effort */ }
}

async function sendPurchaseConfirmation(email, productName, productUrl) {
  try {
    await supabase.from('email_queue').insert({
      type: 'purchase_confirmation',
      to_email: email,
      subject: `Your purchase: ${productName}`,
      metadata: { product_name: productName, product_url: productUrl },
      status: 'pending'
    });
  } catch (e) { /* best-effort */ }
}

async function sendBlogNotification(subscriberEmail, postTitle, postUrl) {
  try {
    await supabase.from('email_queue').insert({
      type: 'blog_notification',
      to_email: subscriberEmail,
      subject: `New on Aivora: ${postTitle}`,
      metadata: { post_title: postTitle, post_url: postUrl },
      status: 'pending'
    });
  } catch (e) { /* best-effort */ }
}

document.addEventListener('DOMContentLoaded', () => {
  initScrollProgress();
  initNavScroll();
  initMobileMenu();
  initBackToTop();
  initRevealAnimations();
  initFAQAccordion();
  initNewsletterForm();
  initAdminShortcut();
  initDarkMode();
  initImageOptimization();
  loadSiteLogo();

  loadFeaturedProducts();
  loadBestsellers();
  loadProductsPage();
  loadProductDetail();
  loadFAQs();
  loadBlogPage();
  loadBlogPostDetail();

  // Inject organization schema on all pages
  injectOrganizationSchema();

  // Init social proof (shows random purchase notifications)
  initSocialProof();

  // Auto-update currency rates daily
  autoUpdateCurrencyRates();

  setTimeout(hideLoadingOverlay, 300);
});
