// ================================================
// API HELPER FUNCTIONS
// ================================================

async function apiCall(endpoint, data = null, method = "POST") {
    try {
        const options = {
            method: method,
            headers: {
                "Content-Type": "application/json",
            },
        };

        if (data && method !== "GET") {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(`/api/${endpoint}`, options);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        return result;
    } catch (error) {
        console.error(`API call to ${endpoint} failed:`, error);
        throw error;
    }
}

// ================================================
// API FUNCTIONS (Replacing Wails bindings)
// ================================================

// Authentication
async function Login(credentials) {
    return await apiCall("login", credentials);
}

async function Logout() {
    return await apiCall("logout");
}

async function GetCurrentUser() {
    return await apiCall("current-user", null, "GET");
}

async function CheckLoginStatus() {
    return await apiCall("check-login-status", null, "GET");
}

async function TestSendLimit(request) {
    return await apiCall("test-send-limit", request);
}

// Task management
async function CreateTask() {
    return await apiCall("create-task");
}

async function UpdateTask(taskId, updates) {
    return await apiCall("update-task", { taskId, updates });
}

async function DeleteTask(taskId) {
    return await apiCall("delete-task", { taskId });
}

async function GetTask(taskId) {
    return await apiCall(`get-task?taskId=${taskId}`, null, "GET");
}

async function GetAllTasks() {
    return await apiCall("get-tasks", null, "GET");
}

async function ClearCompletedTasks() {
    return await apiCall("clear-completed-tasks");
}

// Task control
async function StartSending(taskId) {
    return await apiCall("start-sending", { taskId });
}

async function PauseTask(taskId) {
    return await apiCall("pause-task", { taskId });
}

async function ResumeTask(taskId) {
    return await apiCall("resume-task", { taskId });
}

async function StopTask(taskId) {
    return await apiCall("stop-task", { taskId });
}

// File upload
async function UploadFile(file, filename) {
    const formData = new FormData();
    formData.append("file", file);
    
    try {
        const response = await fetch("/api/upload-file", {
            method: "POST",
            body: formData,
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        return result.filePath;
    } catch (error) {
        console.error("File upload failed:", error);
        throw error;
    }
}

// SMTP management
async function GetSMTPSettings() {
    return await apiCall("smtp-settings", null, "GET");
}

async function UpdateSMTPServer(server) {
    return await apiCall("update-smtp", server);
}

async function UploadSMTPFile(base64Data) {
    return await apiCall("upload-smtp", { base64Data });
}

async function AddManualSMTP(email, password) {
    return await apiCall("add-manual-smtp", { email, password });
}

async function TestSMTPConnection() {
    return await apiCall("test-smtp-connection");
}

async function ClearSMTPAccounts(accountType) {
    return await apiCall("clear-smtp-accounts", { accountType });
}

async function DownloadSMTPReport(reportType) {
    try {
        const response = await fetch(`/api/download-smtp-report?type=${reportType}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${reportType}_smtp_report_${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        return true;
    } catch (error) {
        console.error("Download failed:", error);
        throw error;
    }
}

// Tags
async function GetTaskTags() {
    return await apiCall("task-tags", null, "GET");
}

// Window controls (web versions)
async function MaximizeWindow() {
    return await apiCall("maximize-window");
}

async function MinimizeWindow() {
    return await apiCall("minimize-window");
}

async function RestoreWindow() {
    return await apiCall("restore-window");
}

async function CloseWindow() {
    return await apiCall("close-window");
}

async function SetWindowSize(width, height) {
    return await apiCall("set-window-size", { width, height });
}

async function GetWindowState() {
    return await apiCall("get-window-state", null, "GET");
}

async function GetTaskErrors(taskId) {
    // Note: This function needs to be implemented in the backend API
    // For now, we'll get the task and extract errors
    const task = await GetTask(taskId);
    if (task.success) {
        return {
            success: true,
            errors: task.task.errors || []
        };
    }
    return task;
}

async function GetCurrentTime() {
    // For web version, use client time
    return {
        success: true,
        time: new Date().toISOString()
    };
}

// ================================================
// REST OF THE FRONTEND CODE (SAME AS BEFORE)
// ================================================

// Current active task
let currentTaskId = null;
let activeTasks = new Map();
let notifications = [];
let uploadedFiles = new Map();
let formDataCache = new Map();
let isPollingPaused = false;
let currentUser = null;
let taskTags = {};
let smtpSettings = null;
let emailFormScroll = null;
let isWindowMaximized = false;
let loginStartTime = null;
let logoutTimerInterval = null;

// DOM Elements (same as before)
const elements = {
    // Window controls
    minimizeBtn: document.getElementById('minimizeBtn'),
    maximizeBtn: document.getElementById('maximizeBtn'),
    restoreBtn: document.getElementById('restoreBtn'),
    closeBtn: document.getElementById('closeBtn'),
    
    // Login screen
    loginScreen: document.getElementById('loginScreen'),
    loginForm: document.getElementById('loginForm'),
    loginUsername: document.getElementById('loginUsername'),
    loginPassword: document.getElementById('loginPassword'),
    loginBtn: document.getElementById('loginBtn'),
    loginStatus: document.getElementById('loginStatus'),
    systemIP: document.getElementById('systemIP'),
    currentDate: document.getElementById('currentDate'),
    
    // Main app
    mainApp: document.getElementById('mainApp'),
    currentUsername: document.getElementById('currentUsername'),
    userAvatar: document.getElementById('userAvatar'),
    userLimit: document.getElementById('userLimit'),
    userSent: document.getElementById('userSent'),
    logoutBtn: document.getElementById('logoutBtn'),
    
    // Header tabs
    emailTabBtn: document.getElementById('emailTabBtn'),
    smtpTabBtn: document.getElementById('smtpTabBtn'),
    userDetailsTabBtn: document.getElementById('userDetailsTabBtn'),
    tagsTabBtn: document.getElementById('tagsTabBtn'),
    
    // Task management
    newTaskBtn: document.getElementById('newTaskBtn'),
    clearTasksBtn: document.getElementById('clearTasksBtn'),
    taskList: document.getElementById('taskList'),
    
    // Tab containers
    emailFormContainer: document.getElementById('emailFormContainer'),
    emailFormScroll: document.getElementById('emailFormScroll'),
    smtpContainer: document.getElementById('smtpContainer'),
    userDetailsContainer: document.getElementById('userDetailsContainer'),
    tagsContainer: document.getElementById('tagsContainer'),
    
    // Email form elements
    senderName: document.getElementById('senderName'),
    subject: document.getElementById('subject'),
    body: document.getElementById('body'),
    useSMTPRotation: document.getElementById('useSMTPRotation'),
    
    // SMTP stats in task progress
    availableSMTPCount: document.getElementById('availableSMTPCount'),
    wrongSMTPCount: document.getElementById('wrongSMTPCount'),
    
    // Attachment name options
    useOriginalName: document.getElementById('useOriginalName'),
    useCustomName: document.getElementById('useCustomName'),
    useTagsForName: document.getElementById('useTagsForName'),
    customAttachment: document.getElementById('customAttachment'),
    
    // File upload
    rawAttachmentsDrop: document.getElementById('rawAttachmentsDrop'),
    rawAttachmentsInput: document.getElementById('rawAttachmentsInput'),
    rawAttachmentsList: document.getElementById('rawAttachmentsList'),
    
    // Recipients
    recipients: document.getElementById('recipients'),
    
    // Time delay elements
    delaySeconds: document.getElementById('delaySeconds'),
    useRandomDelay: document.getElementById('useRandomDelay'),
    fixedDelayOption: document.getElementById('fixedDelayOption'),
    
    // Action buttons
    startBtn: document.getElementById('startBtn'),
    pauseBtn: document.getElementById('pauseBtn'),
    resumeBtn: document.getElementById('resumeBtn'),
    stopBtn: document.getElementById('stopBtn'),
    saveBtn: document.getElementById('saveBtn'),
    deleteBtn: document.getElementById('deleteBtn'),
    
    // SMTP Configuration elements
    smtpServer: document.getElementById('smtpServer'),
    smtpPort: document.getElementById('smtpPort'),
    smtpSecurity: document.getElementById('smtpSecurity'),
    smtpDomain: document.getElementById('smtpDomain'),
    smtpStatus: document.getElementById('smtpStatus'),
    testSMTPConnectionBtn: document.getElementById('testSMTPConnectionBtn'),
    saveSMTPSettingsBtn: document.getElementById('saveSMTPSettingsBtn'),
    
    // SMTP Accounts
    availableSMTPList: document.getElementById('availableSMTPList'),
    wrongSMTPList: document.getElementById('wrongSMTPList'),
    downloadAvailableBtn: document.getElementById('downloadAvailableBtn'),
    downloadWrongBtn: document.getElementById('downloadWrongBtn'),
    clearAvailableBtn: document.getElementById('clearAvailableBtn'),
    clearWrongBtn: document.getElementById('clearWrongBtn'),
    
    // SMTP File Upload
    smtpFileDrop: document.getElementById('smtpFileDrop'),
    smtpFileInput: document.getElementById('smtpFileInput'),
    autoUploadSMTP: document.getElementById('autoUploadSMTP'),
    
    // Manual SMTP Addition
    manualEmail: document.getElementById('manualEmail'),
    manualPassword: document.getElementById('manualPassword'),
    addManualSMTPBtn: document.getElementById('addManualSMTPBtn'),
    
    // User details elements
    detailUsername: document.getElementById('detailUsername'),
    detailUserType: document.getElementById('detailUserType'),
    detailIP: document.getElementById('detailIP'),
    detailLastLogin: document.getElementById('detailLastLogin'),
    detailMaxLogins: document.getElementById('detailMaxLogins'),
    detailLoginsToday: document.getElementById('detailLoginsToday'),
    detailLoggedIPs: document.getElementById('detailLoggedIPs'),
    detailExpiryDate: document.getElementById('detailExpiryDate'),
    detailDaysUntilExpiry: document.getElementById('detailDaysUntilExpiry'),
    detailLastResetDate: document.getElementById('detailLastResetDate'),
    detailProgressBar: document.getElementById('detailProgressBar'),
    detailUsagePercent: document.getElementById('detailUsagePercent'),
    detailLimitStatus: document.getElementById('detailLimitStatus'),
    detailDailyLimit: document.getElementById('detailDailyLimit'),
    detailSentToday: document.getElementById('detailSentToday'),
    detailRemainingToday: document.getElementById('detailRemainingToday'),
    refreshUserDetailsBtn: document.getElementById('refreshUserDetailsBtn'),
    testLimitBtn: document.getElementById('testLimitBtn'),
    
    // Tags elements
    tagsContent: document.getElementById('tagsContent'),
    
    // Task progress elements
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),
    totalCount: document.getElementById('totalCount'),
    sentCount: document.getElementById('sentCount'),
    failedCount: document.getElementById('failedCount'),
    progressPercent: document.getElementById('progressPercent'),
    activityLog: document.getElementById('activityLog'),
    
    // Failed emails elements
    failedEmailsSection: document.getElementById('failedEmailsSection'),
    failedEmailsList: document.getElementById('failedEmailsList'),
    
    // Error details modal
    errorDetailsModal: document.getElementById('errorDetailsModal'),
    errorDetailsClose: document.getElementById('errorDetailsClose'),
    errorDetailsContent: document.getElementById('errorDetailsContent'),
    
    // Auto logout elements
    autoLogoutWarning: document.getElementById('autoLogoutWarning'),
    logoutTimer: document.getElementById('logoutTimer'),
    
    // Scroll elements
    scrollToTop: document.getElementById('scrollToTop'),
    
    // Notifications
    notifications: document.getElementById('notifications')
};

// ================================================
// INITIALIZATION
// ================================================
window.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    checkInitialLoginStatus();
    updateCurrentDate();
    setupScrollToTop();
    setInterval(updateCurrentDate, 60000); // Update date every minute
});

function initializeApp() {
    // Store scroll element reference
    emailFormScroll = elements.emailFormScroll;
    
    // Setup window controls for web
    setupWindowControls();
    
    // Login form submission
    elements.loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleLogin();
    });

    // Header tabs
    elements.emailTabBtn.addEventListener('click', () => {
        switchTab('email');
        scrollToTop();
    });

    elements.smtpTabBtn.addEventListener('click', () => {
        switchTab('smtp');
        loadSMTPSettings();
        scrollToTop();
    });

    elements.userDetailsTabBtn.addEventListener('click', () => {
        switchTab('userDetails');
        updateUserDetailsDisplay();
        scrollToTop();
    });

    elements.tagsTabBtn.addEventListener('click', () => {
        switchTab('tags');
        loadTaskTags();
        scrollToTop();
    });

    // Logout button
    elements.logoutBtn.addEventListener('click', async () => {
        await handleLogout();
    });

    // New Task button
    elements.newTaskBtn.addEventListener('click', async () => {
        await createNewTask();
    });

    // Clear completed tasks
    elements.clearTasksBtn.addEventListener('click', async () => {
        const result = await ClearCompletedTasks();
        if (result.success) {
            await loadTasks();
            showNotification('info', result.message);
        }
    });

    // File upload handling
    setupFileUploadHandlers();

    // SMTP file upload handling
    setupSMTPFileUploadHandlers();

    // Action buttons
    elements.startBtn.addEventListener('click', async () => {
        await startSending();
    });

    elements.pauseBtn.addEventListener('click', async () => {
        await pauseSending();
    });

    elements.resumeBtn.addEventListener('click', async () => {
        await resumeSending();
    });

    elements.stopBtn.addEventListener('click', async () => {
        await stopSending();
    });

    elements.saveBtn.addEventListener('click', async () => {
        await saveTask();
    });

    elements.deleteBtn.addEventListener('click', async () => {
        if (!currentTaskId) return;
        
        if (confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
            await deleteTask();
        }
    });

    // Time delay checkbox handler
    elements.useRandomDelay.addEventListener('change', () => {
        updateDelayInputVisibility();
        if (currentTaskId) {
            cacheFormData();
        }
    });

    // SMTP rotation checkbox
    elements.useSMTPRotation.addEventListener('change', () => {
        if (currentTaskId) {
            cacheFormData();
        }
    });

    // Attachment name options
    setupAttachmentNameHandlers();

    // Input change listeners - save to cache
    setupInputListeners();

    // SMTP Configuration
    setupSMTPConfigurationHandlers();

    // User details refresh button
    elements.refreshUserDetailsBtn.addEventListener('click', async () => {
        await refreshUserInfo();
    });

    // Test limit button
    elements.testLimitBtn.addEventListener('click', async () => {
        await testSendLimit();
    });

    // Manual SMTP addition
    elements.addManualSMTPBtn.addEventListener('click', async () => {
        await addManualSMTP();
    });

    // Error details modal close button
    elements.errorDetailsClose.addEventListener('click', () => {
        elements.errorDetailsModal.classList.add('hidden');
    });

    // Close modal when clicking outside
    elements.errorDetailsModal.addEventListener('click', (e) => {
        if (e.target === elements.errorDetailsModal) {
            elements.errorDetailsModal.classList.add('hidden');
        }
    });
}

// ================================================
// AUTO LOGOUT TIMER
// ================================================
function startAutoLogoutTimer() {
    if (logoutTimerInterval) {
        clearInterval(logoutTimerInterval);
    }
    
    loginStartTime = Date.now();
    const logoutTime = 60 * 60 * 1000; // 1 hour in milliseconds
    
    logoutTimerInterval = setInterval(() => {
        const elapsed = Date.now() - loginStartTime;
        const remaining = logoutTime - elapsed;
        
        if (remaining <= 0) {
            // Auto logout
            performAutoLogout();
            clearInterval(logoutTimerInterval);
            return;
        }
        
        // Show warning when less than 5 minutes remaining
        if (remaining <= 5 * 60 * 1000) {
            elements.autoLogoutWarning.classList.remove('hidden');
            
            const minutes = Math.floor(remaining / 60000);
            const seconds = Math.floor((remaining % 60000) / 1000);
            elements.logoutTimer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else {
            elements.autoLogoutWarning.classList.add('hidden');
        }
    }, 1000); // Update every second
}

async function performAutoLogout() {
    try {
        const result = await Logout();
        currentUser = null;
        stopAutoLogoutTimer();
        showLoginScreen();
        showNotification('warning', 'Auto-logout: Session expired after 1 hour. Please login again.');
    } catch (error) {
        console.error('Auto-logout error:', error);
        showNotification('error', 'Auto-logout failed. Please login again.');
        showLoginScreen();
    }
}

function stopAutoLogoutTimer() {
    if (logoutTimerInterval) {
        clearInterval(logoutTimerInterval);
        logoutTimerInterval = null;
    }
    elements.autoLogoutWarning.classList.add('hidden');
}

// ================================================
// WINDOW CONTROL SETUP (Web Version)
// ================================================
function setupWindowControls() {
    // For web version, window controls are mostly cosmetic
    // Close button should refresh the page
    elements.closeBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to close the application?')) {
            window.location.href = '/';
        }
    });
    
    // Other buttons are disabled in web version
    elements.minimizeBtn.style.display = 'none';
    elements.maximizeBtn.style.display = 'none';
    elements.restoreBtn.style.display = 'none';
}

// ================================================
// SCROLL MANAGEMENT
// ================================================
function setupScrollToTop() {
    elements.scrollToTop.addEventListener('click', () => {
        scrollToTop();
    });

    // Show/hide scroll to top button
    if (emailFormScroll) {
        emailFormScroll.addEventListener('scroll', () => {
            if (emailFormScroll.scrollTop > 300) {
                elements.scrollToTop.classList.remove('hidden');
                elements.scrollToTop.classList.add('visible');
            } else {
                elements.scrollToTop.classList.remove('visible');
                elements.scrollToTop.classList.add('hidden');
            }
        });
    }

    // Also listen for scroll in SMTP container
    if (elements.smtpContainer) {
        elements.smtpContainer.addEventListener('scroll', () => {
            if (elements.smtpContainer.scrollTop > 300) {
                elements.scrollToTop.classList.remove('hidden');
                elements.scrollToTop.classList.add('visible');
            } else {
                elements.scrollToTop.classList.remove('visible');
                elements.scrollToTop.classList.add('hidden');
            }
        });
    }
}

function scrollToTop() {
    const activeContainer = getActiveContainer();
    if (activeContainer) {
        activeContainer.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }
}

function scrollToRecipients() {
    const recipientsElement = elements.recipients;
    if (recipientsElement) {
        recipientsElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
        recipientsElement.focus();
    }
}

function getActiveContainer() {
    if (elements.emailFormContainer.style.display !== 'none') {
        return emailFormScroll;
    } else if (elements.smtpContainer.style.display !== 'none') {
        return elements.smtpContainer;
    } else if (elements.userDetailsContainer.style.display !== 'none') {
        return elements.userDetailsContainer;
    } else if (elements.tagsContainer.style.display !== 'none') {
        return elements.tagsContainer;
    }
    return null;
}

// ================================================
// TAB MANAGEMENT
// ================================================
function switchTab(tabName) {
    // Hide all containers
    elements.emailFormContainer.style.display = 'none';
    elements.smtpContainer.style.display = 'none';
    elements.userDetailsContainer.style.display = 'none';
    elements.tagsContainer.style.display = 'none';
    
    // Remove active class from all tabs
    elements.emailTabBtn.classList.remove('active');
    elements.smtpTabBtn.classList.remove('active');
    elements.userDetailsTabBtn.classList.remove('active');
    elements.tagsTabBtn.classList.remove('active');
    
    // Show selected container and set active tab
    switch(tabName) {
        case 'email':
            elements.emailFormContainer.style.display = 'flex';
            elements.emailTabBtn.classList.add('active');
            break;
        case 'smtp':
            elements.smtpContainer.style.display = 'flex';
            elements.smtpTabBtn.classList.add('active');
            break;
        case 'userDetails':
            elements.userDetailsContainer.style.display = 'flex';
            elements.userDetailsTabBtn.classList.add('active');
            break;
        case 'tags':
            elements.tagsContainer.style.display = 'flex';
            elements.tagsTabBtn.classList.add('active');
            break;
    }
    
    // Hide scroll to top when switching tabs
    elements.scrollToTop.classList.remove('visible');
    elements.scrollToTop.classList.add('hidden');
}

// ================================================
// LOGIN & AUTHENTICATION
// ================================================
async function checkInitialLoginStatus() {
    try {
        const result = await CheckLoginStatus();
        
        if (result.success && result.userInfo) {
            currentUser = result.userInfo;
            showMainApp();
            startPolling();
            startAutoLogoutTimer();
        } else {
            showLoginScreen();
        }
    } catch (error) {
        showLoginScreen();
    }
}

function showLoginScreen() {
    elements.loginScreen.classList.remove('hidden');
    elements.mainApp.classList.add('hidden');
    elements.autoLogoutWarning.classList.add('hidden');
    stopAutoLogoutTimer();
    
    // Update system info
    elements.systemIP.textContent = getSystemIP();
}

function showMainApp() {
    elements.loginScreen.classList.add('hidden');
    elements.mainApp.classList.remove('hidden');
    
    // Update user info in header
    if (currentUser) {
        updateHeaderUserInfo();
    }
    
    loadTasks();
    startPolling();
    loadSMTPSettings();
    startAutoLogoutTimer();
}

async function handleLogin() {
    const username = elements.loginUsername.value.trim();
    const password = elements.loginPassword.value.trim();
    
    if (!username || !password) {
        showLoginStatus('Please enter both username and password', 'error');
        return;
    }
    
    elements.loginBtn.disabled = true;
    elements.loginBtn.innerHTML = '🔐 Authenticating...';
    showLoginStatus('Connecting to authentication server...', 'info');
    
    try {
        const result = await Login({ username, password });
        
        if (result.success && result.userInfo) {
            currentUser = result.userInfo;
            showMainApp();
            showLoginStatus('Login successful!', 'success');
            showNotification('success', 'Login successful!');
        } else {
            showLoginStatus(result.message || 'Login failed', 'error');
            showNotification('error', result.message || 'Login failed');
        }
    } catch (error) {
        showLoginStatus('Login error: ' + error.message, 'error');
        showNotification('error', 'Login error: ' + error.message);
    } finally {
        elements.loginBtn.disabled = false;
        elements.loginBtn.innerHTML = '🔓 LOGIN TO RED-X MAILER';
    }
}

async function handleLogout() {
    try {
        const result = await Logout();
        
        if (result.success) {
            currentUser = null;
            stopAutoLogoutTimer();
            showLoginScreen();
            showNotification('info', 'Logged out successfully');
        }
    } catch (error) {
        showNotification('error', 'Logout failed: ' + error.message);
    }
}

async function testSendLimit() {
    if (!currentUser) return;
    
    const count = prompt('Enter number of emails to test:', '100');
    if (!count || count <= 0) {
        alert('Please enter a valid number');
        return;
    }
    
    try {
        const result = await TestSendLimit({
            username: currentUser.username,
            count: parseInt(count)
        });
        
        if (result.canSend) {
            alert(`✅ ${result.message}`);
        } else {
            alert(`❌ ${result.message}`);
        }
    } catch (error) {
        alert('Error testing limit: ' + error.message);
    }
}

async function refreshUserInfo() {
    if (!currentUser) return;
    
    try {
        const result = await GetCurrentUser();
        
        if (result.success && result.userInfo) {
            currentUser = result.userInfo;
            updateUserDetailsDisplay();
            updateHeaderUserInfo();
            showNotification('success', 'User details refreshed');
        }
    } catch (error) {
        console.error('Failed to refresh user info:', error);
        showNotification('error', 'Failed to refresh user details');
    }
}

function updateHeaderUserInfo() {
    if (!currentUser) return;
    
    elements.currentUsername.textContent = currentUser.username;
    elements.userAvatar.textContent = currentUser.username.charAt(0).toUpperCase();
    elements.userLimit.textContent = `Limit: ${currentUser.dailyLimit}`;
    elements.userSent.textContent = `Sent: ${currentUser.sentToday}`;
}

function updateUserDetailsDisplay() {
    if (!currentUser) return;
    
    // Update user details
    elements.detailUsername.textContent = currentUser.username;
    elements.detailUserType.textContent = currentUser.userType || 'N/A';
    elements.detailIP.textContent = currentUser.ipAddress || 'Unknown';
    elements.detailLastLogin.textContent = currentUser.lastLoginDate || 'Never';
    elements.detailMaxLogins.textContent = currentUser.maxLoginsPerDay || 'Unlimited';
    elements.detailLoginsToday.textContent = currentUser.loginsToday || '0';
    elements.detailLoggedIPs.textContent = currentUser.loggedIPs || 'None';
    elements.detailExpiryDate.textContent = currentUser.expiryDate || 'N/A';
    elements.detailDaysUntilExpiry.textContent = currentUser.daysUntilExpiry !== undefined ? 
        `${currentUser.daysUntilExpiry} days` : 'N/A';
    elements.detailLastResetDate.textContent = currentUser.lastResetDate || 'N/A';
    
    // Update limits
    elements.detailDailyLimit.textContent = currentUser.dailyLimit.toLocaleString();
    elements.detailSentToday.textContent = currentUser.sentToday.toLocaleString();
    elements.detailRemainingToday.textContent = currentUser.remainingToday.toLocaleString();
    
    // Calculate and update usage percentage
    const usagePercentage = currentUser.dailyLimit > 0 ? 
        (currentUser.sentToday / currentUser.dailyLimit) * 100 : 0;
    
    elements.detailProgressBar.style.width = `${Math.min(usagePercentage, 100)}%`;
    elements.detailUsagePercent.textContent = `${usagePercentage.toFixed(1)}%`;
    
    // Update limit status
    if (currentUser.isExpired) {
        elements.detailLimitStatus.textContent = 'Status: EXPIRED';
        elements.detailLimitStatus.style.color = 'var(--danger)';
    } else if (currentUser.remainingToday <= 0) {
        elements.detailLimitStatus.textContent = 'Status: LIMIT EXCEEDED';
        elements.detailLimitStatus.style.color = 'var(--danger)';
    } else if (currentUser.remainingToday < currentUser.dailyLimit * 0.1) {
        elements.detailLimitStatus.textContent = 'Status: LOW LIMIT';
        elements.detailLimitStatus.style.color = 'var(--warning)';
    } else {
        elements.detailLimitStatus.textContent = 'Status: ACTIVE';
        elements.detailLimitStatus.style.color = 'var(--success)';
    }
}

function showLoginStatus(message, type) {
    elements.loginStatus.textContent = message;
    elements.loginStatus.className = 'login-status ' + type;
}

function getSystemIP() {
    // This will be detected from the backend
    return 'Detecting...';
}

function updateCurrentDate() {
    const now = new Date();
    elements.currentDate.textContent = now.toISOString().split('T')[0];
}

// ================================================
// FAILED EMAILS MANAGEMENT
// ================================================
function updateFailedEmailsDisplay(task) {
    if (!task || !task.errors || task.errors.length === 0) {
        elements.failedEmailsSection.classList.add('hidden');
        return;
    }
    
    elements.failedEmailsSection.classList.remove('hidden');
    
    // Sort errors by timestamp (newest first)
    const sortedErrors = [...task.errors].sort((a, b) => {
        return new Date(b.timestamp) - new Date(a.timestamp);
    });
    
    let html = '';
    sortedErrors.forEach((error, index) => {
        const time = formatTime(error.timestamp);
        html += `
            <div class="failed-email-item" onclick="showErrorDetails('${error.email}', '${escapeHtml(error.error)}', '${error.timestamp}')">
                <div class="failed-email-details">
                    <div class="failed-email-address">${error.email}</div>
                    <div class="failed-email-error">${error.error.substring(0, 50)}${error.error.length > 50 ? '...' : ''}</div>
                </div>
                <div class="failed-email-time">${time}</div>
            </div>
        `;
    });
    
    elements.failedEmailsList.innerHTML = html;
}

window.showErrorDetails = function(email, error, timestamp) {
    const time = new Date(timestamp).toLocaleString();
    elements.errorDetailsContent.innerHTML = `
        <div style="margin-bottom: 16px;">
            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Email</div>
            <div style="font-size: 14px; font-weight: 500;">${email}</div>
        </div>
        <div style="margin-bottom: 16px;">
            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Time</div>
            <div style="font-size: 14px;">${time}</div>
        </div>
        <div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Error Details</div>
            <div style="font-size: 14px; background: rgba(255, 59, 48, 0.05); padding: 12px; border-radius: 8px; border: 1px solid rgba(255, 59, 48, 0.1); white-space: pre-wrap; font-family: monospace;">${error}</div>
        </div>
    `;
    elements.errorDetailsModal.classList.remove('hidden');
};

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ================================================
// SMTP FUNCTIONS
// ================================================

async function loadSMTPSettings() {
    try {
        const result = await GetSMTPSettings();
        if (result.success) {
            smtpSettings = result.settings;
            renderSMTPSettings();
            updateSMTPStats();
        }
    } catch (error) {
        console.error('Failed to load SMTP settings:', error);
        showNotification('error', 'Failed to load SMTP settings');
    }
}

function renderSMTPSettings() {
    if (!smtpSettings) return;
    
    // Update server settings
    const server = smtpSettings.currentServer;
    
    // Set server dropdown
    if (server.host === 'smtp.gmail.com') {
        elements.smtpServer.value = 'smtp.gmail.com';
    } else if (server.host === 'smtp.mail.me.com') {
        elements.smtpServer.value = 'smtp.mail.me.com';
    } else {
        elements.smtpServer.value = 'custom';
        // You would need to handle custom server input
    }
    
    // Set port
    if (['587', '465', '25'].includes(server.port)) {
        elements.smtpPort.value = server.port;
    } else {
        elements.smtpPort.value = 'custom';
    }
    
    // Set security
    elements.smtpSecurity.value = server.security;
    
    // Set domain
    elements.smtpDomain.value = server.domain;
    
    // Update connection status
    updateSMTPConnectionStatus(server.connected);
    
    // Update auto-upload checkbox
    elements.autoUploadSMTP.checked = smtpSettings.autoUploadSMTP;
    
    // Render available SMTP list
    renderSMTPAccountList('available', smtpSettings.availableSMTP);
    
    // Render wrong SMTP list
    renderSMTPAccountList('wrong', smtpSettings.wrongSMTP);
}

function updateSMTPConnectionStatus(connected) {
    elements.smtpStatus.className = 'server-status ' + (connected ? 'status-connected' : 'status-disconnected');
    elements.smtpStatus.innerHTML = connected ? 
        '<span>🟢</span><span>Connection Status: Connected</span>' :
        '<span>🔴</span><span>Connection Status: Disconnected</span>';
}

function updateSMTPStats() {
    if (!smtpSettings) return;
    
    elements.availableSMTPCount.textContent = smtpSettings.availableSMTP.length;
    elements.wrongSMTPCount.textContent = smtpSettings.wrongSMTP.length;
}

function renderSMTPAccountList(type, accounts) {
    const listElement = type === 'available' ? elements.availableSMTPList : elements.wrongSMTPList;
    
    if (accounts.length === 0) {
        listElement.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-secondary);">No accounts</div>';
        return;
    }
    
    let html = '';
    accounts.forEach((account, index) => {
        const statusClass = account.active ? 'status-active' : 'status-inactive';
        const statusText = account.active ? 'Active' : 'Inactive';
        const lastUsed = account.lastUsed ? formatTime(account.lastUsed) : 'Never';
        
        html += `
            <div class="account-item">
                <div>
                    <div class="account-email">${account.email}</div>
                    <div style="font-size: 10px; color: var(--text-secondary);">
                        Last used: ${lastUsed}
                    </div>
                </div>
                <div class="account-status ${statusClass}">${statusText}</div>
            </div>
        `;
    });
    
    listElement.innerHTML = html;
}

function setupSMTPConfigurationHandlers() {
    // Test SMTP connection
    elements.testSMTPConnectionBtn.addEventListener('click', async () => {
        await testSMTPConnection();
    });
    
    // Save SMTP settings
    elements.saveSMTPSettingsBtn.addEventListener('click', async () => {
        await saveSMTPSettings();
    });
    
    // Download reports
    elements.downloadAvailableBtn.addEventListener('click', async () => {
        await downloadSMTPReport('available');
    });
    
    elements.downloadWrongBtn.addEventListener('click', async () => {
        await downloadSMTPReport('wrong');
    });
    
    // Clear Available SMTP button
    elements.clearAvailableBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to clear all available SMTP accounts? This action cannot be undone.')) {
            await clearSMTPAccounts('available');
        }
    });
    
    // Clear Wrong SMTP button
    elements.clearWrongBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to clear all wrong SMTP accounts? This action cannot be undone.')) {
            await clearSMTPAccounts('wrong');
        }
    });
    
    // Server selection handlers
    elements.smtpServer.addEventListener('change', () => {
        updateSMTPFields();
    });
    
    elements.smtpPort.addEventListener('change', () => {
        updateSMTPFields();
    });
}

async function clearSMTPAccounts(accountType) {
    try {
        const result = await ClearSMTPAccounts(accountType);
        
        if (result.success) {
            showNotification('success', result.message);
            // Reload SMTP settings
            await loadSMTPSettings();
        } else {
            showNotification('error', result.message);
        }
    } catch (error) {
        showNotification('error', 'Failed to clear SMTP accounts: ' + error.message);
    }
}

async function testSMTPConnection() {
    try {
        elements.testSMTPConnectionBtn.disabled = true;
        elements.testSMTPConnectionBtn.innerHTML = '🔄 Testing...';
        
        const result = await TestSMTPConnection();
        
        if (result.success) {
            updateSMTPConnectionStatus(true);
            showNotification('success', result.message);
        } else {
            updateSMTPConnectionStatus(false);
            showNotification('error', result.message);
        }
    } catch (error) {
        updateSMTPConnectionStatus(false);
        showNotification('error', 'Failed to test SMTP connection: ' + error.message);
    } finally {
        elements.testSMTPConnectionBtn.disabled = false;
        elements.testSMTPConnectionBtn.innerHTML = '🔌 Test Connection';
    }
}

async function saveSMTPSettings() {
    try {
        const server = {
            host: elements.smtpServer.value === 'custom' ? prompt('Enter custom SMTP server:') : elements.smtpServer.value,
            port: elements.smtpPort.value === 'custom' ? prompt('Enter custom port:') : elements.smtpPort.value,
            security: elements.smtpSecurity.value,
            domain: elements.smtpDomain.value,
            connected: false
        };
        
        const result = await UpdateSMTPServer(server);
        
        if (result.success) {
            showNotification('success', result.message);
            // Reload settings
            await loadSMTPSettings();
        } else {
            showNotification('error', result.message);
        }
    } catch (error) {
        showNotification('error', 'Failed to save SMTP settings: ' + error.message);
    }
}

async function downloadSMTPReport(reportType) {
    try {
        await DownloadSMTPReport(reportType);
        showNotification('success', `Downloaded ${reportType} SMTP report`);
    } catch (error) {
        showNotification('error', 'Failed to download report: ' + error.message);
    }
}

function updateSMTPFields() {
    // Auto-set port and security based on server selection
    if (elements.smtpServer.value === 'smtp.gmail.com') {
        elements.smtpPort.value = '587';
        elements.smtpSecurity.value = 'TLS';
        elements.smtpDomain.value = 'gmail.com';
    } else if (elements.smtpServer.value === 'smtp.mail.me.com') {
        elements.smtpPort.value = '587';
        elements.smtpSecurity.value = 'TLS';
        elements.smtpDomain.value = 'icloud.com';
    }
}

function setupSMTPFileUploadHandlers() {
    if (!elements.smtpFileDrop) return;
    
    elements.smtpFileDrop.addEventListener('click', () => {
        elements.smtpFileInput.click();
    });

    elements.smtpFileDrop.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        elements.smtpFileDrop.style.borderColor = 'var(--primary)';
        elements.smtpFileDrop.style.background = 'rgba(0, 122, 255, 0.1)';
    });

    elements.smtpFileDrop.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        elements.smtpFileDrop.style.borderColor = 'rgba(0, 122, 255, 0.3)';
        elements.smtpFileDrop.style.background = '';
    });

    elements.smtpFileDrop.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        elements.smtpFileDrop.style.borderColor = 'rgba(0, 122, 255, 0.3)';
        elements.smtpFileDrop.style.background = '';
        
        const files = e.dataTransfer.files;
        await handleSMTPFileUpload(files);
    });

    elements.smtpFileInput.addEventListener('change', async (e) => {
        const files = e.target.files;
        await handleSMTPFileUpload(files);
    });
}

async function handleSMTPFileUpload(files) {
    if (files.length === 0) return;
    
    const file = files[0];
    if (file.type !== 'text/plain' && !file.name.endsWith('.txt')) {
        showNotification('error', 'Please upload a .txt file');
        return;
    }
    
    try {
        // Convert file to base64
        const base64 = await fileToBase64(file);
        
        // Upload to backend
        const result = await UploadSMTPFile(base64);
        
        if (result.success) {
            showNotification('success', result.message);
            // Reload SMTP settings
            await loadSMTPSettings();
        } else {
            showNotification('error', result.message);
        }
    } catch (error) {
        showNotification('error', 'Failed to upload SMTP file: ' + error.message);
    }
    
    elements.smtpFileInput.value = '';
}

async function addManualSMTP() {
    const email = elements.manualEmail.value.trim();
    const password = elements.manualPassword.value.trim();
    
    if (!email || !password) {
        showNotification('error', 'Please enter both email and password');
        return;
    }
    
    if (!email.includes('@')) {
        showNotification('error', 'Please enter a valid email address');
        return;
    }
    
    try {
        const result = await AddManualSMTP(email, password);
        
        if (result.success) {
            showNotification('success', result.message);
            // Clear form
            elements.manualEmail.value = '';
            elements.manualPassword.value = '';
            // Reload SMTP settings
            await loadSMTPSettings();
        } else {
            showNotification('error', result.message);
        }
    } catch (error) {
        showNotification('error', 'Failed to add SMTP account: ' + error.message);
    }
}

// ================================================
// TAGS MANAGEMENT
// ================================================
async function loadTaskTags() {
    try {
        const result = await GetTaskTags();
        if (result.success) {
            taskTags = result.tags;
            renderTags();
        }
    } catch (error) {
        console.error('Failed to load tags:', error);
    }
}

function renderTags() {
    if (!taskTags || !elements.tagsContent) return;
    
    let html = '';
    
    // Invoice & Transaction Tags
    if (taskTags.invoice) {
        html += `
            <div class="tag-group">
                <div class="tag-group-title">📄 INVOICE & TRANSACTION TAGS</div>
                <div class="tag-list">
                    ${Object.entries(taskTags.invoice).map(([tag, desc]) => `
                        <div class="tag-item" onclick="copyTag('${tag}')">
                            <div class="tag-code">${tag}</div>
                            <div class="tag-desc">${desc}</div>
                            <button class="tag-copy">📋</button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    // Date & Time Tags
    if (taskTags.date) {
        html += `
            <div class="tag-group">
                <div class="tag-group-title">📅 DATE & TIME TAGS</div>
                <div class="tag-list">
                    ${Object.entries(taskTags.date).map(([tag, desc]) => `
                        <div class="tag-item" onclick="copyTag('${tag}')">
                            <div class="tag-code">${tag}</div>
                            <div class="tag-desc">${desc}</div>
                            <button class="tag-copy">📋</button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    // Recipient Tags
    if (taskTags.recipient) {
        html += `
            <div class="tag-group">
                <div class="tag-group-title">👤 RECIPIENT TAGS</div>
                <div class="tag-list">
                    ${Object.entries(taskTags.recipient).map(([tag, desc]) => `
                        <div class="tag-item" onclick="copyTag('${tag}')">
                            <div class="tag-code">${tag}</div>
                            <div class="tag-desc">${desc}</div>
                            <button class="tag-copy">📋</button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    // Parameter Tags
    if (taskTags.parameter) {
        html += `
            <div class="tag-group">
                <div class="tag-group-title">🎲 PARAMETER TAGS (Random Values)</div>
                <div class="tag-list">
                    ${Object.entries(taskTags.parameter).map(([tag, desc]) => `
                        <div class="tag-item" onclick="copyTag('${tag}')">
                            <div class="tag-code">${tag}</div>
                            <div class="tag-desc">${desc}</div>
                            <button class="tag-copy">📋</button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    // Body Content Tags
    if (taskTags.body) {
        html += `
            <div class="tag-group">
                <div class="tag-group-title">📝 BODY CONTENT TAGS</div>
                <div class="tag-list">
                    ${Object.entries(taskTags.body).map(([tag, desc]) => `
                        <div class="tag-item" onclick="copyTag('${tag}')">
                            <div class="tag-code">${tag}</div>
                            <div class="tag-desc">${desc}</div>
                            <button class="tag-copy">📋</button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    elements.tagsContent.innerHTML = html;
}

window.copyTag = function(tag) {
    navigator.clipboard.writeText(tag).then(() => {
        showNotification('success', `Copied tag: ${tag}`);
    }).catch(err => {
        console.error('Failed to copy tag:', err);
    });
};

// ================================================
// ATTACHMENT NAME HANDLING
// ================================================
function setupAttachmentNameHandlers() {
    elements.useOriginalName.addEventListener('change', () => {
        if (elements.useOriginalName.checked) {
            elements.customAttachment.disabled = true;
            cacheFormData();
        }
    });
    
    elements.useCustomName.addEventListener('change', () => {
        if (elements.useCustomName.checked) {
            elements.customAttachment.disabled = false;
            cacheFormData();
        }
    });
    
    elements.useTagsForName.addEventListener('change', () => {
        if (elements.useTagsForName.checked) {
            elements.customAttachment.disabled = true;
            cacheFormData();
        }
    });
    
    elements.customAttachment.addEventListener('input', () => {
        if (currentTaskId) {
            cacheFormData();
        }
    });
}

// ================================================
// TASK MANAGEMENT
// ================================================
async function createNewTask() {
    // Check if user is logged in
    if (!currentUser) {
        showNotification('error', 'Please login first');
        return;
    }
    
    // Check if SMTP accounts are available
    if (!smtpSettings || smtpSettings.availableSMTP.length === 0) {
        showNotification('error', 'No SMTP accounts available. Please add SMTP accounts first.');
        return;
    }
    
    try {
        const result = await CreateTask();
        
        if (result.error) {
            showNotification('error', result.error);
            return;
        }
        
        if (!result.success || !result.taskId) {
            showNotification('error', 'Failed to create task');
            return;
        }
        
        currentTaskId = result.taskId;
        
        // Initialize form cache for this task with EMPTY values
        formDataCache.set(currentTaskId, {
            senderName: '',
            subject: '',
            body: '',
            recipients: '',
            rawAttachments: [],
            delaySeconds: 1,
            useRandomDelay: false,
            customAttachment: '',
            useTagsForAttach: false,
            useSMTPRotation: true,
            tags: {}
        });
        
        // Clear uploaded files for this task
        uploadedFiles.delete(currentTaskId);
        
        // Load the new task
        await loadTask(currentTaskId);
        renderTasks();
        
        // Clear form UI completely
        clearFormUI();
        
        // Select the new task
        await selectTask(currentTaskId);
        
        showNotification('info', `Created new task: Task ${currentTaskId.split('-')[1]}`, currentTaskId);
        addActivityLog(`Created new task: ${currentTaskId}`);
        
        // Scroll to recipients section after a short delay
        setTimeout(() => {
            scrollToRecipients();
        }, 300);
        
    } catch (error) {
        showNotification('error', 'Failed to create task: ' + error.message);
    }
}

async function loadTasks() {
    try {
        const result = await GetAllTasks();
        
        activeTasks.clear();
        if (result.success && result.tasks) {
            result.tasks.forEach(task => {
                activeTasks.set(task.id, task);
                
                // Initialize cache for each task if not exists
                if (!formDataCache.has(task.id)) {
                    formDataCache.set(task.id, {
                        senderName: task.senderName || '',
                        subject: task.subject || '',
                        body: task.body || '',
                        recipients: task.recipients ? task.recipients.join('\n') : '',
                        rawAttachments: task.rawAttachments || [],
                        delaySeconds: task.delaySeconds || 1,
                        useRandomDelay: task.useRandomDelay || false,
                        customAttachment: task.customAttachment || '',
                        useTagsForAttach: task.useTagsForAttach || false,
                        useSMTPRotation: task.useSMTPRotation !== false,
                        tags: task.tags || {}
                    });
                }
            });
        }
        
        renderTasks();
        
    } catch (error) {
        console.error('Failed to load tasks:', error);
    }
}

async function loadTask(taskId) {
    try {
        const result = await GetTask(taskId);
        
        if (result.success && result.task) {
            const task = result.task;
            activeTasks.set(taskId, task);
            
            // Update progress display if this is the current task
            if (taskId === currentTaskId) {
                updateProgressDisplay(task);
                updateFailedEmailsDisplay(task);
                updateActionButtons(task.status);
            }
        }
    } catch (error) {
        console.error('Failed to load task:', error);
    }
}

function renderTasks() {
    elements.taskList.innerHTML = '';
    
    if (activeTasks.size === 0) {
        elements.taskList.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                No tasks yet. Click "New Task" to create one.
            </div>
        `;
        return;
    }
    
    Array.from(activeTasks.values()).forEach(task => {
        const taskElement = document.createElement('div');
        taskElement.className = `task-tab ${task.status} ${task.id === currentTaskId ? 'active' : ''}`;
        
        // Add delay info to task tab
        let delayInfo = '';
        if (task.useRandomDelay) {
            delayInfo = '⏱️ Random';
        } else if (task.delaySeconds === 0) {
            delayInfo = '⏱️ Fast';
        } else {
            delayInfo = `⏱️ ${task.delaySeconds}s`;
        }
        
        taskElement.innerHTML = `
            <div class="task-tab-header">
                <div class="task-name">${task.name}</div>
                <div class="task-status-badge badge-${task.status}">
                    ${task.status}
                </div>
                <div class="task-controls">
                    <button class="task-control-btn" onclick="event.stopPropagation(); window.selectTask('${task.id}')">
                        📝
                    </button>
                    <button class="task-control-btn" onclick="event.stopPropagation(); window.deleteTaskFromList('${task.id}')">
                        🗑️
                    </button>
                </div>
            </div>
            <div class="task-progress-ribbon">
                <div class="task-progress-counts">
                    <span>✅ ${task.progress?.sent || 0}</span>
                    <span>❌ ${task.progress?.failed || 0}</span>
                    <span>📊 ${task.progress?.percentage || 0}%</span>
                </div>
                <div>${task.progress?.current || 0}/${task.progress?.total || 0}</div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: var(--text-secondary);">
                <div>${formatTime(task.startTime)}</div>
                <div style="background: var(--glass); padding: 2px 6px; border-radius: 10px;">
                    ${delayInfo}
                </div>
            </div>
        `;
        
        taskElement.addEventListener('click', () => {
            selectTask(task.id);
        });
        
        elements.taskList.appendChild(taskElement);
    });
}

async function selectTask(taskId) {
    // Save current task data before switching
    if (currentTaskId && currentTaskId !== taskId) {
        cacheFormData();
    }
    
    currentTaskId = taskId;
    await loadTask(taskId);
    renderTasks();
    
    // Restore form from cache
    restoreFormFromCache(taskId);
    
    // Switch to email tab if not already there
    switchTab('email');
    
    addActivityLog(`Selected task: ${taskId}`);
}

async function deleteTask() {
    if (!currentTaskId) return;
    
    try {
        const result = await DeleteTask(currentTaskId);
        
        if (result.error) {
            showNotification('error', result.error);
            return;
        }
        
        // Remove from collections
        activeTasks.delete(currentTaskId);
        uploadedFiles.delete(currentTaskId);
        formDataCache.delete(currentTaskId);
        
        // Clear form and hide it
        clearFormUI();
        
        // Reset current task
        currentTaskId = null;
        
        // Update UI
        renderTasks();
        updateProgressDisplay(null);
        updateFailedEmailsDisplay(null);
        updateActionButtons('none');
        
        showNotification('info', result.message);
        addActivityLog(`Deleted task: ${currentTaskId}`);
        
    } catch (error) {
        showNotification('error', 'Failed to delete task: ' + error.message);
    }
}

async function saveTask() {
    if (!currentTaskId) {
        showNotification('error', 'Please select a task first');
        return;
    }
    
    if (!currentUser) {
        showNotification('error', 'Please login first');
        return;
    }
    
    try {
        // Pause polling to prevent interference
        isPollingPaused = true;
        
        // Get current form data
        const formData = {
            name: `Task ${currentTaskId.split('-')[1]}`,
            senderName: elements.senderName.value,
            subject: elements.subject.value,
            body: elements.body.value,
            recipients: elements.recipients.value,
            rawAttachments: Array.from(uploadedFiles.get(currentTaskId) || []).map(file => file.path || file.filePath),
            delaySeconds: parseFloat(elements.delaySeconds.value) || 0,
            useRandomDelay: elements.useRandomDelay.checked,
            customAttachment: elements.customAttachment.value,
            useTagsForAttach: elements.useTagsForName.checked,
            useSMTPRotation: elements.useSMTPRotation.checked,
            tags: formDataCache.get(currentTaskId)?.tags || {}
        };
        
        // Validate delay seconds
        if (formData.delaySeconds < 0) {
            formData.delaySeconds = 0;
            elements.delaySeconds.value = 0;
        }
        
        // Update cache
        cacheFormData();
        
        const result = await UpdateTask(currentTaskId, formData);
        
        if (result.error) {
            showNotification('error', result.error, currentTaskId);
        } else {
            // Reload task to get updated data
            await loadTask(currentTaskId);
            showNotification('success', result.message, currentTaskId);
            addActivityLog(`Saved task changes: ${currentTaskId}`);
        }
        
        // Resume polling after a short delay
        setTimeout(() => {
            isPollingPaused = false;
        }, 1000);
        
    } catch (error) {
        showNotification('error', 'Failed to save task: ' + error.message, currentTaskId);
        isPollingPaused = false;
    }
}

// ================================================
// FORM DATA MANAGEMENT
// ================================================
function setupInputListeners() {
    const inputs = [
        elements.senderName,
        elements.subject,
        elements.body,
        elements.recipients,
        elements.delaySeconds,
        elements.customAttachment
    ];
    
    inputs.forEach(input => {
        if (input) {
            input.addEventListener('input', () => {
                if (currentTaskId) {
                    cacheFormData();
                }
            });
        }
    });
    
    if (elements.useRandomDelay) {
        elements.useRandomDelay.addEventListener('change', () => {
            if (currentTaskId) {
                cacheFormData();
            }
        });
    }
}

function cacheFormData() {
    if (!currentTaskId) return;
    
    const cachedData = formDataCache.get(currentTaskId) || {};
    formDataCache.set(currentTaskId, {
        ...cachedData,
        senderName: elements.senderName.value,
        subject: elements.subject.value,
        body: elements.body.value,
        recipients: elements.recipients.value,
        rawAttachments: Array.from(uploadedFiles.get(currentTaskId) || []),
        delaySeconds: parseFloat(elements.delaySeconds.value) || 0,
        useRandomDelay: elements.useRandomDelay.checked,
        customAttachment: elements.customAttachment.value,
        useTagsForAttach: elements.useTagsForName.checked,
        useSMTPRotation: elements.useSMTPRotation.checked,
        tags: cachedData.tags || {}
    });
}

function restoreFormFromCache(taskId) {
    const cachedData = formDataCache.get(taskId);
    if (!cachedData) {
        // If no cache, clear the form
        clearFormUI();
        return;
    }
    
    // Restore form values from cache
    elements.senderName.value = cachedData.senderName || '';
    elements.subject.value = cachedData.subject || '';
    elements.body.value = cachedData.body || '';
    elements.recipients.value = cachedData.recipients || '';
    elements.delaySeconds.value = cachedData.delaySeconds || 0;
    elements.useRandomDelay.checked = cachedData.useRandomDelay || false;
    elements.useSMTPRotation.checked = cachedData.useSMTPRotation !== false;
    elements.customAttachment.value = cachedData.customAttachment || '';
    
    // Update attachment name options
    if (cachedData.customAttachment && cachedData.customAttachment.trim() !== '') {
        elements.useCustomName.checked = true;
        elements.customAttachment.disabled = false;
    } else if (cachedData.useTagsForAttach) {
        elements.useTagsForName.checked = true;
        elements.customAttachment.disabled = true;
    } else {
        elements.useOriginalName.checked = true;
        elements.customAttachment.disabled = true;
    }
    
    // Update delay input visibility
    updateDelayInputVisibility();
    
    // Restore uploaded files
    if (!uploadedFiles.has(taskId) && cachedData.rawAttachments) {
        uploadedFiles.set(taskId, cachedData.rawAttachments.map(item => {
            if (typeof item === 'string') {
                return {
                    name: item.split('\\').pop() || item.split('/').pop() || 'file',
                    path: item,
                    size: 0
                };
            } else if (item.path) {
                return {
                    name: item.name || item.path.split('\\').pop() || item.path.split('/').pop() || 'file',
                    path: item.path,
                    size: item.size || 0
                };
            }
            return item;
        }).filter(Boolean));
    }
    renderUploadedFiles();
}

function clearFormUI() {
    elements.senderName.value = '';
    elements.subject.value = '';
    elements.body.value = '';
    elements.recipients.value = '';
    elements.delaySeconds.value = '1';
    elements.useRandomDelay.checked = false;
    elements.useSMTPRotation.checked = true;
    elements.useOriginalName.checked = true;
    elements.useCustomName.checked = false;
    elements.useTagsForName.checked = false;
    elements.customAttachment.value = '';
    elements.customAttachment.disabled = true;
    
    updateDelayInputVisibility();
    
    // Clear file lists
    elements.rawAttachmentsList.innerHTML = '';
    
    // Clear uploaded files for current task
    if (currentTaskId) {
        uploadedFiles.delete(currentTaskId);
    }
}

function clearFormUIOnly() {
    // This function is kept for compatibility but uses clearFormUI
    clearFormUI();
}

function updateDelayInputVisibility() {
    if (elements.useRandomDelay.checked) {
        elements.fixedDelayOption.style.display = 'none';
    } else {
        elements.fixedDelayOption.style.display = 'flex';
    }
}

// ================================================
// FILE UPLOAD HANDLING
// ================================================
function setupFileUploadHandlers() {
    if (!elements.rawAttachmentsDrop) return;
    
    elements.rawAttachmentsDrop.addEventListener('click', () => {
        elements.rawAttachmentsInput.click();
    });

    elements.rawAttachmentsDrop.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        elements.rawAttachmentsDrop.style.borderColor = 'var(--primary)';
        elements.rawAttachmentsDrop.style.background = 'rgba(0, 122, 255, 0.1)';
    });

    elements.rawAttachmentsDrop.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        elements.rawAttachmentsDrop.style.borderColor = 'var(--border)';
        elements.rawAttachmentsDrop.style.background = '';
    });

    elements.rawAttachmentsDrop.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        elements.rawAttachmentsDrop.style.borderColor = 'var(--border)';
        elements.rawAttachmentsDrop.style.background = '';
        
        const files = e.dataTransfer.files;
        await handleFileUpload(files);
    });

    elements.rawAttachmentsInput.addEventListener('change', async (e) => {
        const files = e.target.files;
        await handleFileUpload(files);
    });
}

async function handleFileUpload(files) {
    if (!currentTaskId) {
        showNotification('error', 'Please select a task first');
        return;
    }
    
    // Initialize files array for this task if not exists
    if (!uploadedFiles.has(currentTaskId)) {
        uploadedFiles.set(currentTaskId, []);
    }
    
    for (const file of files) {
        try {
            // Upload to backend
            const filePath = await UploadFile(file, file.name);
            
            // Add to task's files
            uploadedFiles.get(currentTaskId).push({
                name: file.name,
                path: filePath,
                size: file.size
            });
            
            renderUploadedFiles();
            
            // Update cache
            cacheFormData();
            
            showNotification('success', `Uploaded: ${file.name}`, currentTaskId);
            addActivityLog(`Uploaded file: ${file.name} for task: ${currentTaskId}`);
            
        } catch (error) {
            showNotification('error', `Failed to upload ${file.name}: ${error.message}`, currentTaskId);
        }
    }
    
    elements.rawAttachmentsInput.value = '';
}

function renderUploadedFiles() {
    elements.rawAttachmentsList.innerHTML = '';
    
    const files = uploadedFiles.get(currentTaskId) || [];
    
    files.forEach((file, index) => {
        const fileElement = document.createElement('div');
        fileElement.className = 'file-item';
        fileElement.innerHTML = `
            <span>📎 ${file.name} (${formatFileSize(file.size)})</span>
            <button onclick="removeFile(${index})" style="background:none;border:none;color:var(--danger);cursor:pointer;">✕</button>
        `;
        elements.rawAttachmentsList.appendChild(fileElement);
    });
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = error => reject(error);
    });
}

function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

window.removeFile = function(index) {
    if (!currentTaskId) return;
    
    const files = uploadedFiles.get(currentTaskId);
    if (files && files[index]) {
        files.splice(index, 1);
        renderUploadedFiles();
        cacheFormData();
    }
};

// ================================================
// EMAIL SENDING
// ================================================
async function startSending() {
    if (!currentTaskId) {
        showNotification('error', 'Please select a task first');
        return;
    }

    if (!currentUser) {
        showNotification('error', 'Please login first');
        return;
    }

    // First save any pending changes
    await saveTask();

    try {
        elements.startBtn.disabled = true;
        elements.startBtn.innerHTML = '🔄 Starting...';
        
        const result = await StartSending(currentTaskId);
        
        if (result.error) {
            showNotification('error', result.error, currentTaskId);
        } else {
            // Update action buttons
            updateActionButtons('running');
            showNotification('info', result.message, currentTaskId);
            addActivityLog(`Started sending emails for task: ${currentTaskId}`);
        }
    } catch (error) {
        showNotification('error', 'Failed to start sending: ' + error.message, currentTaskId);
    } finally {
        setTimeout(() => {
            elements.startBtn.disabled = false;
            elements.startBtn.innerHTML = '🚀 Start Sending';
        }, 1000);
    }
}

async function pauseSending() {
    if (!currentTaskId) return;
    
    try {
        const result = await PauseTask(currentTaskId);
        
        if (result.error) {
            showNotification('error', result.error, currentTaskId);
        } else {
            // Update action buttons
            updateActionButtons('paused');
            showNotification('info', result.message, currentTaskId);
            addActivityLog(`Paused task: ${currentTaskId}`);
        }
    } catch (error) {
        showNotification('error', 'Failed to pause task: ' + error.message, currentTaskId);
    }
}

async function resumeSending() {
    if (!currentTaskId) return;
    
    try {
        const result = await ResumeTask(currentTaskId);
        
        if (result.error) {
            showNotification('error', result.error, currentTaskId);
        } else {
            // Update action buttons
            updateActionButtons('running');
            showNotification('info', result.message, currentTaskId);
            addActivityLog(`Resumed task: ${currentTaskId}`);
        }
    } catch (error) {
        showNotification('error', 'Failed to resume task: ' + error.message, currentTaskId);
    }
}

async function stopSending() {
    if (!currentTaskId) return;
    
    try {
        const result = await StopTask(currentTaskId);
        
        if (result.error) {
            showNotification('error', result.error, currentTaskId);
        } else {
            // Update action buttons
            updateActionButtons('stopped');
            showNotification('info', result.message, currentTaskId);
            addActivityLog(`Stopped task: ${currentTaskId}`);
        }
    } catch (error) {
        showNotification('error', 'Failed to stop task: ' + error.message, currentTaskId);
    }
}

// ================================================
// UI UPDATES
// ================================================
function updateProgressDisplay(task) {
    if (!task || !task.progress) {
        elements.progressFill.style.width = '0%';
        elements.progressText.textContent = 'Select a task to view progress';
        elements.totalCount.textContent = '0';
        elements.sentCount.textContent = '0';
        elements.failedCount.textContent = '0';
        elements.progressPercent.textContent = '0%';
        return;
    }
    
    const progress = task.progress;
    
    elements.progressFill.style.width = `${progress.percentage}%`;
    elements.progressText.textContent = progress.statusText || task.status;
    elements.totalCount.textContent = progress.total || 0;
    elements.sentCount.textContent = progress.sent || 0;
    elements.failedCount.textContent = progress.failed || 0;
    elements.progressPercent.textContent = `${progress.percentage || 0}%`;
}

function updateActionButtons(status) {
    // Hide all buttons first
    elements.startBtn.style.display = 'none';
    elements.pauseBtn.style.display = 'none';
    elements.resumeBtn.style.display = 'none';
    elements.stopBtn.style.display = 'none';
    
    // Show buttons based on status
    switch (status) {
        case 'ready':
            elements.startBtn.style.display = 'flex';
            elements.stopBtn.style.display = 'flex';
            break;
        case 'running':
            elements.pauseBtn.style.display = 'flex';
            elements.stopBtn.style.display = 'flex';
            break;
        case 'paused':
            elements.resumeBtn.style.display = 'flex';
            elements.stopBtn.style.display = 'flex';
            break;
        case 'stopped':
        case 'completed':
        case 'error':
            elements.startBtn.style.display = 'flex';
            break;
        default:
            elements.startBtn.style.display = 'flex';
    }
}

// ================================================
// NOTIFICATIONS
// ================================================
function showNotification(type, message, taskId = null) {
    const notification = {
        id: Date.now(),
        type,
        message,
        taskId,
        timestamp: new Date()
    };
    
    notifications.unshift(notification);
    if (notifications.length > 10) {
        notifications.pop();
    }
    
    renderNotification(notification);
    
    // Auto-remove notification after 5 seconds
    setTimeout(() => {
        removeNotification(notification.id);
    }, 5000);
}

function renderNotification(notification) {
    const icons = {
        success: '✓',
        error: '✗',
        info: 'ℹ',
        warning: '⚠'
    };
    
    const colors = {
        success: 'var(--success)',
        error: 'var(--danger)',
        info: 'var(--primary)',
        warning: 'var(--warning)'
    };
    
    const notificationElement = document.createElement('div');
    notificationElement.className = `notification ${notification.type}`;
    notificationElement.id = `notification-${notification.id}`;
    notificationElement.innerHTML = `
        <div class="notification-icon" style="background: ${colors[notification.type]}">
            ${icons[notification.type]}
        </div>
        <div class="notification-content">
            ${notification.message}
            ${notification.taskId ? `<div style="font-size:12px;opacity:0.7;">Task: ${notification.taskId}</div>` : ''}
        </div>
        <button class="notification-close" onclick="removeNotification(${notification.id})">✕</button>
    `;
    
    elements.notifications.appendChild(notificationElement);
}

function removeNotification(id) {
    const element = document.getElementById(`notification-${id}`);
    if (element) {
        element.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        }, 300);
    }
}

window.removeNotification = removeNotification;

// ================================================
// ACTIVITY LOG
// ================================================
function addActivityLog(message) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.style.marginBottom = '4px';
    logEntry.innerHTML = `<span style="color:var(--text-secondary);">[${timestamp}]</span> ${message}`;
    
    elements.activityLog.prepend(logEntry);
    
    // Keep only last 10 entries
    while (elements.activityLog.children.length > 10) {
        elements.activityLog.removeChild(elements.activityLog.lastChild);
    }
}

// ================================================
// POLLING FOR UPDATES
// ================================================
function startPolling() {
    setInterval(async () => {
        // Skip polling if paused
        if (isPollingPaused) return;
        
        try {
            // Only update task list, don't overwrite form data
            const result = await GetAllTasks();
            
            if (result.success && result.tasks) {
                const updatedTasks = new Map();
                result.tasks.forEach(task => {
                    updatedTasks.set(task.id, task);
                });
                
                // Merge updates without losing form data
                activeTasks.forEach((task, taskId) => {
                    if (updatedTasks.has(taskId)) {
                        // Update progress and status only, not form fields
                        const updatedTask = updatedTasks.get(taskId);
                        task.status = updatedTask.status;
                        task.progress = updatedTask.progress;
                        task.isPaused = updatedTask.isPaused;
                        task.stopRequested = updatedTask.stopRequested;
                        task.pausedAt = updatedTask.pausedAt;
                        task.errors = updatedTask.errors || [];
                        task.completionTime = updatedTask.completionTime;
                        task.delaySeconds = updatedTask.delaySeconds || task.delaySeconds;
                        task.useRandomDelay = updatedTask.useRandomDelay || task.useRandomDelay;
                        task.useSMTPRotation = updatedTask.useSMTPRotation !== false;
                    }
                });
                
                // Add new tasks
                updatedTasks.forEach((task, taskId) => {
                    if (!activeTasks.has(taskId)) {
                        activeTasks.set(taskId, task);
                    }
                });
                
                // Render updated tasks
                renderTasks();
                
                // Update progress for current task
                if (currentTaskId && activeTasks.has(currentTaskId)) {
                    const task = activeTasks.get(currentTaskId);
                    updateProgressDisplay(task);
                    updateFailedEmailsDisplay(task);
                    updateActionButtons(task.status);
                }
            }
            
            // Update SMTP stats periodically
            if (smtpSettings) {
                updateSMTPStats();
            }
            
        } catch (error) {
            console.error('Polling error:', error);
        }
    }, 2000);
}

// ================================================
// HELPER FUNCTIONS
// ================================================
function formatTime(dateString) {
    if (!dateString) return '';
    
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        
        return date.toLocaleDateString();
    } catch (error) {
        return '';
    }
}

// ================================================
// EXPORT FUNCTIONS TO GLOBAL SCOPE
// ================================================
window.selectTask = selectTask;
window.deleteTaskFromList = async (taskId) => {
    if (confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
        try {
            const result = await DeleteTask(taskId);
            
            if (result.error) {
                showNotification('error', result.error);
                return;
            }
            
            // Remove from collections
            activeTasks.delete(taskId);
            uploadedFiles.delete(taskId);
            formDataCache.delete(taskId);
            
            // If this was the current task, clear the form
            if (currentTaskId === taskId) {
                clearFormUI();
                currentTaskId = null;
                updateProgressDisplay(null);
                updateFailedEmailsDisplay(null);
                updateActionButtons('none');
            }
            
            // Update UI
            renderTasks();
            
            showNotification('info', result.message);
            addActivityLog(`Deleted task: ${taskId}`);
            
        } catch (error) {
            showNotification('error', 'Failed to delete task: ' + error.message);
        }
    }
};