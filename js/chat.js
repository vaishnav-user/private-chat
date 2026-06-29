/**
 * chat.js — Main chat controller (plain script, no modules)
 * Depends on window.PCC set by firebase.js
 */
(function () {
    'use strict';

    // ── Config ────────────────────────────────────────────────────────────
    // Set your anniversary date here (year, month [0=Jan], day)
    var ANNIVERSARY = new Date(2024, 9, 12);

    var PROFILES = {
        vaishnav: { name: 'Vaishnav', partner: 'chikku',   partnerName: 'Chikku'   },
        chikku:   { name: 'Chikku',   partner: 'vaishnav', partnerName: 'Vaishnav' }
    };

    var EMOJIS = {
        recent:     ['❤️','💖','🥰','😘','💕','✨','🌸','🧸','💑','💌','😍','🫦'],
        smileys:    ['😊','😂','🤣','😍','🥰','😘','😗','😙','😋','😛','😜','🤪','😎','🥺','😢','😭','😤','🤗','🤔','😳','🥵','🥶','😱','🤯','😇','😈'],
        animals:    ['🐶','🐱','🐰','🦊','🐻','🐼','🐨','🦁','🐮','🐸','🦋','🐝','🦄','🐙','🦀','🐬','🐳'],
        food:       ['🍓','🍒','🍑','🥭','🍍','🍫','🍩','🎂','🧁','🍪','🍰','🍵','☕','🥤','🍹','🥂'],
        activities: ['🎉','🎊','🎁','🎀','✨','🏆','🎭','🎨','🎬','🎤','🎧','🎹','🎸','🎮','🛹','💃']
    };

    // ── DOM ───────────────────────────────────────────────────────────────
    var $ = function (id) { return document.getElementById(id); };

    var msgContainer      = $('messagesContainer');
    var msgList           = $('messagesList');
    var msgInput          = $('messageInput');
    var sendBtn           = $('sendBtn');
    var emojiBtn          = $('emojiBtn');
    var emojiDrawer       = $('emojiDrawer');
    var emojiGrid         = $('emojiGrid');
    var emojiTabs         = $('emojiTabs');
    var typingIndicator   = $('typingIndicator');
    var typingText        = $('typingText');
    var sidebarAvatar     = $('sidebarAvatar');
    var sidebarName       = $('sidebarPartnerName');
    var sidebarStatus     = $('sidebarPartnerStatusText');
    var sidebarBadge      = $('sidebarStatusBadge');
    var loveCounter       = $('loveCounter');
    var msgCount          = $('messagesExchanged');
    var themeToggleBtn    = $('themeToggleBtn');
    var themeIcon         = $('themeIcon');
    var logoutBtn         = $('logoutBtn');
    var mobileThemeBtn    = $('mobileThemeToggleBtn');
    var mobileThemeIcon   = $('mobileThemeIcon');
    var mobileLogoutBtn   = $('mobileLogoutBtn');
    var headerAvatar      = $('headerAvatar');
    var headerName        = $('headerPartnerName');
    var headerStatus      = $('headerPartnerStatus');
    var headerText        = $('headerTextContainer');

    // ── State ─────────────────────────────────────────────────────────────
    var me        = null;
    var partner   = null;
    var initTime  = Date.now();
    var typingTmr = null;
    var isTyping  = false;

    // ── Boot: wait for auth ───────────────────────────────────────────────
    PCC.onAuthStateChanged(PCC.auth, function (user) {
        if (user) {
            me      = user.email.split('@')[0].toLowerCase();
            partner = PROFILES[me] ? PROFILES[me].partner : null;
            if (!partner) return;

            setupUI();
            updateStatus(true);
            listenPartner();
            listenMessages();
            setupPresence();
        }
    });

    // ── UI Setup ──────────────────────────────────────────────────────────
    function setupUI() {
        var p = PROFILES[me];

        sidebarName.textContent = PROFILES[p.partner].name;
        headerName.textContent  = PROFILES[p.partner].name;

        // Love counter
        var days = Math.ceil(Math.abs(new Date() - ANNIVERSARY) / 86400000);
        loveCounter.textContent = days + ' Days';

        // Theme
        setTheme(localStorage.getItem('pcc_theme') || 'dark');

        // Load emojis
        loadEmojis('recent');
    }

    // ── Events ────────────────────────────────────────────────────────────
    sendBtn.addEventListener('click', sendMessage);

    msgInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });

    msgInput.addEventListener('input', handleTyping);

    emojiBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        emojiDrawer.classList.toggle('active');
    });

    document.addEventListener('click', function (e) {
        if (!emojiDrawer.contains(e.target) && e.target !== emojiBtn) {
            emojiDrawer.classList.remove('active');
        }
    });

    emojiTabs.addEventListener('click', function (e) {
        var tab = e.target.closest('.emoji-tab');
        if (!tab) return;
        document.querySelectorAll('.emoji-tab').forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        loadEmojis(tab.dataset.category);
    });

    logoutBtn.addEventListener('click', function ()       { updateStatus(false).then(function(){ window.PCC_logout(); }); });
    mobileLogoutBtn.addEventListener('click', function () { updateStatus(false).then(function(){ window.PCC_logout(); }); });
    themeToggleBtn.addEventListener('click', toggleTheme);
    mobileThemeBtn.addEventListener('click', toggleTheme);

    // ── Send Message ──────────────────────────────────────────────────────
    async function sendMessage() {
        var text = msgInput.value.trim();
        if (!text) return;

        msgInput.value = '';
        stopTyping();

        try {
            await PCC.addDoc(PCC.collection(PCC.db, 'messages'), {
                text:      text,
                sender:    me,
                timestamp: PCC.serverTimestamp(),
                read:      false,
                readAt:    null
            });
        } catch (e) {
            console.error('Send failed:', e);
        }
    }

    // ── Typing Indicator ──────────────────────────────────────────────────
    function handleTyping() {
        if (!isTyping) { isTyping = true; setTypingStatus(true); }
        clearTimeout(typingTmr);
        typingTmr = setTimeout(stopTyping, 2500);
    }

    function stopTyping() {
        if (isTyping) { isTyping = false; clearTimeout(typingTmr); setTypingStatus(false); }
    }

    async function setTypingStatus(val) {
        try {
            await PCC.updateDoc(PCC.doc(PCC.db, 'users', me), { typing: val });
        } catch (e) {}
    }

    // ── Online Presence ───────────────────────────────────────────────────
    async function updateStatus(online) {
        if (!me) return;
        try {
            var ref  = PCC.doc(PCC.db, 'users', me);
            var snap = await PCC.getDoc(ref);
            var data = { username: me, online: online, lastSeen: PCC.serverTimestamp() };
            if (online) data.typing = false;
            if (snap.exists()) {
                await PCC.updateDoc(ref, data);
            } else {
                await PCC.setDoc(ref, data);
            }
        } catch (e) {}
    }

    function setupPresence() {
        window.addEventListener('focus',  function () { updateStatus(true);  markRead(); });
        window.addEventListener('blur',   function () { updateStatus(false); stopTyping(); });
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'visible') { updateStatus(true); markRead(); }
            else { updateStatus(false); stopTyping(); }
        });
        window.addEventListener('beforeunload', function () { updateStatus(false); });
    }

    // ── Listen to Partner Status ──────────────────────────────────────────
    function listenPartner() {
        var ref = PCC.doc(PCC.db, 'users', partner);
        PCC.onSnapshot(ref, function (snap) {
            if (!snap.exists()) return;
            var d = snap.data();

            // Online badge
            var isOnline = !!d.online;
            sidebarBadge.classList.toggle('online', isOnline);
            headerText.classList.toggle('online', isOnline);
            var statusLabel = isOnline ? 'Online' : formatLastSeen(d.lastSeen);
            sidebarStatus.textContent = statusLabel;
            headerStatus.textContent  = isOnline ? 'online' : statusLabel;

            // Typing
            if (d.typing) {
                typingText.textContent      = PROFILES[partner].name + ' is typing...';
                typingIndicator.style.display = 'flex';
            } else {
                typingIndicator.style.display = 'none';
            }
        });
    }

    // ── Listen to Messages ────────────────────────────────────────────────
    function listenMessages() {
        var q = PCC.query(PCC.collection(PCC.db, 'messages'));

        PCC.onSnapshot(q, function (snapshot) {
            var toMarkRead = [];
            var hasNew     = false;

            msgCount.textContent = snapshot.size;
            msgList.innerHTML    = '';

            snapshot.forEach(function (docSnap) {
                var msg = docSnap.data();
                var id  = docSnap.id;

                if (msg.sender === partner && !msg.read) {
                    toMarkRead.push(id);
                    var msgTs = msg.timestamp ? msg.timestamp.toDate().getTime() : Date.now();
                    if (msgTs > initTime - 3000) hasNew = true;
                }
                renderBubble(msg);
            });

            scrollBottom();

            if (hasNew) playSound();

            if (toMarkRead.length && document.visibilityState === 'visible') {
                batchMarkRead(toMarkRead);
            }
        });
    }

    // ── Render Bubble ─────────────────────────────────────────────────────
    function renderBubble(msg) {
        var isSent = msg.sender === me;
        var row    = document.createElement('div');
        row.className = 'message-row ' + (isSent ? 'sent' : 'received');

        var bubble = document.createElement('div');
        bubble.className = 'message-bubble';

        var textEl = document.createElement('span');
        textEl.textContent = msg.text;
        bubble.appendChild(textEl);

        var meta = document.createElement('div');
        meta.className = 'message-meta';

        var timeEl = document.createElement('span');
        timeEl.textContent = msg.timestamp ? fmtTime(msg.timestamp.toDate()) : fmtTime(new Date());
        meta.appendChild(timeEl);

        if (isSent) {
            var receipt = document.createElement('span');
            receipt.className = 'read-receipt';
            receipt.innerHTML = msg.read
                ? '<i class="bx bx-check-double read" title="Read"></i>'
                : '<i class="bx bx-check" title="Sent"></i>';
            meta.appendChild(receipt);
        }

        bubble.appendChild(meta);
        row.appendChild(bubble);
        msgList.appendChild(row);
    }

    // ── Mark Messages as Read ─────────────────────────────────────────────
    async function batchMarkRead(ids) {
        var batch = PCC.writeBatch(PCC.db);
        ids.forEach(function (id) {
            batch.update(PCC.doc(PCC.db, 'messages', id), {
                read:   true,
                readAt: PCC.serverTimestamp()
            });
        });
        try { await batch.commit(); } catch (e) {}
    }

    async function markRead() {
        // Re-read all messages and mark partner's unread ones
        var msgs  = JSON.parse(localStorage.getItem('pcc_messages') || '[]');
        var toMark = msgs.filter(function (m) { return m.sender === partner && !m.read; })
                         .map(function (m) { return m.id; });
        if (toMark.length) await batchMarkRead(toMark);
    }

    // ── Sound ─────────────────────────────────────────────────────────────
    function playSound() {
        var audio = document.getElementById('notificationSound');
        if (audio) {
            audio.currentTime = 0;
            audio.play().catch(synthSound);
        } else {
            synthSound();
        }
    }

    function synthSound() {
        try {
            var Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return;
            var ctx   = new Ctx();
            var gain  = ctx.createGain();
            var o1    = ctx.createOscillator();
            var o2    = ctx.createOscillator();
            o1.frequency.value = 880;
            o2.frequency.value = 1320;
            gain.gain.setValueAtTime(0, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
            o1.connect(gain); o2.connect(gain); gain.connect(ctx.destination);
            o1.start(); o2.start();
            o1.stop(ctx.currentTime + 0.4); o2.stop(ctx.currentTime + 0.4);
        } catch (_) {}
    }

    // ── Emoji Drawer ──────────────────────────────────────────────────────
    function loadEmojis(category) {
        emojiGrid.innerHTML = '';
        (EMOJIS[category] || []).forEach(function (em) {
            var btn = document.createElement('button');
            btn.type      = 'button';
            btn.className = 'emoji-item';
            btn.textContent = em;
            btn.addEventListener('click', function () {
                msgInput.value += em;
                msgInput.focus();
                handleTyping();
            });
            emojiGrid.appendChild(btn);
        });
    }

    // ── Theme ─────────────────────────────────────────────────────────────
    function toggleTheme() {
        var cur = document.documentElement.getAttribute('data-theme') || 'dark';
        setTheme(cur === 'dark' ? 'light' : 'dark');
    }

    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('pcc_theme', theme);
        var isDark = theme === 'dark';
        themeIcon.className       = isDark ? 'bx bx-sun'  : 'bx bx-moon';
        mobileThemeIcon.className = isDark ? 'bx bx-sun'  : 'bx bx-moon';
        var label = isDark ? 'Light Mode' : 'Dark Mode';
        themeToggleBtn.querySelector('span').textContent = label;
    }

    // ── Helpers ───────────────────────────────────────────────────────────
    function scrollBottom() {
        msgContainer.scrollTop = msgContainer.scrollHeight;
    }

    function fmtTime(date) {
        return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    }

    function formatLastSeen(tsObj) {
        var date   = tsObj && tsObj.toDate ? tsObj.toDate() : (tsObj ? new Date(tsObj) : null);
        if (!date) return 'offline';
        var now    = new Date();
        var diffMs = now - date;
        var mins   = Math.floor(diffMs / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return 'last seen ' + mins + 'm ago';
        if (date.toDateString() === now.toDateString()) return 'last seen today at ' + fmtTime(date);
        var yest = new Date(now); yest.setDate(now.getDate() - 1);
        if (date.toDateString() === yest.toDateString()) return 'last seen yesterday at ' + fmtTime(date);
        return 'last seen ' + date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
})();
