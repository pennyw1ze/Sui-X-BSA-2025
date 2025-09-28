import { useCallback, useEffect, useRef, useState } from 'react';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import WalrusUploader from './WalrusUploader';
import logo from './assets/logo.png';
import ZkLoginPill from './components/ZkLoginPill';
import WalletConnectPill from './components/WalletConnectPill';
import LeaksCarousel from './components/LeaksCarousel';
import Thickbox from './components/Thickbox';
import './App.css';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3001';

// Initialize Sui client
const suiClient = new SuiClient({
  url: getFullnodeUrl('testnet'),
});

// Session storage key for zkLogin accounts
const accountDataKey = 'zklogin-demo.accounts';

const showcaseLeaks = [
  {
    id: 'leak-1',
    title: 'Sui Ecosystem Report 2025',
    description: 'Anonymously uploaded research on validator performance and community grants with anonymised validator metrics and grant disbursement figures.',
    link: 'https://example.com/sui-ecosystem-report',
    tags: ['Research', 'Community'],
    status: 'Verified',
    insight: 'Highlights validator transparency gaps and proposes safeguards for grant allocations.',
  },
  {
    id: 'leak-2',
    title: 'Governance Proposal Draft',
    description: 'Early look at an unreleased governance proposal targeting fee reforms across core DeFi apps in the Sui ecosystem.',
    link: 'https://example.com/governance-proposal-draft',
    tags: ['Governance', 'Draft'],
    status: 'Awaiting Review',
    insight: 'Signals fee structure shifts that could impact smaller validators and DAO treasuries.',
  },
  {
    id: 'leak-3',
    title: 'Cross-chain Integration Notes',
    description: 'Technical design notes for a cross-chain bridge leveraging Walrus storage, including validator staking assumptions and failure scenarios.',
    link: 'https://example.com/cross-chain-notes',
    tags: ['Technical', 'Bridge'],
    status: 'New',
    insight: 'Early-stage bridge architecture with identified failure modes that need wider review.',
  },
];

function App() {
  const [isDonateOpen, setDonateOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isThickboxChecked, setIsThickboxChecked] = useState(false);
  const [zkLoginAccounts, setZkLoginAccounts] = useState([]);
  const [balances, setBalances] = useState(new Map());
  const [leakState, setLeakState] = useState({
    entries: [],
    loading: true,
    error: null,
    llmInfo: null,
  });
  const leakControllerRef = useRef(null);

  // Function to check if user is logged in via zkLogin
  const checkZkLoginStatus = useCallback(() => {
    try {
      const dataRaw = sessionStorage.getItem(accountDataKey);
      if (dataRaw) {
        const data = JSON.parse(dataRaw);
        if (Array.isArray(data) && data.length > 0) {
          setZkLoginAccounts(data);
          return data;
        }
      }
      setZkLoginAccounts([]);
      return [];
    } catch (error) {
      console.warn('Error reading zkLogin accounts from session storage:', error);
      setZkLoginAccounts([]);
      return [];
    }
  }, []);

  // Function to fetch balances for zkLogin accounts
  const fetchBalances = useCallback(async (accounts) => {
    if (accounts.length === 0) {
      return;
    }
    
    try {
      const newBalances = new Map();
      for (const account of accounts) {
        const suiBalance = await suiClient.getBalance({
          owner: account.userAddr,
          coinType: '0x2::sui::SUI',
        });
        newBalances.set(
          account.userAddr,
          +suiBalance.totalBalance / 1_000_000_000
        );
      }
      setBalances(prevBalances =>
        new Map([...prevBalances, ...newBalances])
      );
    } catch (error) {
      console.warn('Error fetching balances:', error);
    }
  }, []);

  const fetchLeaks = useCallback(async () => {
    if (leakControllerRef.current) {
      leakControllerRef.current.abort();
    }

    const controller = new AbortController();
    leakControllerRef.current = controller;

    setLeakState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch(`${API_BASE_URL}/leaks`, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const payload = await response.json();
      setLeakState({
        entries: Array.isArray(payload.leaks) ? payload.leaks : [],
        loading: false,
        error: null,
        llmInfo: payload.llm ?? null,
      });
    } catch (error) {
      if (error.name === 'AbortError') return;

      setLeakState({
        entries: [],
        loading: false,
        error: error.message,
        llmInfo: null,
      });
    }
  }, [API_BASE_URL]);

  // Check zkLogin status on mount and set up polling
  useEffect(() => {
    const checkAndLoadBalances = () => {
      const accounts = checkZkLoginStatus();
      if (accounts.length > 0) {
        fetchBalances(accounts);
      }
    };

    // Initial check
    checkAndLoadBalances();

    // Set up polling to check for zkLogin changes every 2 seconds
    const interval = setInterval(checkAndLoadBalances, 2000);

    // Listen for storage events from other tabs
    const handleStorageChange = (event) => {
      if (event.key === accountDataKey) {
        checkAndLoadBalances();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [checkZkLoginStatus, fetchBalances]);

  useEffect(() => {
    const revealables = document.querySelectorAll('[data-reveal="true"]');
    if (!revealables.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.15,
        rootMargin: '0px 0px -10% 0px',
      }
    );

    revealables.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    fetchLeaks();

    return () => {
      if (leakControllerRef.current) {
        leakControllerRef.current.abort();
      }
    };
  }, [fetchLeaks]);

  const usingFallback = !leakState.entries.length;
  const rawLeaks = usingFallback ? showcaseLeaks : leakState.entries;
  const leaksToDisplay = rawLeaks.filter((leak) => 
    leak.title.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const carouselError = usingFallback ? null : leakState.error;
  const derivedLlmInfo = leakState.llmInfo ?? (usingFallback
    ? {
        enabled: false,
        reason: leakState.error
          ? `Showing curated leaks while live data sync fails: ${leakState.error}`
          : 'Awaiting live Walrus submissions.',
      }
    : null);

  return (
    <div className="app">
      <header className="hero" id="top">
        <div className="hero__ambient" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="hero__nav hero__nav--left" data-reveal="true">
          <button
            type="button"
            className="pill-button pill-button--donate"
            onClick={() => setDonateOpen(true)}
          >
            <span className="pill-button__icon" aria-hidden="true">🤝</span>
            <span className="pill-button__label">
              <strong>Donate</strong>
              <small>Keep leaks safe</small>
            </span>
          </button>
        </div>
        <div className="hero__nav hero__nav--right" data-reveal="true">
          <div className="hero__nav-pills">
            <WalletConnectPill />
            <ZkLoginPill />
          </div>
        </div>
        
        <div className="hero__content" data-reveal="true">
          <div className="hero__logo-wrapper">
            <img src={logo} alt="Walrus Vault" className="hero__logo" />
          </div>
          <h1>Walrus Vault</h1>
          <p>
            Leak responsibly. Store, share, and govern sensitive documents on-chain using Walrus
            storage and the Sui network.
          </p>
          <div className="hero__actions">
            <a className="cta primary" href="#start">Start leaking now</a>
            <a className="cta secondary" href="#leaks">Watch current leaks</a>
          </div>
        </div>
      </header>

      <main>
        <section id="start" className="section uploader-section" data-reveal="true">
          <div className="section__header">
            <h2>Start leaking now</h2>
            <p>
              Fund a temporary wallet, store your files on Walrus blobs, and mint a verifiable
              footprint on Sui. Everything happens client-side for maximum privacy.
            </p>
          </div>
          {/* Check if the user is already logged (zkLogin token in session storage) */}
          {zkLoginAccounts.length > 0 && (
            <div className="zklogin-status-card">
              <h3>🔐 zkLogin Status</h3>
              {zkLoginAccounts.map((account, index) => {
                const balance = balances.get(account.userAddr) || 0;
                return (
                  <div key={account.userAddr} className="account-status">
                    <div className="account-info">
                      <strong>Provider:</strong> {account.provider}
                    </div>
                    <div className="account-info">
                      <strong>Domain:</strong> {account.domain || 'N/A'}
                    </div>
                    <div className="account-info">
                      <strong>Address:</strong> {account.userAddr.slice(0, 6)}...{account.userAddr.slice(-4)}
                    </div>
                    <div className="account-info balance">
                      <strong>SUI Balance:</strong> {balance.toFixed(4)} SUI
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          <WalrusUploader isThickboxChecked={isThickboxChecked} />
          <Thickbox 
            isChecked={isThickboxChecked} 
            onCheckedChange={setIsThickboxChecked}
          />
        </section>

        <section id="leaks" className="section leaks-section" data-reveal="true">
          <div className="section__header">
            <h2>Watch current leaks</h2>
            <p>
              Explore curated leaks uploaded by the community. These cards are placeholders you can
              later connect to live Walrus blob metadata or DAO governance tooling.
            </p>
            <div className="search-bar">
              <div className="search-bar__wrapper">
                <span className="search-bar__icon" aria-hidden="true">🔍</span>
                <input
                  type="text"
                  className="search-bar__input"
                  placeholder="Search leaks by title..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button
                    type="button"
                    className="search-bar__clear"
                    onClick={() => setSearchTerm('')}
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          </div>
          <LeaksCarousel
            items={leaksToDisplay}
            loading={leakState.loading}
            error={carouselError}
            onRetry={fetchLeaks}
            llmInfo={derivedLlmInfo}
          />
        </section>
      </main>

      {isDonateOpen && (
        <div
          className="donate-modal__overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="donate-modal-title"
          onClick={() => setDonateOpen(false)}
        >
          <div
            className="donate-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="donate-modal__close"
              aria-label="Close donation message"
              onClick={() => setDonateOpen(false)}
            >
              ×
            </button>
            <div className="donate-modal__icon" aria-hidden="true">🫶</div>
            <h2 id="donate-modal-title">Support Walrus Vault</h2>
            <p>
              We&rsquo;re a nonprofit collective fighting to keep critical documents online and
              whistleblowers protected from powerful governments and corporations. Your donation
              helps us fund anonymous infrastructure, harden our privacy tooling, and stand guard
              for those who leak responsibly.
            </p>
            <button
              type="button"
              className="pill-button pill-button--donate"cd 
              onClick={() => setDonateOpen(false)}
            >
              I&rsquo;m in
            </button>
          </div>
        </div>
      )}

      <footer className="footer">
        <p>
          Built for the BSA × Sui Hackathon 2025. Secure leaks, community governance, and permanent
          storage powered by Walrus.
        </p>
        <a href="#top" className="back-to-top">
          Back to top ↑
        </a>
      </footer>
    </div>
  );
}

export default App;