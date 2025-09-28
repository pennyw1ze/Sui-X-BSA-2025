import { useCallback, useEffect, useRef, useState } from 'react';
import WalrusUploader from './WalrusUploader';
import logo from './assets/logo.png';
import ZkLoginPill from './components/ZkLoginPill';
import LeaksCarousel from './components/LeaksCarousel';
import './App.css';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3001';

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
  const [leakState, setLeakState] = useState({
    entries: [],
    loading: true,
    error: null,
    llmInfo: null,
  });
  const leakControllerRef = useRef(null);

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
  
  // Filter leaks by search term
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
          <ZkLoginPill />
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
          <WalrusUploader />
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