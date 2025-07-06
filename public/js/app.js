// Main JavaScript file for Membership SaaS System

class SaaSApp {
    constructor() {
        this.baseURL = window.location.origin;
        this.token = localStorage.getItem('token');
        this.user = JSON.parse(localStorage.getItem('user') || 'null');
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuthState();
    }

    // Authentication Methods
    async login(email, password) {
        try {
            const response = await this.makeRequest('/api/auth/login', 'POST', {
                email,
                password
            });

            if (response.success) {
                this.token = response.token;
                this.user = response.user;
                localStorage.setItem('token', this.token);
                localStorage.setItem('user', JSON.stringify(this.user));
                
                // Redirect based on role
                if (this.user.role === 'super_admin') {
                    window.location.href = '/admin';
                } else {
                    window.location.href = '/client';
                }
            }
            return response;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    async signup(formData) {
        try {
            const response = await this.makeRequest('/api/auth/signup', 'POST', formData);
            return response;
        } catch (error) {
            console.error('Signup error:', error);
            throw error;
        }
    }

    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        this.token = null;
        this.user = null;
        window.location.href = '/login';
    }

    checkAuthState() {
        const currentPath = window.location.pathname;
        const protectedPaths = ['/admin', '/client', '/members'];
        
        if (protectedPaths.some(path => currentPath.includes(path))) {
            if (!this.token || !this.user) {
                window.location.href = '/login';
                return;
            }

            // Check role-based access
            if (currentPath.includes('/admin') && this.user.role !== 'super_admin') {
                window.location.href = '/client';
                return;
            }

            if (currentPath.includes('/client') && this.user.role !== 'client') {
                window.location.href = '/admin';
                return;
            }
        }
    }

    // API Methods
    async makeRequest(url, method = 'GET', body = null, headers = {}) {
        const config = {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        if (this.token) {
            config.headers['Authorization'] = `Bearer ${this.token}`;
        }

        if (body && method !== 'GET') {
            config.body = JSON.stringify(body);
        }

        const response = await fetch(`${this.baseURL}${url}`, config);
        
        if (response.status === 401) {
            this.logout();
            return;
        }

        return await response.json();
    }

    // Dashboard Methods
    async getDashboardData() {
        const endpoint = this.user.role === 'super_admin' ? '/api/admin/dashboard' : '/api/client/dashboard';
        return await this.makeRequest(endpoint);
    }

    // Member Methods
    async getMembers(page = 1, limit = 10, search = '', status = '', plan = '') {
        const params = new URLSearchParams({
            page,
            limit,
            search,
            status,
            plan
        });
        
        return await this.makeRequest(`/api/members?${params}`);
    }

    async getMember(id) {
        return await this.makeRequest(`/api/members/${id}`);
    }

    async createMember(memberData) {
        return await this.makeRequest('/api/members', 'POST', memberData);
    }

    async updateMember(id, memberData) {
        return await this.makeRequest(`/api/members/${id}`, 'PUT', memberData);
    }

    async deleteMember(id) {
        return await this.makeRequest(`/api/members/${id}`, 'DELETE');
    }

    async addMemberPayment(id, paymentData) {
        return await this.makeRequest(`/api/members/${id}/payments`, 'POST', paymentData);
    }

    async extendMembership(id, extensionData) {
        return await this.makeRequest(`/api/members/${id}/extend`, 'POST', extensionData);
    }

    // Client Methods (for admin)
    async getClients(page = 1, limit = 10, search = '', status = '') {
        const params = new URLSearchParams({
            page,
            limit,
            search,
            status
        });
        
        return await this.makeRequest(`/api/admin/clients?${params}`);
    }

    async updateClientStatus(id, status) {
        return await this.makeRequest(`/api/admin/clients/${id}/status`, 'PUT', { status });
    }

    // Plans Methods
    async getPlans() {
        return await this.makeRequest('/api/auth/plans');
    }

    // Utility Methods
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(amount);
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('en-IN');
    }

    formatDateTime(dateString) {
        return new Date(dateString).toLocaleString('en-IN');
    }

    getStatusBadge(status) {
        const badges = {
            active: 'badge bg-success',
            expired: 'badge bg-danger',
            pending: 'badge bg-warning text-dark',
            approved: 'badge bg-success',
            blocked: 'badge bg-danger',
            trial: 'badge bg-info'
        };
        
        return badges[status] || 'badge bg-secondary';
    }

    showAlert(message, type = 'info') {
        const alertContainer = document.getElementById('alert-container') || this.createAlertContainer();
        
        const alertElement = document.createElement('div');
        alertElement.className = `alert alert-${type} alert-dismissible fade show`;
        alertElement.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        alertContainer.appendChild(alertElement);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (alertElement.parentNode) {
                alertElement.remove();
            }
        }, 5000);
    }

    createAlertContainer() {
        const container = document.createElement('div');
        container.id = 'alert-container';
        container.className = 'position-fixed top-0 end-0 p-3';
        container.style.zIndex = '9999';
        document.body.appendChild(container);
        return container;
    }

    showSpinner(show = true) {
        let spinner = document.getElementById('loading-spinner');
        
        if (show) {
            if (!spinner) {
                spinner = document.createElement('div');
                spinner.id = 'loading-spinner';
                spinner.className = 'spinner-overlay';
                spinner.innerHTML = `
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                `;
                document.body.appendChild(spinner);
            }
            spinner.style.display = 'flex';
        } else {
            if (spinner) {
                spinner.style.display = 'none';
            }
        }
    }

    // Form Validation
    validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    validatePhone(phone) {
        return /^[6-9]\d{9}$/.test(phone);
    }

    validateForm(formElement) {
        const inputs = formElement.querySelectorAll('input[required], select[required]');
        let isValid = true;

        inputs.forEach(input => {
            const value = input.value.trim();
            let inputValid = true;

            // Remove previous validation classes
            input.classList.remove('is-invalid');
            const feedback = input.parentNode.querySelector('.invalid-feedback');
            if (feedback) feedback.remove();

            // Basic required field validation
            if (!value) {
                inputValid = false;
                this.showFieldError(input, 'This field is required');
            }

            // Email validation
            if (input.type === 'email' && value && !this.validateEmail(value)) {
                inputValid = false;
                this.showFieldError(input, 'Please enter a valid email address');
            }

            // Phone validation
            if (input.name === 'phone' && value && !this.validatePhone(value)) {
                inputValid = false;
                this.showFieldError(input, 'Please enter a valid 10-digit phone number');
            }

            // Password validation
            if (input.type === 'password' && value && value.length < 6) {
                inputValid = false;
                this.showFieldError(input, 'Password must be at least 6 characters long');
            }

            if (!inputValid) {
                isValid = false;
            }
        });

        return isValid;
    }

    showFieldError(input, message) {
        input.classList.add('is-invalid');
        const feedback = document.createElement('div');
        feedback.className = 'invalid-feedback';
        feedback.textContent = message;
        input.parentNode.appendChild(feedback);
    }

    // Event Listeners
    setupEventListeners() {
        // Global form submissions
        document.addEventListener('submit', (e) => {
            if (e.target.matches('.needs-validation')) {
                e.preventDefault();
                if (this.validateForm(e.target)) {
                    this.handleFormSubmit(e.target);
                }
            }
        });

        // Global logout buttons
        document.addEventListener('click', (e) => {
            if (e.target.matches('.logout-btn')) {
                e.preventDefault();
                this.logout();
            }
        });

        // Mobile sidebar toggle
        const sidebarToggle = document.getElementById('sidebar-toggle');
        const sidebar = document.querySelector('.sidebar');
        
        if (sidebarToggle && sidebar) {
            sidebarToggle.addEventListener('click', () => {
                sidebar.classList.toggle('show');
            });
        }
    }

    async handleFormSubmit(form) {
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        this.showSpinner(true);
        
        try {
            let response;
            
            switch (form.id) {
                case 'login-form':
                    response = await this.login(data.email, data.password);
                    break;
                
                case 'signup-form':
                    response = await this.signup(data);
                    if (response.success) {
                        this.showAlert('Signup successful! Please wait for admin approval.', 'success');
                        setTimeout(() => window.location.href = '/login', 2000);
                    }
                    break;
                
                case 'member-form':
                    if (data.id) {
                        response = await this.updateMember(data.id, data);
                    } else {
                        response = await this.createMember(data);
                    }
                    
                    if (response.success) {
                        this.showAlert(response.message, 'success');
                        form.reset();
                        if (typeof refreshMembersList === 'function') {
                            refreshMembersList();
                        }
                    }
                    break;
                
                default:
                    console.log('Unhandled form submission:', form.id);
            }

            if (response && !response.success) {
                this.showAlert(response.message, 'danger');
            }

        } catch (error) {
            console.error('Form submission error:', error);
            this.showAlert('An error occurred. Please try again.', 'danger');
        } finally {
            this.showSpinner(false);
        }
    }

    // CSV Export
    async exportData(endpoint, filename) {
        try {
            this.showSpinner(true);
            
            const response = await fetch(`${this.baseURL}${endpoint}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                
                this.showAlert('Export completed successfully', 'success');
            } else {
                throw new Error('Export failed');
            }
        } catch (error) {
            console.error('Export error:', error);
            this.showAlert('Export failed. Please try again.', 'danger');
        } finally {
            this.showSpinner(false);
        }
    }

    // QR Code handling
    displayQRCode(qrCodeData, memberName) {
        const modal = document.getElementById('qr-modal') || this.createQRModal();
        const qrContainer = modal.querySelector('.qr-code-container');
        const memberNameElement = modal.querySelector('.member-name');
        
        qrContainer.innerHTML = `<img src="${qrCodeData}" alt="Member QR Code" class="img-fluid">`;
        memberNameElement.textContent = memberName;
        
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
    }

    createQRModal() {
        const modal = document.createElement('div');
        modal.id = 'qr-modal';
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Member QR Code</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body text-center">
                        <h6 class="member-name mb-3"></h6>
                        <div class="qr-code-container"></div>
                        <p class="text-muted mt-3">Scan this QR code for attendance</p>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        return modal;
    }
}

// Initialize the app
window.saasApp = new SaaSApp();

// Global utility functions
window.formatCurrency = (amount) => saasApp.formatCurrency(amount);
window.formatDate = (date) => saasApp.formatDate(date);
window.formatDateTime = (date) => saasApp.formatDateTime(date);
window.showAlert = (message, type) => saasApp.showAlert(message, type);
window.exportData = (endpoint, filename) => saasApp.exportData(endpoint, filename);