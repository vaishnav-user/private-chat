/**
 * login.js — Login form handler (plain script, no modules)
 * Depends on window.PCC set by firebase.js
 */
(function () {
    'use strict';

    var form            = document.getElementById('loginForm');
    var usernameInput   = document.getElementById('username');
    var passwordInput   = document.getElementById('password');
    var rememberMe      = document.getElementById('rememberMe');
    var loginBtn        = document.getElementById('loginBtn');
    var loginAlert      = document.getElementById('loginAlert');
    var alertMessage    = document.getElementById('alertMessage');
    var passwordToggle  = document.getElementById('passwordToggle');
    var eyeIcon         = document.getElementById('eyeIcon');

    // Show unauthorized error from URL param
    var params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'unauthorized') {
        showAlert('This account is not authorized to access this private chat.');
    }

    // Password show / hide toggle
    passwordToggle.addEventListener('click', function () {
        var isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';
        eyeIcon.className  = isPassword ? 'bx bx-hide' : 'bx bx-show';
    });

    // Form submit
    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        clearAlert();

        var username = usernameInput.value.trim().toLowerCase();
        var password = passwordInput.value;

        if (!username || !password) {
            showAlert('Please fill in all fields.');
            return;
        }

        if (username !== 'vaishnav' && username !== 'chikku') {
            showAlert('Invalid username. Only authorized users can enter this private space.');
            return;
        }

        var mappedEmail = username + '@privatechat.local';
        setLoading(true);

        try {
            var persistence = rememberMe.checked
                ? PCC.browserLocalPersistence
                : PCC.browserSessionPersistence;

            await PCC.setPersistence(PCC.auth, persistence);
            await PCC.signInWithEmailAndPassword(PCC.auth, mappedEmail, password);
            // Redirect is handled by auth.js onAuthStateChanged listener
        } catch (err) {
            console.error('Login error:', err);
            var msg = 'Failed to connect. Please check your credentials and try again.';
            if (err.code === 'auth/invalid-credential' ||
                err.code === 'auth/wrong-password'     ||
                err.code === 'auth/user-not-found') {
                msg = 'Incorrect username or password.';
            } else if (err.code === 'auth/network-request-failed') {
                msg = 'Network error. Please check your connection.';
            } else if (err.code === 'auth/too-many-requests') {
                msg = 'Too many attempts. Please try again later.';
            }
            showAlert(msg);
            setLoading(false);
        }
    });

    function showAlert(msg) {
        alertMessage.textContent = msg;
        loginAlert.classList.remove('hidden');
    }

    function clearAlert() {
        loginAlert.classList.add('hidden');
    }

    function setLoading(on) {
        loginBtn.classList.toggle('loading', on);
        loginBtn.disabled        = on;
        usernameInput.disabled   = on;
        passwordInput.disabled   = on;
        rememberMe.disabled      = on;
    }
})();
