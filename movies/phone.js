// Phones as a remote for Movies on the TV, the same link the launcher uses (the launcher's
// app/js/remote.js and jam/index.html): presses, typing and volume come over Supabase
// Realtime broadcast. Typing edits the search. TV mode only. deploy.sh adds this to the
// build, after tv.js, with __ROOM__ set to the room it gave this TV's launcher.
(() => {
    if (!document.documentElement.classList.contains('tv')) return;
    const SUPABASE = 'https://jbvkjvdthuzofvmhwctv.supabase.co';
    const KEY = 'sb_publishable_hbxcjbYF5H8py5gGLokxPg_tD9nGsNl';
    const TOPIC = 'realtime:tv-__ROOM__';
    const LAUNCHER_ID = 'SkrFlap001.SeekerFlap';
    const KEY_CODES = { up: 38, down: 40, left: 37, right: 39, ok: 13, back: 10009 };
    const isTizen = typeof window.tizen !== 'undefined' && !!window.tizen.application;
    let ws = null, joined = false, ref = 0, sent = '', sentAt = 0, shownAt = 0;

    function raw(msg) {
        msg.ref = String(++ref);
        ws.send(JSON.stringify(msg));
    }

    function send(event, payload) {
        if (joined) raw({ topic: TOPIC, event: 'broadcast', payload: { type: 'broadcast', event, payload } });
    }

    // tv.js reads the remote's keyCode, which a KeyboardEvent can't be given directly.
    function press(k) {
        const e = new KeyboardEvent('keydown', { bubbles: true, cancelable: true });
        Object.defineProperty(e, 'keyCode', { get: () => KEY_CODES[k] });
        window.dispatchEvent(e);
    }

    // tv.js takes the search from the address whenever it changes, so typing goes there.
    let typed = null, typeTimer = null;
    function type(back, text) {
        if (typed === null) {
            const m = location.hash.startsWith('#/search') && location.hash.match(/[?&]q=([^&]*)/);
            typed = m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : '';
        }
        typed = (typed.slice(0, Math.max(0, typed.length - back)) + text).slice(0, 60);
        clearTimeout(typeTimer);
        typeTimer = setTimeout(() => {
            const hash = '#/search' + (typed ? '?q=' + encodeURIComponent(typed) : '');
            typed = null;
            if (location.hash.startsWith('#/search')) location.replace(hash);
            else location.hash = hash;
        }, 300);
    }

    function volume(change) {
        if (!isTizen) return null;
        try {
            const a = tizen.tvaudiocontrol;
            if (change === 'mute') a.setMute(!a.isMute());
            else if (change === 'up') a.setVolumeUp();
            else if (change === 'down') a.setVolumeDown();
            return { level: a.getVolume(), muted: a.isMute() };
        } catch (e) {
            return null;
        }
    }

    // Movies stays open behind the launcher, so opening it again is instant.
    function exitApp() {
        if (!isTizen) return;
        const quit = () => { try { tizen.application.getCurrentApplication().exit(); } catch (e) {} };
        try { tizen.application.launch(LAUNCHER_ID, () => {}, quit); } catch (e) { quit(); }
    }

    function receive(event, p) {
        // Messages for the launcher, or queued while Movies was hidden, are skipped.
        if (event === 'hello') return void (sent = '');
        if (p.app !== 'movies' || document.hidden || performance.now() - shownAt < 1000) return;
        if (event === 'key' && p.down !== false && KEY_CODES[p.k]) press(p.k);
        else if (event === 'type' && (p.back || p.text)) type(p.back | 0, String(p.text || ''));
        else if (event === 'volume') level = volume(p.change);
        else if (event === 'home' || event === 'open') exitApp();
    }

    function connect() {
        ws = new WebSocket(SUPABASE.replace(/^http/, 'ws') + '/realtime/v1/websocket?vsn=1.0.0&apikey=' + KEY);
        ws.onopen = () => raw({ topic: TOPIC, event: 'phx_join', payload: { config: { broadcast: { self: false }, presence: { key: '' }, private: false } } });
        ws.onmessage = m => {
            const msg = JSON.parse(m.data);
            if (msg.event === 'phx_reply' && msg.topic === TOPIC && msg.payload.status === 'ok') {
                joined = true;
                sent = '';
            } else if (msg.event === 'broadcast') receive(msg.payload.event, msg.payload.payload || {});
        };
        ws.onclose = () => {
            ws = null;
            joined = false;
            setTimeout(connect, 3000);
        };
    }

    // The TV's volume, read every 5s rather than on every check below: those reads are
    // synchronous and take time from the video.
    let level = volume();
    setInterval(() => { if (!document.hidden) level = volume(); }, 5000);

    // Tells phones Movies is in front, so they address it; every 20s while it stays there.
    function publish() {
        const state = { app: 'movies', screen: 'movies', games: [], game: null, volume: level };
        const json = JSON.stringify(state);
        if (json === sent && Date.now() - sentAt < 20000) return;
        sent = json;
        sentAt = Date.now();
        send('state', state);
    }

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) return;
        shownAt = performance.now();
        sent = '';
    });
    connect();
    setInterval(publish, 500);
    setInterval(() => { if (ws && ws.readyState === 1) raw({ topic: 'phoenix', event: 'heartbeat', payload: {} }); }, 25000);
})();
