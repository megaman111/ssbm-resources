// Background video: only stream the 15 MB menu loop on wide screens, without
// reduced-motion or data-saver. Everyone else sees the still poster frame.
(function () {
    var v = document.getElementById('video-background');
    if (!v) return;
    var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var narrow = window.innerWidth < 900;
    var saveData = navigator.connection && navigator.connection.saveData;
    if (reduced || narrow || saveData) return;
    var p = v.play();
    if (p && p.catch) p.catch(function () {});
})();
