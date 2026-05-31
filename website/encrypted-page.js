(function () {
  "use strict";

  const rememberDays = 30;
  const sessionHours = 12;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  function fromBase64(value) {
    return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
  }

  function toBase64(bytes) {
    let value = "";
    for (let index = 0; index < bytes.length; index += 1) {
      value += String.fromCharCode(bytes[index]);
    }
    return btoa(value);
  }

  function readPayload() {
    const node = document.getElementById("zhiyu-encrypted-payload");
    if (!node) return null;

    try {
      return JSON.parse(node.textContent || "");
    } catch (error) {
      return null;
    }
  }

  function storageKey(payload) {
    return `zhiyu_decrypt_key_${payload.version}_${payload.salt}`;
  }

  function eachStore(callback) {
    [localStorage, sessionStorage].forEach((store) => {
      try {
        callback(store);
      } catch (error) {
        // Storage can be unavailable in strict privacy modes.
      }
    });
  }

  function clearSavedKeys() {
    eachStore((store) => {
      for (let index = store.length - 1; index >= 0; index -= 1) {
        const key = store.key(index);
        if (key && key.startsWith("zhiyu_decrypt_key_")) {
          store.removeItem(key);
        }
      }
    });
  }

  function readSavedKey(payload) {
    const key = storageKey(payload);
    const stores = [localStorage, sessionStorage];

    for (const store of stores) {
      try {
        const raw = store.getItem(key);
        if (!raw) continue;

        const saved = JSON.parse(raw);
        if (!saved || !saved.key || !saved.expiresAt || Number(saved.expiresAt) < Date.now()) {
          store.removeItem(key);
          continue;
        }

        return fromBase64(saved.key);
      } catch (error) {
        store.removeItem(key);
      }
    }

    return null;
  }

  function rememberKey(payload, keyBytes, remember) {
    const expiresAt = Date.now() + (remember ? rememberDays * 24 : sessionHours) * 60 * 60 * 1000;
    const key = storageKey(payload);
    const value = JSON.stringify({
      version: payload.version,
      expiresAt,
      key: toBase64(keyBytes)
    });

    const targetStore = remember ? localStorage : sessionStorage;
    const otherStore = remember ? sessionStorage : localStorage;
    targetStore.setItem(key, value);
    otherStore.removeItem(key);
  }

  async function deriveKeyBytes(password, payload) {
    const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
      "deriveBits"
    ]);
    const bits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: fromBase64(payload.salt),
        iterations: payload.iterations,
        hash: "SHA-256"
      },
      material,
      256
    );
    return new Uint8Array(bits);
  }

  async function decryptHtml(payload, keyBytes) {
    const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]);
    const plainBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(payload.iv) },
      key,
      fromBase64(payload.ciphertext)
    );
    return decoder.decode(plainBuffer);
  }

  function renderDecryptedDocument(html) {
    // The string is authenticated AES-GCM output produced by our own build step.
    document.open();
    document.write(html);
    document.close();
  }

  function message(text, tone) {
    const node = document.querySelector("[data-lock-message]");
    if (!node) return;
    node.textContent = text;
    node.dataset.tone = tone || "";
  }

  function setBusy(isBusy) {
    const button = document.querySelector("[data-lock-submit]");
    const input = document.querySelector("[data-lock-password]");
    if (button) {
      button.disabled = isBusy;
      button.textContent = isBusy ? "正在打开..." : "打开 ZHIYU";
    }
    if (input) input.disabled = isBusy;
  }

  async function trySavedKey(payload) {
    const saved = readSavedKey(payload);
    if (!saved) return false;

    try {
      const html = await decryptHtml(payload, saved);
      renderDecryptedDocument(html);
      return true;
    } catch (error) {
      clearSavedKeys();
      return false;
    }
  }

  async function handleSubmit(event, payload) {
    event.preventDefault();

    const input = document.querySelector("[data-lock-password]");
    const remember = document.querySelector("[data-lock-remember]");
    const password = input ? input.value.trim() : "";

    if (!password) {
      message("请先输入访问密钥。", "error");
      if (input) input.focus();
      return;
    }

    setBusy(true);
    message("正在用密钥解码内容...", "info");

    try {
      const keyBytes = await deriveKeyBytes(password, payload);
      const html = await decryptHtml(payload, keyBytes);
      rememberKey(payload, keyBytes, Boolean(remember && remember.checked));
      renderDecryptedDocument(html);
    } catch (error) {
      message("密钥不对，请检查大小写和空格。", "error");
      setBusy(false);
      if (input) {
        input.select();
        input.focus();
      }
    }
  }

  async function boot() {
    const payload = readPayload();
    const params = new URLSearchParams(window.location.search);

    if (params.get("logout") === "1" || params.get("lock") === "reset") {
      clearSavedKeys();
    }

    if (!payload) {
      message("没有找到加密内容，请重新发布页面。", "error");
      return;
    }

    if (!window.crypto || !crypto.subtle) {
      message("当前浏览器不支持本地解密，请使用最新版 Chrome、Edge 或 Safari 打开。", "error");
      return;
    }

    const form = document.querySelector("[data-lock-form]");
    if (form) {
      form.addEventListener("submit", (event) => handleSubmit(event, payload));
    }

    message("如果这台设备已记住密钥，会自动打开。", "info");
    await trySavedKey(payload);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
