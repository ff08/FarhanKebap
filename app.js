const CONFIG = {
  // Buraya kendi Google Sheets linkinizi koyun.
  // Ornek: https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit#gid=0
  googleSheetUrl: "https://docs.google.com/spreadsheets/d/18hXcFTXBGkRL7RRvYfiUiKFpSGRbiUHLEoGaLEJsf6k/edit?usp=sharing",
  // Her sekme bir kategori gibi okunur.
  // Tek sekme kullaniyorsaniz bir tane birakin: ["Sayfa1"]
  sheetNames: ["İkram", "Başlangıç", "Kebap & Dürüm", "Pide" ,"Tepsi" , "Lahmacun" , "Şiş" , "İçecek", "Tatlı"],
  currency: "TL",
  // Buraya kendi isletme linklerinizi ekleyin.
  googleMapsReviewUrl: "https://maps.google.com/",
  instagramUrl: "https://www.instagram.com/farhanurfakebapdunyasi",
  menuUpdatedAt: "2026-04-15",
  policyLinks: {
    privacy: "https://farhankebap.com/gizlilik-politikasi",
    terms: "https://farhankebap.com/kullanim-sartlari",
    cookies: "https://farhankebap.com/cerez-politikasi"
  },
  cacheTtlMs: 5 * 60 * 1000
};

const UI_TEXT = {
  tr: {
    loadingTitle: "Menu yukleniyor...",
    loadingSubtitle: "Lutfen bekleyin.",
    errorTitle: "Menu yuklenemedi",
    errorSubtitle: "Google Sheets baglantisini ve yayin ayarlarini kontrol edin.",
    allergens: "Alerjen:",
    weight: "Gramaj:",
    free: "Ikram",
    socialProofTitle: "Yorumlar ve Sosyal Kanit",
    socialProofText: "Deneyiminizi paylasin. Google uzerinden yorum ve puan birakarak diger misafirlere yol gosterebilirsiniz.",
    mapsCta: "Google Maps'te Yorum Yap",
    instagramCta: "Instagram Hesabimiz",
    updatedAt: "Menu guncelleme tarihi:",
    privacyPolicy: "Gizlilik Politikasi",
    terms: "Kullanim Sartlari",
    cookiePolicy: "Cerez Politikasi",
    languageModalTitle: "Dil Secin",
    languageModalText: "Lutfen menu dilini secin."
  },
  en: {
    loadingTitle: "Loading menu...",
    loadingSubtitle: "Please wait.",
    errorTitle: "Menu could not be loaded",
    errorSubtitle: "Check your Google Sheets link and publish settings.",
    allergens: "Allergens:",
    weight: "Weight:",
    free: "Complimentary",
    socialProofTitle: "Reviews and Social Proof",
    socialProofText: "Share your experience. Leave a rating and review on Google to help other guests.",
    mapsCta: "Leave a Google Review",
    instagramCta: "Our Instagram",
    updatedAt: "Menu updated:",
    privacyPolicy: "Privacy Policy",
    terms: "Terms of Use",
    cookiePolicy: "Cookie Policy",
    languageModalTitle: "Choose Language",
    languageModalText: "Please select your menu language."
  }
};

const state = {
  lang: "tr",
  categories: [],
  activeCategoryId: null
};

const els = {
  topHeader: document.querySelector(".top-header"),
  loadingState: document.getElementById("loading-state"),
  errorState: document.getElementById("error-state"),
  menuContent: document.getElementById("menu-content"),
  mobileMenuBar: document.getElementById("mobile-menu-bar"),
  langSelect: document.getElementById("lang-select"),
  langFlag: document.getElementById("lang-flag"),
  imageModal: document.getElementById("image-modal"),
  imageModalImg: document.getElementById("image-modal-img"),
  imageModalClose: document.getElementById("image-modal-close"),
  languageWelcomeModal: document.getElementById("language-welcome-modal"),
  languageWelcomeTitle: document.getElementById("language-welcome-title"),
  languageWelcomeText: document.getElementById("language-welcome-text"),
  languageWelcomeTr: document.getElementById("language-welcome-tr"),
  languageWelcomeEn: document.getElementById("language-welcome-en")
};

let lastScrollY = window.scrollY;
const LANGUAGE_MODAL_SEEN_KEY = "farhan-menu-language-modal-seen-v1";
const LANGUAGE_PREF_KEY = "farhan-menu-language-pref-v1";
const MENU_CACHE_KEY = "farhan-menu-sheet-cache-v1";

function normalizeHeader(key) {
  return String(key || "")
    .trim()
    .toLowerCase()
    .replace(/[ıİ]/g, "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
}

function extractSheetInfo(link) {
  const sheetMatch = link.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const gidMatch = link.match(/[?#&]gid=(\d+)/);
  return {
    sheetId: sheetMatch ? sheetMatch[1] : "",
    gid: gidMatch ? gidMatch[1] : "0"
  };
}

async function fetchSheetRows(googleSheetUrl) {
  const { sheetId } = extractSheetInfo(googleSheetUrl);
  if (!sheetId) {
    throw new Error("Google Sheet ID bulunamadi.");
  }

  const targets = getSheetTargets();
  const cacheKey = `${MENU_CACHE_KEY}:${sheetId}:${targets.join("|")}`;
  const cached = readMenuCache(cacheKey);
  if (cached) {
    return cached;
  }

  const allRowsBySheet = [];
  try {
    for (const sheetName of targets) {
      // Statik web sitelerinde Google gviz endpoint'i CORS sebebiyle engellenebilir.
      // Bu nedenle once CORS uyumlu opensheet endpoint'ini deneriz.
      const opensheetEndpoint = `https://opensheet.elk.sh/${sheetId}/${encodeURIComponent(sheetName)}`;
      const opensheetResponse = await fetch(opensheetEndpoint);

      if (opensheetResponse.ok) {
        const list = await opensheetResponse.json();
        const rows = list.map((row) => {
          const normalized = {};
          Object.entries(row).forEach(([k, v]) => {
            normalized[normalizeHeader(k)] = String(v ?? "").trim();
          });
          return normalized;
        });
        allRowsBySheet.push({ sheetName, rows });
        continue;
      }

      // Fallback: opensheet servisine ulasilamazsa gviz dene.
      const gvizEndpoint = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
      const gvizResponse = await fetch(gvizEndpoint);
      if (!gvizResponse.ok) {
        throw new Error(`Sheet okunamadi: ${sheetName}`);
      }

      const raw = await gvizResponse.text();
      const match = raw.match(/google\.visualization\.Query\.setResponse\(([\s\S]+)\);?$/);
      if (!match?.[1]) {
        throw new Error(`Google Sheets cevabi parse edilemedi: ${sheetName}`);
      }
      const parsed = JSON.parse(match[1]);
      const table = parsed?.table;
      const headers = (table?.cols || []).map((col) => normalizeHeader(col.label));
      const rows = (table?.rows || []).map((row) => {
        const normalized = {};
        (row.c || []).forEach((cell, i) => {
          normalized[headers[i] || `col_${i}`] = cell ? String(cell.v ?? "").trim() : "";
        });
        return normalized;
      });
      allRowsBySheet.push({ sheetName, rows });
    }
  } catch (error) {
    const stale = readMenuCache(cacheKey, true);
    if (stale) {
      return stale;
    }
    throw error;
  }

  writeMenuCache(cacheKey, allRowsBySheet);
  return allRowsBySheet;
}

function getSheetTargets() {
  const names = Array.isArray(CONFIG.sheetNames) ? CONFIG.sheetNames : [];
  const cleaned = names.map((name) => String(name || "").trim()).filter(Boolean);
  if (cleaned.length) return cleaned;
  return ["Sayfa1"];
}

function parseMenuRows(sheetGroups) {
  const grouped = new Map();

  for (const sheetGroup of sheetGroups) {
    const sheetCategoryTr = sheetGroup.sheetName;
    const sheetCategoryEn = sheetGroup.sheetName;

    for (const row of sheetGroup.rows) {
      const categoryTr = row.kategori_basligi || row.category_tr || sheetCategoryTr;
      const categoryEn = row.kategori_basligi_en || row.category_en || sheetCategoryEn;
      const productTr = row.urun_adi || row.product_name_tr || "";
      const productEn = row.urun_adi_en || row.product_name_en || productTr;

      if (!productTr) {
        continue;
      }

      const categoryKey = `${categoryTr}__${categoryEn}`;
      if (!grouped.has(categoryKey)) {
        grouped.set(categoryKey, {
          id: slugify(categoryTr),
          tr: categoryTr,
          en: categoryEn,
          items: []
        });
      }

      const priceRaw = row.fiyat || row.price || "";
      const parsedPrice = formatPrice(priceRaw);

      grouped.get(categoryKey).items.push({
        trName: productTr,
        enName: productEn,
        trDescription: row.urun_icerigi || row.description_tr || "",
        enDescription: row.urun_icerigi_en || row.description_en || row.urun_icerigi || "",
        trAllergen: row.alerjen_madde || row.allergens_tr || "",
        enAllergen: row.alerjen_madde_en || row.allergens_en || row.alerjen_madde || "",
        weight: row.gramaj || row.weight || "",
        price: parsedPrice,
        imageUrl: row.urun_gorseli_link || row.image_url || row.gorsel_link || ""
      });
    }
  }

  return [...grouped.values()];
}

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatPrice(value) {
  if (!value) return "";
  const cleaned = String(value).replace(/[^\d.,]/g, "").replace(",", ".");
  const numeric = Number(cleaned);
  if (!Number.isFinite(numeric) || numeric <= 0) return "";
  return `${numeric.toFixed(2)} ${CONFIG.currency}`;
}

function setStateText() {
  const t = UI_TEXT[state.lang];
  els.loadingState.querySelector(".state-title").textContent = t.loadingTitle;
  els.loadingState.querySelector(".state-subtitle").textContent = t.loadingSubtitle;
  els.errorState.querySelector(".state-title").textContent = t.errorTitle;
  els.errorState.querySelector(".state-subtitle").textContent = t.errorSubtitle;
  els.languageWelcomeTitle.textContent = t.languageModalTitle;
  els.languageWelcomeText.textContent = t.languageModalText;
}

function render() {
  renderCategories();
  renderMenuBar();
  setupSectionObserver();
  bindDynamicEvents();
}

function renderCategories() {
  const t = UI_TEXT[state.lang];
  const categoriesHtml = state.categories
    .map((category) => {
      const title = state.lang === "tr" ? category.tr : category.en;
      const itemsHtml = category.items.map((item) => renderItemCard(item, t)).join("");

      return `
        <section id="${category.id}" class="category-section">
          <h2 class="category-title">${escapeHtml(title)}</h2>
          <div class="items">${itemsHtml}</div>
        </section>
      `;
    })
    .join("");

  els.menuContent.innerHTML = `${categoriesHtml}<div id="deferred-sections"></div>`;
  scheduleDeferredSectionsRender(t);
}

function renderItemCard(item, t) {
  const name = state.lang === "tr" ? item.trName : item.enName;
  const description = state.lang === "tr" ? item.trDescription : item.enDescription;
  const allergen = state.lang === "tr" ? item.trAllergen : item.enAllergen;
  const image = item.imageUrl || "./assets/no-image.svg";
  const price = item.price ? item.price : t.free;

  return `
    <article class="item-card">
      <img class="item-image" src="${image}" alt="${escapeHtml(name)}" loading="lazy" />
      <div class="item-main">
        <div class="item-top">
          <h3 class="item-name">${escapeHtml(name)}</h3>
          <p class="item-price">${escapeHtml(price)}</p>
        </div>
        ${description ? `<p class="item-desc">${escapeHtml(description)}</p>` : ""}
        ${item.weight ? `<p class="item-meta">${t.weight} ${escapeHtml(item.weight)}</p>` : ""}
        ${
          allergen
            ? `<p class="item-meta"><span class="allergen-label">${t.allergens}</span>${escapeHtml(allergen)}</p>`
            : ""
        }
      </div>
    </article>
  `;
}

function renderMenuBar() {
  els.mobileMenuBar.innerHTML = state.categories
    .map((category) => {
      const title = state.lang === "tr" ? category.tr : category.en;
      const isActive = state.activeCategoryId === category.id ? "active" : "";
      return `<button type="button" class="category-chip ${isActive}" data-target="${category.id}">${escapeHtml(title)}</button>`;
    })
    .join("");

  els.mobileMenuBar.querySelectorAll(".category-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const id = chip.dataset.target;
      const target = document.getElementById(id);
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      state.activeCategoryId = id;
      highlightActiveChip();
    });
  });
}

function renderSocialProof(t) {
  const mapsUrl = escapeHtml(CONFIG.googleMapsReviewUrl || "https://maps.google.com/");
  const instagramUrl = escapeHtml(CONFIG.instagramUrl || "https://instagram.com/");

  return `
    <section class="social-proof">
      <h2 class="category-title">${escapeHtml(t.socialProofTitle)}</h2>
      <p class="social-proof-text">${escapeHtml(t.socialProofText)}</p>
      <div class="social-proof-actions">
        <a class="social-proof-btn" href="${mapsUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(t.mapsCta)}</a>
        <a class="social-proof-btn social-proof-btn-secondary" href="${instagramUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(t.instagramCta)}</a>
      </div>
    </section>
  `;
}

function renderFooterInfo(t) {
  const updated = formatUpdatedDate(CONFIG.menuUpdatedAt, state.lang);
  const privacyUrl = escapeHtml(CONFIG.policyLinks?.privacy || "#");
  const termsUrl = escapeHtml(CONFIG.policyLinks?.terms || "#");
  const cookiesUrl = escapeHtml(CONFIG.policyLinks?.cookies || "#");

  return `
    <section class="menu-footer">
      <p class="menu-updated">${escapeHtml(t.updatedAt)} ${escapeHtml(updated)}</p>
      <div class="policy-links">
        <a class="policy-link" href="${privacyUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(t.privacyPolicy)}</a>
        <a class="policy-link" href="${termsUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(t.terms)}</a>
        <a class="policy-link" href="${cookiesUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(t.cookiePolicy)}</a>
      </div>
    </section>
  `;
}

function scheduleDeferredSectionsRender(t) {
  const target = document.getElementById("deferred-sections");
  if (!target) return;

  const renderDeferred = () => {
    target.innerHTML = `${renderSocialProof(t)}${renderFooterInfo(t)}`;
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(renderDeferred, { timeout: 600 });
  } else {
    setTimeout(renderDeferred, 0);
  }
}

function bindDynamicEvents() {
  els.menuContent.querySelectorAll(".item-image").forEach((img) => {
    img.addEventListener("click", () => openImageModal(img.getAttribute("src"), img.getAttribute("alt")));
  });
}

function setupSectionObserver() {
  const sections = [...document.querySelectorAll(".category-section")];
  if (!sections.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      state.activeCategoryId = visible.target.id;
      highlightActiveChip();
    },
    {
      rootMargin: "-25% 0px -65% 0px",
      threshold: [0.2, 0.5, 0.8]
    }
  );

  sections.forEach((section) => observer.observe(section));
}

function highlightActiveChip() {
  els.mobileMenuBar.querySelectorAll(".category-chip").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.target === state.activeCategoryId);
  });
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function showError() {
  els.loadingState.classList.add("hidden");
  els.menuContent.classList.add("hidden");
  els.mobileMenuBar.classList.add("hidden");
  els.errorState.classList.remove("hidden");
}

function showMenu() {
  els.loadingState.classList.add("hidden");
  els.errorState.classList.add("hidden");
  els.menuContent.classList.remove("hidden");
  els.mobileMenuBar.classList.remove("hidden");
  els.topHeader.classList.remove("header-hidden-scroll");
}

function openImageModal(src, alt) {
  if (!src) return;
  els.imageModalImg.src = src;
  els.imageModalImg.alt = alt || "";
  els.imageModal.classList.remove("hidden");
}

function closeImageModal() {
  els.imageModal.classList.add("hidden");
  els.imageModalImg.src = "";
  els.imageModalImg.alt = "";
}

function applyLanguageToControls() {
  const flagByLang = {
    tr: "🇹🇷",
    en: "🇬🇧"
  };
  els.langSelect.value = state.lang;
  els.langFlag.textContent = flagByLang[state.lang] || "🌐";
}

function formatUpdatedDate(value, lang) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value || "-";
  }
  return new Intl.DateTimeFormat(lang === "tr" ? "tr-TR" : "en-US", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(parsed);
}

function readMenuCache(cacheKey, allowStale = false) {
  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.timestamp || !Array.isArray(parsed?.data)) return null;
    const isFresh = Date.now() - parsed.timestamp <= CONFIG.cacheTtlMs;
    if (!isFresh && !allowStale) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeMenuCache(cacheKey, data) {
  try {
    localStorage.setItem(
      cacheKey,
      JSON.stringify({
        timestamp: Date.now(),
        data
      })
    );
  } catch {
    // Ignore cache write errors (quota/private mode).
  }
}

function openLanguageWelcomeModal() {
  els.languageWelcomeModal.classList.remove("hidden");
}

function closeLanguageWelcomeModal() {
  els.languageWelcomeModal.classList.add("hidden");
}

function chooseLanguage(lang) {
  state.lang = lang === "en" ? "en" : "tr";
  document.documentElement.lang = state.lang;
  setStateText();
  applyLanguageToControls();
  localStorage.setItem(LANGUAGE_PREF_KEY, state.lang);
  els.langSelect.closest(".header-actions")?.classList.add("hidden");
  if (state.categories.length) {
    render();
  }
}

function setupLanguageWelcomeFlow() {
  const savedLang = localStorage.getItem(LANGUAGE_PREF_KEY);
  if (savedLang === "tr" || savedLang === "en") {
    state.lang = savedLang;
    document.documentElement.lang = state.lang;
  }

  const seen = localStorage.getItem(LANGUAGE_MODAL_SEEN_KEY) === "1";
  if (seen) {
    els.langSelect.closest(".header-actions")?.classList.add("hidden");
  }
  if (!seen) {
    openLanguageWelcomeModal();
  }

  els.languageWelcomeTr.addEventListener("click", () => {
    chooseLanguage("tr");
    localStorage.setItem(LANGUAGE_MODAL_SEEN_KEY, "1");
    closeLanguageWelcomeModal();
  });

  els.languageWelcomeEn.addEventListener("click", () => {
    chooseLanguage("en");
    localStorage.setItem(LANGUAGE_MODAL_SEEN_KEY, "1");
    closeLanguageWelcomeModal();
  });
}

function setupMenuBarScrollVisibility() {
  window.addEventListener(
    "scroll",
    () => {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollY;

      if (currentY < 24) {
        els.topHeader.classList.remove("header-hidden-scroll");
        lastScrollY = currentY;
        return;
      }

      if (Math.abs(delta) < 8) {
        return;
      }

      if (delta > 0) {
        els.topHeader.classList.add("header-hidden-scroll");
      } else {
        els.topHeader.classList.remove("header-hidden-scroll");
      }

      lastScrollY = currentY;
    },
    { passive: true }
  );
}

async function bootstrap() {
  setupLanguageWelcomeFlow();
  setStateText();
  applyLanguageToControls();
  setupMenuBarScrollVisibility();

  els.langSelect.addEventListener("change", () => {
    state.lang = els.langSelect.value === "en" ? "en" : "tr";
    document.documentElement.lang = state.lang;
    setStateText();
    applyLanguageToControls();
    localStorage.setItem(LANGUAGE_PREF_KEY, state.lang);
    if (state.categories.length) {
      render();
    }
  });

  els.imageModalClose.addEventListener("click", closeImageModal);
  els.imageModal.addEventListener("click", (event) => {
    if (event.target === els.imageModal) {
      closeImageModal();
    }
  });

  try {
    const rows = await fetchSheetRows(CONFIG.googleSheetUrl);
    const categories = parseMenuRows(rows);

    if (!categories.length) {
      throw new Error("Google Sheets satirlarinda gecerli menu verisi yok.");
    }

    state.categories = categories;
    state.activeCategoryId = categories[0].id;
    render();
    showMenu();
  } catch (error) {
    console.error(error);
    showError();
  }
}

bootstrap();
