import { supabase } from './supabaseClient.js';

function formatPrice(price, salePrice, currency) {
  const c = currency || 'USD';
  const symbol = c === 'USD' ? '$' : c + ' ';
  if (salePrice && parseFloat(salePrice) > 0 && parseFloat(salePrice) < parseFloat(price)) {
    return `<span class="text-2xl font-black text-error">${symbol}${parseFloat(salePrice).toFixed(2)}</span><span class="text-sm text-slate-400 line-through ml-2">${symbol}${parseFloat(price).toFixed(2)}</span>`;
  }
  return `<span class="text-2xl font-black text-text">${symbol}${parseFloat(price).toFixed(2)}</span>`;
}

function productCardHTML(product) {
  const onSale = product.sale_price && parseFloat(product.sale_price) > 0 && parseFloat(product.sale_price) < parseFloat(product.price);
  const badges = [];
  if (product.featured) badges.push('<span class="badge-featured px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">Featured</span>');
  if (product.best_seller) badges.push('<span class="badge-best px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">Best Seller</span>');
  if (product.new_product) badges.push('<span class="badge-new px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">New</span>');
  if (onSale) badges.push('<span class="badge-sale px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">Sale</span>');

  const img = product.image || 'https://images.pexels.com/photos/5900545/pexels-photo-5900545.jpeg?auto=cs&s=400';

  return `
    <a href="product.html?slug=${product.slug}" class="product-card group">
      <div class="relative aspect-[4/3] overflow-hidden bg-slate-100">
        <img src="${img}" alt="${product.title}" class="w-full h-full object-cover" referrerpolicy="no-referrer" />
        ${badges.length ? `<div class="absolute top-3 left-3 flex flex-wrap gap-1.5">${badges.join('')}</div>` : ''}
      </div>
      <div class="p-5 flex flex-col flex-grow">
        <span class="text-[10px] font-bold uppercase tracking-wider text-primary mb-2">${product.category || 'Product'}</span>
        <h3 class="font-bold text-base mb-1.5 group-hover:text-primary transition-colors">${product.title}</h3>
        <p class="text-xs text-slate-500 leading-relaxed mb-4 flex-grow">${product.short_description || product.subtitle || ''}</p>
        <div class="flex items-center justify-between">
          <div>${formatPrice(product.price, product.sale_price, product.currency)}</div>
          <span class="text-[10px] text-slate-400 font-medium">${product.downloads || 'PDF'}</span>
        </div>
      </div>
    </a>`;
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
        grid.innerHTML = all.map(productCardHTML).join('');
      } else {
        grid.innerHTML = '<p class="col-span-full text-center text-slate-400 py-12">No products available yet.</p>';
      }
    } else {
      grid.innerHTML = data.map(productCardHTML).join('');
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
        carousel.innerHTML = all.map(p => `<div class="min-w-[300px] max-w-[300px]">${productCardHTML(p)}</div>`).join('');
      } else {
        carousel.innerHTML = '<div class="w-full text-center text-slate-400 py-12">No products available.</div>';
      }
    } else {
      carousel.innerHTML = products.map(p => `<div class="min-w-[300px] max-w-[300px]">${productCardHTML(p)}</div>`).join('');
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
    grid.innerHTML = data.map(productCardHTML).join('');
    if (window.lucide) window.lucide.createIcons();
  } catch (e) {
    grid.innerHTML = '<p class="col-span-full text-center text-slate-400 py-12">Unable to load products.</p>';
  }

  const filterBtns = document.querySelectorAll('[data-filter]');
  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
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
        ? filtered.map(productCardHTML).join('')
        : '<p class="col-span-full text-center text-slate-400 py-12">No products in this category.</p>';
      if (window.lucide) window.lucide.createIcons();
    });
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
    if (priceEl) priceEl.innerHTML = formatPrice(data.price, data.sale_price, data.currency);

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
        relatedGrid.innerHTML = related.map(productCardHTML).join('');
      } else {
        relatedGrid.innerHTML = '<p class="col-span-full text-center text-slate-400 py-8">No related products.</p>';
      }
    }

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
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    success.classList.remove('hidden');
    form.reset();
    setTimeout(() => success.classList.add('hidden'), 4000);
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

    const img = data.cover_image || 'https://images.pexels.com/photos/5900545/pexels-photo-5900545.jpeg?auto=cs&s=800';
    const date = data.published_at || data.created_at?.split('T')[0] || '';

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
            <p class="text-xs text-slate-400">${date}</p>
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

document.addEventListener('DOMContentLoaded', () => {
  initScrollProgress();
  initNavScroll();
  initMobileMenu();
  initBackToTop();
  initRevealAnimations();
  initFAQAccordion();
  initNewsletterForm();
  loadSiteLogo();

  loadFeaturedProducts();
  loadBestsellers();
  loadProductsPage();
  loadProductDetail();
  loadFAQs();
  loadBlogPage();
  loadBlogPostDetail();

  setTimeout(hideLoadingOverlay, 300);
});
