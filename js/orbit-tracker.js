// Per-instance trajectory recording + merge/branch bookkeeping.
window.Orbit = window.Orbit || {};

(function () {
  'use strict';

  var SAMPLE_INTERVAL_MS = 100;
  var EPSILON_PX = 1.5;

  function OrbitTracker() {
    this.instances = new Map();
    this._nextId = 1;
    this._lastSampleAt = 0;
  }

  OrbitTracker.prototype.reset = function () {
    this.instances.clear();
    this._nextId = 1;
    this._lastSampleAt = 0;
  };

  OrbitTracker.prototype.createId = function () {
    return this._nextId++;
  };

  OrbitTracker.prototype.createInstance = function (id, typeIndex, x, y, now) {
    var type = Orbit.PLANET_TYPES[typeIndex];
    var inst = {
      id: id,
      typeIndex: typeIndex,
      color: type.color,
      points: [{ x: x, y: y, t: now }],
      parentIds: [],
      bornAt: now,
      bornPoint: { x: x, y: y },
      diedAt: null,
      deathPoint: null,
      deathReason: null,
    };
    this.instances.set(id, inst);
    return inst;
  };

  // Called once per main-loop tick (not every physics substep).
  OrbitTracker.prototype.sample = function (activeBodies, now) {
    if (now - this._lastSampleAt < SAMPLE_INTERVAL_MS) return;
    this._lastSampleAt = now;

    for (var i = 0; i < activeBodies.length; i++) {
      var body = activeBodies[i];
      var inst = this.instances.get(body.plugin.instanceId);
      if (!inst || inst.diedAt !== null) continue;
      var last = inst.points[inst.points.length - 1];
      var dx = body.position.x - last.x;
      var dy = body.position.y - last.y;
      if (Math.hypot(dx, dy) > EPSILON_PX) {
        inst.points.push({ x: body.position.x, y: body.position.y, t: now });
      }
    }
  };

  // Both parents terminate exactly at `mid`; the child begins there too, producing
  // a visual branch point with no explicit tree-walk needed at render time.
  OrbitTracker.prototype.recordMerge = function (idA, idB, newId, newTypeIndex, mid, now) {
    var a = this.instances.get(idA);
    var b = this.instances.get(idB);
    [a, b].forEach(function (inst) {
      if (!inst) return;
      inst.points.push({ x: mid.x, y: mid.y, t: now });
      inst.diedAt = now;
      inst.deathPoint = { x: mid.x, y: mid.y };
      inst.deathReason = 'merged';
    });

    var type = Orbit.PLANET_TYPES[newTypeIndex];
    var child = {
      id: newId,
      typeIndex: newTypeIndex,
      color: type.color,
      points: [{ x: mid.x, y: mid.y, t: now }],
      parentIds: [idA, idB],
      bornAt: now,
      bornPoint: { x: mid.x, y: mid.y },
      diedAt: null,
      deathPoint: null,
      deathReason: null,
    };
    this.instances.set(newId, child);
    return child;
  };

  OrbitTracker.prototype.finalizeSurvivors = function (activeBodies, now) {
    var self = this;
    activeBodies.forEach(function (body) {
      var inst = self.instances.get(body.plugin.instanceId);
      if (!inst || inst.diedAt !== null) return;
      inst.points.push({ x: body.position.x, y: body.position.y, t: now });
      inst.diedAt = now;
      inst.deathPoint = { x: body.position.x, y: body.position.y };
      inst.deathReason = 'survived';
    });
  };

  Orbit.OrbitTracker = OrbitTracker;
})();
