import { useEffect, useState } from 'react';
import { ConnectButton } from "@mysten/dapp-kit";
import WalrusUploader from './WalrusUploader';
import logo from './assets/logo.png';
import suiMark from './assets/sui_logo_white.svg';
import './App.css';

const showcaseLeaks = [
  {
    id: 'leak-1',
    title: 'Sui Ecosystem Report 2025',
    summary: 'Anonymously uploaded research on validator performance and community grants.',
    tags: ['Research', 'Community'],
    status: 'Verified',
  },
  {
    id: 'leak-2',
    title: 'Governance Proposal Draft',
    summary: 'Early look at an unreleased governance proposal targeting fee reforms.',
    tags: ['Governance', 'Draft'],
    status: 'Awaiting Review',
  },
  {
    id: 'leak-3',
    title: 'Cross-chain Integration Notes',
    summary: 'Technical design notes for a cross-chain bridge leveraging Walrus storage.',
    tags: ['Technical', 'Bridge'],
    status: 'New',
  },
];

function App() {
  const [isDonateOpen, setDonateOpen] = useState(false);

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
          <ConnectButton
            className="pill-button pill-button--connect"
            connectText={(
              <>
                <span className="pill-button__icon pill-button__icon--connect" aria-hidden="true">
                  <img src={suiMark} alt="" />
                </span>
                <span className="pill-button__label">
                  <strong>Connect wallet</strong>
                  <small>Secure session</small>
                </span>
              </>
            )}
          />
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
          </div>
          <div className="leak-grid">
            {showcaseLeaks.map((leak, index) => (
              <article
                key={leak.id}
                className="leak-card"
                data-reveal="true"
                style={{ transitionDelay: `${index * 80}ms` }}
              >
                <div className="leak-card__status" data-status={leak.status}>
                  {leak.status}
                </div>
                <h3>{leak.title}</h3>
                <p>{leak.summary}</p>
                <div className="leak-card__tags">
                  {leak.tags.map((tag) => (
                    <span key={`${leak.id}-${tag}`} className="tag">
                      #{tag}
                    </span>
                  ))}
                </div>
                <button type="button" className="ghost-button">
                  View details
                </button>
              </article>
            ))}
          </div>
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
              className="pill-button pill-button--donate"
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