import React, { useState } from "react";
import { walrusClient } from "@mysten/walrus";
import { ConnectButton, useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
// @ts-ignore: some workspaces don't have @mysten/sui.js types installed — treat as any
import "@mysten/dapp-kit/dist/index.css";




// Provide a minimal JSX namespace so this file can compile even if project JSX
// typings are not present. This keeps the change local to this file only.
declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

function WalrusUploader() {
  const [file, setFile] = useState(null as File | null);
  const [blobId, setBlobId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null as string | null);

  async function onUpload() {
    if (!file) return;
    setUploading(true);
    setError(null);
    setBlobId("");
    try {
      const res = await walrusClient(file);
  // defensive: some implementations may return the id in different fields
  const r: any = res;
  const id = (r && (r.blobId ?? r.id ?? r.blob)) ?? "";
      setBlobId(String(id));
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ marginTop: 24 }}>
      <h3>Walrus</h3>
      <input
        type="file"
        onChange={(e: any) => setFile((e.target as HTMLInputElement).files?.[0] ?? null)}
        disabled={uploading}
      />
      <button onClick={onUpload} disabled={!file || uploading} style={{ marginLeft: 8 }}>
        {uploading ? "Uploading…" : "Upload"}
      </button>

      {blobId && (
        <div style={{ marginTop: 8 }}>
          Blob ID: <code>{blobId}</code>
        </div>
      )}

      {error && (
        <div style={{ marginTop: 8, color: "#c00" }}>
          Error: {error}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const [log, setLog] = useState("" as string);

  async function demoTx() {
    if (!account) return;
    try {
      setLog("Sending demo tx...");
      const tx = new Transaction();
      // split 0.001 SUI (1_000_000 MIST) and send back to self
      const [coin] = tx.splitCoins(tx.gas, [tx.pure(1_000_000)]);
      tx.transferObjects([coin], tx.pure(account.address));
  const res = await signAndExecute({ transaction: tx, options: { showEffects: true } } as any);
      setLog("OK: " + (res?.digest ?? JSON.stringify(res)));
    } catch (e: any) {
      setLog("Error: " + (e?.message ?? String(e)));
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1>Sui Dev Kit – Fresh Start</h1>
      <ConnectButton />
      <div style={{ marginTop: 12 }}>
        {account ? (
          <>
            <div>
              Connected: <code>{account.address}</code>
            </div>
            <button style={{ marginTop: 8 }} onClick={demoTx}>
              Run demo tx
            </button>
          </>
        ) : (
          <div>Not connected</div>
        )}
      </div>

      {/* render the uploader */}
      <WalrusUploader />

      <pre style={{ marginTop: 16, background: "#111", color: "#0f0", padding: 12, minHeight: 80 }}>
        {log}
      </pre>
    </div>
  );
}