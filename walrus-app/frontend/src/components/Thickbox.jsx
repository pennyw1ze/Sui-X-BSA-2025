import { useState, useEffect } from 'react';

const Thickbox = ({ isChecked, onCheckedChange }) => {
    const [currentDomain, setCurrentDomain] = useState('');

    useEffect(() => {
        // Function to get domain from zkLogin session storage
        const getDomainFromStorage = () => {
            try {
                const accountDataKey = 'zklogin-demo.accounts';
                const dataRaw = sessionStorage.getItem(accountDataKey);
                if (dataRaw) {
                    const data = JSON.parse(dataRaw);
                    if (data && data.length > 0 && data[0].domain) {
                        return data[0].domain;
                    }
                }
                return '';
            } catch (error) {
                console.warn('Error reading domain from session storage:', error);
                return '';
            }
        };

        // Update current domain state
        const domain = getDomainFromStorage();
        setCurrentDomain(domain);

        // Update document title based on checkbox state and available domain
        if (isChecked && domain) {
            document.title = `Walrus Vault - ${domain}`;
        } else {
            document.title = 'Walrus Vault';
        }

        // Listen for storage changes to update domain dynamically
        const handleStorageChange = () => {
            const newDomain = getDomainFromStorage();
            setCurrentDomain(newDomain);
            
            if (isChecked && newDomain) {
                document.title = `Walrus Vault - ${newDomain}`;
            } else if (isChecked && !newDomain) {
                document.title = 'Walrus Vault';
            }
        };

        // Listen for custom storage events (for same-page updates)
        window.addEventListener('storage', handleStorageChange);
        
        // Check for domain updates periodically (in case session storage changes in same tab)
        const interval = setInterval(handleStorageChange, 1000);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            clearInterval(interval);
        };
    }, [isChecked]);

    const handleCheckboxChange = (event) => {
        onCheckedChange(event.target.checked);
    };

    return (
        <div className="thickbox-container">
            <label className="thickbox-label">
                <input
                    type="checkbox"
                    className="thickbox-input"
                    checked={isChecked}
                    onChange={handleCheckboxChange}
                />
                <span className="thickbox-checkbox"></span>
                <span className="thickbox-text">
                    Attach domain to document title
                    {currentDomain && (
                        <small className="thickbox-domain">
                            Current domain: {currentDomain}
                        </small>
                    )}
                </span>
            </label>
        </div>
    );
};

export default Thickbox;