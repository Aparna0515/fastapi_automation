/**
 * app.js - Frontend logic for FastAPI User Authentication & Upload Modules.
 * Manages JWT tokens, page/tab states, data grid lists, CSV/JSON template downloads,
 * drag-and-drop file imports, and toast notifications.
 */

const API_BASE_URL = window.location.origin && window.location.origin !== 'null' && !window.location.origin.startsWith('file://')
    ? window.location.origin
    : 'http://localhost:8000';

// Global application state
const state = {
    accessToken: localStorage.getItem('access_token') || null,
    user: null,
    uploadModels: null, // Cached upload schema metadata
    selectedFile: null,
};

// SVG icons for Password Toggles
const SVG_EYE_OPEN = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
    <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
</svg>`;

const SVG_EYE_CLOSED = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
</svg>`;

// Toast notifications SVG icons
const SVG_TOAST_SUCCESS = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
</svg>`;

const SVG_TOAST_ERROR = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
</svg>`;

const SVG_TOAST_WARNING = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
</svg>`;

/* ==========================================================================
   TOAST NOTIFICATION HELPER
   ========================================================================== */
function showToast(title, message, type = 'success', duration = 5000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = SVG_TOAST_SUCCESS;
    if (type === 'error') icon = SVG_TOAST_ERROR;
    if (type === 'warning') icon = SVG_TOAST_WARNING;

    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-msg">${message}</div>
        </div>
    `;

    container.appendChild(toast);

    // Fade out and remove
    const exitTimeout = setTimeout(() => {
        toast.classList.add('toast-exit');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 400);
    }, duration);

    // Dismiss on click
    toast.addEventListener('click', () => {
        clearTimeout(exitTimeout);
        toast.classList.add('toast-exit');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 200);
    });
}

/* ==========================================================================
   FORM INPUT ERROR UTILITIES
   ========================================================================== */
function setInputError(inputElement, errorMessage) {
    const group = inputElement.closest('.input-group');
    if (!group) return;
    
    group.classList.add('has-error');
    const errorText = group.querySelector('.error-text');
    if (errorText) {
        errorText.textContent = errorMessage;
    }
}

function clearInputError(inputElement) {
    const group = inputElement.closest('.input-group');
    if (!group) return;
    
    group.classList.remove('has-error');
    const errorText = group.querySelector('.error-text');
    if (errorText) {
        errorText.textContent = '';
    }
}

function clearAllErrors(formElement) {
    const errorGroups = formElement.querySelectorAll('.input-group.has-error');
    errorGroups.forEach(group => {
        group.classList.remove('has-error');
        const err = group.querySelector('.error-text');
        if (err) err.textContent = '';
    });
}

/* ==========================================================================
   INTERACTION HANDLERS: PASSWORD EYE TOGGLE
   ========================================================================== */
function setupPasswordToggles() {
    const toggles = document.querySelectorAll('.password-toggle');
    toggles.forEach(toggle => {
        toggle.innerHTML = SVG_EYE_OPEN;

        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            const input = toggle.previousElementSibling;
            if (!input) return;

            if (input.type === 'password') {
                input.type = 'text';
                toggle.innerHTML = SVG_EYE_CLOSED;
            } else {
                input.type = 'password';
                toggle.innerHTML = SVG_EYE_OPEN;
            }
        });
    });
}

/* ==========================================================================
   SCREEN & NAVIGATION MANAGERS
   ========================================================================== */
function switchScreen(screen) {
    const authCard = document.getElementById('auth-card');
    const dashboardCard = document.getElementById('dashboard-card');
    const appContainer = document.querySelector('.app-container');
    
    const loginSection = document.getElementById('login-section');
    const registerSection = document.getElementById('register-section');
    const authTitle = document.getElementById('auth-title');
    const authSubtitle = document.getElementById('auth-subtitle');

    authCard.classList.remove('card-enter', 'shake');
    dashboardCard.classList.remove('card-enter');

    if (screen === 'dashboard') {
        authCard.classList.add('hidden');
        dashboardCard.classList.remove('hidden');
        dashboardCard.classList.add('card-enter');
        if (appContainer) appContainer.classList.add('dashboard-active');
        
        // Reset dashboard to main menu view
        showDashboardMenu();
    } else {
        dashboardCard.classList.add('hidden');
        authCard.classList.remove('hidden');
        authCard.classList.add('card-enter');
        if (appContainer) appContainer.classList.remove('dashboard-active');

        if (screen === 'register') {
            loginSection.classList.add('hidden');
            registerSection.classList.remove('hidden');
            authTitle.textContent = 'Create Account';
            authSubtitle.textContent = 'Register to explore key features';
            clearAllErrors(document.getElementById('register-form'));
        } else {
            registerSection.classList.add('hidden');
            loginSection.classList.remove('hidden');
            authTitle.textContent = 'Welcome Back';
            authSubtitle.textContent = 'Access your account dashboard';
            clearAllErrors(document.getElementById('login-form'));
        }
    }
}

/**
 * Handle switching between dashboard tabs
 */
function switchTab(tabId) {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    tabButtons.forEach(btn => {
        if (btn.getAttribute('data-tab') === tabId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    tabPanels.forEach(panel => {
        if (panel.id === `panel-${tabId}`) {
            panel.classList.remove('hidden');
        } else {
            panel.classList.add('hidden');
        }
    });

    // Fire events depending on which tab opened
    if (tabId === 'data-view') {
        loadDataView();
    } else if (tabId === 'tools') {
        loadUploadCenterConfig();
    }
}

/* ==========================================================================
   API INTERACTION HELPER
   ========================================================================== */
async function makeRequest(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
        'Accept': 'application/json',
        ...options.headers
    };

    if (state.accessToken) {
        headers['Authorization'] = `Bearer ${state.accessToken}`;
    }

    const config = {
        ...options,
        headers
    };

    try {
        const response = await fetch(url, config);
        let data = null;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        }

        if (!response.ok) {
            const errorMsg = data && data.detail ? data.detail : `HTTP error! Status: ${response.status}`;
            throw { status: response.status, message: errorMsg };
        }

        return data;
    } catch (err) {
        console.error(`Request to ${endpoint} failed:`, err);
        throw err;
    }
}

/* ==========================================================================
   AUTHENTICATION FLOWS
   ========================================================================== */

async function loadUserProfile() {
    try {
        const user = await makeRequest('/api/auth/me');
        state.user = user;
        
        const nameEl = document.getElementById('user-display-name');
        if (nameEl) nameEl.textContent = user.name;
        
        switchScreen('dashboard');
    } catch (err) {
        showToast('Authentication Failed', 'Unable to fetch your profile. Please sign in again.', 'error');
        logoutClient();
    }
}

async function handleLogout(btn) {
    const btnText = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.spinner');

    if (btnText && spinner) {
        btnText.classList.add('hidden');
        spinner.classList.remove('hidden');
    }
    btn.disabled = true;

    try {
        await makeRequest('/api/auth/logout', { method: 'POST' });
        showToast('Success', 'Successfully signed out.', 'success');
    } catch (err) {
        console.warn('Backend signout failed:', err);
    } finally {
        logoutClient();
        if (btnText && spinner) {
            btnText.classList.remove('hidden');
            spinner.classList.add('hidden');
        }
        btn.disabled = false;
    }
}

function logoutClient() {
    state.accessToken = null;
    state.user = null;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    switchScreen('login');
}

async function handleRegister(e) {
    e.preventDefault();
    const form = e.target;
    const btn = document.getElementById('btn-register');
    const btnText = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.spinner');

    const nameInput = document.getElementById('register-name');
    const emailInput = document.getElementById('register-email');
    const passwordInput = document.getElementById('register-password');
    const confirmInput = document.getElementById('register-confirm-password');

    clearAllErrors(form);

    let hasError = false;

    if (!nameInput.value.trim()) {
        setInputError(nameInput, 'Full Name is required');
        hasError = true;
    }

    if (!emailInput.value.trim()) {
        setInputError(emailInput, 'Email Address is required');
        hasError = true;
    } else if (!validateEmail(emailInput.value)) {
        setInputError(emailInput, 'Please enter a valid email address');
        hasError = true;
    }

    if (!passwordInput.value) {
        setInputError(passwordInput, 'Password is required');
        hasError = true;
    } else if (passwordInput.value.length < 8) {
        setInputError(passwordInput, 'Password must be at least 8 characters long');
        hasError = true;
    }

    if (!confirmInput.value) {
        setInputError(confirmInput, 'Please confirm your password');
        hasError = true;
    } else if (passwordInput.value !== confirmInput.value) {
        setInputError(confirmInput, 'Passwords do not match');
        hasError = true;
    }

    if (hasError) {
        document.getElementById('auth-card').classList.add('shake');
        setTimeout(() => document.getElementById('auth-card').classList.remove('shake'), 400);
        return;
    }

    btnText.classList.add('hidden');
    spinner.classList.remove('hidden');
    btn.disabled = true;

    try {
        const payload = {
            name: nameInput.value.trim(),
            email: emailInput.value.trim().toLowerCase(),
            password: passwordInput.value,
            confirm_password: confirmInput.value
        };

        await makeRequest('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        showToast('Account Created!', 'Please sign in with your credentials.', 'success');
        form.reset();
        switchScreen('login');
    } catch (err) {
        document.getElementById('auth-card').classList.add('shake');
        setTimeout(() => document.getElementById('auth-card').classList.remove('shake'), 400);
        
        const errMsg = err.message || 'Registration failed.';
        if (errMsg.toLowerCase().includes('email')) {
            setInputError(emailInput, errMsg);
        } else {
            showToast('Registration Error', errMsg, 'error');
        }
    } finally {
        btnText.classList.remove('hidden');
        spinner.classList.add('hidden');
        btn.disabled = false;
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const form = e.target;
    const btn = document.getElementById('btn-login');
    const btnText = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.spinner');

    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');

    clearAllErrors(form);

    let hasError = false;

    if (!emailInput.value.trim()) {
        setInputError(emailInput, 'Email Address is required');
        hasError = true;
    } else if (!validateEmail(emailInput.value)) {
        setInputError(emailInput, 'Please enter a valid email address');
        hasError = true;
    }

    if (!passwordInput.value) {
        setInputError(passwordInput, 'Password is required');
        hasError = true;
    }

    if (hasError) {
        document.getElementById('auth-card').classList.add('shake');
        setTimeout(() => document.getElementById('auth-card').classList.remove('shake'), 400);
        return;
    }

    btnText.classList.add('hidden');
    spinner.classList.remove('hidden');
    btn.disabled = true;

    try {
        const payload = {
            email: emailInput.value.trim().toLowerCase(),
            password: passwordInput.value
        };

        const response = await makeRequest('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        state.accessToken = response.access_token;
        localStorage.setItem('access_token', response.access_token);

        showToast('Welcome!', 'Signed in successfully.', 'success');
        form.reset();
        
        await loadUserProfile();
    } catch (err) {
        document.getElementById('auth-card').classList.add('shake');
        setTimeout(() => document.getElementById('auth-card').classList.remove('shake'), 400);

        const errMsg = err.message || 'Incorrect credentials.';
        setInputError(passwordInput, 'Incorrect email or password');
    } finally {
        btnText.classList.remove('hidden');
        spinner.classList.add('hidden');
        btn.disabled = false;
    }
}

/* ==========================================================================
   DATA VIEW: COURSES & STUDENTS LISTS
   ========================================================================== */

/**
 * Switch table container panels inside Data View tab.
 */
function switchDataTableView(viewType) {
    const btnCourses = document.getElementById('btn-show-courses');
    const btnStudents = document.getElementById('btn-show-students');
    const tableCourses = document.getElementById('courses-table-wrapper');
    const tableStudents = document.getElementById('students-table-wrapper');

    if (viewType === 'courses') {
        btnCourses.classList.add('active');
        btnStudents.classList.remove('active');
        tableCourses.classList.remove('hidden');
        tableStudents.classList.add('hidden');
    } else {
        btnCourses.classList.remove('active');
        btnStudents.classList.add('active');
        tableCourses.classList.add('hidden');
        tableStudents.classList.remove('hidden');
    }
}

/**
 * Fetch and load both Course and Student lists.
 */
async function loadDataView() {
    const btnRefresh = document.getElementById('btn-refresh-data');
    btnRefresh.classList.add('spinning');

    try {
        await Promise.all([loadCoursesTable(), loadStudentsTable()]);
    } catch (e) {
        showToast('Error Loading Data', 'Failed to retrieve database records.', 'error');
    } finally {
        btnRefresh.classList.remove('spinning');
    }
}

async function loadCoursesTable() {
    const tbody = document.getElementById('courses-table-body');
    tbody.innerHTML = `<tr><td colspan="2" class="text-center">Loading courses...</td></tr>`;

    try {
        const courses = await makeRequest('/api/upload/courses');
        if (courses.length === 0) {
            tbody.innerHTML = `<tr><td colspan="2" class="text-center">No courses found. Go to Upload Center to import.</td></tr>`;
            return;
        }

        tbody.innerHTML = courses.map(course => `
            <tr>
                <td class="font-mono">#${course.id}</td>
                <td><strong>${escapeHTML(course.course_name)}</strong></td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="2" class="text-center" style="color: var(--error);">Error retrieving courses.</td></tr>`;
        throw err;
    }
}

async function loadStudentsTable() {
    const tbody = document.getElementById('students-table-body');
    tbody.innerHTML = `<tr><td colspan="4" class="text-center">Loading students...</td></tr>`;

    try {
        const students = await makeRequest('/api/upload/students');
        if (students.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center">No students found. Go to Upload Center to import.</td></tr>`;
            return;
        }

        tbody.innerHTML = students.map(st => `
            <tr>
                <td class="font-mono">#${st.id}</td>
                <td><strong>${escapeHTML(st.name)}</strong></td>
                <td>${escapeHTML(st.email)}</td>
                <td><span class="badge badge-success">${escapeHTML(st.course_name || 'None')}</span></td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center" style="color: var(--error);">Error retrieving students.</td></tr>`;
        throw err;
    }
}

/* ==========================================================================
   UPLOAD CENTER: SCHEMA CACHING & TEMPLATES
   ========================================================================== */

/**
 * Fetch permitted upload models and caching inside application.
 */
async function loadUploadCenterConfig() {
    try {
        if (!state.uploadModels) {
            state.uploadModels = await makeRequest('/api/upload/models');
        }
        updateUploadGuide();
        clearSelectedFile();
    } catch (err) {
        showToast('Error Loading Models', 'Unable to fetch upload schemas from backend.', 'error');
    }
}

/**
 * Update guide box instructions based on selected target upload model.
 */
function updateUploadGuide() {
    const modelSelect = document.getElementById('upload-model-select');
    const guideText = document.getElementById('model-guide-text');
    if (!modelSelect || !guideText || !state.uploadModels) return;

    const selectedModel = modelSelect.value;
    const modelData = state.uploadModels.find(m => m.model === selectedModel);

    if (modelData) {
        let fieldDescriptions = modelData.fields.map(f => {
            const req = f.required ? '<span style="color:var(--error);">*required</span>' : 'optional';
            return `<li><code>${f.name}</code> (${f.type}): ${f.description} (${req})</li>`;
        }).join('');

        guideText.innerHTML = `
            <strong>${escapeHTML(modelData.description)}</strong>
            <p style="margin: 8px 0 6px 0;">Accepted Fields:</p>
            <ul style="padding-left: 20px; font-size: 12.5px;">${fieldDescriptions}</ul>
            <p style="margin-top: 8px; font-size: 11.5px; color: var(--text-muted);">
               Note: System normalizes headers (removes spaces, lowercases). Column order does not matter.
            </p>
        `;
    }
}

/**
 * Generate templates dynamically and download to client disk.
 */
function downloadTemplate(fileType) {
    const modelSelect = document.getElementById('upload-model-select');
    if (!modelSelect || !state.uploadModels) return;

    const selectedModel = modelSelect.value;
    const modelData = state.uploadModels.find(m => m.model === selectedModel);
    if (!modelData) return;

    let content = '';
    let mimeType = '';
    let extension = '';

    if (fileType === 'csv') {
        content = modelData.template_csv;
        mimeType = 'text/csv';
        extension = 'csv';
    } else {
        content = modelData.template_json;
        mimeType = 'application/json';
        extension = 'json';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedModel.toLowerCase()}_template.${extension}`;
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('Template Downloaded', `${selectedModel} template in .${extension} format is ready.`, 'success');
}

/* ==========================================================================
   UPLOAD CENTER: DRAG AND DROP & IMPORT ACTIONS
   ========================================================================== */

function setupFileDropZone() {
    const dropZone = document.getElementById('upload-drop-zone');
    const fileInput = document.getElementById('upload-file-input');

    if (!dropZone || !fileInput) return;

    // Trigger browse on click
    dropZone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });

    // Drag events
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('dragover');
        }, false);
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            handleFileSelect(files[0]);
        }
    }, false);
}

function handleFileSelect(file) {
    // Validate file extensions
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'csv' && ext !== 'json') {
        showToast('Format Unacceptable', 'Only CSV and JSON files are supported for import.', 'error');
        clearSelectedFile();
        return;
    }

    // Limit to 5MB
    if (file.size > 5 * 1024 * 1024) {
        showToast('File Too Large', 'Maximum allowed file size is 5MB.', 'error');
        clearSelectedFile();
        return;
    }

    state.selectedFile = file;
    
    // Update selected file card details
    document.getElementById('selected-file-name').textContent = file.name;
    document.getElementById('selected-file-size').textContent = formatBytes(file.size);
    document.getElementById('selected-file-details').classList.remove('hidden');

    // Hide previous results
    document.getElementById('upload-results').classList.add('hidden');
}

function clearSelectedFile() {
    state.selectedFile = null;
    document.getElementById('upload-file-input').value = '';
    
    const details = document.getElementById('selected-file-details');
    if (details) details.classList.add('hidden');
}

/**
 * Send the FormData upload import request and start polling the background task.
 */
async function submitImport() {
    if (!state.selectedFile) return;

    const btn = document.getElementById('btn-submit-upload');
    const btnText = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.spinner');
    const modelSelect = document.getElementById('upload-model-select');

    btnText.classList.add('hidden');
    spinner.classList.remove('hidden');
    btn.disabled = true;

    // Display processing state in results box
    const resultsBox = document.getElementById('upload-results');
    const badge = document.getElementById('results-status-badge');
    const statRows = document.getElementById('result-stat-inserted');
    const errorsList = document.getElementById('upload-errors-list');

    if (resultsBox && badge && statRows && errorsList) {
        badge.className = 'results-badge';
        badge.textContent = 'Processing';
        badge.style.color = 'var(--warning)';
        badge.style.backgroundColor = 'var(--warning-bg)';
        statRows.textContent = '0';
        errorsList.innerHTML = '<div>Connecting to Celery task queue...</div>';
        resultsBox.classList.remove('hidden');
    }

    const formData = new FormData();
    formData.append('model_name', modelSelect.value);
    formData.append('file', state.selectedFile);

    try {
        const response = await makeRequest('/api/upload/', {
            method: 'POST',
            body: formData
        });

        if (response.success && response.task_id) {
            showToast('Upload Received', 'Import task started in background.', 'success');
            pollUploadTask(response.task_id, btn, btnText, spinner);
        } else {
            throw new Error('Task ID missing in response.');
        }
    } catch (err) {
        showToast('Upload Failure', err.message || 'Network error encountered during upload.', 'error');
        clearSelectedFile();
        if (resultsBox) resultsBox.classList.add('hidden');
        btnText.classList.remove('hidden');
        spinner.classList.add('hidden');
        btn.disabled = false;
    }
}

/**
 * Poll the background Celery task status.
 */
async function pollUploadTask(taskId, btn, btnText, spinner) {
    const resultsBox = document.getElementById('upload-results');
    const badge = document.getElementById('results-status-badge');
    const errorsList = document.getElementById('upload-errors-list');

    const pollInterval = setInterval(async () => {
        try {
            const data = await makeRequest(`/api/upload/tasks/${taskId}`);
            
            if (errorsList && badge) {
                badge.textContent = data.status;
                errorsList.innerHTML = `<div>Queue status: <strong>${data.status}</strong>... waiting for worker.</div>`;
            }

            if (data.status === 'SUCCESS' || data.status === 'FAILURE') {
                clearInterval(pollInterval);
                
                // Process final result
                displayUploadResults(data.result);
                clearSelectedFile();
                
                // Re-enable UI
                btnText.classList.remove('hidden');
                spinner.classList.add('hidden');
                btn.disabled = false;
                
                // Reload lists on success
                if (data.status === 'SUCCESS') {
                    loadDataView();
                }
            }
        } catch (err) {
            clearInterval(pollInterval);
            showToast('Polling Error', 'Lost connection to task status monitor.', 'error');
            clearSelectedFile();
            if (resultsBox) resultsBox.classList.add('hidden');
            btnText.classList.remove('hidden');
            spinner.classList.add('hidden');
            btn.disabled = false;
        }
    }, 1000);
}

/**
 * Render upload summary report and row-by-row failures
 */
function displayUploadResults(result) {
    const resultsBox = document.getElementById('upload-results');
    const statRows = document.getElementById('result-stat-inserted');
    const errorsList = document.getElementById('upload-errors-list');
    const badge = document.getElementById('results-status-badge');

    if (!resultsBox || !statRows || !errorsList || !badge) return;

    statRows.textContent = result.rows_inserted;
    errorsList.innerHTML = '';
    
    // Determine overall status colors and text
    badge.className = 'results-badge';
    if (result.success && result.errors.length === 0) {
        badge.classList.add('success');
        badge.textContent = 'Success';
        showToast('Import Complete', `Successfully imported ${result.rows_inserted} records!`, 'success');
    } else if (result.success && result.errors.length > 0) {
        badge.classList.add('partial');
        badge.textContent = 'Partial';
        showToast('Import Warning', `Imported ${result.rows_inserted} rows, but skipped some due to errors.`, 'warning');
    } else {
        badge.classList.add('partial'); // treats failure as warning styling
        badge.style.color = 'var(--error)';
        badge.style.backgroundColor = 'var(--error-bg)';
        badge.textContent = 'Failed';
        showToast('Import Failed', 'No records were added due to parsing/database failures.', 'error');
    }

    // Populate row-by-row errors
    if (result.errors.length > 0) {
        errorsList.innerHTML = result.errors.map(err => `<div>• ${escapeHTML(err)}</div>`).join('');
    } else {
        errorsList.innerHTML = '<div style="color: var(--success);">No failures detected. Clean import!</div>';
    }

    resultsBox.classList.remove('hidden');
}

/* ==========================================================================
   VALIDATIONS & UTILITIES
   ========================================================================== */
function validateEmail(email) {
    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;");
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function setupInputListeners() {
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('input', () => clearInputError(input));
        input.addEventListener('focus', () => clearInputError(input));
    });
}

// Page Load Handler
window.addEventListener('DOMContentLoaded', async () => {
    // 1. Setup toggle structures & buttons
    setupPasswordToggles();
    setupInputListeners();
    setupFileDropZone();

    // 2. Setup button navigation click events
    document.getElementById('link-register').addEventListener('click', (e) => {
        e.preventDefault();
        switchScreen('register');
    });

    document.getElementById('link-login').addEventListener('click', (e) => {
        e.preventDefault();
        switchScreen('login');
    });

    document.getElementById('btn-logout').addEventListener('click', (e) => {
        e.preventDefault();
        handleLogout(e.currentTarget);
    });

    // 3. Card click bindings for dashboard sub-panels
    document.getElementById('card-import-tool').addEventListener('click', () => openToolPanel('import-tool'));
    document.getElementById('card-export-tool').addEventListener('click', () => openToolPanel('export-tool'));
    document.getElementById('card-data-view').addEventListener('click', () => openToolPanel('data-view'));
    document.getElementById('card-settings').addEventListener('click', () => openToolPanel('settings'));

    // Back to dashboard menu binding
    document.getElementById('btn-back-to-menu').addEventListener('click', showDashboardMenu);

    // Settings form submit binding
    document.getElementById('settings-form').addEventListener('submit', handleSettingsUpdate);

    // 4. Data-view toggle bindings
    document.getElementById('btn-show-courses').addEventListener('click', () => switchDataTableView('courses'));
    document.getElementById('btn-show-students').addEventListener('click', () => switchDataTableView('students'));
    document.getElementById('btn-refresh-data').addEventListener('click', loadDataView);

    // 5. Upload center template and submit bindings
    document.getElementById('upload-model-select').addEventListener('change', updateUploadGuide);
    document.getElementById('btn-dl-csv').addEventListener('click', () => downloadTemplate('csv'));
    document.getElementById('btn-dl-json').addEventListener('click', () => downloadTemplate('json'));
    document.getElementById('btn-submit-upload').addEventListener('click', submitImport);
    document.getElementById('btn-submit-export').addEventListener('click', submitExport);

    // 6. Form submit binds
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('register-form').addEventListener('submit', handleRegister);

    // 7. Initial session check
    if (state.accessToken) {
        await loadUserProfile();
    } else {
        switchScreen('login');
    }
});

/**
 * Toggle between Import Tool and Export Tool sub-panels inside the Tools tab.
 */
/**
 * Navigates into a specific tool view sub-panel from the dashboard card grid menu.
 */
function openToolPanel(panelId) {
    const menuView = document.getElementById('dashboard-menu-view');
    const detailsView = document.getElementById('dashboard-details-view');
    
    if (!menuView || !detailsView) return;

    menuView.classList.add('hidden');
    detailsView.classList.remove('hidden');

    const panels = ['panel-import-tool', 'panel-export-tool', 'panel-data-view', 'panel-settings'];
    panels.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (id === `panel-${panelId}`) {
                el.classList.remove('hidden');
            } else {
                el.classList.add('hidden');
            }
        }
    });

    if (panelId === 'data-view') {
        loadDataView();
    } else if (panelId === 'import-tool') {
        loadUploadCenterConfig();
    } else if (panelId === 'settings') {
        // Pre-populate settings input forms
        const nameInput = document.getElementById('settings-name');
        const emailInput = document.getElementById('settings-email');
        const passwordInput = document.getElementById('settings-password');
        const confirmPasswordInput = document.getElementById('settings-confirm-password');

        if (nameInput) nameInput.value = state.user ? state.user.name : '';
        if (emailInput) emailInput.value = state.user ? state.user.email : '';
        if (passwordInput) passwordInput.value = '';
        if (confirmPasswordInput) confirmPasswordInput.value = '';

        // Clear previous error messages
        document.getElementById('settings-name-error').textContent = '';
        document.getElementById('settings-email-error').textContent = '';
        document.getElementById('settings-password-error').textContent = '';
        document.getElementById('settings-confirm-password-error').textContent = '';
    }
}

/**
 * Resets the dashboard back to the main management grid card menu.
 */
function showDashboardMenu() {
    const menuView = document.getElementById('dashboard-menu-view');
    const detailsView = document.getElementById('dashboard-details-view');
    
    if (menuView && detailsView) {
        menuView.classList.remove('hidden');
        detailsView.classList.add('hidden');
    }
}

/**
 * Validates and submits account settings profile updates (PUT /api/auth/profile).
 */
async function handleSettingsUpdate(e) {
    e.preventDefault();

    const nameInput = document.getElementById('settings-name');
    const emailInput = document.getElementById('settings-email');
    const passwordInput = document.getElementById('settings-password');
    const confirmPasswordInput = document.getElementById('settings-confirm-password');

    const btn = document.getElementById('btn-submit-settings');
    const btnText = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.spinner');

    if (!nameInput || !emailInput || !passwordInput || !confirmPasswordInput) return;

    // Reset errors
    document.getElementById('settings-name-error').textContent = '';
    document.getElementById('settings-email-error').textContent = '';
    document.getElementById('settings-password-error').textContent = '';
    document.getElementById('settings-confirm-password-error').textContent = '';

    let hasErrors = false;

    // Name check
    if (!nameInput.value.trim()) {
        document.getElementById('settings-name-error').textContent = 'Full name is required.';
        hasErrors = true;
    }

    // Email check
    if (!emailInput.value.trim()) {
        document.getElementById('settings-email-error').textContent = 'Email address is required.';
        hasErrors = true;
    } else if (!validateEmail(emailInput.value.trim())) {
        document.getElementById('settings-email-error').textContent = 'Invalid email address.';
        hasErrors = true;
    }

    // Password check
    if (passwordInput.value) {
        if (passwordInput.value.length < 8) {
            document.getElementById('settings-password-error').textContent = 'Password must be at least 8 characters.';
            hasErrors = true;
        }
        if (passwordInput.value !== confirmPasswordInput.value) {
            document.getElementById('settings-confirm-password-error').textContent = 'Passwords do not match.';
            hasErrors = true;
        }
    }

    if (hasErrors) return;

    btnText.classList.add('hidden');
    spinner.classList.remove('hidden');
    btn.disabled = true;

    const payload = {
        name: nameInput.value.trim(),
        email: emailInput.value.trim()
    };
    if (passwordInput.value) {
        payload.password = passwordInput.value;
    }

    try {
        const user = await makeRequest('/api/auth/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        state.user = user;
        document.getElementById('user-display-name').textContent = user.name;
        showToast('Profile Updated', 'Your settings have been saved successfully.', 'success');
        showDashboardMenu();
    } catch (err) {
        showToast('Update Failed', err.message || 'Unable to update profile settings.', 'error');
    } finally {
        btnText.classList.remove('hidden');
        spinner.classList.add('hidden');
        btn.disabled = false;
    }
}

/**
 * Fire the asynchronous Celery database to CSV export task.
 */
async function submitExport() {
    const btn = document.getElementById('btn-submit-export');
    const btnText = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.spinner');
    const modelSelect = document.getElementById('export-model-select');

    const resultsBox = document.getElementById('export-results');
    const badge = document.getElementById('export-status-badge');
    const message = document.getElementById('export-status-message');

    if (!btn || !modelSelect) return;

    btnText.classList.add('hidden');
    spinner.classList.remove('hidden');
    btn.disabled = true;

    // Reset status box to processing
    if (resultsBox && badge && message) {
        badge.className = 'results-badge';
        badge.textContent = 'Processing';
        badge.style.color = 'var(--warning)';
        badge.style.backgroundColor = 'var(--warning-bg)';
        message.textContent = 'Queuing export task in background...';
        resultsBox.classList.remove('hidden');
    }

    const formData = new FormData();
    formData.append('model_name', modelSelect.value);

    try {
        const response = await makeRequest('/api/upload/export', {
            method: 'POST',
            body: formData
        });

        if (response.success && response.task_id) {
            showToast('Export Queued', 'Celery worker processing CSV generation.', 'success');
            pollExportTask(response.task_id, btn, btnText, spinner, modelSelect.value);
        } else {
            throw new Error('Export task ID not returned by server.');
        }
    } catch (err) {
        showToast('Export Failure', err.message || 'Unable to trigger export background task.', 'error');
        if (resultsBox) resultsBox.classList.add('hidden');
        btnText.classList.remove('hidden');
        spinner.classList.add('hidden');
        btn.disabled = false;
    }
}

/**
 * Poll task status endpoint to retrieve export CSV once complete.
 */
async function pollExportTask(taskId, btn, btnText, spinner, modelName) {
    const resultsBox = document.getElementById('export-results');
    const badge = document.getElementById('export-status-badge');
    const message = document.getElementById('export-status-message');

    const pollInterval = setInterval(async () => {
        try {
            const data = await makeRequest(`/api/upload/tasks/${taskId}`);
            
            if (badge && message) {
                badge.textContent = data.status;
                message.textContent = `Queue status: <strong>${data.status}</strong>... compiling records.`;
            }

            if (data.status === 'SUCCESS' || data.status === 'FAILURE') {
                clearInterval(pollInterval);
                
                // Re-enable UI
                btnText.classList.remove('hidden');
                spinner.classList.add('hidden');
                btn.disabled = false;

                if (data.status === 'SUCCESS') {
                    const result = data.result;
                    if (result.success && result.csv_data) {
                        // Generate blob and trigger browser download
                        const blob = new Blob([result.csv_data], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = result.filename || `${modelName.toLowerCase()}_export.csv`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                        
                        badge.className = 'results-badge success';
                        badge.textContent = 'Complete';
                        message.textContent = `Successfully exported database. CSV file downloaded to your system.`;
                        showToast('Export Complete', `${modelName} CSV download triggered.`, 'success');
                    } else {
                        badge.className = 'results-badge error';
                        badge.style.color = 'var(--error)';
                        badge.style.backgroundColor = 'var(--error-bg)';
                        badge.textContent = 'Failed';
                        message.textContent = result.error || 'Task completed but database query failed.';
                        showToast('Export Failed', result.error || 'CSV compilation failed.', 'error');
                    }
                } else {
                    badge.className = 'results-badge error';
                    badge.style.color = 'var(--error)';
                    badge.style.backgroundColor = 'var(--error-bg)';
                    badge.textContent = 'Failed';
                    message.textContent = 'Worker process failed to complete task execution.';
                    showToast('Export Failed', 'Worker returned an execution failure.', 'error');
                }
            }
        } catch (err) {
            clearInterval(pollInterval);
            showToast('Polling Error', 'Lost connection to task monitor.', 'error');
            if (resultsBox) resultsBox.classList.add('hidden');
            btnText.classList.remove('hidden');
            spinner.classList.add('hidden');
            btn.disabled = false;
        }
    }, 1000);
}
