import WalrusUploader from './WalrusUploader';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Walrus File Uploader</h1>
        <p>Upload files to the Walrus decentralized database on the Sui testnet.</p>
      </header>
      <main>
        <WalrusUploader />
      </main>
    </div>
  );
}

export default App;