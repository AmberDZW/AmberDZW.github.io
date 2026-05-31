(function () {
  const navToggle = document.querySelector("[data-nav-toggle]");
  const siteNav = document.querySelector("[data-site-nav]");
  const toTop = document.querySelector("[data-to-top]");
  const filterButtons = Array.from(document.querySelectorAll("[data-filter]"));
  const seriesCards = Array.from(document.querySelectorAll("[data-kind]"));
  const tabButtons = Array.from(document.querySelectorAll("[data-tab]"));
  const tabPanels = Array.from(document.querySelectorAll("[data-panel]"));
  const quickShortcuts = document.querySelector("[data-quick-shortcuts]");
  const quickResult = document.querySelector(".quick-result");
  const quickResultActions = document.querySelector(".quick-result-actions");
  const quickResetButton = document.querySelector("[data-quick-reset]");
  const quickToast = document.querySelector("[data-quick-toast]");
  const pwaInstallButton = document.querySelector("[data-pwa-install]");
  const pwaUpdateButton = document.querySelector("[data-pwa-update]");
  const networkState = document.querySelector("[data-network-state]");
  const iosInstallHint = document.querySelector("[data-ios-install-hint]");
  const shellBarItems = Array.from(document.querySelectorAll("[data-app-shell-bar] .app-shell-item"));

  const QUICK_USAGE_KEY = "zy.quickShortcutsUsage.v1";
  const LAST_ROUTE_KEY = "zy.lastRoute.v1";
  const QUICK_MAX_ITEMS = 4;
  const QUICK_USAGE_HALF_LIFE_DAYS = 14;
  const QUICK_USAGE_HALF_LIFE = QUICK_USAGE_HALF_LIFE_DAYS * 24 * 60 * 60 * 1000;
  const QUICK_RESET_DELAY = 280;

  const DEFAULT_RESOURCE_FILTER = "all";
  const DEFAULT_TOOL_TAB = "toolset";
  const DEFAULT_RESOURCE_FOCUS = "";
  const RESOURCE_FILTERS = ["all", "prompt", "starter", "safety", "tool"];
  const RESOURCE_COMPONENT_IDS = ["prompt", "starter", "safety", "tool"];
  const TOOL_TABS = ["toolset", "scenes", "review"];
  const ALLOWED_ROUTE_TARGETS = ["top", "roadmap", "resources", "safety", "tools", "faq"];
  const APP_SHELL_ROUTE_MAP = {
    roadmap: "top",
    safety: "resources"
  };

  let isApplyingRouteFromHash = false;

  function now() {
    return Date.now();
  }

  function isPrimaryMouseAction(event) {
    return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
  }

  function normalizeRouteTarget(target) {
    const raw = typeof target === "string" && target.trim() ? target.trim().replace(/^#/, "") : "top";
    return ALLOWED_ROUTE_TARGETS.includes(raw) ? raw : "top";
  }

  function sanitizeRouteTarget(target) {
    return normalizeRouteTarget(target);
  }

  function sanitizeRouteFocus(componentId) {
    return RESOURCE_COMPONENT_IDS.includes(componentId) ? componentId : DEFAULT_RESOURCE_FOCUS;
  }

  function sanitizeRouteFilter(filter) {
    return RESOURCE_FILTERS.includes(filter) ? filter : DEFAULT_RESOURCE_FILTER;
  }

  function sanitizeRouteTab(tab) {
    return TOOL_TABS.includes(tab) ? tab : DEFAULT_TOOL_TAB;
  }

  function normalizePath(pathname) {
    if (typeof pathname !== "string") return "/";
    const clean = pathname.trim();
    if (!clean) return "/";
    return clean === "/" ? "/" : clean.replace(/\/+$/, "");
  }

  function buildRouteHash(target, params) {
    const routeTarget = normalizeRouteTarget(target) || "top";
    const query = [];

    if (params && typeof params === "object") {
      Object.entries(params).forEach(([key, value]) => {
        if (value === null || value === undefined || value === "") return;
        if (Array.isArray(value)) return;
        query.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
      });
    }

    return query.length > 0 ? `#${routeTarget}?${query.join("&")}` : `#${routeTarget}`;
  }

  function syncRouteToUrl(target, params, { replace = false } = {}) {
    const hash = buildRouteHash(target, params);
    if (window.location.hash === hash) return;

    isApplyingRouteFromHash = true;
    if (replace) {
      window.history.replaceState(null, "", hash);
    } else {
      window.location.hash = hash;
    }
    setTimeout(() => {
      isApplyingRouteFromHash = false;
    }, 0);
  }

  function rememberLastRoute(target, params) {
    try {
      const route = {
        target: normalizeRouteTarget(target),
        params: params && typeof params === "object" ? params : {},
        t: now()
      };

      window.localStorage.setItem(LAST_ROUTE_KEY, JSON.stringify(route));
    } catch (error) {
      // localStorage may be unavailable
    }
  }

  function loadLastRoute() {
    try {
      const raw = window.localStorage.getItem(LAST_ROUTE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;

      const target = sanitizeRouteTarget(parsed.target) || "top";
      const params = parsed.params && typeof parsed.params === "object" ? parsed.params : {};

      return {
        target,
        params
      };
    } catch (error) {
      return null;
    }
  }

  function getCurrentRouteState() {
    const rawHash = window.location.hash || "";
    const hashText = rawHash.replace(/^#/, "");

    if (!hashText) {
      return { target: "top", params: new URLSearchParams() };
    }

    const [targetText, queryText = ""] = hashText.split("?");
    const params = new URLSearchParams(queryText);
    return {
      target: sanitizeRouteTarget(targetText),
      params
    };
  }

  function routeFromHashString(hashText) {
    if (typeof hashText !== "string") return { target: "top", params: new URLSearchParams() };
    const normalized = hashText.startsWith("#") ? hashText.slice(1) : hashText;
    if (!normalized) return { target: "top", params: new URLSearchParams() };

    const [targetText, queryText = ""] = normalized.split("?");
    return {
      target: sanitizeRouteTarget(targetText),
      params: new URLSearchParams(queryText)
    };
  }

  function getQuickComponents() {
    const links = Array.from(
      quickShortcuts ? quickShortcuts.querySelectorAll("[data-quick-link]") : []
    );

    return links.map((link, index) => {
      const id = link.dataset.componentId || `component-${index}`;
      const name = link.dataset.componentName || link.textContent.trim() || `Component ${index + 1}`;
      const hint = link.dataset.componentHint || "";
      const route = link.dataset.route || "";
      const routeMode = link.dataset.routeMode || "internal-first";
      const href = link.getAttribute("href") || "";
      const componentFocus = sanitizeRouteFocus(link.dataset.componentFocus || "");
      const badge = link.querySelector(".quick-badge") || null;

      return {
        id,
        name,
        hint,
        route,
        routeMode,
        componentFocus,
        href,
        link,
        badge,
        defaultIndex: index
      };
    });
  }

  function sanitizeUsageRecord(record) {
      return {
        count: Number(record?.count) > 0 ? Math.max(1, Number(record.count)) : 0,
        lastUsedAt: Number(record?.lastUsedAt) > 0 ? Number(record.lastUsedAt) : 0,
        componentName: typeof record?.componentName === "string" ? record.componentName : null,
        componentHref: typeof record?.componentHref === "string" ? record.componentHref : null,
        componentRoute: typeof record?.componentRoute === "string" ? record.componentRoute : null,
        componentRouteMode: typeof record?.componentRouteMode === "string" ? record.componentRouteMode : null,
        componentFocus: typeof record?.componentFocus === "string" ? record.componentFocus : null
      };
  }

  function usageScore(usage, currentTime = now()) {
    if (!usage?.count || !usage.lastUsedAt) {
      return usage?.count || 0;
    }
    const age = Math.max(currentTime - usage.lastUsedAt, 0);
    const decay = Math.exp(-age / QUICK_USAGE_HALF_LIFE);
    return usage.count * (0.3 + decay);
  }

  function setQuickToast(message, duration = 1600) {
    if (!quickToast) return;

    clearTimeout(window.__quickToastTimer);
    clearTimeout(window.__quickToastDismissTimer);
    quickToast.textContent = message;
    quickToast.hidden = false;
    quickToast.classList.add("is-visible");

    window.__quickToastTimer = setTimeout(() => {
      quickToast.classList.remove("is-visible");
      window.__quickToastDismissTimer = setTimeout(() => {
        quickToast.hidden = true;
      }, 180);
    }, duration);
  }

  function syncQuickResetButton(hasUsageData) {
    if (!quickResetButton) return;
    quickResetButton.hidden = !hasUsageData;
  }

  function loadShortcutUsage() {
    try {
      const raw = window.localStorage.getItem(QUICK_USAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
      return parsed;
    } catch (error) {
      return {};
    }
  }

  function saveShortcutUsage(state) {
    try {
      window.localStorage.setItem(QUICK_USAGE_KEY, JSON.stringify(state));
    } catch (error) {
      // localStorage may be restricted
    }
  }

  function getQuickBadge(link) {
    const badge = document.createElement("span");
    badge.className = "quick-badge";
    badge.setAttribute("aria-hidden", "true");
    link.appendChild(badge);
    return badge;
  }

  function recordShortcutUsage(componentId, componentName, componentHref, componentRoute, componentRouteMode, componentFocus) {
    if (!componentId) return;
    const usageMap = loadShortcutUsage();
    const current = sanitizeUsageRecord(usageMap[componentId]);

    usageMap[componentId] = {
      count: current.count + 1,
      lastUsedAt: now(),
      componentName: componentName || componentId,
      componentHref: componentHref || current.componentHref,
      componentRoute: componentRoute || current.componentRoute,
      componentRouteMode: componentRouteMode || current.componentRouteMode || "internal-first",
      componentFocus: componentFocus || current.componentFocus
    };

    saveShortcutUsage(usageMap);
  }

  function applyQuickShortcutOrder() {
    if (!quickShortcuts) return [];

    const currentTime = now();
    const usageMap = loadShortcutUsage();
    const components = getQuickComponents().map((component) => {
      const usage = sanitizeUsageRecord(usageMap[component.id]);
      return {
        ...component,
        usageCount: usage.count,
        lastUsedAt: usage.lastUsedAt,
        score: usageScore(usage, currentTime)
      };
    });

    components.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.lastUsedAt !== a.lastUsedAt) return b.lastUsedAt - a.lastUsedAt;
      return a.defaultIndex - b.defaultIndex;
    });

    components.forEach((item, index) => {
      if (!item.link) return;
      quickShortcuts.appendChild(item.link);

      const badge = item.badge || getQuickBadge(item.link);
      if (index < QUICK_MAX_ITEMS && item.score > 0) {
        badge.textContent = String(index + 1);
        badge.classList.add("is-visible");
      } else {
        badge.textContent = "";
        badge.classList.remove("is-visible");
      }
    });

    const usedItems = components.filter((item) => item.score > 0).slice(0, QUICK_MAX_ITEMS);
    const quickResultTitle = quickResult ? quickResult.querySelector("strong") : null;
    const quickResultText = quickResult ? quickResult.querySelector("p") : null;

    if (quickResultTitle && quickResultText) {
      if (usedItems.length === 0) {
        quickResultTitle.textContent = "使用习惯";
        quickResultText.textContent =
          "你还没点过捷径入口，先用一次后会把常用入口排到更前，方便快速打开。";
      } else {
        quickResultTitle.textContent = "常用入口如下";
        quickResultText.textContent =
          usedItems.length > 1
            ? `当前常用：${usedItems.map((item) => item.name).join("、")}`
            : "当前只保存了1个常用入口，继续用它会更贴合你的习惯。";
      }
    }

    if (quickResultActions) {
      syncQuickResetButton(components.some((item) => item.score > 0));
    }

    return components;
  }

  function focusResourceComponent(componentId) {
    if (!componentId) return null;

    const selector = `#resource-component-${componentId}, .series-card[data-component-id="${componentId}"], article[data-kind="${componentId}"]`;
    const componentCard = document.querySelector(selector);
    if (!componentCard || componentCard.hidden) return null;

    componentCard.classList.add("is-focus");
    componentCard.scrollIntoView({ behavior: "smooth", block: "start" });
    componentCard.setAttribute("tabindex", "-1");
    componentCard.focus({ preventScroll: true });
    setTimeout(() => {
      componentCard.classList.remove("is-focus");
      componentCard.removeAttribute("tabindex");
    }, 1200);

    return componentCard;
  }

  function isSamePageHashRoute(routeString) {
    try {
      const target = new URL(routeString, window.location.href);
      return normalizePath(target.origin + target.pathname) === normalizePath(location.origin + location.pathname);
    } catch (error) {
      return false;
    }
  }

  function toIndexHashUrl(hashText) {
    const indexUrl = new URL("./index.html", window.location.href);
    indexUrl.hash = hashText || "#top";
    return indexUrl.href;
  }

  function resolveSafeRoute(routeInput) {
    if (typeof routeInput !== "string") {
      return routeFromHashString("#top");
    }

    const routeText = routeInput.trim();
    if (!routeText) {
      return routeFromHashString("#top");
    }

    if (routeText.startsWith("#")) {
      const routeState = routeFromHashString(routeText);
      const safeTarget = sanitizeRouteTarget(routeState.target);
      return {
        target: safeTarget,
        params: sanitizeRouteParamsForTarget(safeTarget, routeState.params)
      };
    }

    try {
      const targetUrl = new URL(routeText, window.location.href);
      if (!isSamePageHashRoute(targetUrl.href)) {
        return null;
      }
      const fallbackTarget = routeFromHashString(targetUrl.hash || "#top");
      const safeTarget = sanitizeRouteTarget(fallbackTarget.target);
      return {
        target: safeTarget,
        params: sanitizeRouteParamsForTarget(safeTarget, fallbackTarget.params)
      };
    } catch (error) {
      return routeFromHashString("#top");
    }
  }

  function navigateToQuickDestination(route, href, routeMode = "internal-first", focusComponent = "") {
    const safeMode = typeof routeMode === "string" && routeMode === "external-only" ? "external-only" : "internal-first";
    const resolved = resolveSafeRoute(route);
    const safeHref = href || toIndexHashUrl("#top");

    if (safeMode === "external-only" && href) {
      window.location.href = href;
      return;
    }

    if (!resolved) {
      window.location.href = safeHref;
      return;
    }

    const applyFocus = (targetState) => {
      if (!focusComponent || focusComponent === "all") return;
      setTimeout(() => {
        focusResourceComponent(focusComponent);
      }, 40);
    };

    try {
      const routeResult = applyRoute(resolved.target, resolved.params, {
        updateHistory: true,
        skipScroll: false
      });
      if (focusComponent) {
        applyFocus(routeResult);
      }
    } catch (error) {
      window.location.href = safeHref;
    }
  }

  function bindQuickShortcutTracking() {
    if (!quickShortcuts) return;

    const links = Array.from(quickShortcuts.querySelectorAll("[data-quick-link]"));
    let quickNavigationInFlight = false;
    links.forEach((link) => {
      const componentId = link.dataset.componentId;
      if (!componentId) return;

      const componentName = link.dataset.componentName || link.textContent.trim() || "快捷入口";
      const componentRoute = link.dataset.route || "";
      const componentRouteMode = link.dataset.routeMode || "internal-first";
      const componentFocus = sanitizeRouteFocus(link.dataset.componentFocus || "");
      const href = link.getAttribute("href") || "#";

      const handleQuickAction = () => {
        if (quickNavigationInFlight) return;
        quickNavigationInFlight = true;

        recordShortcutUsage(componentId, componentName, href, componentRoute, componentRouteMode, componentFocus);
        const orderedComponents = applyQuickShortcutOrder();
        const selected = orderedComponents.find((item) => item.id === componentId);
        const selectedName = selected?.name || componentName;

        setQuickToast(`\u5df2\u4f18\u5316\uff1a${selectedName}`);
        setTimeout(() => {
          navigateToQuickDestination(componentRoute, href, componentRouteMode, componentFocus);
          quickNavigationInFlight = false;
        }, QUICK_RESET_DELAY);
      };

      link.addEventListener("click", (event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        if (typeof event.button === "number" && event.button !== 0) return;
        event.preventDefault();
        handleQuickAction();
      });

      link.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        handleQuickAction();
      });
    });

    if (quickResetButton) {
      quickResetButton.addEventListener("click", () => {
        try {
          window.localStorage.removeItem(QUICK_USAGE_KEY);
        } catch (error) {
          // ignore localStorage failures
        }
        applyQuickShortcutOrder();
        setQuickToast("已清空快捷入口历史");
      });
    }
  }

  function getCurrentSectionId() {
    return normalizeRouteTarget((window.location.hash || "").replace(/^#/, "").split("?")[0] || "top");
  }

  function isDefaultRouteTarget(target) {
    return normalizeRouteTarget(target) === "top";
  }

  function isCurrentRouteExact(target, params) {
    const safeParams = sanitizeRouteParamsForTarget(target, params);
    const current = getCurrentRouteState();
    const currentParams = sanitizeRouteParamsForTarget(current.target, current.params);

    if (normalizeRouteTarget(target) !== current.target) {
      return false;
    }

    const keys = new Set([...Object.keys(currentParams), ...Object.keys(safeParams)]);
    for (const key of keys) {
      if (String(currentParams[key] || "") !== String(safeParams[key] || "")) {
        return false;
      }
    }

    return true;
  }

  function setActiveFilterButton(targetFilter) {
    filterButtons.forEach((item) => {
      const isActive = item.dataset.filter === targetFilter;
      item.classList.toggle("is-active", isActive);
      item.setAttribute("aria-selected", String(isActive));
    });
  }

  function setActiveTabButton(targetTab) {
    tabButtons.forEach((button) => {
      const isActive = button.dataset.tab === targetTab;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", String(isActive));
    });

    tabPanels.forEach((panel) => {
      const isActive = panel.dataset.panel === targetTab;
      panel.classList.toggle("is-active", isActive);
      panel.hidden = !isActive;
    });
  }

  function activateResourceFilter(filter) {
    const targetFilter = sanitizeRouteFilter(filter);
    setActiveFilterButton(targetFilter);

    seriesCards.forEach((card) => {
      const shouldShow = targetFilter === "all" || card.dataset.kind === targetFilter;
      card.hidden = !shouldShow;
    });

    return targetFilter;
  }

  function activateToolTab(tab) {
    const targetTab = sanitizeRouteTab(tab);
    setActiveTabButton(targetTab);
    return targetTab;
  }

  function syncAppShellBar(routeTarget) {
    if (!shellBarItems.length) return;

    const normalizedTarget = normalizeRouteTarget(routeTarget);
    const target = APP_SHELL_ROUTE_MAP[normalizedTarget] || normalizedTarget;
    shellBarItems.forEach((item) => {
      const href = (item.getAttribute("href") || "").replace(/^#/, "").trim();
      const isActive = href && href === target;
      item.classList.toggle("is-active", isActive);
      item.setAttribute("aria-current", isActive ? "page" : "false");
    });
  }

  function sanitizeRouteParamsForTarget(target, params) {
    const safe = {};
    if (!params || typeof params !== "object") return safe;
    const readParam = (key) =>
      typeof params.get === "function" ? params.get(key) : params[key];

    if (target === "resources") {
      const safeFilter = sanitizeRouteFilter(readParam("filter"));
      const safeFocus = sanitizeRouteFocus(readParam("focus"));
      safe.filter = safeFilter;
      safe.focus = safeFocus || "";
    }

    if (target === "tools") {
      safe.tab = sanitizeRouteTab(readParam("tab"));
    }

    return safe;
  }

  function applyRoute(
    target,
    params,
    {
      updateHistory = false,
      skipScroll = true,
      syncUrl = true
    } = {}
  ) {
    const normalizedTarget = normalizeRouteTarget(target);
    const safeParams = sanitizeRouteParamsForTarget(normalizedTarget, params);
    const targetElement = document.getElementById(normalizedTarget);
    let filter = DEFAULT_RESOURCE_FILTER;
    let tab = DEFAULT_TOOL_TAB;
    let focusedComponent = "";
    const previousTarget = getCurrentSectionId();
    const shouldScroll =
      targetElement &&
      (previousTarget !== normalizedTarget || Math.abs(targetElement.getBoundingClientRect().top) > 4);

    if (normalizedTarget === "resources") {
      filter = activateResourceFilter(safeParams.filter || DEFAULT_RESOURCE_FILTER);
      focusedComponent = safeParams.focus || "";
      if (focusedComponent) {
        requestAnimationFrame(() => {
          focusResourceComponent(focusedComponent);
        });
      }
    } else {
      activateResourceFilter(DEFAULT_RESOURCE_FILTER);
    }

    if (normalizedTarget === "tools") {
      tab = activateToolTab(safeParams.tab || DEFAULT_TOOL_TAB);
    } else {
      activateToolTab(DEFAULT_TOOL_TAB);
    }

    syncAppShellBar(normalizedTarget);
    rememberLastRoute(normalizedTarget, {
      ...(safeParams.filter ? { filter } : {}),
      ...(safeParams.tab ? { tab } : {}),
      ...(safeParams.focus ? { focus: focusedComponent } : {})
    });

    if (syncUrl && (updateHistory || !isCurrentRouteExact(normalizedTarget, safeParams))) {
      syncRouteToUrl(normalizedTarget, safeParams, {
        replace: updateHistory ? false : true
      });
    }

    if (targetElement && !skipScroll && shouldScroll) {
      targetElement.scrollIntoView({ behavior: "auto", block: "start" });
    }

    return { target: normalizedTarget, params: safeParams };
  }

  function applyHashRoute() {
    if (isApplyingRouteFromHash) return;
    const route = getCurrentRouteState();
    const target = sanitizeRouteTarget(route.target);
    const safeParams = sanitizeRouteParamsForTarget(target, route.params);
    const canonicalHash = buildRouteHash(target, safeParams);

    if (window.location.hash !== canonicalHash) {
      syncRouteToUrl(target, safeParams, { replace: true });
      return;
    }

    applyRoute(target, safeParams, {
      updateHistory: false,
      skipScroll: false,
      syncUrl: false
    });
  }

  function applyDefaultRoute() {
    const saved = loadLastRoute();
    const hasLastRoute =
      saved &&
      (saved.target !== "top" || (typeof saved.params === "object" && Object.keys(saved.params || {}).length > 0));

    if (hasLastRoute) {
      const safeSaved = {
        target: sanitizeRouteTarget(saved.target),
        params: new URLSearchParams()
      };

      Object.entries(saved.params || {}).forEach(([key, value]) => {
        if (typeof value === "string") {
          safeSaved.params.set(key, value);
        }
      });

      const normalized = sanitizeRouteParamsForTarget(safeSaved.target, safeSaved.params);
      syncRouteToUrl(safeSaved.target, normalized, { replace: true });
      applyRoute(safeSaved.target, safeSaved.params, {
        updateHistory: false,
        skipScroll: false,
        syncUrl: false
      });
    } else {
      activateResourceFilter(DEFAULT_RESOURCE_FILTER);
      activateToolTab(DEFAULT_TOOL_TAB);
      syncAppShellBar("top");
      rememberLastRoute("top", {});
    }
  }

  function isStandaloneMode() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    );
  }

  function isIosDevice() {
    const ua = window.navigator.userAgent || "";
    const isTouchMac = window.navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
    return (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) || isTouchMac;
  }

  function applyPwaHints() {
    if (!pwaInstallButton && !iosInstallHint && !pwaUpdateButton) return;

    if (isStandaloneMode()) {
      if (pwaInstallButton) pwaInstallButton.hidden = true;
      if (iosInstallHint) iosInstallHint.hidden = true;
      if (pwaUpdateButton) pwaUpdateButton.hidden = true;
      return;
    }

    if (isIosDevice()) {
      if (pwaInstallButton) pwaInstallButton.hidden = true;
      if (iosInstallHint) iosInstallHint.hidden = false;
      return;
    }

    if (pwaInstallButton) pwaInstallButton.hidden = false;
    if (iosInstallHint) iosInstallHint.hidden = true;
  }

  function updateNetworkState() {
    if (!networkState) return;

    if (navigator.onLine) {
      networkState.classList.remove("is-offline");
      networkState.textContent = "在线可用";
    } else {
      networkState.classList.add("is-offline");
      networkState.textContent = "当前离线，系统将自动回退到离线页";
    }
  }

  function applyPwaUpdateButtonState(registration) {
    if (!pwaUpdateButton) return;

    pwaUpdateButton.textContent = "更新版本";
    pwaUpdateButton.hidden = false;
    if (networkState) {
      networkState.textContent = "可用更新，可刷新";
      networkState.classList.remove("is-offline");
    }

    pwaUpdateButton.onclick = () => {
      const waiting = registration.waiting;
      if (!waiting) return;
      window.__zyReloadPending = true;
      waiting.postMessage({ type: "SKIP_WAITING" });
      pwaUpdateButton.textContent = "更新中...";
      pwaUpdateButton.disabled = true;
      pwaUpdateButton.ariaDisabled = "true";
    };
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    window.addEventListener("load", async () => {
      try {
        const swPath = new URL("../sw.js", window.location.href).pathname;
        const swScope = new URL("../", window.location.href).pathname;
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations
            .filter((item) => item.scope !== new URL(swScope, window.location.origin).href)
            .map((item) => item.unregister())
        );
        const registration = await navigator.serviceWorker.register(swPath, { scope: swScope });
        window.__zySwRegistration = registration;
        registration.update();

        if (registration.waiting && navigator.serviceWorker.controller) {
          applyPwaUpdateButtonState(registration);
        }

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              applyPwaUpdateButtonState(registration);
            }
          });
        });
      } catch (error) {
        console.warn("PWA: service worker registration failed", error);
      }
    });

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!window.__zyReloadPending) return;
      window.__zyReloadPending = false;
      window.location.reload();
    });
  }

  function bindPwaInstallPrompt() {
    if (!pwaInstallButton || isStandaloneMode()) {
      if (pwaInstallButton) {
        pwaInstallButton.hidden = true;
      }
      if (iosInstallHint) {
        iosInstallHint.hidden = true;
      }
      return;
    }

    let deferredPrompt = null;
    let promptSeenInSession = false;

    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      deferredPrompt = event;
      if (iosInstallHint) {
        iosInstallHint.hidden = true;
      }
      pwaInstallButton.hidden = false;
      if (!promptSeenInSession && networkState) {
        networkState.textContent = "可安装：添加到主屏幕后能更快打开";
        networkState.classList.remove("is-offline");
        promptSeenInSession = true;
      }
    });

    pwaInstallButton.addEventListener("click", async () => {
      if (!deferredPrompt) {
        if (networkState) {
          networkState.textContent = "当前没有系统安装提示，可手动添加到主屏幕";
        }
        return;
      }

      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      deferredPrompt = null;

      pwaInstallButton.hidden = true;
      if (networkState) {
        networkState.textContent =
          choiceResult && choiceResult.outcome === "accepted"
            ? "安装成功，APP 入口已就绪"
            : "取消安装，稍后可在首页手动触发安装";
      }
    });

    window.addEventListener("appinstalled", () => {
      pwaInstallButton.hidden = true;
      if (iosInstallHint) {
        iosInstallHint.hidden = true;
      }
      if (networkState) {
        networkState.textContent = "安装成功，返回首页继续使用";
      }
    });
  }

  function closeNav() {
    if (!navToggle || !siteNav) return;
    navToggle.setAttribute("aria-expanded", "false");
    siteNav.classList.remove("is-open");
  }

  if (quickShortcuts) {
    applyQuickShortcutOrder();
    bindQuickShortcutTracking();
  }

  bindPwaInstallPrompt();
  registerServiceWorker();
  applyPwaHints();
  updateNetworkState();
  window.addEventListener("online", updateNetworkState);
  window.addEventListener("offline", updateNetworkState);

  if (window.location.hash) {
    applyHashRoute();
  } else {
    applyDefaultRoute();
  }
  window.addEventListener("hashchange", () => {
    applyHashRoute();
  });

  if (navToggle && siteNav) {
    navToggle.addEventListener("click", () => {
      const expanded = navToggle.getAttribute("aria-expanded") === "true";
      navToggle.setAttribute("aria-expanded", String(!expanded));
      siteNav.classList.toggle("is-open", !expanded);
    });

    siteNav.addEventListener("click", (event) => {
      if (event.target instanceof HTMLAnchorElement) closeNav();
    });
  }

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const filter = sanitizeRouteFilter(button.dataset.filter || DEFAULT_RESOURCE_FILTER);
      const routeParams = new URLSearchParams();
      routeParams.set("filter", filter);
      applyRoute("resources", routeParams, { updateHistory: true, skipScroll: true });
    });
  });

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tab = sanitizeRouteTab(button.dataset.tab);
      const routeParams = new URLSearchParams();
      routeParams.set("tab", tab);
      applyRoute("tools", routeParams, { updateHistory: true, skipScroll: true });
    });
  });

  if (toTop) {
    toTop.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    window.addEventListener(
      "scroll",
      () => {
        toTop.classList.toggle("is-visible", window.scrollY > 620);
      },
      { passive: true }
    );
  }
})();

