// Planet data model + log-compressed size mapping
window.Orbit = window.Orbit || {};

(function () {
  'use strict';

  // Ascending real-diameter order == merge progression.
  // imgBox is the pixel rect of the actual drawn planet within its (padded,
  // transparent-margined) source PNG, precomputed offline from the alpha channel.
  // Hardcoded rather than detected at runtime via canvas getImageData, because
  // that call throws a security error on images loaded over file:// (canvas
  // tainting) -- exactly the way this prototype is meant to be opened.
  Orbit.PLANET_TYPES = [
    { id: 'mercury', order: 0, nameEn: 'Mercury', nameKo: '수성', realDiameterKm: 4879, color: '#dba35e', imagePath: 'assets/mercury.png', image: null, imgBox: { sx: 981, sy: 312, sw: 2005, sh: 2041 }, displayRadius: null },
    { id: 'mars', order: 1, nameEn: 'Mars', nameKo: '화성', realDiameterKm: 6779, color: '#cc5200', imagePath: 'assets/mars.png', image: null, imgBox: { sx: 231, sy: 237, sw: 2749, sh: 2720 }, displayRadius: null },
    { id: 'venus', order: 2, nameEn: 'Venus', nameKo: '금성', realDiameterKm: 12104, color: '#8d81a6', imagePath: 'assets/venus.png', image: null, imgBox: { sx: 1051, sy: 302, sw: 1903, sh: 1904 }, displayRadius: null },
    { id: 'earth', order: 3, nameEn: 'Earth', nameKo: '지구', realDiameterKm: 12742, color: '#19823a', imagePath: 'assets/earth.png', image: null, imgBox: { sx: 904, sy: 259, sw: 2224, sh: 2225 }, displayRadius: null },
    { id: 'neptune', order: 4, nameEn: 'Neptune', nameKo: '해왕성', realDiameterKm: 49244, color: '#1050e6', imagePath: 'assets/neptune.png', image: null, imgBox: { sx: 126, sy: 149, sw: 2523, sh: 2448 }, displayRadius: null },
    { id: 'uranus', order: 5, nameEn: 'Uranus', nameKo: '천왕성', realDiameterKm: 50724, color: '#8bd9d1', imagePath: 'assets/uranus.png', image: null, imgBox: { sx: 1062, sy: 195, sw: 2229, sh: 2230 }, displayRadius: null },
    { id: 'saturn', order: 6, nameEn: 'Saturn', nameKo: '토성', realDiameterKm: 116460, color: '#ebba75', imagePath: 'assets/saturn.png', image: null, imgBox: { sx: 274, sy: 274, sw: 3497, sh: 2031 }, displayRadius: null },
    { id: 'jupiter', order: 7, nameEn: 'Jupiter', nameKo: '목성', realDiameterKm: 139820, color: '#996925', imagePath: 'assets/jupiter.png', image: null, imgBox: { sx: 230, sy: 184, sw: 2392, sh: 2409 }, displayRadius: null },
  ];

  // Only Mercury..Neptune are ever player-dropped; bigger planets only appear via merges.
  Orbit.DROPPABLE_MAX_ORDER = 4;

  // Computed once per session from the current play-column width. Never recomputed
  // mid-session -- live physics bodies can't have their radii shift underfoot.
  Orbit.computeDisplayRadii = function (playColumnWidth) {
    var minR = clamp(playColumnWidth * 0.09, 22, 30);
    var maxR = clamp(playColumnWidth * 0.34, 100, 140);

    var mercury = Orbit.PLANET_TYPES[0];
    var jupiter = Orbit.PLANET_TYPES[Orbit.PLANET_TYPES.length - 1];
    var lnMin = Math.log(mercury.realDiameterKm);
    var lnMax = Math.log(jupiter.realDiameterKm);
    var b = (maxR - minR) / (lnMax - lnMin);
    var a = minR - b * lnMin;

    Orbit.PLANET_TYPES.forEach(function (type) {
      type.displayRadius = a + b * Math.log(type.realDiameterKm);
    });
  };

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  Orbit.randomDroppableType = function () {
    var idx = Math.floor(Math.random() * (Orbit.DROPPABLE_MAX_ORDER + 1));
    return Orbit.PLANET_TYPES[idx];
  };

  Orbit.nextTypeIndex = function (currentIndex) {
    return Math.min(currentIndex + 1, Orbit.PLANET_TYPES.length - 1);
  };
})();
