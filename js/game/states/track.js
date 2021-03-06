let trackPositions = [
  { 'name': 'a1', 'x': 1423, 'y': 432, 'angle': 90, 'moves': ['wall', 'a2', 'b2', 'b1', 'a30', 'wall'] },
  { 'name': 'a2', 'x': 1293, 'y': 432, 'angle': 90, 'moves': ['wall', 'a3', 'b3', 'b2', 'a1', 'wall'] },
  { 'name': 'a3', 'x': 1186, 'y': 432, 'angle': 90, 'moves': ['x1', 'a4', 'b4', 'b3', 'a2', 'wall'] },
  { 'name': 'a4', 'x': 1071, 'y': 432, 'angle': 90, 'moves': ['x2', 'a5', 'b5', 'b4', 'a3', 'x1'] },
  { 'name': 'a5', 'x': 956, 'y': 432, 'angle': 90, 'moves': ['x3', 'a6', 'b6', 'b5', 'a4', 'x2'] },
  { 'name': 'a6', 'x': 835, 'y': 432, 'angle': 90, 'moves': ['x4', 'a7', 'b7', 'b6', 'a5', 'x3'] },
  { 'name': 'a7', 'x': 728, 'y': 432, 'angle': 90, 'moves': ['wall', 'a8', 'b8', 'b7', 'a6', 'x4'] },
  { 'name': 'a8', 'x': 618, 'y': 432, 'angle': 90, 'moves': ['wall', 'a9', 'b9', 'b8', 'a7', 'wall'] },
  { 'name': 'a9', 'x': 503, 'y': 432, 'angle': 90, 'moves': ['wall', 'a10', 'b10', 'b9', 'a8', 'wall'] },
  { 'name': 'a10', 'x': 388, 'y': 432, 'angle': 90, 'moves': ['wall', 'a11', 'b11', 'b10', 'a9', 'wall'] },
  { 'name': 'a11', 'x': 271, 'y': 432, 'angle': 75, 'moves': ['a12', 'b13', 'b12', 'b11', 'a10', 'wall'] },
  { 'name': 'a12', 'x': 181, 'y': 490, 'angle': 20, 'moves': ['wall', 'a13', 'b14', 'b13', 'a11', 'wall'], 'speed': 3 },
  { 'name': 'a13', 'x': 181, 'y': 592, 'angle': -37, 'moves': ['wall', 'a14', 'b16', 'b15', 'a12', 'wall'], 'speed': 3 },
  { 'name': 'a14', 'x': 288, 'y': 654, 'angle': -90, 'moves': ['wall', 'a15', 'b18', 'b17', 'a13', 'wall'] },
  { 'name': 'a15', 'x': 388, 'y': 654, 'angle': -90, 'moves': ['wall', 'a16', 'b19', 'b18', 'a14', 'wall'] },
  { 'name': 'a16', 'x': 506, 'y': 654, 'angle': -90, 'moves': ['wall', 'a17', 'b20', 'b19', 'a15', 'wall'] },
  { 'name': 'a17', 'x': 611, 'y': 654, 'angle': -90, 'moves': ['wall', 'a18', 'b21', 'b20', 'a16', 'wall'] },
  { 'name': 'a18', 'x': 733, 'y': 647, 'angle': -90, 'moves': ['x11', 'a19', 'b22', 'b21', 'a17', 'wall'] },
  { 'name': 'a19', 'x': 845, 'y': 647, 'angle': -90, 'moves': ['x10', 'a20', 'b23', 'b22', 'a18', 'x11'] },
  { 'name': 'a20', 'x': 958, 'y': 647, 'angle': -90, 'moves': ['x9', 'a21', 'b24', 'b23', 'a19', 'x10'] },
  { 'name': 'a21', 'x': 1076, 'y': 647, 'angle': -90, 'moves': ['x8', 'a22', 'b25', 'b24', 'a20', 'x9'] },
  { 'name': 'a22', 'x': 1188, 'y': 647, 'angle': -90, 'moves': ['wall', 'a23', 'b26', 'b25', 'a21', 'x8'] },
  { 'name': 'a23', 'x': 1305, 'y': 649, 'angle': -90, 'moves': ['wall', 'a24', 'b27', 'b26', 'a22', 'wall'] },
  { 'name': 'a24', 'x': 1415, 'y': 649, 'angle': -90, 'moves': ['wall', 'a25', 'b28', 'b27', 'a23', 'wall'] },
  { 'name': 'a25', 'x': 1523, 'y': 649, 'angle': -90, 'moves': ['wall', 'a26', 'b29', 'b28', 'a24', 'wall'] },
  { 'name': 'a26', 'x': 1645, 'y': 649, 'angle': -99, 'moves': ['a27', 'b31', 'b30', 'b29', 'a25', 'wall'] },
  { 'name': 'a27', 'x': 1745, 'y': 579, 'angle': -155, 'moves': ['wall', 'a28', 'b32', 'b31', 'a26', 'wall'], 'speed': 3 },
  { 'name': 'a28', 'x': 1740, 'y': 485, 'angle': 143, 'moves': ['wall', 'a29', 'b34', 'b33', 'a27', 'wall'], 'speed': 3 },
  { 'name': 'a29', 'x': 1638, 'y': 430, 'angle': 90, 'moves': ['wall', 'a30', 'b36', 'b35', 'a28', 'wall'] },
  { 'name': 'a30', 'x': 1525, 'y': 430, 'angle': 90, 'moves': ['wall', 'a1', 'b1', 'b36', 'a29', 'wall'] },

  { 'name': 'b1', 'x': 1471, 'y': 384, 'angle': 90, 'moves': ['a1', 'b2', 'c1', 'c40', 'b36', 'a30'] },
  { 'name': 'b2', 'x': 1353, 'y': 384, 'angle': 90, 'moves': ['a2', 'b3', 'c2', 'c1', 'b1', 'a1'] },
  { 'name': 'b3', 'x': 1241, 'y': 384, 'angle': 90, 'moves': ['a3', 'b4', 'c3', 'c2', 'b2', 'a2'] },
  { 'name': 'b4', 'x': 1128, 'y': 384, 'angle': 90, 'moves': ['a4', 'b5', 'c4', 'c3', 'b3', 'a3'] },
  { 'name': 'b5', 'x': 1015, 'y': 384, 'angle': 90, 'moves': ['a5', 'b6', 'c5', 'c4', 'b4', 'a4'] },
  { 'name': 'b6', 'x': 895, 'y': 384, 'angle': 90, 'moves': ['a6', 'b7', 'c6', 'c5', 'b5', 'a5'] },
  { 'name': 'b7', 'x': 783, 'y': 384, 'angle': 90, 'moves': ['a7', 'b8', 'c7', 'c6', 'b6', 'a6'] },
  { 'name': 'b8', 'x': 671, 'y': 384, 'angle': 90, 'moves': ['a8', 'b9', 'c8', 'c7', 'b7', 'a7'] },
  { 'name': 'b9', 'x': 555, 'y': 384, 'angle': 90, 'moves': ['a9', 'b10', 'c9', 'c8', 'b8', 'a8'] },
  { 'name': 'b10', 'x': 446, 'y': 384, 'angle': 90, 'moves': ['a10', 'b11', 'c10', 'c9', 'b9', 'a9'] },
  { 'name': 'b11', 'x': 335, 'y': 384, 'angle': 90, 'moves': ['a11', 'b12', 'c11', 'c10', 'b10', 'a10'] },
  { 'name': 'b12', 'x': 231, 'y': 390, 'angle': 68, 'moves': ['a11', 'b13', 'c12', 'c11', 'b11', 'a11'], 'speed': 6 },
  { 'name': 'b13', 'x': 163, 'y': 432, 'angle': 39, 'moves': ['a12', 'b14', 'c14', 'c12', 'b12', 'a11'], 'speed': 5 },
  { 'name': 'b14', 'x': 125, 'y': 500, 'angle': 12, 'moves': ['a12', 'b15', 'c15', 'c14', 'b13', 'a12'], 'speed': 4 },
  { 'name': 'b15', 'x': 125, 'y': 575, 'angle': -19, 'moves': ['a13', 'b16', 'c16', 'c15', 'b14', 'a13'], 'speed': 4 },
  { 'name': 'b16', 'x': 165, 'y': 647, 'angle': -46, 'moves': ['a14', 'b17', 'c18', 'c16', 'b15', 'a13'], 'speed': 5 },
  { 'name': 'b17', 'x': 238, 'y': 690, 'angle': -69, 'moves': ['a14', 'b18', 'c19', 'c18', 'b16', 'a14'], 'speed': 6 },
  { 'name': 'b18', 'x': 336, 'y': 694, 'angle': -90, 'moves': ['a15', 'b19', 'c20', 'c19', 'b17', 'a14'] },
  { 'name': 'b19', 'x': 448, 'y': 694, 'angle': -90, 'moves': ['a16', 'b20', 'c21', 'c20', 'b18', 'a15'] },
  { 'name': 'b20', 'x': 558, 'y': 694, 'angle': -90, 'moves': ['a17', 'b21', 'c22', 'c21', 'b19', 'a16'] },
  { 'name': 'b21', 'x': 671, 'y': 694, 'angle': -90, 'moves': ['a18', 'b22', 'c23', 'c22', 'b20', 'a17'] },
  { 'name': 'b22', 'x': 785, 'y': 694, 'angle': -90, 'moves': ['a19', 'b23', 'c24', 'c23', 'b21', 'a18'] },
  { 'name': 'b23', 'x': 905, 'y': 694, 'angle': -90, 'moves': ['a20', 'b24', 'c25', 'c24', 'b22', 'a19'] },
  { 'name': 'b24', 'x': 1016, 'y': 694, 'angle': -90, 'moves': ['a21', 'b25', 'c26', 'c25', 'b23', 'a20'] },
  { 'name': 'b25', 'x': 1133, 'y': 694, 'angle': -90, 'moves': ['a22', 'b26', 'c27', 'c26', 'b24', 'a21'] },
  { 'name': 'b26', 'x': 1245, 'y': 694, 'angle': -90, 'moves': ['a23', 'b27', 'c28', 'c27', 'b25', 'a22'] },
  { 'name': 'b27', 'x': 1360, 'y': 694, 'angle': -90, 'moves': ['a24', 'b28', 'c29', 'c28', 'b26', 'a23'] },
  { 'name': 'b28', 'x': 1470, 'y': 694, 'angle': -90, 'moves': ['a25', 'b29', 'c30', 'c29', 'b27', 'a24'] },
  { 'name': 'b29', 'x': 1586, 'y': 694, 'angle': -90, 'moves': ['a26', 'b30', 'c31', 'c30', 'b28', 'a25'] },
  { 'name': 'b30', 'x': 1681, 'y': 692, 'angle': -109, 'moves': ['a26', 'b31', 'c32', 'c31', 'b29', 'a26'], 'speed': 6 },
  { 'name': 'b31', 'x': 1756, 'y': 647, 'angle': -136, 'moves': ['a27', 'b32', 'c34', 'c32', 'b30', 'a26'], 'speed': 5 },
  { 'name': 'b32', 'x': 1795, 'y': 575, 'angle': -160, 'moves': ['a27', 'b33', 'c35', 'c34', 'b31', 'a27'], 'speed': 4 },
  { 'name': 'b33', 'x': 1795, 'y': 504, 'angle': 165, 'moves': ['a28', 'b34', 'c36', 'c35', 'b32', 'a28'], 'speed': 4 },
  { 'name': 'b34', 'x': 1758, 'y': 432, 'angle': 139, 'moves': ['a29', 'b35', 'c38', 'c36', 'b33', 'a28'], 'speed': 5 },
  { 'name': 'b35', 'x': 1680, 'y': 389, 'angle': 105, 'moves': ['a29', 'b36', 'c39', 'c38', 'b34', 'a29'], 'speed': 6 },
  { 'name': 'b36', 'x': 1580, 'y': 385, 'angle': 90, 'moves': ['a30', 'b1', 'c40', 'c39', 'b35', 'a29'] },

  { 'name': 'c1', 'x': 1423, 'y': 339, 'angle': 90, 'moves': ['b2', 'c2', 'd2', 'd1', 'c40', 'b1'] },
  { 'name': 'c2', 'x': 1296, 'y': 339, 'angle': 90, 'moves': ['b3', 'c3', 'd3', 'd2', 'c1', 'b2'] },
  { 'name': 'c3', 'x': 1181, 'y': 339, 'angle': 90, 'moves': ['b4', 'c4', 'd4', 'd3', 'c2', 'b3'] },
  { 'name': 'c4', 'x': 1065, 'y': 339, 'angle': 90, 'moves': ['b5', 'c5', 'd5', 'd4', 'c3', 'b4'] },
  { 'name': 'c5', 'x': 955, 'y': 339, 'angle': 90, 'moves': ['b6', 'c6', 'd6', 'd5', 'c4', 'b5'] },
  { 'name': 'c6', 'x': 838, 'y': 339, 'angle': 90, 'moves': ['b7', 'c7', 'd7', 'd6', 'c5', 'b6'] },
  { 'name': 'c7', 'x': 731, 'y': 339, 'angle': 90, 'moves': ['b8', 'c8', 'd8', 'd7', 'c6', 'b7'] },
  { 'name': 'c8', 'x': 615, 'y': 339, 'angle': 90, 'moves': ['b9', 'c9', 'd9', 'd8', 'c7', 'b8'] },
  { 'name': 'c9', 'x': 501, 'y': 339, 'angle': 90, 'moves': ['b10', 'c10', 'd10', 'd9', 'c8', 'b9'] },
  { 'name': 'c10', 'x': 393, 'y': 339, 'angle': 90, 'moves': ['b11', 'c11', 'd11', 'd10', 'c9', 'b10'] },
  { 'name': 'c11', 'x': 288, 'y': 339, 'angle': 86, 'moves': ['b12', 'c12', 'd12', 'd11', 'c10', 'b11'] },
  { 'name': 'c12', 'x': 203, 'y': 354, 'angle': 58, 'moves': ['b13', 'c13', 'd14', 'd13', 'c11', 'b12'], 'speed': 7 },
  { 'name': 'c13', 'x': 135, 'y': 394, 'angle': 38, 'moves': ['b13', 'c14', 'd15', 'd14', 'c12', 'b13'], 'speed': 6 },
  { 'name': 'c14', 'x': 91, 'y': 457, 'angle': 22, 'moves': ['b14', 'c15', 'd16', 'd15', 'c13', 'b13'], 'speed': 6 },
  { 'name': 'c15', 'x': 73, 'y': 544, 'angle': -3, 'moves': ['b15', 'c16', 'd17', 'd16', 'c14', 'b14'], 'speed': 5 },
  { 'name': 'c16', 'x': 93, 'y': 622, 'angle': -25, 'moves': ['b16', 'c17', 'd18', 'd17', 'c15', 'b15'], 'speed': 6 },
  { 'name': 'c17', 'x': 131, 'y': 682, 'angle': -47, 'moves': ['b16', 'c18', 'd19', 'd18', 'c16', 'b16'], 'speed': 6 },
  { 'name': 'c18', 'x': 198, 'y': 727, 'angle': -60, 'moves': ['b17', 'c19', 'd21', 'd19', 'c17', 'b16'], 'speed': 7 },
  { 'name': 'c19', 'x': 291, 'y': 740, 'angle': -90, 'moves': ['b18', 'c20', 'd22', 'd21', 'c18', 'b17'] },
  { 'name': 'c20', 'x': 393, 'y': 740, 'angle': -90, 'moves': ['b19', 'c21', 'd23', 'd22', 'c19', 'b18'] },
  { 'name': 'c21', 'x': 505, 'y': 740, 'angle': -90, 'moves': ['b20', 'c22', 'd24', 'd23', 'c20', 'b19'] },
  { 'name': 'c22', 'x': 616, 'y': 740, 'angle': -90, 'moves': ['b21', 'c23', 'd25', 'd24', 'c21', 'b20'] },
  { 'name': 'c23', 'x': 733, 'y': 740, 'angle': -90, 'moves': ['b22', 'c24', 'd26', 'd25', 'c22', 'b21'] },
  { 'name': 'c24', 'x': 851, 'y': 740, 'angle': -90, 'moves': ['b23', 'c25', 'd27', 'd26', 'c23', 'b22'] },
  { 'name': 'c25', 'x': 965, 'y': 740, 'angle': -90, 'moves': ['b24', 'c26', 'd28', 'd27', 'c24', 'b23'] },
  { 'name': 'c26', 'x': 1080, 'y': 740, 'angle': -90, 'moves': ['b25', 'c27', 'd29', 'd28', 'c25', 'b24'] },
  { 'name': 'c27', 'x': 1186, 'y': 740, 'angle': -90, 'moves': ['b26', 'c28', 'd30', 'd29', 'c26', 'b25'] },
  { 'name': 'c28', 'x': 1303, 'y': 740, 'angle': -90, 'moves': ['b27', 'c29', 'd31', 'd30', 'c27', 'b26'] },
  { 'name': 'c29', 'x': 1416, 'y': 740, 'angle': -90, 'moves': ['b28', 'c30', 'd32', 'd31', 'c28', 'b27'] },
  { 'name': 'c30', 'x': 1526, 'y': 740, 'angle': -90, 'moves': ['b29', 'c31', 'd33', 'd32', 'c29', 'b28'] },
  { 'name': 'c31', 'x': 1630, 'y': 740, 'angle': -94, 'moves': ['b30', 'c32', 'd34', 'd33', 'c30', 'b29'] },
  { 'name': 'c32', 'x': 1723, 'y': 725, 'angle': -113, 'moves': ['b31', 'c33', 'd36', 'd35', 'c31', 'b30'], 'speed': 7 },
  { 'name': 'c33', 'x': 1783, 'y': 684, 'angle': -133, 'moves': ['b31', 'c34', 'd37', 'd36', 'c32', 'b31'], 'speed': 6 },
  { 'name': 'c34', 'x': 1828, 'y': 622, 'angle': -155, 'moves': ['b32', 'c35', 'd38', 'd37', 'c33', 'b31'], 'speed': 6 },
  { 'name': 'c35', 'x': 1848, 'y': 535, 'angle': -179, 'moves': ['b33', 'c36', 'd39', 'd38', 'c34', 'b32'], 'speed': 5 },
  { 'name': 'c36', 'x': 1828, 'y': 454, 'angle': 149, 'moves': ['b34', 'c37', 'd40', 'd39', 'c35', 'b33'], 'speed': 6 },
  { 'name': 'c37', 'x': 1785, 'y': 394, 'angle': 140, 'moves': ['b34', 'c38', 'd41', 'd40', 'c36', 'b34'], 'speed': 6 },
  { 'name': 'c38', 'x': 1713, 'y': 352, 'angle': 108, 'moves': ['b35', 'c39', 'd43', 'd41', 'c37', 'b34'], 'speed': 7 },
  { 'name': 'c39', 'x': 1630, 'y': 340, 'angle': 90, 'moves': ['b36', 'c40', 'd44', 'd43', 'c38', 'b35'] },
  { 'name': 'c40', 'x': 1526, 'y': 340, 'angle': 90, 'moves': ['b1', 'c1', 'd1', 'd44', 'c39', 'b36'] },

  { 'name': 'd1', 'x': 1470, 'y': 294, 'angle': 90, 'moves': ['c1', 'd2', 'wall', 'wall', 'd44', 'c40'] },
  { 'name': 'd2', 'x': 1351, 'y': 294, 'angle': 90, 'moves': ['c2', 'd3', 'wall', 'wall', 'd1', 'c1'] },
  { 'name': 'd3', 'x': 1240, 'y': 294, 'angle': 90, 'moves': ['c3', 'd4', 'wall', 'wall', 'd2', 'c2'] },
  { 'name': 'd4', 'x': 1123, 'y': 294, 'angle': 90, 'moves': ['c4', 'd5', 'wall', 'wall', 'd3', 'c3'] },
  { 'name': 'd5', 'x': 1006, 'y': 294, 'angle': 90, 'moves': ['c5', 'd6', 'wall', 'wall', 'd4', 'c4'] },
  { 'name': 'd6', 'x': 901, 'y': 294, 'angle': 90, 'moves': ['c6', 'd7', 'wall', 'wall', 'd5', 'c5'] },
  { 'name': 'd7', 'x': 776, 'y': 294, 'angle': 90, 'moves': ['c7', 'd8', 'wall', 'wall', 'd6', 'c6'] },
  { 'name': 'd8', 'x': 671, 'y': 294, 'angle': 90, 'moves': ['c8', 'd9', 'wall', 'wall', 'd7', 'c7'] },
  { 'name': 'd9', 'x': 556, 'y': 294, 'angle': 90, 'moves': ['c9', 'd10', 'wall', 'wall', 'd8', 'c8'] },
  { 'name': 'd10', 'x': 443, 'y': 294, 'angle': 90, 'moves': ['c10', 'd11', 'wall', 'wall', 'd9', 'c9'] },
  { 'name': 'd11', 'x': 326, 'y': 294, 'angle': 90, 'moves': ['c11', 'd12', 'wall', 'wall', 'd10', 'c10'] },
  { 'name': 'd12', 'x': 245, 'y': 294, 'angle': 75, 'moves': ['c12', 'd13', 'wall', 'wall', 'd11', 'c11'] },
  { 'name': 'd13', 'x': 181, 'y': 312, 'angle': 57, 'moves': ['c12', 'd14', 'wall', 'wall', 'd12', 'c12'], 'speed': 7 },
  { 'name': 'd14', 'x': 113, 'y': 349, 'angle': 43, 'moves': ['c13', 'd15', 'wall', 'wall', 'd13', 'c12'], 'speed': 7 },
  { 'name': 'd15', 'x': 60, 'y': 419, 'angle': 23, 'moves': ['c14', 'd16', 'wall', 'wall', 'd14', 'c13'], 'speed': 7 },
  { 'name': 'd16', 'x': 30, 'y': 500, 'angle': 7, 'moves': ['c15', 'd17', 'wall', 'wall', 'd15', 'c14'], 'speed': 7 },
  { 'name': 'd17', 'x': 30, 'y': 579, 'angle': -8, 'moves': ['c16', 'd18', 'wall', 'wall', 'd16', 'c15'], 'speed': 7 },
  { 'name': 'd18', 'x': 60, 'y': 665, 'angle': -32, 'moves': ['c17', 'd19', 'wall', 'wall', 'd17', 'c16'], 'speed': 7 },
  { 'name': 'd19', 'x': 111, 'y': 725, 'angle': -48, 'moves': ['c18', 'd20', 'wall', 'wall', 'd18', 'c17'], 'speed': 7 },
  { 'name': 'd20', 'x': 176, 'y': 767, 'angle': -62, 'moves': ['c18', 'd21', 'wall', 'wall', 'd19', 'c18'], 'speed': 7 },
  { 'name': 'd21', 'x': 243, 'y': 785, 'angle': -78, 'moves': ['c19', 'd22', 'wall', 'wall', 'd20', 'c18'] },
  { 'name': 'd22', 'x': 338, 'y': 787, 'angle': -90, 'moves': ['c20', 'd23', 'wall', 'wall', 'd21', 'c19'] },
  { 'name': 'd23', 'x': 451, 'y': 787, 'angle': -90, 'moves': ['c21', 'd24', 'wall', 'wall', 'd22', 'c20'] },
  { 'name': 'd24', 'x': 565, 'y': 787, 'angle': -90, 'moves': ['c22', 'd25', 'wall', 'wall', 'd23', 'c21'] },
  { 'name': 'd25', 'x': 678, 'y': 787, 'angle': -90, 'moves': ['c23', 'd26', 'wall', 'wall', 'd24', 'c22'] },
  { 'name': 'd26', 'x': 793, 'y': 787, 'angle': -90, 'moves': ['c24', 'd27', 'wall', 'wall', 'd25', 'c23'] },
  { 'name': 'd27', 'x': 901, 'y': 787, 'angle': -90, 'moves': ['c25', 'd28', 'wall', 'wall', 'd26', 'c24'] },
  { 'name': 'd28', 'x': 1021, 'y': 787, 'angle': -90, 'moves': ['c26', 'd29', 'wall', 'wall', 'd27', 'c25'] },
  { 'name': 'd29', 'x': 1138, 'y': 787, 'angle': -90, 'moves': ['c27', 'd30', 'wall', 'wall', 'd28', 'c26'] },
  { 'name': 'd30', 'x': 1248, 'y': 787, 'angle': -90, 'moves': ['c28', 'd31', 'wall', 'wall', 'd29', 'c27'] },
  { 'name': 'd31', 'x': 1358, 'y': 787, 'angle': -90, 'moves': ['c29', 'd32', 'wall', 'wall', 'd30', 'c28'] },
  { 'name': 'd32', 'x': 1471, 'y': 787, 'angle': -90, 'moves': ['c30', 'd33', 'wall', 'wall', 'd31', 'c29'] },
  { 'name': 'd33', 'x': 1583, 'y': 787, 'angle': -90, 'moves': ['c31', 'd34', 'wall', 'wall', 'd32', 'c30'] },
  { 'name': 'd34', 'x': 1673, 'y': 785, 'angle': -101, 'moves': ['c32', 'd35', 'wall', 'wall', 'd33', 'c31'] },
  { 'name': 'd35', 'x': 1740, 'y': 769, 'angle': -114, 'moves': ['c32', 'd36', 'wall', 'wall', 'd34', 'c32'], 'speed': 7 },
  { 'name': 'd36', 'x': 1808, 'y': 729, 'angle': -130, 'moves': ['c33', 'd37', 'wall', 'wall', 'd35', 'c32'], 'speed': 7 },
  { 'name': 'd37', 'x': 1861, 'y': 662, 'angle': -145, 'moves': ['c34', 'd38', 'wall', 'wall', 'd36', 'c33'], 'speed': 7 },
  { 'name': 'd38', 'x': 1890, 'y': 579, 'angle': -178, 'moves': ['c35', 'd39', 'wall', 'wall', 'd37', 'c34'], 'speed': 7 },
  { 'name': 'd39', 'x': 1890, 'y': 497, 'angle': 169, 'moves': ['c36', 'd40', 'wall', 'wall', 'd38', 'c35'], 'speed': 7 },
  { 'name': 'd40', 'x': 1858, 'y': 415, 'angle': 146, 'moves': ['c37', 'd41', 'wall', 'wall', 'd39', 'c36'], 'speed': 7 },
  { 'name': 'd41', 'x': 1803, 'y': 345, 'angle': 130, 'moves': ['c38', 'd42', 'wall', 'wall', 'd40', 'c37'], 'speed': 7 },
  { 'name': 'd42', 'x': 1740, 'y': 312, 'angle': 115, 'moves': ['c38', 'd43', 'wall', 'wall', 'd41', 'c38'], 'speed': 7 },
  { 'name': 'd43', 'x': 1676, 'y': 292, 'angle': 97, 'moves': ['c39', 'd44', 'wall', 'wall', 'd42', 'c38'] },
  { 'name': 'd44', 'x': 1580, 'y': 292, 'angle': 90, 'moves': ['c40', 'd1', 'wall', 'wall', 'd43', 'c39'] },

  { 'name': 'x1', 'x': 1123, 'y': 482, 'angle': 90, 'moves': ['x5', 'x2', 'a4', 'a3', 'wall', 'wall'] },
  { 'name': 'x2', 'x': 1015, 'y': 482, 'angle': 90, 'moves': ['x6', 'x3', 'a5', 'a4', 'x1', 'x5'] },
  { 'name': 'x3', 'x': 898, 'y': 482, 'angle': 90, 'moves': ['x7', 'x4', 'a6', 'a5', 'x2', 'x6'] },
  { 'name': 'x4', 'x': 788, 'y': 482, 'angle': 90, 'moves': ['wall', 'wall', 'a7', 'a6', 'x3', 'x7'] },
  { 'name': 'x5', 'x': 1075, 'y': 537, 'angle': 90, 'moves': ['x9', 'x6', 'x2', 'x1', 'x4', 'x8'] },
  { 'name': 'x6', 'x': 960, 'y': 537, 'angle': 90, 'moves': ['x10', 'x7', 'x3', 'x2', 'x5', 'x9'] },
  { 'name': 'x7', 'x': 846, 'y': 537, 'angle': 90, 'moves': ['x11', 'wall', 'x4', 'x3', 'x6', 'x10'] },
  { 'name': 'x8', 'x': 1131, 'y': 594, 'angle': -90, 'moves': ['wall', 'wall', 'a22', 'a21', 'x9', 'x5'] },
  { 'name': 'x9', 'x': 1018, 'y': 594, 'angle': -90, 'moves': ['x5', 'x8', 'a21', 'a20', 'x10', 'x6'] },
  { 'name': 'x10', 'x': 900, 'y': 594, 'angle': -90, 'moves': ['x6', 'x9', 'a20', 'a19', 'x11', 'x7'] },
  { 'name': 'x11', 'x': 786, 'y': 594, 'angle': -90, 'moves': ['x7', 'x10', 'a19', 'a18', 'wall', 'wall'] }]

module.exports = trackPositions
