//Settings component for the admin panel, allowing to change the admin username and password, the root directory for the servers, and the JWT secret key. It also includes a toggle for dark mode and a logout button.

import React, { useState } from 'react';
export default function Settings({ darkMode}) {
    const [adminUser, setAdminUser] = useState('');
    const [adminPass, setAdminPass] = useState('');
    const [serverRoot, setServerRoot] = useState('');
    const [jwtSecret, setJwtSecret] = useState('');
    const [message, setMessage] = useState('');

    const saveSettings = async () => {
        try {
            const res = await fetch('http://localhost:4000/api/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({
                    serverRoot
                })
            });

            const data = await res.json();
            if (res.ok) {
                setMessage('Settings saved successfully!');
            } else {
                setMessage(`Error: ${data.error}`);
            }
        } catch (err) {
            console.error('Error saving settings:', err);
            setMessage('An error occurred while saving settings.');
        }
    };

    const loadSettings = async () => {
        try {
            const res = await fetch('http://localhost:4000/api/settings', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
            const data = await res.json();
            if (res.ok) {
                setServerRoot(data.serverRoot);
            } else {
                setMessage(`Error: ${data.error}`);
            }
        } catch (err) {
            console.error('Error loading settings:', err);
            setMessage('An error occurred while loading settings.');
        }
    };

    // Cargar settings al montar el componente
    React.useEffect(() => {
        loadSettings();
    }, []);


    return (
        <div className={`max-w-3xl mx-auto mt-6 p-4 md:p-6 rounded-lg transition-colors duration-300 
            `}>
            <h1 className="text-2xl font-bold mb-4">Settings</h1>
            <div className="space-y-4">
                
                <div>
                    <label className="block mb-1 font-medium">Server Root Directory</label>
                    <input

                        type="text"
                        value={serverRoot}
                        onChange={(e) => setServerRoot(e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg border transition-colors ${darkMode
                            ? 'bg-gray-800 text-white border-gray-700'
                            : 'bg-white text-gray-900 border-gray-300'
                            }`}
                    />
                    
                </div>
                <button
                    onClick={saveSettings}
                    className={`px-4 py-2 rounded-lg transition-colors ${darkMode
                        ? 'bg-purple-600 text-white hover:bg-purple-700'
                        : 'bg-purple-500 text-white hover:bg-purple-600'
                        }`}
                >
                    Save Settings
                </button>   
                {message && <p className={`mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-700'}`}>{message}</p>}
            </div>
        </div>
    );
}
