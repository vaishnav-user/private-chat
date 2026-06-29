/**
 * auth.js — Route guard and logout helper (plain script, no modules)
 * Depends on window.PCC set by firebase.js
 */
(function () {
    'use strict';

    var ALLOWED_EMAILS = [
        'vaishnav@privatechat.local',
        'chikku@privatechat.local'
    ];

    function isUserAuthorized(email) {
        return email && ALLOWED_EMAILS.indexOf(email.toLowerCase()) !== -1;
    }

    // Expose helper for use in login.js / chat.js
    window.PCC_isUserAuthorized = isUserAuthorized;

    // Logout helper
    window.PCC_logout = async function () {
        var user = PCC.auth.currentUser;
        if (user) {
            try {
                var username   = user.email.split('@')[0];
                var userDocRef = PCC.doc(PCC.db, 'users', username);
                await PCC.updateDoc(userDocRef, { online: false, lastSeen: new Date(), typing: false });
            } catch (e) {
                console.warn('Status cleanup on logout failed:', e);
            }
        }
        await PCC.signOut(PCC.auth);
        window.location.replace('login.html');
    };

    // ── Route Guard ───────────────────────────────────────────────────────
    var path        = window.location.pathname;
    var isChat      = path.indexOf('chat.html')  !== -1;
    var isLogin     = path.indexOf('login.html') !== -1;
    var isIndex     = path === '/' || path.indexOf('index.html') !== -1;

    PCC.onAuthStateChanged(PCC.auth, async function (user) {
        if (user) {
            if (!isUserAuthorized(user.email)) {
                await PCC.signOut(PCC.auth);
                if (!isLogin) window.location.replace('login.html?error=unauthorized');
                return;
            }
            // Logged in and on login/index page → go to chat
            if (isLogin || isIndex) {
                window.location.replace('chat.html');
            }
        } else {
            // Not logged in and on chat page → go to login
            if (isChat) {
                window.location.replace('login.html');
            }
        }
    });
})();
