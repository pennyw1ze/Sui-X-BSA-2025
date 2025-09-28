import { ConnectButton } from '@mysten/dapp-kit';
import suiMark from '../assets/sui_logo_white.svg';

const WalletConnectPill = ({ className = '' }) => (
  <ConnectButton
    className={`pill-button pill-button--connect connect-button--pill ${className}`.trim()}
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
);

export default WalletConnectPill;
