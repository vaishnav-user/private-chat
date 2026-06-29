/**
 * firebase.js — Self-contained global module (Demo Mode)
 * Sets window.FirebaseApp with auth and db helpers.
 * No external CDN, no imports, no exports — works offline instantly.
 */
(function () {
    'use strict';

    // ── Demo credentials (only used locally, never sent anywhere) ──────────
    const DEMO_USERS = {
        vaishnav: { password: '671403',   email: 'vaishnav@privatechat.local' },
        chikku:   { password: 'chikku369', email: 'chikku@privatechat.local'  }
    };

    // ── Persistence constants ──────────────────────────────────────────────
    const browserLocalPersistence   = 'LOCAL';
    const browserSessionPersistence = 'SESSION';

    // ── In-memory state ───────────────────────────────────────────────────
    let _currentUser      = null;
    let _persistence      = browserLocalPersistence;
    const _authListeners  = [];
    const _fsListeners    = [];

    // ── Restore previous session ──────────────────────────────────────────
    (function restoreSession() {
        const saved = localStorage.getItem('pcc_user') || sessionStorage.getItem('pcc_user');
        if (saved) {
            try { _currentUser = JSON.parse(saved); } catch (_) {}
        }
    })();

    // ── Seed localStorage on first run ────────────────────────────────────
    if (!localStorage.getItem('pcc_messages')) {
        localStorage.setItem('pcc_messages', JSON.stringify([]));
    }
    if (!localStorage.getItem('pcc_users')) {
        localStorage.setItem('pcc_users', JSON.stringify({
            vaishnav: { username: 'vaishnav', online: false, lastSeen: new Date().toISOString(), typing: false },
            chikku:   { username: 'chikku',   online: false, lastSeen: new Date().toISOString(), typing: false }
        }));
    }

    // ── Cross-tab real-time sync via BroadcastChannel ─────────────────────
    let _bc = null;
    try {
        _bc = new BroadcastChannel('pcc_sync');
        _bc.onmessage = function (e) { _fireFS(e.data.col); };
    } catch (_) {
        window.addEventListener('storage', function (e) {
            if (e.key === 'pcc_messages') _fireFS('messages');
            if (e.key === 'pcc_users')    _fireFS('users');
        });
    }

    function _broadcast(col) {
        try { if (_bc) _bc.postMessage({ col: col }); } catch (_) {}
    }

    function _fireFS(col) {
        _fsListeners.forEach(function (l) { if (l.col === col) l.cb(); });
    }

    // ── Helper: timestamp-like wrapper ────────────────────────────────────
    function _ts(iso) {
        if (!iso) return null;
        return { toDate: function () { return new Date(iso); } };
    }

    // ═════════════════════════════════════════════════════════════════════
    // AUTH API
    // ═════════════════════════════════════════════════════════════════════

    const auth = {
        get currentUser() { return _currentUser; }
    };

    function setPersistence(_auth, type) {
        _persistence = type;
        return Promise.resolve();
    }

    function onAuthStateChanged(_auth, callback) {
        _authListeners.push(callback);
        // Fire immediately after all scripts have loaded
        setTimeout(function () { callback(_currentUser); }, 100);
        return function () {
            var idx = _authListeners.indexOf(callback);
            if (idx > -1) _authListeners.splice(idx, 1);
        };
    }

    function signInWithEmailAndPassword(_auth, email, password) {
        return new Promise(function (resolve, reject) {
            setTimeout(function () {
                var username = email.split('@')[0].toLowerCase();
                var profile  = DEMO_USERS[username];

                if (profile && profile.password === password) {
                    _currentUser = { email: email, uid: username };

                    var saved = JSON.stringify(_currentUser);
                    if (_persistence === browserLocalPersistence) {
                        localStorage.setItem('pcc_user', saved);
                    } else {
                        sessionStorage.setItem('pcc_user', saved);
                    }

                    _authListeners.forEach(function (cb) { cb(_currentUser); });
                    resolve({ user: _currentUser });
                } else {
                    var err  = new Error('Invalid credentials');
                    err.code = 'auth/invalid-credential';
                    reject(err);
                }
            }, 600);
        });
    }

    function signOut(_auth) {
        return new Promise(function (resolve) {
            _currentUser = null;
            localStorage.removeItem('pcc_user');
            sessionStorage.removeItem('pcc_user');
            _authListeners.forEach(function (cb) { cb(null); });
            resolve();
        });
    }

    // ═════════════════════════════════════════════════════════════════════
    // FIRESTORE API
    // ═════════════════════════════════════════════════════════════════════

    const db = {};

    function serverTimestamp() { return new Date().toISOString(); }

    function collection(_db, path) { return { _path: path }; }

    function doc(_db, path, id) { return { _path: path, _id: id }; }

    function query(ref) { return ref; }
    function orderBy() { return {}; }
    function limit()   { return {}; }
    function where()   { return {}; }

    function addDoc(colRef, data) {
        return new Promise(function (resolve) {
            var msgs = JSON.parse(localStorage.getItem('pcc_messages') || '[]');
            var msg  = {
                id:        'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
                text:      data.text,
                sender:    data.sender,
                timestamp: new Date().toISOString(),
                read:      false,
                readAt:    null
            };
            msgs.push(msg);
            localStorage.setItem('pcc_messages', JSON.stringify(msgs));
            _broadcast('messages');
            _fireFS('messages');
            resolve({ id: msg.id });
        });
    }

    function getDoc(docRef) {
        return new Promise(function (resolve) {
            var users = JSON.parse(localStorage.getItem('pcc_users') || '{}');
            var data  = users[docRef._id];
            resolve({
                exists: function () { return !!data; },
                data:   function () {
                    if (!data) return null;
                    return Object.assign({}, data, { lastSeen: _ts(data.lastSeen) });
                }
            });
        });
    }

    function getDocs(_queryRef) {
        return new Promise(function (resolve) {
            var msgs = JSON.parse(localStorage.getItem('pcc_messages') || '[]');
            var docs = msgs.map(function (m) {
                return {
                    id:  m.id,
                    ref: { _path: 'messages', _id: m.id },
                    data: function () { return _wrapMsg(m); }
                };
            });
            resolve({
                empty:   docs.length === 0,
                forEach: function (cb) { docs.forEach(cb); }
            });
        });
    }

    function setDoc(docRef, data) {
        return new Promise(function (resolve) {
            if (docRef._path === 'users') {
                var users = JSON.parse(localStorage.getItem('pcc_users') || '{}');
                var existing = users[docRef._id] || {};
                users[docRef._id] = Object.assign({}, existing, data,
                    { lastSeen: data.lastSeen ? new Date().toISOString() : existing.lastSeen });
                localStorage.setItem('pcc_users', JSON.stringify(users));
                _broadcast('users');
                _fireFS('users');
            }
            resolve();
        });
    }

    function updateDoc(docRef, data) {
        return new Promise(function (resolve) {
            if (docRef._path === 'users') {
                var users = JSON.parse(localStorage.getItem('pcc_users') || '{}');
                var u = users[docRef._id];
                if (u) {
                    users[docRef._id] = Object.assign({}, u, data,
                        { lastSeen: data.lastSeen !== undefined ? new Date().toISOString() : u.lastSeen });
                    localStorage.setItem('pcc_users', JSON.stringify(users));
                    _broadcast('users');
                    _fireFS('users');
                }
            } else if (docRef._path === 'messages') {
                var msgs = JSON.parse(localStorage.getItem('pcc_messages') || '[]');
                var idx  = msgs.findIndex(function (m) { return m.id === docRef._id; });
                if (idx !== -1) {
                    msgs[idx] = Object.assign({}, msgs[idx], data,
                        { readAt: data.readAt ? new Date().toISOString() : msgs[idx].readAt });
                    localStorage.setItem('pcc_messages', JSON.stringify(msgs));
                    _broadcast('messages');
                    _fireFS('messages');
                }
            }
            resolve();
        });
    }

    function onSnapshot(ref, callback) {
        var col = ref._id ? 'users' : (ref._path || 'messages');

        function fire() {
            if (col === 'messages') {
                var msgs = JSON.parse(localStorage.getItem('pcc_messages') || '[]');
                var docs = msgs.map(function (m) {
                    return { id: m.id, data: function () { return _wrapMsg(m); } };
                });
                callback({ size: docs.length, forEach: function (cb) { docs.forEach(cb); } });
            } else {
                var users    = JSON.parse(localStorage.getItem('pcc_users') || '{}');
                var username = ref._id;
                var ud       = users[username] || {};
                callback({
                    exists: function () { return !!users[username]; },
                    data:   function () {
                        return Object.assign({}, ud, { lastSeen: _ts(ud.lastSeen) });
                    }
                });
            }
        }

        var listener = { col: col, cb: fire };
        _fsListeners.push(listener);
        setTimeout(fire, 100);

        return function () {
            var i = _fsListeners.indexOf(listener);
            if (i > -1) _fsListeners.splice(i, 1);
        };
    }

    function writeBatch(_db) {
        var ops = [];
        return {
            update: function (ref, data) { ops.push(function () { return updateDoc(ref, data); }); },
            commit: function () {
                return Promise.all(ops.map(function (f) { return f(); })).then(function () {
                    _broadcast('messages');
                    _fireFS('messages');
                });
            }
        };
    }

    function _wrapMsg(m) {
        return Object.assign({}, m, {
            timestamp: _ts(m.timestamp),
            readAt:    _ts(m.readAt)
        });
    }

    // ═════════════════════════════════════════════════════════════════════
    // EXPOSE as window.PCC (Private Couple Chat)
    // ═════════════════════════════════════════════════════════════════════
    window.PCC = {
        auth:                      auth,
        db:                        db,
        browserLocalPersistence:   browserLocalPersistence,
        browserSessionPersistence: browserSessionPersistence,
        signInWithEmailAndPassword: signInWithEmailAndPassword,
        signOut:                   signOut,
        onAuthStateChanged:        onAuthStateChanged,
        setPersistence:            setPersistence,
        collection:                collection,
        addDoc:                    addDoc,
        doc:                       doc,
        setDoc:                    setDoc,
        getDoc:                    getDoc,
        getDocs:                   getDocs,
        updateDoc:                 updateDoc,
        onSnapshot:                onSnapshot,
        query:                     query,
        orderBy:                   orderBy,
        limit:                     limit,
        where:                     where,
        serverTimestamp:           serverTimestamp,
        writeBatch:                writeBatch
    };

    console.log('%c💕 Private Couple Chat — Demo Mode Active', 'color:#e91e8c;font-weight:bold;font-size:14px');
    console.log('%c🔑 Login: vaishnav / 671403  |  chikku / chikku369', 'color:#9c27b0;font-size:12px');
})();
