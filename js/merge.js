// Collision detection + merge algorithm.
window.Orbit = window.Orbit || {};

(function () {
  'use strict';

  function MergeSystem(physics, orbitTracker) {
    this.physics = physics;
    this.orbitTracker = orbitTracker;
    this.pending = [];
    this._onCollisionStart = this._onCollisionStart.bind(this);
  }

  MergeSystem.prototype.attach = function () {
    Matter.Events.on(this.physics.engine, 'collisionStart', this._onCollisionStart);
  };

  MergeSystem.prototype.detach = function () {
    Matter.Events.off(this.physics.engine, 'collisionStart', this._onCollisionStart);
  };

  MergeSystem.prototype._onCollisionStart = function (event) {
    var pairs = event.pairs;
    for (var i = 0; i < pairs.length; i++) {
      var bodyA = pairs[i].bodyA;
      var bodyB = pairs[i].bodyB;

      // Any contact -- with the floor/walls or another planet -- ends a
      // planet's untracked free-fall and starts its orbit recording.
      this._markLandedIfNeeded(bodyA);
      this._markLandedIfNeeded(bodyB);

      var a = bodyA.plugin;
      var b = bodyB.plugin;
      if (!a || !b || !a.instanceId || !b.instanceId) continue;
      if (a.pendingRemoval || b.pendingRemoval) continue;
      if (a.typeIndex !== b.typeIndex) continue;
      a.pendingRemoval = true;
      b.pendingRemoval = true;
      this.pending.push({ bodyA: bodyA, bodyB: bodyB });
    }
  };

  MergeSystem.prototype._markLandedIfNeeded = function (body) {
    var plugin = body.plugin;
    if (!plugin || !plugin.instanceId) return;
    this.orbitTracker.markLanded(plugin.instanceId, body.position.x, body.position.y, performance.now());
  };

  // Must be called AFTER Engine.update, never from inside the collision callback --
  // mutating the world mid-physics-step is not safe in Matter.js.
  MergeSystem.prototype.process = function (now, onMerge) {
    if (this.pending.length === 0) return;
    var batch = this.pending;
    this.pending = [];

    for (var i = 0; i < batch.length; i++) {
      var bodyA = batch[i].bodyA;
      var bodyB = batch[i].bodyB;
      var mid = {
        x: (bodyA.position.x + bodyB.position.x) / 2,
        y: (bodyA.position.y + bodyB.position.y) / 2,
      };
      var curIdx = bodyA.plugin.typeIndex;
      // Jupiter+Jupiter clamps to itself: collapses into a single new Jupiter, no
      // special-case branch needed.
      var newIdx = Orbit.nextTypeIndex(curIdx);

      this.physics.removeBody(bodyA);
      this.physics.removeBody(bodyB);

      var newId = this.orbitTracker.createId();
      var newBody = this.physics.spawnPlanet(newIdx, mid.x, mid.y, newId);
      this.orbitTracker.recordMerge(bodyA.plugin.instanceId, bodyB.plugin.instanceId, newId, newIdx, mid, now);

      if (typeof onMerge === 'function') onMerge(newIdx, mid);
    }
  };

  Orbit.MergeSystem = MergeSystem;
})();
