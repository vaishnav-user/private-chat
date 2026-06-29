/**
 * firebase.js — Real Firebase Mode
 * Uses Firebase Firestore + Authentication for live real-time sync.
 * Exposes window.PCC with same API as Demo Mode so chat.html and login.html work unchanged.
 */
(function () {
    'use strict';

    // ── Firebase Config ────────────────────────────────────────────────────
    const FIREBASE_CONFIG = {
        apiKey:            "AIzaSyAF9xdma_4QA-RWXmCFK3UatkAUYD-kxtg",
        authDomain:        "agriculture-cddd2.firebaseapp.com",
        projectId:         "agriculture-cddd2",
        storageBucket:     "agriculture-cddd2.firebasestorage.app",
        messagingSenderId: "924636203634",
        appId:             "1:924636203634:web:70369630e197fa96b510eb",
        measurementId:     "G-JH8S8J0BH9"
    };

    // ── Firebase SDK URLs (v9 compat build — works without bundler) ────────
    const SDK_BASE = "https://www.gstatic.com/firebasejs/10.12.2";

    // ── Persistence constants (mirror real Firebase names) ─────────────────
    const browserLocalPersistence   = 'LOCAL';
    const browserSessionPersistence = 'SESSION';

    // ── Internal state ─────────────────────────────────────────────────────
    let _firebaseApp  = null;
    let _auth         = null;
    let _db           = null;
    let _ready        = false;
    let _readyCbs     = [];
    let _persistence  = browserLocalPersistence;
    let _FB           = null;   // real Firebase module refs

    // Queue of PCC calls made before SDK loads
    function _whenReady(fn) {
        if (_ready) { fn(); } else { _readyCbs.push(fn); }
    }

    // ── Dynamically load Firebase SDK ──────────────────────────────────────
    function _loadScript(url) {
        return new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            s.src = url;
            s.onload  = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    Promise.all([
        _loadScript(SDK_BASE + '/firebase-app-compat.js'),
        _loadScript(SDK_BASE + '/firebase-auth-compat.js'),
        _loadScript(SDK_BASE + '/firebase-firestore-compat.js')
    ]).then(function () {
        _firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
        _auth = firebase.auth();
        _db   = firebase.firestore();

        // Enable offline persistence so the app works if connection drops
        _db.enablePersistence({ synchronizeTabs: true }).catch(function () {});

        _ready = true;
        _readyCbs.forEach(function (fn) { fn(); });
        _readyCbs = [];

        console.log('%c🌾 Agriculture — Live Firebase Mode Active', 'color:#4ade80;font-weight:bold;font-size:14px');
    }).catch(function (err) {
        console.error('Firebase SDK failed to load:', err);
    });

    // ══════════════════════════════════════════════════════════════════════
    // AUTH WRAPPERS
    // ══════════════════════════════════════════════════════════════════════

    const auth = {
        get currentUser() { return _auth ? _auth.currentUser : null; }
    };

    function setPersistence(_a, type) {
        _persistence = type;
        return new Promise(function (resolve) {
            _whenReady(function () {
                var mode = (type === browserSessionPersistence)
                    ? firebase.auth.Auth.Persistence.SESSION
                    : firebase.auth.Auth.Persistence.LOCAL;
                _auth.setPersistence(mode).then(resolve).catch(resolve);
            });
        });
    }

    function onAuthStateChanged(_a, callback) {
        var unsubscribe = null;
        _whenReady(function () {
            unsubscribe = _auth.onAuthStateChanged(callback);
        });
        // If SDK not ready yet, return a cancel fn that unsubscribes when ready
        return function () {
            if (unsubscribe) unsubscribe();
        };
    }

    function signInWithEmailAndPassword(_a, email, password) {
        return new Promise(function (resolve, reject) {
            _whenReady(function () {
                _auth.signInWithEmailAndPassword(email, password)
                    .then(resolve)
                    .catch(reject);
            });
        });
    }

    function signOut(_a) {
        return new Promise(function (resolve, reject) {
            _whenReady(function () {
                // Mark user offline before signing out
                var user = _auth.currentUser;
                if (user) {
                    var username = user.email.split('@')[0].toLowerCase();
                    _db.collection('users').doc(username)
                        .set({ online: false, lastSeen: firebase.firestore.FieldValue.serverTimestamp(), typing: false }, { merge: true })
                        .catch(function () {})
                        .finally(function () {
                            _auth.signOut().then(resolve).catch(reject);
                        });
                } else {
                    _auth.signOut().then(resolve).catch(reject);
                }
            });
        });
    }

    // ══════════════════════════════════════════════════════════════════════
    // FIRESTORE WRAPPERS  (mimic the modular v9 API surface used by chat.html)
    // ══════════════════════════════════════════════════════════════════════

    const db = {};

    function serverTimestamp() {
        return _db ? firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString();
    }

    function collection(_db2, path) {
        return { _path: path, _isCollection: true };
    }

    function doc(_db2, path, id) {
        return { _path: path, _id: id, _isDoc: true };
    }

    function query(ref /*, ...constraints */) {
        // Store constraints for use in getDocs/onSnapshot
        var constraints = Array.prototype.slice.call(arguments, 1);
        return Object.assign({}, ref, { _constraints: constraints });
    }

    function orderBy(field, dir) {
        return { _type: 'orderBy', field: field, dir: dir || 'asc' };
    }

    function limit(n) {
        return { _type: 'limit', n: n };
    }

    function where(field, op, val) {
        return { _type: 'where', field: field, op: op, val: val };
    }

    // ── Apply query constraints to a Firestore reference ──────────────────
    function _applyConstraints(ref, constraints) {
        var q = ref;
        (constraints || []).forEach(function (c) {
            if (!c || !c._type) return;
            if (c._type === 'orderBy') q = q.orderBy(c.field, c.dir);
            if (c._type === 'limit')   q = q.limit(c.n);
            if (c._type === 'where')   q = q.where(c.field, c.op, c.val);
        });
        return q;
    }

    // ── Wrap a Firestore snapshot doc for chat.html ───────────────────────
    function _wrapDoc(fsDoc) {
        return {
            id:  fsDoc.id,
            ref: { _path: 'messages', _id: fsDoc.id, _isDoc: true },
            data: function () {
                var d = fsDoc.data() || {};
                return d;
            }
        };
    }

    function addDoc(colRef, data) {
        return new Promise(function (resolve, reject) {
            _whenReady(function () {
                _db.collection(colRef._path).add(data)
                    .then(function (ref) { resolve({ id: ref.id }); })
                    .catch(reject);
            });
        });
    }

    function getDoc(docRef) {
        return new Promise(function (resolve, reject) {
            _whenReady(function () {
                _db.collection(docRef._path).doc(docRef._id).get()
                    .then(function (snap) {
                        resolve({
                            exists: function () { return snap.exists; },
                            data:   function () { return snap.data() || null; }
                        });
                    })
                    .catch(reject);
            });
        });
    }

    function getDocs(queryRef) {
        return new Promise(function (resolve, reject) {
            _whenReady(function () {
                var colRef = _db.collection(queryRef._path);
                var q      = _applyConstraints(colRef, queryRef._constraints);
                q.get().then(function (snap) {
                    var docs = [];
                    snap.forEach(function (d) { docs.push(_wrapDoc(d)); });
                    resolve({
                        empty:   docs.length === 0,
                        forEach: function (cb) { docs.forEach(cb); }
                    });
                }).catch(reject);
            });
        });
    }

    function setDoc(docRef, data, options) {
        return new Promise(function (resolve, reject) {
            _whenReady(function () {
                var ref = _db.collection(docRef._path).doc(docRef._id);
                var promise = (options && options.merge)
                    ? ref.set(data, { merge: true })
                    : ref.set(data);
                promise.then(resolve).catch(reject);
            });
        });
    }

    function updateDoc(docRef, data) {
        return new Promise(function (resolve, reject) {
            _whenReady(function () {
                _db.collection(docRef._path).doc(docRef._id).update(data)
                    .then(resolve)
                    .catch(function (err) {
                        // If doc doesn't exist yet, set it instead
                        if (err.code === 'not-found') {
                            _db.collection(docRef._path).doc(docRef._id).set(data).then(resolve).catch(reject);
                        } else {
                            reject(err);
                        }
                    });
            });
        });
    }

    function onSnapshot(ref, callback) {
        var unsubscribe = null;

        _whenReady(function () {
            if (ref._isDoc || ref._id) {
                // Single document snapshot (e.g. users/vaishnav)
                unsubscribe = _db.collection(ref._path).doc(ref._id)
                    .onSnapshot(function (snap) {
                        callback({
                            exists: function () { return snap.exists; },
                            data:   function () { return snap.data() || null; }
                        });
                    });
            } else {
                // Collection/query snapshot (e.g. messages)
                var colRef = _db.collection(ref._path);
                var q      = _applyConstraints(colRef, ref._constraints);
                unsubscribe = q.onSnapshot(function (snap) {
                    var docs = [];
                    snap.forEach(function (d) { docs.push(_wrapDoc(d)); });
                    callback({
                        size:    docs.length,
                        forEach: function (cb) { docs.forEach(cb); }
                    });
                });
            }
        });

        return function () { if (unsubscribe) unsubscribe(); };
    }

    function writeBatch(_db2) {
        var _batch = null;
        var ops    = [];

        _whenReady(function () {
            _batch = _db.batch();
            ops.forEach(function (op) { op(_batch); });
        });

        return {
            update: function (docRef, data) {
                var op = function (b) {
                    b.update(_db.collection(docRef._path).doc(docRef._id), data);
                };
                if (_batch) { op(_batch); } else { ops.push(op); }
            },
            commit: function () {
                return new Promise(function (resolve, reject) {
                    _whenReady(function () {
                        _batch.commit().then(resolve).catch(reject);
                    });
                });
            }
        };
    }

    // ══════════════════════════════════════════════════════════════════════
    // EXPOSE as window.PCC  (same shape as Demo Mode)
    // ══════════════════════════════════════════════════════════════════════
    window.PCC = {
        auth:                       auth,
        db:                         db,
        browserLocalPersistence:    browserLocalPersistence,
        browserSessionPersistence:  browserSessionPersistence,
        signInWithEmailAndPassword:  signInWithEmailAndPassword,
        signOut:                    signOut,
        onAuthStateChanged:         onAuthStateChanged,
        setPersistence:             setPersistence,
        collection:                 collection,
        addDoc:                     addDoc,
        doc:                        doc,
        setDoc:                     setDoc,
        getDoc:                     getDoc,
        getDocs:                    getDocs,
        updateDoc:                  updateDoc,
        onSnapshot:                 onSnapshot,
        query:                      query,
        orderBy:                    orderBy,
        limit:                      limit,
        where:                      where,
        serverTimestamp:            serverTimestamp,
        writeBatch:                 writeBatch
    };
})();
