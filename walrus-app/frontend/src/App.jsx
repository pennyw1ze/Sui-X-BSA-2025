import { ConnectButton } from "@mysten/dapp-kit";
import WalrusUploader from './WalrusUploader';
import logo from './assets/logo.png';
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
  return (
    <div className="app">
      <header className="hero" id="top">
        <div className="hero__content">
          <img src={logo} alt="Walrus Vault" className="hero__logo" />
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
        <div className="hero__wallet">
          <ConnectButton />
        </div>
      </header>

      <main>
        <section id="start" className="section uploader-section">
          <div className="section__header">
            <h2>Start leaking now</h2>
            <p>
              Fund a temporary wallet, store your files on Walrus blobs, and mint a verifiable
              footprint on Sui. Everything happens client-side for maximum privacy.
            </p>
          </div>
          <WalrusUploader />
        </section>

        <section id="leaks" className="section leaks-section">
          <div className="section__header">
            <h2>Watch current leaks</h2>
            <p>
              Explore curated leaks uploaded by the community. These cards are placeholders you can
              later connect to live Walrus blob metadata or DAO governance tooling.
            </p>
          </div>
          <div className="leak-grid">
            {showcaseLeaks.map((leak) => (
              <article key={leak.id} className="leak-card">
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