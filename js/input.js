// Pointer (mouse + touch) aim/drag/drop handling and next-planet preview.
window.Orbit = window.Orbit || {};

(function () {
  'use strict';

  var DROP_COOLDOWN_MS = 400;
  var SPAWN_Y_RATIO = 0.08; // from the top of the play area

  function InputController(canvas, worldWidth, worldHeight) {
    this.canvas = canvas;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.spawnY = worldHeight * SPAWN_Y_RATIO;
    this.enabled = true;
    this._cooldownUntil = 0;
    this.nextType = Orbit.randomDroppableType();
    this.preview = { x: worldWidth / 2, y: this.spawnY, radius: this.nextType.displayRadius, color: this.nextType.color };
    this.onDrop = null; // (type, x, y) => void

    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._dragging = false;
  }

  InputController.prototype.attach = function () {
    this.canvas.style.touchAction = 'none';
    this.canvas.addEventListener('pointerdown', this._onPointerDown);
    this.canvas.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('pointerup', this._onPointerUp);
    window.addEventListener('pointercancel', this._onPointerUp);
  };

  InputController.prototype.detach = function () {
    this.canvas.removeEventListener('pointerdown', this._onPointerDown);
    this.canvas.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerup', this._onPointerUp);
    window.removeEventListener('pointercancel', this._onPointerUp);
  };

  InputController.prototype._toWorldX = function (clientX) {
    var rect = this.canvas.getBoundingClientRect();
    var scale = this.worldWidth / rect.width;
    return (clientX - rect.left) * scale;
  };

  InputController.prototype._clampPreviewX = function (x) {
    var r = this.preview.radius;
    return Math.max(r, Math.min(this.worldWidth - r, x));
  };

  InputController.prototype._onPointerDown = function (e) {
    if (!this.enabled) return;
    this._dragging = true;
    this.preview.x = this._clampPreviewX(this._toWorldX(e.clientX));
  };

  InputController.prototype._onPointerMove = function (e) {
    if (!this.enabled || !this._dragging) return;
    this.preview.x = this._clampPreviewX(this._toWorldX(e.clientX));
  };

  InputController.prototype._onPointerUp = function (e) {
    if (!this._dragging) return;
    this._dragging = false;
    if (!this.enabled) return;
    var now = performance.now();
    if (now < this._cooldownUntil) return;
    this._cooldownUntil = now + DROP_COOLDOWN_MS;

    var type = this.nextType;
    var x = this.preview.x;
    var y = this.spawnY;
    if (typeof this.onDrop === 'function') this.onDrop(type, x, y);

    this.nextType = Orbit.randomDroppableType();
    this.preview = { x: this._clampPreviewX(x), y: this.spawnY, radius: this.nextType.displayRadius, color: this.nextType.color };
  };

  Orbit.InputController = InputController;
})();
