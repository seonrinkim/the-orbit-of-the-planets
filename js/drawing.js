// Canvas rendering: in-game frame draw, results spline+asterisk drawing, PNG export.
window.Orbit = window.Orbit || {};

(function () {
  'use strict';

  var Drawing = {};

  // ---- In-game frame ----------------------------------------------------------

  Drawing.drawPlayfieldFloor = function (ctx, width, height) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
  };

  Drawing.drawDangerLine = function (ctx, width, y) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
    ctx.restore();
  };

  // The source image's real content (per type.imgBox) is fit to `radius` by
  // HEIGHT, not forced into a square -- a ringed planet like Saturn is wider than
  // it is tall, so its rings are allowed to overhang the physics collision circle
  // rather than being squashed to fit inside it.
  Drawing.drawPlanetCircle = function (ctx, x, y, radius, type) {
    ctx.save();
    if (type.image && type.imgBox) {
      var box = type.imgBox;
      var diameter = radius * 2;
      var aspect = box.sw / box.sh;
      var dh = diameter;
      var dw = diameter * aspect;
      ctx.drawImage(type.image, box.sx, box.sy, box.sw, box.sh, x - dw / 2, y - dh / 2, dw, dh);
    } else {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.stroke();
    }
    ctx.restore();
  };

  Drawing.drawBodies = function (ctx, bodies) {
    for (var i = 0; i < bodies.length; i++) {
      var b = bodies[i];
      var type = Orbit.PLANET_TYPES[b.plugin.typeIndex];
      Drawing.drawPlanetCircle(ctx, b.position.x, b.position.y, type.displayRadius, type);
    }
  };

  Drawing.drawPreview = function (ctx, preview, type) {
    ctx.save();
    ctx.globalAlpha = 0.85;
    Drawing.drawPlanetCircle(ctx, preview.x, preview.y, preview.radius, type);
    ctx.restore();
  };

  // ---- Smooth-curve + asterisk drawing (shared by results renderer) ----------

  // Catmull-Rom -> cubic Bezier, tension 1/6.
  function strokeCatmullRom(ctx, points, color, lineWidth, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (var i = 0; i < points.length - 1; i++) {
      var p0 = points[Math.max(i - 1, 0)];
      var p1 = points[i];
      var p2 = points[i + 1];
      var p3 = points[Math.min(i + 2, points.length - 1)];
      var cp1x = p1.x + (p2.x - p0.x) / 6;
      var cp1y = p1.y + (p2.y - p0.y) / 6;
      var cp2x = p2.x - (p3.x - p1.x) / 6;
      var cp2y = p2.y - (p3.y - p1.y) / 6;
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function jitterPoints(points, amount) {
    return points.map(function (p) {
      return { x: p.x + (Math.random() - 0.5) * amount * 2, y: p.y + (Math.random() - 0.5) * amount * 2 };
    });
  }

  // Two lightly jittered, partially-transparent passes give the line a rough,
  // hand-drawn texture instead of a single crisp vector stroke.
  Drawing.drawSmoothPath = function (ctx, points, color, lineWidth) {
    if (points.length < 2) return;
    lineWidth = lineWidth || 1.5;
    strokeCatmullRom(ctx, jitterPoints(points, 0.6), color, lineWidth, 0.65);
    strokeCatmullRom(ctx, jitterPoints(points, 1.1), color, lineWidth * 0.7, 0.5);
  };

  // Spokes radiate outward only, from a small inner gap to the tip -- earlier
  // this offset the inner end BACKWARD past center, which left a small reversed
  // stub on every spoke; those stubs lined up into their own tiny asterisk,
  // making the mark look like two stars overlapping.
  // A random rotation offset per mark keeps a field of them from all lining up
  // at identical angles, which read as too rigid/mechanical.
  Drawing.drawAsterisk = function (ctx, center, diameter, spokes, color) {
    spokes = spokes || 8;
    color = color || 'rgba(255,255,255,0.9)';
    var r = diameter / 2;
    var innerR = r * 0.08;
    var rotation = Math.random() * Math.PI * 2;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    for (var i = 0; i < spokes; i++) {
      var angle = rotation + (i / spokes) * Math.PI * 2;
      var cos = Math.cos(angle);
      var sin = Math.sin(angle);
      var x1 = center.x + cos * innerR;
      var y1 = center.y + sin * innerR;
      var x2 = center.x + cos * r;
      var y2 = center.y + sin * r;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.restore();
  };

  // ---- Results screen ----------------------------------------------------------

  Drawing.renderResults = function (canvas, instances, worldWidth, worldHeight) {
    var dpr = window.devicePixelRatio || 1;
    var cssWidth = canvas.clientWidth;
    var cssHeight = canvas.clientHeight;
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    var scale = Math.min(cssWidth / worldWidth, cssHeight / worldHeight);
    var offsetX = (cssWidth - worldWidth * scale) / 2;
    var offsetY = (cssHeight - worldHeight * scale) / 2;

    function mapPoints(points) {
      return points.map(function (p) {
        return { x: p.x * scale + offsetX, y: p.y * scale + offsetY };
      });
    }

    instances.forEach(function (inst) {
      if (inst.points.length < 2) return;
      Drawing.drawSmoothPath(ctx, mapPoints(inst.points), inst.color, 1.5);
    });

    instances.forEach(function (inst) {
      if (inst.parentIds.length !== 2) return;
      var type = Orbit.PLANET_TYPES[inst.typeIndex];
      var center = { x: inst.bornPoint.x * scale + offsetX, y: inst.bornPoint.y * scale + offsetY };
      Drawing.drawAsterisk(ctx, center, type.displayRadius * 2 * scale);
    });
  };

  Drawing.downloadCanvasPNG = function (canvas, filename) {
    canvas.toBlob(function (blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename || 'orbit-of-the-planets.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  Orbit.Drawing = Drawing;
})();
