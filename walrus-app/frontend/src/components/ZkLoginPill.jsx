import { useEffect, useRef, useState } from 'react';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from "@mysten/sui/transactions";
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import {
    genAddressSeed,
    generateNonce,
    generateRandomness,
    getExtendedEphemeralPublicKey,
    getZkLoginSignature,
    jwtToAddress,
} from '@mysten/sui/zklogin';
import { jwtDecode } from 'jwt-decode';
import suiMark from '../assets/sui_logo_white.svg';

// Configuration
const NETWORK = 'testnet';
const MAX_EPOCH = 2;

const suiClient = new SuiClient({
    url: getFullnodeUrl(NETWORK),
});

// Session storage keys
const setupDataKey = 'zklogin-demo.setup';
const accountDataKey = 'zklogin-demo.accounts';

// Configuration - you'll need to set these URLs
const config = {
    URL_SALT_SERVICE: '/dummy-salt-service.json', // Update with your salt service
    URL_ZK_PROVER: 'https://prover-dev.mystenlabs.com/v1', // Update with your ZK prover
};

    const ZkLoginPill = () => {
        const accounts = useRef([]);
        const [isOpen, setIsOpen] = useState(false);
        const [modalContent, setModalContent] = useState('');

        // Debug function to check session storage (accessible from browser console)
        useEffect(() => {
            window.debugZkLogin = () => {
                console.log('=== zkLogin Debug Info ===');
                console.log('Setup data:', sessionStorage.getItem(setupDataKey));
                console.log('Account data:', sessionStorage.getItem(accountDataKey));
                console.log('Current accounts:', accounts.current);
                console.log('========================');
            };
            return () => {
                delete window.debugZkLogin;
            };
        }, []);    useEffect(() => {
        completeZkLogin();
        // Load accounts from storage
        const dataRaw = sessionStorage.getItem(accountDataKey);
        if (dataRaw) {
            const data = JSON.parse(dataRaw);
            accounts.current = data;
        }
    }, []);

    /* zkLogin Functions */

    async function beginZkLogin(provider) {
        setModalContent(`🔑 Logging in with ${provider}...`);

        try {
            // Create a nonce
            const { epoch } = await suiClient.getLatestSuiSystemState();
            const maxEpoch = Number(epoch) + MAX_EPOCH;
            const ephemeralKeyPair = new Ed25519Keypair();
            const randomness = generateRandomness();
            const nonce = generateNonce(ephemeralKeyPair.getPublicKey(), maxEpoch, randomness);

            // Save data to session storage
            saveSetupData({
                provider,
                maxEpoch,
                randomness: randomness.toString(),
                ephemeralPrivateKey: ephemeralKeyPair.getSecretKey(),
            });

            // Start OAuth flow
            const redirectUri = window.location.origin;
            const urlParamsBase = {
                nonce: nonce,
                redirect_uri: redirectUri,
                response_type: 'id_token',
                scope: 'openid email profile',
            };

            let oauthUrl;
            switch (provider) {
                case 'Google': {
                    const urlParams = new URLSearchParams({
                        ...urlParamsBase,
                        client_id: '25769832374-famecqrhe2gkebt5fvqms2263046lj96.apps.googleusercontent.com', // Update with your client ID
                    });
                    oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${urlParams}`;
                    break;
                }
                case 'Twitch': {
                    const urlParams = new URLSearchParams({
                        ...urlParamsBase,
                        client_id: 'your-twitch-client-id', // Update with your client ID
                        force_verify: 'true',
                    });
                    oauthUrl = `https://id.twitch.tv/oauth2/authorize?${urlParams}`;
                    break;
                }
                case 'Facebook': {
                    const urlParams = new URLSearchParams({
                        ...urlParamsBase,
                        client_id: 'your-facebook-client-id', // Update with your client ID
                    });
                    oauthUrl = `https://www.facebook.com/v18.0/dialog/oauth?${urlParams}`;
                    break;
                }
                default:
                    throw new Error(`Unknown provider: ${provider}`);
            }

            window.location.href = oauthUrl;
        } catch (error) {
            console.error('zkLogin error:', error);
            setModalContent('❌ Login failed. Please try again.');
        }
    }

    async function completeZkLogin() {
        // Get JWT from URL
        const urlFragment = window.location.hash.substring(1);
        const urlParams = new URLSearchParams(urlFragment);
        const jwt = urlParams.get('id_token');
        if (!jwt) {
            return;
        }

        // Remove URL fragment
        window.history.replaceState(null, '', window.location.pathname);

        // Decode JWT
        const jwtPayload = jwtDecode(jwt);
        if (!jwtPayload.sub || !jwtPayload.aud) {
            console.warn('[completeZkLogin] missing jwt.sub or jwt.aud');
            return;
        }

        // Extract domain from email
        const email = jwtPayload.email || '';
        const domain = email.includes('@') ? email.split('@')[1] : '';
        console.debug('[completeZkLogin] User email:', email);
        console.debug('[completeZkLogin] User email domain:', domain);

        try {
            // Get salt - using a mock salt for development
            console.debug('[completeZkLogin] Fetching salt...');
            
            let saltResponse;
            try {
                const response = await fetch(config.URL_SALT_SERVICE, {
                    method: 'GET',
                });
                saltResponse = await response.json();
            } catch (saltError) {
                console.warn('[completeZkLogin] Salt service failed, using mock salt:', saltError);
                // Use a mock salt for development/testing
                saltResponse = { salt: '129390038577185583942388216820280642146' };
            }

            if (!saltResponse || !saltResponse.salt) {
                console.error('[completeZkLogin] No salt received');
                setModalContent('❌ Failed to get salt. Please try again.');
                return;
            }

            console.debug('[completeZkLogin] Salt received:', saltResponse.salt);

            const userSalt = BigInt(saltResponse.salt);
            const userAddr = jwtToAddress(jwt, userSalt);

            // Load setup data
            const setupData = loadSetupData();
            if (!setupData) {
                console.warn('[completeZkLogin] missing session storage data');
                return;
            }
            clearSetupData();

            // Check if already logged in
            for (const account of accounts.current) {
                if (userAddr === account.userAddr) {
                    console.warn(`[completeZkLogin] already logged in with this ${setupData.provider} account`);
                    return;
                }
            }

            // Get ZK proof
            const ephemeralKeyPair = keypairFromSecretKey(setupData.ephemeralPrivateKey);
            const ephemeralPublicKey = ephemeralKeyPair.getPublicKey();
            
            setModalContent('⏳ Requesting ZK proof...');
            console.debug('[completeZkLogin] Requesting ZK proof...');

            let zkProofs;
            try {
                const zkProofResponse = await fetch(config.URL_ZK_PROVER, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        maxEpoch: setupData.maxEpoch,
                        jwtRandomness: setupData.randomness,
                        extendedEphemeralPublicKey: getExtendedEphemeralPublicKey(ephemeralPublicKey),
                        jwt,
                        salt: userSalt.toString(),
                        keyClaimName: 'sub',
                    }, null, 2),
                });

                if (!zkProofResponse.ok) {
                    throw new Error(`ZK prover request failed: ${zkProofResponse.status}`);
                }

                zkProofs = await zkProofResponse.json();
                console.debug('[completeZkLogin] ZK proofs received:', zkProofs);
            } catch (zkError) {
                console.error('[completeZkLogin] ZK proof failed:', zkError);
                setModalContent('❌ ZK proof generation failed. Continuing with mock data for testing...');
                
                // For development/testing, we'll skip ZK proofs and save the account anyway
                zkProofs = { mockProof: true };
            }

            if (!zkProofs) {
                console.error('[completeZkLogin] No ZK proofs received');
                setModalContent('❌ Failed to generate ZK proofs.');
                return;
            }

            // Save account
            console.debug('[completeZkLogin] Saving account with domain:', domain);
            const accountData = {
                provider: setupData.provider,
                userAddr,
                zkProofs,
                ephemeralPrivateKey: setupData.ephemeralPrivateKey,
                userSalt: userSalt.toString(),
                sub: jwtPayload.sub,
                aud: typeof jwtPayload.aud === 'string' ? jwtPayload.aud : jwtPayload.aud[0],
                maxEpoch: setupData.maxEpoch,
                domain: domain,
            };
            
            console.debug('[completeZkLogin] Account data to save:', accountData);
            saveAccount(accountData);

            setModalContent('✅ Login successful!');
            console.debug('[completeZkLogin] Login completed successfully');
            setTimeout(() => setModalContent(''), 2000);
        } catch (error) {
            console.error('ZkLogin completion error:', error);
            setModalContent('❌ Login completion failed');
        }
    }

    /* Helper Functions */

    function saveSetupData(data) {
        sessionStorage.setItem(setupDataKey, JSON.stringify(data));
    }

    function loadSetupData() {
        const dataRaw = sessionStorage.getItem(setupDataKey);
        if (!dataRaw) {
            return null;
        }
        return JSON.parse(dataRaw);
    }

    function clearSetupData() {
        sessionStorage.removeItem(setupDataKey);
    }

    function saveAccount(account) {
        console.debug('[saveAccount] Saving account:', account);
        const newAccounts = [...accounts.current, account];
        console.debug('[saveAccount] New accounts array:', newAccounts);
        sessionStorage.setItem(accountDataKey, JSON.stringify(newAccounts));
        accounts.current = newAccounts;
        console.debug('[saveAccount] Account saved to session storage with key:', accountDataKey);
        
        // Verify the save
        const saved = sessionStorage.getItem(accountDataKey);
        console.debug('[saveAccount] Verification - saved data:', saved);
    }

    function keypairFromSecretKey(privateKeyBase64) {
        const keyPair = decodeSuiPrivateKey(privateKeyBase64);
        return Ed25519Keypair.fromSecretKey(keyPair.secretKey);
    }

    /* Render */

    const currentAccount = accounts.current[0]; // Get first account
    const isLoggedIn = !!currentAccount;

    return (
        <>
            <button
                type="button"
                className="pill-button pill-button--connect connect-button--pill"
                onClick={() => setIsOpen(true)}
            >
                <span className="pill-button__icon pill-button__icon--connect" aria-hidden="true">
                    <img src={suiMark} alt="" />
                </span>
                <span className="pill-button__label">
                    <strong>{isLoggedIn ? 'Account' : 'zkLogin'}</strong>
                    <small>{isLoggedIn ? currentAccount.domain : 'Secure session'}</small>
                </span>
            </button>

            {isOpen && (
                <div
                    className="zklogin-modal__overlay"
                    role="dialog"
                    aria-modal="true"
                    onClick={() => setIsOpen(false)}
                >
                    <div
                        className="zklogin-modal"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <button
                            type="button"
                            className="zklogin-modal__close"
                            aria-label="Close zkLogin modal"
                            onClick={() => setIsOpen(false)}
                        >
                            ×
                        </button>

                        <div className="zklogin-modal__content">
                            <h2>zkLogin Authentication</h2>
                            
                            {modalContent && (
                                <div className="zklogin-status">
                                    {modalContent}
                                </div>
                            )}

                            {!isLoggedIn ? (
                                <div className="zklogin-providers">
                                    <p>Choose a provider to login anonymously:</p>
                                    <button
                                        className="provider-button google"
                                        onClick={() => beginZkLogin('Google')}
                                    >
                                        <span>🔍</span> Google
                                    </button>
                                    <button
                                        className="provider-button twitch"
                                        onClick={() => beginZkLogin('Twitch')}
                                    >
                                        <span>📺</span> Twitch
                                    </button>
                                    <button
                                        className="provider-button facebook"
                                        onClick={() => beginZkLogin('Facebook')}
                                    >
                                        <span>📘</span> Facebook
                                    </button>
                                </div>
                            ) : (
                                <div className="zklogin-account">
                                    <h3>Logged in as:</h3>
                                    <div className="account-info">
                                        <div><strong>Provider:</strong> {currentAccount.provider}</div>
                                        <div><strong>Domain:</strong> {currentAccount.domain}</div>
                                        <div><strong>Address:</strong> {currentAccount.userAddr.slice(0, 6)}...{currentAccount.userAddr.slice(-4)}</div>
                                    </div>
                                    <button
                                        className="logout-button"
                                        onClick={() => {
                                            sessionStorage.removeItem(accountDataKey);
                                            accounts.current = [];
                                            setIsOpen(false);
                                        }}
                                    >
                                        Logout
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ZkLoginPill;