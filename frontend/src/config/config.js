// Function to get credentials from local storage
const getCredentialsFromStorage = () => {
    try {
        const storedCredentials = localStorage.getItem('aws-credentials');
        if (storedCredentials) {
            // Parse the stored credentials (no decoding needed)
            return JSON.parse(storedCredentials);
        }
    } catch (error) {
        console.error('Failed to retrieve AWS credentials from local storage:', error);
    }
    return null;
};

// Get credentials from local storage or fall back to environment variables
const storedCredentials = typeof window !== 'undefined' ? getCredentialsFromStorage() : null;

const config = {
    ENV: {
        ACCESS_KEY: storedCredentials?.accessKeyId || '',
        SECRET_ACCESS_KEY: storedCredentials?.secretAccessKey || '',
        SESSION_TOKEN: storedCredentials?.sessionToken || '',
        REGION: storedCredentials?.region || 'us-east-1',
    }
}

export default config;
