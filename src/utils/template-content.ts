/**
 * Template content for Apps Script HTML templates
 */

export const MAIN_HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?!= options.APP_TITLE || "My App" ?></title>
    <?!= include('inc_styles'); ?>
</head>
<body>
    <div id="app">
        <header class="header">
            <div class="container">
                <h1 class="app-title"><?!= options.APP_TITLE || "My App" ?></h1>
                <p class="app-description"><?!= options.APP_DESCRIPTION || "A web application built with Google Apps Script" ?></p>
            </div>
        </header>

        <main class="main">
            <div class="container">
                <!-- Loading State -->
                <div id="loading" class="loading">
                    <div class="spinner"></div>
                    <p>Loading...</p>
                </div>

                <!-- Main Content Area -->
                <div id="content" class="content" style="display: none;">
                    <!-- Dynamic content will be inserted here -->
                    <?!= options.MAIN_CONTENT || "<div class='card'><div class='card-body'><h3>Welcome!</h3><p>Your application content goes here.</p></div></div>" ?>
                </div>

                <!-- Error Display -->
                <div id="error" class="error" style="display: none;">
                    <div class="error-content">
                        <h3>⚠️ Error</h3>
                        <p id="error-message"></p>
                        <button onclick="retryOperation()" class="btn btn-primary">Retry</button>
                    </div>
                </div>
            </div>
        </main>

        <footer class="footer">
            <div class="container">
                <p>&copy; 2024 Powered by Google Apps Script</p>
            </div>
        </footer>
    </div>

    <?!= include('inc_clientJS'); ?>
</body>
</html>`;

export const STYLES_HTML_TEMPLATE = `<style>
/* Reset and Base Styles */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    line-height: 1.6;
    color: #333;
    background-color: #f5f5f5;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 20px;
}

/* Header Styles */
.header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 2rem 0;
    text-align: center;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.app-title {
    font-size: 2.5rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
}

.app-description {
    font-size: 1.1rem;
    opacity: 0.9;
}

/* Main Content Styles */
.main {
    min-height: calc(100vh - 200px);
    padding: 2rem 0;
}

.content {
    background: white;
    border-radius: 8px;
    padding: 2rem;
    box-shadow: 0 2px 15px rgba(0,0,0,0.1);
    margin-bottom: 2rem;
}

/* Loading Styles */
.loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    text-align: center;
}

.spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #667eea;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

/* Button Styles */
.btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    text-decoration: none;
    display: inline-block;
    text-align: center;
}

.btn-primary {
    background: #667eea;
    color: white;
}

.btn-primary:hover {
    background: #5a6fd8;
    transform: translateY(-1px);
}

.btn-secondary {
    background: #6c757d;
    color: white;
}

.btn-secondary:hover {
    background: #5a6268;
}

.btn-success {
    background: #28a745;
    color: white;
}

.btn-success:hover {
    background: #218838;
}

.btn-danger {
    background: #dc3545;
    color: white;
}

.btn-danger:hover {
    background: #c82333;
}

/* Form Styles */
.form-group {
    margin-bottom: 1.5rem;
}

.form-label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: #555;
}

.form-control {
    width: 100%;
    padding: 0.75rem;
    border: 2px solid #e9ecef;
    border-radius: 6px;
    font-size: 1rem;
    transition: border-color 0.2s ease;
}

.form-control:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

/* Error Styles */
.error {
    background: #f8d7da;
    border: 1px solid #f5c6cb;
    border-radius: 6px;
    padding: 1.5rem;
    margin: 1rem 0;
    color: #721c24;
}

/* Card Styles */
.card {
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    overflow: hidden;
    margin-bottom: 1.5rem;
}

.card-header {
    background: #f8f9fa;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #e9ecef;
    font-weight: 600;
}

.card-body {
    padding: 1.5rem;
}

/* Grid Styles */
.row {
    display: flex;
    flex-wrap: wrap;
    margin: 0 -0.75rem;
}

.col {
    flex: 1;
    padding: 0 0.75rem;
}

.col-6 {
    flex: 0 0 50%;
    padding: 0 0.75rem;
}

/* Table Styles */
.table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 1rem;
}

.table th,
.table td {
    padding: 0.75rem;
    text-align: left;
    border-bottom: 1px solid #e9ecef;
}

.table th {
    background: #f8f9fa;
    font-weight: 600;
    border-bottom: 2px solid #dee2e6;
}

/* Footer Styles */
.footer {
    background: #343a40;
    color: white;
    text-align: center;
    padding: 1.5rem 0;
    margin-top: auto;
}

/* Utility Classes */
.mb-3 { margin-bottom: 1rem; }

/* Responsive Design */
@media (max-width: 768px) {
    .container {
        padding: 0 15px;
    }

    .app-title {
        font-size: 2rem;
    }

    .content {
        padding: 1.5rem;
    }

    .col-6 {
        flex: 0 0 100%;
        margin-bottom: 1rem;
    }

    .btn {
        width: 100%;
        margin-bottom: 0.5rem;
    }
}
</style>`;

export const CLIENT_JS_TEMPLATE = `<script>
// Global state management
window.AppState = {
    loading: false,
    error: null,
    data: null
};

// Utility functions for UI management
function showLoading() {
    document.getElementById('loading').style.display = 'flex';
    document.getElementById('content').style.display = 'none';
    document.getElementById('error').style.display = 'none';
    window.AppState.loading = true;
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
    window.AppState.loading = false;
}

function showContent() {
    document.getElementById('content').style.display = 'block';
    document.getElementById('error').style.display = 'none';
}

function showError(message) {
    document.getElementById('error-message').textContent = message;
    document.getElementById('error').style.display = 'block';
    document.getElementById('content').style.display = 'none';
    hideLoading();
    window.AppState.error = message;
}

function clearError() {
    document.getElementById('error').style.display = 'none';
    window.AppState.error = null;
}

// Google Apps Script communication helpers
function callServerFunction(functionName, parameters = {}) {
    return new Promise((resolve, reject) => {
        showLoading();

        // Create the server call
        const serverCall = google.script.run
            .withSuccessHandler((result) => {
                hideLoading();
                window.AppState.data = result;
                resolve(result);
            })
            .withFailureHandler((error) => {
                hideLoading();
                const errorMessage = error.message || 'An unexpected error occurred';
                showError(errorMessage);
                reject(new Error(errorMessage));
            });

        // Call the server function with parameters
        if (Object.keys(parameters).length > 0) {
            serverCall[functionName](parameters);
        } else {
            serverCall[functionName]();
        }
    });
}

// Example server function calls
async function getStatus() {
    try {
        const result = await callServerFunction('getServerStatus');
        displayResult('Status retrieved successfully', result);
    } catch (error) {
        console.error('Failed to get status:', error);
    }
}

async function submitData(data) {
    try {
        const result = await callServerFunction('submitData', data);
        displaySuccess('Data submitted successfully');
        return result;
    } catch (error) {
        console.error('Failed to submit data:', error);
        throw error;
    }
}

// Display utilities
function displayResult(message, data) {
    clearError();
    showContent();

    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = \`
        <div class="success">
            <h3>✅ \${message}</h3>
            \${data ? \`<pre>\${JSON.stringify(data, null, 2)}</pre>\` : ''}
        </div>
    \`;
}

function displaySuccess(message) {
    clearError();
    showContent();

    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = \`
        <div class="success">
            <h3>✅ \${message}</h3>
        </div>
    \`;
}

// Retry mechanism
function retryOperation() {
    if (window.lastOperation) {
        window.lastOperation();
    } else {
        location.reload();
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Hide loading initially if content is static
    if (document.getElementById('content').innerHTML.trim()) {
        hideLoading();
        showContent();
    }

    // Add click handlers for any buttons with data-action attributes
    document.querySelectorAll('[data-action]').forEach(button => {
        button.addEventListener('click', function() {
            const action = this.getAttribute('data-action');
            const params = this.getAttribute('data-params');

            if (window[action]) {
                window.lastOperation = () => window[action](params ? JSON.parse(params) : undefined);
                window[action](params ? JSON.parse(params) : undefined);
            }
        });
    });

    // Auto-setup form handlers
    document.querySelectorAll('[data-server-function]').forEach(form => {
        const serverFunction = form.getAttribute('data-server-function');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());

            try {
                const result = await callServerFunction(serverFunction, data);
                displaySuccess('Form submitted successfully');
                form.reset();
                return result;
            } catch (error) {
                console.error('Form submission failed:', error);
            }
        });
    });
});
</script>`;
