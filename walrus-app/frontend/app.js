// API base: override by setting window.BACKEND_URL in dev (e.g. window.BACKEND_URL = "http://localhost:3001")
const API_BASE = window.BACKEND_URL || (location.hostname === "localhost" && location.port === "5173" ? "http://localhost:3001" : "");

const out = (v) => { document.getElementById("output").textContent = typeof v === "string" ? v : JSON.stringify(v, null, 2); };

let walletAddress = null;

function updateWalletUI() {
  document.getElementById("wallet-address").textContent = walletAddress ? `Connected: ${walletAddress}` : "Not connected";
}

async function connectWallet() {
  out("Connecting Slush wallet...");
  try {
    // If there's no window.sui at all, bail early
    if (!window.sui) {
      out("No Sui provider detected on window (window.sui not present). Please install Slush.");
      alert("No Slush Sui wallet found in the browser.");
      updateWalletUI();
      return;
    }

    // Best-effort: try to connect and read addresses/accounts from multiple shapes
    let connectResult = null;
    try {
      if (typeof window.sui.connect === "function") {
        connectResult = await window.sui.connect();
      } else if (typeof window.sui.request === "function") {
        // some providers expose request-style API; try a common connect method
        try {
          connectResult = await window.sui.request({ method: "sui_connect" });
        } catch {
          // ignore
        }
      }
    } catch (e) {
      console.warn("connect() threw:", e);
    }

    // Try to derive an address from multiple possible shapes
    let addr = null;
    if (Array.isArray(connectResult) && connectResult.length) {
      addr = connectResult[0]?.address || connectResult[0];
    }
    if (!addr && connectResult && typeof connectResult === "object") {
      addr = connectResult?.address || connectResult?.account?.address || connectResult?.accounts?.[0]?.address;
    }
    // fallback to provider-exposed properties
    if (!addr) {
      addr = window.sui?.account?.address || window.sui?.accounts?.[0]?.address || window.sui?.address || null;
    }

    // If still no address, dump a compact debug view to help identify the provider shape
    if (!addr) {
      const probe = {
        hasConnect: typeof window.sui.connect === "function",
        hasRequest: typeof window.sui.request === "function",
        keys: Object.keys(window.sui).slice(0, 20),
        rawSample: null,
      };
      try {
        // try to get a small JSON-safe sample
        probe.rawSample = JSON.stringify(window.sui, (k, v) => {
          if (typeof v === "function") return "[fn]";
          if (typeof v === "object" && v && Object.keys(v).length > 50) return "[big object]";
          return v;
        }, 2).slice(0, 1000);
      } catch {}
      out("Connected provider found but no address extracted. Probe: " + JSON.stringify(probe, null, 2));
      updateWalletUI();
      return;
    }

    walletAddress = addr;
    out(`Slush connect result: ${walletAddress}`);
  } catch (e) {
    out(String(e));
  }
  updateWalletUI();
}

document.getElementById("btn-connect").addEventListener("click", connectWallet);

document.getElementById("btn-info").addEventListener("click", async () => {
  try {
    const r = await fetch(`${API_BASE}/api/walrus/info`);
    const text = await r.text();
    out(text);
  } catch (e) { out(String(e)); }
});

document.getElementById("btn-list").addEventListener("click", async () => {
  try {
    const r = await fetch(`${API_BASE}/api/walrus/list-blobs`);
    const json = await r.json();
    out(json);
  } catch (e) { out(String(e)); }
});

async function trySignMessage(message) {
  try {
    if (!walletAddress) return "";
    if (window.sui) {
      const encoder = new TextEncoder();
      if (typeof window.sui.signMessage === "function") {
        const resp = await window.sui.signMessage({ message: encoder.encode(message) });
        return resp?.signature || (typeof resp === "string" ? resp : JSON.stringify(resp));
      }
      if (typeof window.sui.request === "function") {
        try {
          const resp = await window.sui.request({ method: "sui_signMessage", params: [message] });
          return resp?.signature || (typeof resp === "string" ? resp : JSON.stringify(resp));
        } catch (e) {
          console.warn("sui.request sign attempt failed:", e);
        }
      }
    }
  } catch (e) {
    console.warn("Signing failed:", e);
  }
  return "";
}

document.getElementById("upload-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const input = document.getElementById("file-input");
  if (!input.files || !input.files[0]) return out("Select a file first");
  const form = new FormData();
  form.append("file", input.files[0]);

  if (walletAddress) {
    form.append("walletAddress", walletAddress);
    const msg = `Walrus upload by ${walletAddress} at ${new Date().toISOString()}`;
    const sig = await trySignMessage(msg);
    if (sig) form.append("signature", sig);
  }

  try {
    const r = await fetch(`${API_BASE}/api/walrus/store`, { method: "POST", body: form });
    const json = await r.json();
    out(json);
  } catch (e) { out(String(e)); }
});

document.getElementById("btn-read").addEventListener("click", async () => {
  const id = document.getElementById("read-id").value.trim();
  if (!id) return out("Enter blob id");
  try {
    const r = await fetch(`${API_BASE}/api/walrus/read/${encodeURIComponent(id)}`);
    if (!r.ok) {
      const text = await r.text();
      return out({ error: text });
    }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${id}.bin`;
    a.textContent = `Download ${id}`;
    const pre = document.getElementById("output");
    pre.textContent = `Click the link below to download:\n`;
    pre.appendChild(a);
  } catch (e) { out(String(e)); }
});

document.getElementById("btn-status").addEventListener("click", async () => {
  const id = document.getElementById("status-id").value.trim();
  if (!id) return out("Enter blob id");
  try {
    const r = await fetch(`${API_BASE}/api/walrus/blob-status/${encodeURIComponent(id)}`);
    const json = await r.json();
    out(json);
  } catch (e) { out(String(e)); }
});

// initialize UI
updateWalletUI();
