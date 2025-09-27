// API base: override by setting window.BACKEND_URL in dev (e.g. window.BACKEND_URL = "http://localhost:3001")
const API_BASE = window.BACKEND_URL || (location.hostname === "localhost" && location.port === "5173" ? "http://localhost:3001" : "");

const out = (v) => { document.getElementById("output").textContent = typeof v === "string" ? v : JSON.stringify(v, null, 2); };

let walletAddress = null;

function updateWalletUI() {
  document.getElementById("wallet-address").textContent = walletAddress ? `Connected: ${walletAddress}` : "Not connected";
}

async function connectWallet() {
  out("Connecting wallet...");
  try {
    // Try Sui provider first
    if (window.sui && typeof window.sui.connect === "function") {
      // many Sui wallets return an array or object; try common shapes
      const r = await window.sui.connect();
      let addr = null;
      if (Array.isArray(r) && r.length) addr = r[0]?.address || r[0];
      if (!addr && r && typeof r === "object") {
        addr = r?.address || r?.account?.address || r?.accounts?.[0]?.address;
      }
      if (!addr && window.sui.account) addr = window.sui.account.address || window.sui.account;
      walletAddress = addr || JSON.stringify(r);
      out(`Sui connect result: ${walletAddress}`);
    }
    // Fallback to EVM (MetaMask)
    else if (window.ethereum && typeof window.ethereum.request === "function") {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      walletAddress = accounts && accounts[0];
      out(`EVM account: ${walletAddress}`);
    } else {
      out("No Sui or EVM wallet found in the page.");
      alert("No Sui or EVM wallet found in the browser.");
    }
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
  // Attempt provider-specific signing; return signature string or empty
  try {
    if (!walletAddress) return "";
    if (window.ethereum && typeof window.ethereum.request === "function") {
      // personal_sign expects [message, address] or [address, message] depending on provider; this is common
      return await window.ethereum.request({ method: "personal_sign", params: [message, walletAddress] });
    }
    if (window.sui && typeof window.sui.signMessage === "function") {
      // Some Sui wallets implement signMessage({ message: Uint8Array })
      const encoder = new TextEncoder();
      const resp = await window.sui.signMessage({ message: encoder.encode(message) });
      // shape varies; try to flatten
      return resp?.signature || (typeof resp === "string" ? resp : JSON.stringify(resp));
    }
  } catch (e) {
    // Not critical — proceed without signature
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

  // Include wallet info (if connected) and attempt an optional signature
  if (walletAddress) {
    form.append("walletAddress", walletAddress);
    const msg = `Walrus upload at ${new Date().toISOString()}`;
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
