// Matter.js engine/world setup: walls, floor, danger line, body factory.
window.Orbit = window.Orbit || {};

(function () {
  'use strict';

  var WALL_THICKNESS = 24;
  var DANGER_LINE_RATIO = 0.15; // from the top of the play area

  function Physics() {
    this.engine = null;
    this.world = null;
    this.width = 0;
    this.height = 0;
    this.dangerLineY = 0;
    this.walls = [];
    this.bodies = []; // active dynamic planet bodies
  }

  Physics.prototype.init = function (width, height) {
    this.width = width;
    this.height = height;
    this.dangerLineY = height * DANGER_LINE_RATIO;

    this.engine = Matter.Engine.create();
    this.engine.gravity.y = 1;
    this.world = this.engine.world;
    this.bodies = [];

    var half = WALL_THICKNESS / 2;
    var floor = Matter.Bodies.rectangle(width / 2, height + half, width + WALL_THICKNESS * 2, WALL_THICKNESS, { isStatic: true, label: 'wall' });
    var left = Matter.Bodies.rectangle(-half, height / 2, WALL_THICKNESS, height * 2, { isStatic: true, label: 'wall' });
    var right = Matter.Bodies.rectangle(width + half, height / 2, WALL_THICKNESS, height * 2, { isStatic: true, label: 'wall' });
    this.walls = [floor, left, right];
    Matter.World.add(this.world, this.walls);
  };

  Physics.prototype.spawnPlanet = function (typeIndex, x, y, instanceId) {
    var type = Orbit.PLANET_TYPES[typeIndex];
    var body = Matter.Bodies.circle(x, y, type.displayRadius, {
      restitution: 0.2,
      friction: 0.4,
      frictionAir: 0.001,
      label: 'planet',
    });
    body.plugin = { instanceId: instanceId, typeIndex: typeIndex, pendingRemoval: false };
    Matter.World.add(this.world, body);
    this.bodies.push(body);
    return body;
  };

  Physics.prototype.removeBody = function (body) {
    Matter.World.remove(this.world, body);
    var idx = this.bodies.indexOf(body);
    if (idx !== -1) this.bodies.splice(idx, 1);
  };

  Physics.prototype.update = function (dt) {
    Matter.Engine.update(this.engine, dt);
  };

  Physics.prototype.destroy = function () {
    if (this.engine) {
      Matter.World.clear(this.world, false);
      Matter.Engine.clear(this.engine);
    }
    this.bodies = [];
  };

  Orbit.Physics = Physics;
})();
