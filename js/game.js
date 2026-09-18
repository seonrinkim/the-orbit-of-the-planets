// State machine + main loop, orchestrates all modules.
window.Orbit = window.Orbit || {};

(function () {
  'use strict';

  var GRACE_MS = 1000;

  var els = {};
  var state = 'menu'; // 'menu' | 'playing' | 'ending' | 'results'
  var physics = null;
  var orbitTracker = null;
  var mergeSystem = null;
  var input = null;
  var dangerTimer = null;
  var lastFrameTime = 0;
  var rafId = null;

  function $(id) {
    return document.getElementById(id);
  }

  function showScreen(name) {
    ['menu', 'game', 'results'].forEach(function (n) {
      els['screen-' + n].classList.toggle('active', n === name);
    });
  }

  function loadPlanetImages(onDone) {
    var types = Orbit.PLANET_TYPES;
    var remaining = types.length;
    types.forEach(function (type) {
      var img = new Image();
      img.onload = function () {
        type.image = img;
        if (--remaining === 0) onDone();
      };
      img.onerror = function () {
        if (--remaining === 0) onDone();
      };
      img.src = type.imagePath;
    });
  }

  function startGame() {
    showScreen('game');

    var column = els.playColumn;
    var width = column.clientWidth;
    var height = column.clientHeight;

    Orbit.computeDisplayRadii(width);

    var dpr = window.devicePixelRatio || 1;
    els.gameCanvas.width = Math.round(width * dpr);
    els.gameCanvas.height = Math.round(height * dpr);
    var ctx = els.gameCanvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    physics = new Orbit.Physics();
    physics.init(width, height);

    orbitTracker = new Orbit.OrbitTracker();

    mergeSystem = new Orbit.MergeSystem(physics, orbitTracker);
    mergeSystem.attach();

    input = new Orbit.InputController(els.gameCanvas, width, height);
    input.onDrop = function (type, x, y) {
      var id = orbitTracker.createId();
      var body = physics.spawnPlanet(type.order, x, y, id);
      orbitTracker.createInstance(id, type.order, body.position.x, body.position.y, performance.now());
    };
    input.attach();

    dangerTimer = null;
    state = 'playing';
    lastFrameTime = performance.now();
    rafId = requestAnimationFrame(loop);
  }

  function loop(now) {
    var dt = Math.min(now - lastFrameTime, 33);
    lastFrameTime = now;

    if (state === 'playing') {
      physics.update(dt);
      mergeSystem.process(now);
      orbitTracker.sample(physics.bodies, now);
      checkGameOver(now);
    }

    renderGameFrame(now);

    if (state === 'playing' || state === 'ending') {
      rafId = requestAnimationFrame(loop);
    }
  }

  function renderGameFrame() {
    var ctx = els.gameCanvas.getContext('2d');
    var width = els.playColumn.clientWidth;
    var height = els.playColumn.clientHeight;

    Orbit.Drawing.drawPlayfieldFloor(ctx, width, height);
    Orbit.Drawing.drawDangerLine(ctx, width, physics.dangerLineY);
    Orbit.Drawing.drawBodies(ctx, physics.bodies);

    if (state === 'playing' && input) {
      Orbit.Drawing.drawPreview(ctx, input.preview, input.nextType);
    }
  }

  function checkGameOver(now) {
    var violating = physics.bodies.some(function (b) {
      var speed = Math.hypot(b.velocity.x, b.velocity.y);
      var type = Orbit.PLANET_TYPES[b.plugin.typeIndex];
      return speed < 0.4 && (b.position.y - type.displayRadius) < physics.dangerLineY;
    });

    if (violating) {
      if (dangerTimer === null) dangerTimer = now;
      if (now - dangerTimer > GRACE_MS) triggerGameOver();
    } else {
      dangerTimer = null;
    }
  }

  function triggerGameOver() {
    state = 'ending';
    if (input) input.enabled = false;

    var now = performance.now();
    orbitTracker.finalizeSurvivors(physics.bodies, now);

    var bloom = els.sunBloom;
    var anim = bloom.animate(
      [
        { opacity: 0, transform: 'scale(0.1)' },
        { opacity: 1, transform: 'scale(1.3)', offset: 0.4 },
        { opacity: 0, transform: 'scale(1.6)' },
      ],
      { duration: 2000, easing: 'ease-in-out' }
    );

    anim.finished.then(function () {
      state = 'results';
      showResults();
    }).catch(function () {
      state = 'results';
      showResults();
    });
  }

  function showResults() {
    showScreen('results');
    var instances = Array.from(orbitTracker.instances.values());
    Orbit.Drawing.renderResults(els.resultsCanvas, instances, physics.width, physics.height);
  }

  function resetGame() {
    if (rafId) cancelAnimationFrame(rafId);
    if (mergeSystem) mergeSystem.detach();
    if (input) input.detach();
    if (physics) physics.destroy();
    physics = null;
    orbitTracker = null;
    mergeSystem = null;
    input = null;
    dangerTimer = null;
    state = 'menu';
    showScreen('menu');
  }

  function init() {
    els['screen-menu'] = $('screen-menu');
    els['screen-game'] = $('screen-game');
    els['screen-results'] = $('screen-results');
    els.playColumn = document.querySelector('.play-column');
    els.gameCanvas = $('gameCanvas');
    els.resultsCanvas = $('resultsCanvas');
    els.sunBloom = $('sunBloom');
    els.startBtn = $('startBtn');
    els.downloadBtn = $('downloadBtn');
    els.playAgainBtn = $('playAgainBtn');

    els.startBtn.disabled = true;
    els.startBtn.textContent = 'Loading...';
    loadPlanetImages(function () {
      els.startBtn.disabled = false;
      els.startBtn.textContent = 'Start';
    });

    els.startBtn.addEventListener('click', startGame);
    els.downloadBtn.addEventListener('click', function () {
      Orbit.Drawing.downloadCanvasPNG(els.resultsCanvas, 'orbit-of-the-planets.png');
    });
    els.playAgainBtn.addEventListener('click', resetGame);

    var resizeTimeout = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(function () {
        if (state === 'playing' || state === 'ending') {
          resetGame();
        }
      }, 150);
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
