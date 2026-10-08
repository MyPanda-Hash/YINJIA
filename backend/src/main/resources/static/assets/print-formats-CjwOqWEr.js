import { a4 as getDefaultExportFromCjs } from './element-plus-W84rT0en.js';
import { s as sumKeepScale } from './sumTotals-C3PClexH.js';

function _mergeNamespaces(n, m) {
  for (var i = 0; i < m.length; i++) {
    const e = m[i];
    if (typeof e !== 'string' && !Array.isArray(e)) { for (const k in e) {
      if (k !== 'default' && !(k in n)) {
        const d = Object.getOwnPropertyDescriptor(e, k);
        if (d) {
          Object.defineProperty(n, k, d.get ? d : {
            enumerable: true,
            get: () => e[k]
          });
        }
      }
    } }
  }
  return Object.freeze(Object.defineProperty(n, Symbol.toStringTag, { value: 'Module' }));
}

var browser = {};

var canPromise;
var hasRequiredCanPromise;

function requireCanPromise () {
	if (hasRequiredCanPromise) return canPromise;
	hasRequiredCanPromise = 1;
	// can-promise has a crash in some versions of react native that dont have
	// standard global objects
	// https://github.com/soldair/node-qrcode/issues/157

	canPromise = function () {
	  return typeof Promise === 'function' && Promise.prototype && Promise.prototype.then
	};
	return canPromise;
}

var qrcode = {};

var utils$1 = {};

var hasRequiredUtils$1;

function requireUtils$1 () {
	if (hasRequiredUtils$1) return utils$1;
	hasRequiredUtils$1 = 1;
	let toSJISFunction;
	const CODEWORDS_COUNT = [
	  0, // Not used
	  26, 44, 70, 100, 134, 172, 196, 242, 292, 346,
	  404, 466, 532, 581, 655, 733, 815, 901, 991, 1085,
	  1156, 1258, 1364, 1474, 1588, 1706, 1828, 1921, 2051, 2185,
	  2323, 2465, 2611, 2761, 2876, 3034, 3196, 3362, 3532, 3706
	];

	/**
	 * Returns the QR Code size for the specified version
	 *
	 * @param  {Number} version QR Code version
	 * @return {Number}         size of QR code
	 */
	utils$1.getSymbolSize = function getSymbolSize (version) {
	  if (!version) throw new Error('"version" cannot be null or undefined')
	  if (version < 1 || version > 40) throw new Error('"version" should be in range from 1 to 40')
	  return version * 4 + 17
	};

	/**
	 * Returns the total number of codewords used to store data and EC information.
	 *
	 * @param  {Number} version QR Code version
	 * @return {Number}         Data length in bits
	 */
	utils$1.getSymbolTotalCodewords = function getSymbolTotalCodewords (version) {
	  return CODEWORDS_COUNT[version]
	};

	/**
	 * Encode data with Bose-Chaudhuri-Hocquenghem
	 *
	 * @param  {Number} data Value to encode
	 * @return {Number}      Encoded value
	 */
	utils$1.getBCHDigit = function (data) {
	  let digit = 0;

	  while (data !== 0) {
	    digit++;
	    data >>>= 1;
	  }

	  return digit
	};

	utils$1.setToSJISFunction = function setToSJISFunction (f) {
	  if (typeof f !== 'function') {
	    throw new Error('"toSJISFunc" is not a valid function.')
	  }

	  toSJISFunction = f;
	};

	utils$1.isKanjiModeEnabled = function () {
	  return typeof toSJISFunction !== 'undefined'
	};

	utils$1.toSJIS = function toSJIS (kanji) {
	  return toSJISFunction(kanji)
	};
	return utils$1;
}

var errorCorrectionLevel = {};

var hasRequiredErrorCorrectionLevel;

function requireErrorCorrectionLevel () {
	if (hasRequiredErrorCorrectionLevel) return errorCorrectionLevel;
	hasRequiredErrorCorrectionLevel = 1;
	(function (exports) {
		exports.L = { bit: 1 };
		exports.M = { bit: 0 };
		exports.Q = { bit: 3 };
		exports.H = { bit: 2 };

		function fromString (string) {
		  if (typeof string !== 'string') {
		    throw new Error('Param is not a string')
		  }

		  const lcStr = string.toLowerCase();

		  switch (lcStr) {
		    case 'l':
		    case 'low':
		      return exports.L

		    case 'm':
		    case 'medium':
		      return exports.M

		    case 'q':
		    case 'quartile':
		      return exports.Q

		    case 'h':
		    case 'high':
		      return exports.H

		    default:
		      throw new Error('Unknown EC Level: ' + string)
		  }
		}

		exports.isValid = function isValid (level) {
		  return level && typeof level.bit !== 'undefined' &&
		    level.bit >= 0 && level.bit < 4
		};

		exports.from = function from (value, defaultValue) {
		  if (exports.isValid(value)) {
		    return value
		  }

		  try {
		    return fromString(value)
		  } catch (e) {
		    return defaultValue
		  }
		}; 
	} (errorCorrectionLevel));
	return errorCorrectionLevel;
}

var bitBuffer;
var hasRequiredBitBuffer;

function requireBitBuffer () {
	if (hasRequiredBitBuffer) return bitBuffer;
	hasRequiredBitBuffer = 1;
	function BitBuffer () {
	  this.buffer = [];
	  this.length = 0;
	}

	BitBuffer.prototype = {

	  get: function (index) {
	    const bufIndex = Math.floor(index / 8);
	    return ((this.buffer[bufIndex] >>> (7 - index % 8)) & 1) === 1
	  },

	  put: function (num, length) {
	    for (let i = 0; i < length; i++) {
	      this.putBit(((num >>> (length - i - 1)) & 1) === 1);
	    }
	  },

	  getLengthInBits: function () {
	    return this.length
	  },

	  putBit: function (bit) {
	    const bufIndex = Math.floor(this.length / 8);
	    if (this.buffer.length <= bufIndex) {
	      this.buffer.push(0);
	    }

	    if (bit) {
	      this.buffer[bufIndex] |= (0x80 >>> (this.length % 8));
	    }

	    this.length++;
	  }
	};

	bitBuffer = BitBuffer;
	return bitBuffer;
}

/**
 * Helper class to handle QR Code symbol modules
 *
 * @param {Number} size Symbol size
 */

var bitMatrix;
var hasRequiredBitMatrix;

function requireBitMatrix () {
	if (hasRequiredBitMatrix) return bitMatrix;
	hasRequiredBitMatrix = 1;
	function BitMatrix (size) {
	  if (!size || size < 1) {
	    throw new Error('BitMatrix size must be defined and greater than 0')
	  }

	  this.size = size;
	  this.data = new Uint8Array(size * size);
	  this.reservedBit = new Uint8Array(size * size);
	}

	/**
	 * Set bit value at specified location
	 * If reserved flag is set, this bit will be ignored during masking process
	 *
	 * @param {Number}  row
	 * @param {Number}  col
	 * @param {Boolean} value
	 * @param {Boolean} reserved
	 */
	BitMatrix.prototype.set = function (row, col, value, reserved) {
	  const index = row * this.size + col;
	  this.data[index] = value;
	  if (reserved) this.reservedBit[index] = true;
	};

	/**
	 * Returns bit value at specified location
	 *
	 * @param  {Number}  row
	 * @param  {Number}  col
	 * @return {Boolean}
	 */
	BitMatrix.prototype.get = function (row, col) {
	  return this.data[row * this.size + col]
	};

	/**
	 * Applies xor operator at specified location
	 * (used during masking process)
	 *
	 * @param {Number}  row
	 * @param {Number}  col
	 * @param {Boolean} value
	 */
	BitMatrix.prototype.xor = function (row, col, value) {
	  this.data[row * this.size + col] ^= value;
	};

	/**
	 * Check if bit at specified location is reserved
	 *
	 * @param {Number}   row
	 * @param {Number}   col
	 * @return {Boolean}
	 */
	BitMatrix.prototype.isReserved = function (row, col) {
	  return this.reservedBit[row * this.size + col]
	};

	bitMatrix = BitMatrix;
	return bitMatrix;
}

var alignmentPattern = {};

/**
 * Alignment pattern are fixed reference pattern in defined positions
 * in a matrix symbology, which enables the decode software to re-synchronise
 * the coordinate mapping of the image modules in the event of moderate amounts
 * of distortion of the image.
 *
 * Alignment patterns are present only in QR Code symbols of version 2 or larger
 * and their number depends on the symbol version.
 */

var hasRequiredAlignmentPattern;

function requireAlignmentPattern () {
	if (hasRequiredAlignmentPattern) return alignmentPattern;
	hasRequiredAlignmentPattern = 1;
	(function (exports) {
		const getSymbolSize = requireUtils$1().getSymbolSize;

		/**
		 * Calculate the row/column coordinates of the center module of each alignment pattern
		 * for the specified QR Code version.
		 *
		 * The alignment patterns are positioned symmetrically on either side of the diagonal
		 * running from the top left corner of the symbol to the bottom right corner.
		 *
		 * Since positions are simmetrical only half of the coordinates are returned.
		 * Each item of the array will represent in turn the x and y coordinate.
		 * @see {@link getPositions}
		 *
		 * @param  {Number} version QR Code version
		 * @return {Array}          Array of coordinate
		 */
		exports.getRowColCoords = function getRowColCoords (version) {
		  if (version === 1) return []

		  const posCount = Math.floor(version / 7) + 2;
		  const size = getSymbolSize(version);
		  const intervals = size === 145 ? 26 : Math.ceil((size - 13) / (2 * posCount - 2)) * 2;
		  const positions = [size - 7]; // Last coord is always (size - 7)

		  for (let i = 1; i < posCount - 1; i++) {
		    positions[i] = positions[i - 1] - intervals;
		  }

		  positions.push(6); // First coord is always 6

		  return positions.reverse()
		};

		/**
		 * Returns an array containing the positions of each alignment pattern.
		 * Each array's element represent the center point of the pattern as (x, y) coordinates
		 *
		 * Coordinates are calculated expanding the row/column coordinates returned by {@link getRowColCoords}
		 * and filtering out the items that overlaps with finder pattern
		 *
		 * @example
		 * For a Version 7 symbol {@link getRowColCoords} returns values 6, 22 and 38.
		 * The alignment patterns, therefore, are to be centered on (row, column)
		 * positions (6,22), (22,6), (22,22), (22,38), (38,22), (38,38).
		 * Note that the coordinates (6,6), (6,38), (38,6) are occupied by finder patterns
		 * and are not therefore used for alignment patterns.
		 *
		 * let pos = getPositions(7)
		 * // [[6,22], [22,6], [22,22], [22,38], [38,22], [38,38]]
		 *
		 * @param  {Number} version QR Code version
		 * @return {Array}          Array of coordinates
		 */
		exports.getPositions = function getPositions (version) {
		  const coords = [];
		  const pos = exports.getRowColCoords(version);
		  const posLength = pos.length;

		  for (let i = 0; i < posLength; i++) {
		    for (let j = 0; j < posLength; j++) {
		      // Skip if position is occupied by finder patterns
		      if ((i === 0 && j === 0) || // top-left
		          (i === 0 && j === posLength - 1) || // bottom-left
		          (i === posLength - 1 && j === 0)) { // top-right
		        continue
		      }

		      coords.push([pos[i], pos[j]]);
		    }
		  }

		  return coords
		}; 
	} (alignmentPattern));
	return alignmentPattern;
}

var finderPattern = {};

var hasRequiredFinderPattern;

function requireFinderPattern () {
	if (hasRequiredFinderPattern) return finderPattern;
	hasRequiredFinderPattern = 1;
	const getSymbolSize = requireUtils$1().getSymbolSize;
	const FINDER_PATTERN_SIZE = 7;

	/**
	 * Returns an array containing the positions of each finder pattern.
	 * Each array's element represent the top-left point of the pattern as (x, y) coordinates
	 *
	 * @param  {Number} version QR Code version
	 * @return {Array}          Array of coordinates
	 */
	finderPattern.getPositions = function getPositions (version) {
	  const size = getSymbolSize(version);

	  return [
	    // top-left
	    [0, 0],
	    // top-right
	    [size - FINDER_PATTERN_SIZE, 0],
	    // bottom-left
	    [0, size - FINDER_PATTERN_SIZE]
	  ]
	};
	return finderPattern;
}

var maskPattern = {};

/**
 * Data mask pattern reference
 * @type {Object}
 */

var hasRequiredMaskPattern;

function requireMaskPattern () {
	if (hasRequiredMaskPattern) return maskPattern;
	hasRequiredMaskPattern = 1;
	(function (exports) {
		exports.Patterns = {
		  PATTERN000: 0,
		  PATTERN001: 1,
		  PATTERN010: 2,
		  PATTERN011: 3,
		  PATTERN100: 4,
		  PATTERN101: 5,
		  PATTERN110: 6,
		  PATTERN111: 7
		};

		/**
		 * Weighted penalty scores for the undesirable features
		 * @type {Object}
		 */
		const PenaltyScores = {
		  N1: 3,
		  N2: 3,
		  N3: 40,
		  N4: 10
		};

		/**
		 * Check if mask pattern value is valid
		 *
		 * @param  {Number}  mask    Mask pattern
		 * @return {Boolean}         true if valid, false otherwise
		 */
		exports.isValid = function isValid (mask) {
		  return mask != null && mask !== '' && !isNaN(mask) && mask >= 0 && mask <= 7
		};

		/**
		 * Returns mask pattern from a value.
		 * If value is not valid, returns undefined
		 *
		 * @param  {Number|String} value        Mask pattern value
		 * @return {Number}                     Valid mask pattern or undefined
		 */
		exports.from = function from (value) {
		  return exports.isValid(value) ? parseInt(value, 10) : undefined
		};

		/**
		* Find adjacent modules in row/column with the same color
		* and assign a penalty value.
		*
		* Points: N1 + i
		* i is the amount by which the number of adjacent modules of the same color exceeds 5
		*/
		exports.getPenaltyN1 = function getPenaltyN1 (data) {
		  const size = data.size;
		  let points = 0;
		  let sameCountCol = 0;
		  let sameCountRow = 0;
		  let lastCol = null;
		  let lastRow = null;

		  for (let row = 0; row < size; row++) {
		    sameCountCol = sameCountRow = 0;
		    lastCol = lastRow = null;

		    for (let col = 0; col < size; col++) {
		      let module = data.get(row, col);
		      if (module === lastCol) {
		        sameCountCol++;
		      } else {
		        if (sameCountCol >= 5) points += PenaltyScores.N1 + (sameCountCol - 5);
		        lastCol = module;
		        sameCountCol = 1;
		      }

		      module = data.get(col, row);
		      if (module === lastRow) {
		        sameCountRow++;
		      } else {
		        if (sameCountRow >= 5) points += PenaltyScores.N1 + (sameCountRow - 5);
		        lastRow = module;
		        sameCountRow = 1;
		      }
		    }

		    if (sameCountCol >= 5) points += PenaltyScores.N1 + (sameCountCol - 5);
		    if (sameCountRow >= 5) points += PenaltyScores.N1 + (sameCountRow - 5);
		  }

		  return points
		};

		/**
		 * Find 2x2 blocks with the same color and assign a penalty value
		 *
		 * Points: N2 * (m - 1) * (n - 1)
		 */
		exports.getPenaltyN2 = function getPenaltyN2 (data) {
		  const size = data.size;
		  let points = 0;

		  for (let row = 0; row < size - 1; row++) {
		    for (let col = 0; col < size - 1; col++) {
		      const last = data.get(row, col) +
		        data.get(row, col + 1) +
		        data.get(row + 1, col) +
		        data.get(row + 1, col + 1);

		      if (last === 4 || last === 0) points++;
		    }
		  }

		  return points * PenaltyScores.N2
		};

		/**
		 * Find 1:1:3:1:1 ratio (dark:light:dark:light:dark) pattern in row/column,
		 * preceded or followed by light area 4 modules wide
		 *
		 * Points: N3 * number of pattern found
		 */
		exports.getPenaltyN3 = function getPenaltyN3 (data) {
		  const size = data.size;
		  let points = 0;
		  let bitsCol = 0;
		  let bitsRow = 0;

		  for (let row = 0; row < size; row++) {
		    bitsCol = bitsRow = 0;
		    for (let col = 0; col < size; col++) {
		      bitsCol = ((bitsCol << 1) & 0x7FF) | data.get(row, col);
		      if (col >= 10 && (bitsCol === 0x5D0 || bitsCol === 0x05D)) points++;

		      bitsRow = ((bitsRow << 1) & 0x7FF) | data.get(col, row);
		      if (col >= 10 && (bitsRow === 0x5D0 || bitsRow === 0x05D)) points++;
		    }
		  }

		  return points * PenaltyScores.N3
		};

		/**
		 * Calculate proportion of dark modules in entire symbol
		 *
		 * Points: N4 * k
		 *
		 * k is the rating of the deviation of the proportion of dark modules
		 * in the symbol from 50% in steps of 5%
		 */
		exports.getPenaltyN4 = function getPenaltyN4 (data) {
		  let darkCount = 0;
		  const modulesCount = data.data.length;

		  for (let i = 0; i < modulesCount; i++) darkCount += data.data[i];

		  const k = Math.abs(Math.ceil((darkCount * 100 / modulesCount) / 5) - 10);

		  return k * PenaltyScores.N4
		};

		/**
		 * Return mask value at given position
		 *
		 * @param  {Number} maskPattern Pattern reference value
		 * @param  {Number} i           Row
		 * @param  {Number} j           Column
		 * @return {Boolean}            Mask value
		 */
		function getMaskAt (maskPattern, i, j) {
		  switch (maskPattern) {
		    case exports.Patterns.PATTERN000: return (i + j) % 2 === 0
		    case exports.Patterns.PATTERN001: return i % 2 === 0
		    case exports.Patterns.PATTERN010: return j % 3 === 0
		    case exports.Patterns.PATTERN011: return (i + j) % 3 === 0
		    case exports.Patterns.PATTERN100: return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0
		    case exports.Patterns.PATTERN101: return (i * j) % 2 + (i * j) % 3 === 0
		    case exports.Patterns.PATTERN110: return ((i * j) % 2 + (i * j) % 3) % 2 === 0
		    case exports.Patterns.PATTERN111: return ((i * j) % 3 + (i + j) % 2) % 2 === 0

		    default: throw new Error('bad maskPattern:' + maskPattern)
		  }
		}

		/**
		 * Apply a mask pattern to a BitMatrix
		 *
		 * @param  {Number}    pattern Pattern reference number
		 * @param  {BitMatrix} data    BitMatrix data
		 */
		exports.applyMask = function applyMask (pattern, data) {
		  const size = data.size;

		  for (let col = 0; col < size; col++) {
		    for (let row = 0; row < size; row++) {
		      if (data.isReserved(row, col)) continue
		      data.xor(row, col, getMaskAt(pattern, row, col));
		    }
		  }
		};

		/**
		 * Returns the best mask pattern for data
		 *
		 * @param  {BitMatrix} data
		 * @return {Number} Mask pattern reference number
		 */
		exports.getBestMask = function getBestMask (data, setupFormatFunc) {
		  const numPatterns = Object.keys(exports.Patterns).length;
		  let bestPattern = 0;
		  let lowerPenalty = Infinity;

		  for (let p = 0; p < numPatterns; p++) {
		    setupFormatFunc(p);
		    exports.applyMask(p, data);

		    // Calculate penalty
		    const penalty =
		      exports.getPenaltyN1(data) +
		      exports.getPenaltyN2(data) +
		      exports.getPenaltyN3(data) +
		      exports.getPenaltyN4(data);

		    // Undo previously applied mask
		    exports.applyMask(p, data);

		    if (penalty < lowerPenalty) {
		      lowerPenalty = penalty;
		      bestPattern = p;
		    }
		  }

		  return bestPattern
		}; 
	} (maskPattern));
	return maskPattern;
}

var errorCorrectionCode = {};

var hasRequiredErrorCorrectionCode;

function requireErrorCorrectionCode () {
	if (hasRequiredErrorCorrectionCode) return errorCorrectionCode;
	hasRequiredErrorCorrectionCode = 1;
	const ECLevel = requireErrorCorrectionLevel();

	const EC_BLOCKS_TABLE = [
	// L  M  Q  H
	  1, 1, 1, 1,
	  1, 1, 1, 1,
	  1, 1, 2, 2,
	  1, 2, 2, 4,
	  1, 2, 4, 4,
	  2, 4, 4, 4,
	  2, 4, 6, 5,
	  2, 4, 6, 6,
	  2, 5, 8, 8,
	  4, 5, 8, 8,
	  4, 5, 8, 11,
	  4, 8, 10, 11,
	  4, 9, 12, 16,
	  4, 9, 16, 16,
	  6, 10, 12, 18,
	  6, 10, 17, 16,
	  6, 11, 16, 19,
	  6, 13, 18, 21,
	  7, 14, 21, 25,
	  8, 16, 20, 25,
	  8, 17, 23, 25,
	  9, 17, 23, 34,
	  9, 18, 25, 30,
	  10, 20, 27, 32,
	  12, 21, 29, 35,
	  12, 23, 34, 37,
	  12, 25, 34, 40,
	  13, 26, 35, 42,
	  14, 28, 38, 45,
	  15, 29, 40, 48,
	  16, 31, 43, 51,
	  17, 33, 45, 54,
	  18, 35, 48, 57,
	  19, 37, 51, 60,
	  19, 38, 53, 63,
	  20, 40, 56, 66,
	  21, 43, 59, 70,
	  22, 45, 62, 74,
	  24, 47, 65, 77,
	  25, 49, 68, 81
	];

	const EC_CODEWORDS_TABLE = [
	// L  M  Q  H
	  7, 10, 13, 17,
	  10, 16, 22, 28,
	  15, 26, 36, 44,
	  20, 36, 52, 64,
	  26, 48, 72, 88,
	  36, 64, 96, 112,
	  40, 72, 108, 130,
	  48, 88, 132, 156,
	  60, 110, 160, 192,
	  72, 130, 192, 224,
	  80, 150, 224, 264,
	  96, 176, 260, 308,
	  104, 198, 288, 352,
	  120, 216, 320, 384,
	  132, 240, 360, 432,
	  144, 280, 408, 480,
	  168, 308, 448, 532,
	  180, 338, 504, 588,
	  196, 364, 546, 650,
	  224, 416, 600, 700,
	  224, 442, 644, 750,
	  252, 476, 690, 816,
	  270, 504, 750, 900,
	  300, 560, 810, 960,
	  312, 588, 870, 1050,
	  336, 644, 952, 1110,
	  360, 700, 1020, 1200,
	  390, 728, 1050, 1260,
	  420, 784, 1140, 1350,
	  450, 812, 1200, 1440,
	  480, 868, 1290, 1530,
	  510, 924, 1350, 1620,
	  540, 980, 1440, 1710,
	  570, 1036, 1530, 1800,
	  570, 1064, 1590, 1890,
	  600, 1120, 1680, 1980,
	  630, 1204, 1770, 2100,
	  660, 1260, 1860, 2220,
	  720, 1316, 1950, 2310,
	  750, 1372, 2040, 2430
	];

	/**
	 * Returns the number of error correction block that the QR Code should contain
	 * for the specified version and error correction level.
	 *
	 * @param  {Number} version              QR Code version
	 * @param  {Number} errorCorrectionLevel Error correction level
	 * @return {Number}                      Number of error correction blocks
	 */
	errorCorrectionCode.getBlocksCount = function getBlocksCount (version, errorCorrectionLevel) {
	  switch (errorCorrectionLevel) {
	    case ECLevel.L:
	      return EC_BLOCKS_TABLE[(version - 1) * 4 + 0]
	    case ECLevel.M:
	      return EC_BLOCKS_TABLE[(version - 1) * 4 + 1]
	    case ECLevel.Q:
	      return EC_BLOCKS_TABLE[(version - 1) * 4 + 2]
	    case ECLevel.H:
	      return EC_BLOCKS_TABLE[(version - 1) * 4 + 3]
	    default:
	      return undefined
	  }
	};

	/**
	 * Returns the number of error correction codewords to use for the specified
	 * version and error correction level.
	 *
	 * @param  {Number} version              QR Code version
	 * @param  {Number} errorCorrectionLevel Error correction level
	 * @return {Number}                      Number of error correction codewords
	 */
	errorCorrectionCode.getTotalCodewordsCount = function getTotalCodewordsCount (version, errorCorrectionLevel) {
	  switch (errorCorrectionLevel) {
	    case ECLevel.L:
	      return EC_CODEWORDS_TABLE[(version - 1) * 4 + 0]
	    case ECLevel.M:
	      return EC_CODEWORDS_TABLE[(version - 1) * 4 + 1]
	    case ECLevel.Q:
	      return EC_CODEWORDS_TABLE[(version - 1) * 4 + 2]
	    case ECLevel.H:
	      return EC_CODEWORDS_TABLE[(version - 1) * 4 + 3]
	    default:
	      return undefined
	  }
	};
	return errorCorrectionCode;
}

var polynomial = {};

var galoisField = {};

var hasRequiredGaloisField;

function requireGaloisField () {
	if (hasRequiredGaloisField) return galoisField;
	hasRequiredGaloisField = 1;
	const EXP_TABLE = new Uint8Array(512);
	const LOG_TABLE = new Uint8Array(256)
	/**
	 * Precompute the log and anti-log tables for faster computation later
	 *
	 * For each possible value in the galois field 2^8, we will pre-compute
	 * the logarithm and anti-logarithm (exponential) of this value
	 *
	 * ref {@link https://en.wikiversity.org/wiki/Reed%E2%80%93Solomon_codes_for_coders#Introduction_to_mathematical_fields}
	 */
	;(function initTables () {
	  let x = 1;
	  for (let i = 0; i < 255; i++) {
	    EXP_TABLE[i] = x;
	    LOG_TABLE[x] = i;

	    x <<= 1; // multiply by 2

	    // The QR code specification says to use byte-wise modulo 100011101 arithmetic.
	    // This means that when a number is 256 or larger, it should be XORed with 0x11D.
	    if (x & 0x100) { // similar to x >= 256, but a lot faster (because 0x100 == 256)
	      x ^= 0x11D;
	    }
	  }

	  // Optimization: double the size of the anti-log table so that we don't need to mod 255 to
	  // stay inside the bounds (because we will mainly use this table for the multiplication of
	  // two GF numbers, no more).
	  // @see {@link mul}
	  for (let i = 255; i < 512; i++) {
	    EXP_TABLE[i] = EXP_TABLE[i - 255];
	  }
	}());

	/**
	 * Returns log value of n inside Galois Field
	 *
	 * @param  {Number} n
	 * @return {Number}
	 */
	galoisField.log = function log (n) {
	  if (n < 1) throw new Error('log(' + n + ')')
	  return LOG_TABLE[n]
	};

	/**
	 * Returns anti-log value of n inside Galois Field
	 *
	 * @param  {Number} n
	 * @return {Number}
	 */
	galoisField.exp = function exp (n) {
	  return EXP_TABLE[n]
	};

	/**
	 * Multiplies two number inside Galois Field
	 *
	 * @param  {Number} x
	 * @param  {Number} y
	 * @return {Number}
	 */
	galoisField.mul = function mul (x, y) {
	  if (x === 0 || y === 0) return 0

	  // should be EXP_TABLE[(LOG_TABLE[x] + LOG_TABLE[y]) % 255] if EXP_TABLE wasn't oversized
	  // @see {@link initTables}
	  return EXP_TABLE[LOG_TABLE[x] + LOG_TABLE[y]]
	};
	return galoisField;
}

var hasRequiredPolynomial;

function requirePolynomial () {
	if (hasRequiredPolynomial) return polynomial;
	hasRequiredPolynomial = 1;
	(function (exports) {
		const GF = requireGaloisField();

		/**
		 * Multiplies two polynomials inside Galois Field
		 *
		 * @param  {Uint8Array} p1 Polynomial
		 * @param  {Uint8Array} p2 Polynomial
		 * @return {Uint8Array}    Product of p1 and p2
		 */
		exports.mul = function mul (p1, p2) {
		  const coeff = new Uint8Array(p1.length + p2.length - 1);

		  for (let i = 0; i < p1.length; i++) {
		    for (let j = 0; j < p2.length; j++) {
		      coeff[i + j] ^= GF.mul(p1[i], p2[j]);
		    }
		  }

		  return coeff
		};

		/**
		 * Calculate the remainder of polynomials division
		 *
		 * @param  {Uint8Array} divident Polynomial
		 * @param  {Uint8Array} divisor  Polynomial
		 * @return {Uint8Array}          Remainder
		 */
		exports.mod = function mod (divident, divisor) {
		  let result = new Uint8Array(divident);

		  while ((result.length - divisor.length) >= 0) {
		    const coeff = result[0];

		    for (let i = 0; i < divisor.length; i++) {
		      result[i] ^= GF.mul(divisor[i], coeff);
		    }

		    // remove all zeros from buffer head
		    let offset = 0;
		    while (offset < result.length && result[offset] === 0) offset++;
		    result = result.slice(offset);
		  }

		  return result
		};

		/**
		 * Generate an irreducible generator polynomial of specified degree
		 * (used by Reed-Solomon encoder)
		 *
		 * @param  {Number} degree Degree of the generator polynomial
		 * @return {Uint8Array}    Buffer containing polynomial coefficients
		 */
		exports.generateECPolynomial = function generateECPolynomial (degree) {
		  let poly = new Uint8Array([1]);
		  for (let i = 0; i < degree; i++) {
		    poly = exports.mul(poly, new Uint8Array([1, GF.exp(i)]));
		  }

		  return poly
		}; 
	} (polynomial));
	return polynomial;
}

var reedSolomonEncoder;
var hasRequiredReedSolomonEncoder;

function requireReedSolomonEncoder () {
	if (hasRequiredReedSolomonEncoder) return reedSolomonEncoder;
	hasRequiredReedSolomonEncoder = 1;
	const Polynomial = requirePolynomial();

	function ReedSolomonEncoder (degree) {
	  this.genPoly = undefined;
	  this.degree = degree;

	  if (this.degree) this.initialize(this.degree);
	}

	/**
	 * Initialize the encoder.
	 * The input param should correspond to the number of error correction codewords.
	 *
	 * @param  {Number} degree
	 */
	ReedSolomonEncoder.prototype.initialize = function initialize (degree) {
	  // create an irreducible generator polynomial
	  this.degree = degree;
	  this.genPoly = Polynomial.generateECPolynomial(this.degree);
	};

	/**
	 * Encodes a chunk of data
	 *
	 * @param  {Uint8Array} data Buffer containing input data
	 * @return {Uint8Array}      Buffer containing encoded data
	 */
	ReedSolomonEncoder.prototype.encode = function encode (data) {
	  if (!this.genPoly) {
	    throw new Error('Encoder not initialized')
	  }

	  // Calculate EC for this data block
	  // extends data size to data+genPoly size
	  const paddedData = new Uint8Array(data.length + this.degree);
	  paddedData.set(data);

	  // The error correction codewords are the remainder after dividing the data codewords
	  // by a generator polynomial
	  const remainder = Polynomial.mod(paddedData, this.genPoly);

	  // return EC data blocks (last n byte, where n is the degree of genPoly)
	  // If coefficients number in remainder are less than genPoly degree,
	  // pad with 0s to the left to reach the needed number of coefficients
	  const start = this.degree - remainder.length;
	  if (start > 0) {
	    const buff = new Uint8Array(this.degree);
	    buff.set(remainder, start);

	    return buff
	  }

	  return remainder
	};

	reedSolomonEncoder = ReedSolomonEncoder;
	return reedSolomonEncoder;
}

var version = {};

var mode = {};

var versionCheck = {};

/**
 * Check if QR Code version is valid
 *
 * @param  {Number}  version QR Code version
 * @return {Boolean}         true if valid version, false otherwise
 */

var hasRequiredVersionCheck;

function requireVersionCheck () {
	if (hasRequiredVersionCheck) return versionCheck;
	hasRequiredVersionCheck = 1;
	versionCheck.isValid = function isValid (version) {
	  return !isNaN(version) && version >= 1 && version <= 40
	};
	return versionCheck;
}

var regex = {};

var hasRequiredRegex;

function requireRegex () {
	if (hasRequiredRegex) return regex;
	hasRequiredRegex = 1;
	const numeric = '[0-9]+';
	const alphanumeric = '[A-Z $%*+\\-./:]+';
	let kanji = '(?:[u3000-u303F]|[u3040-u309F]|[u30A0-u30FF]|' +
	  '[uFF00-uFFEF]|[u4E00-u9FAF]|[u2605-u2606]|[u2190-u2195]|u203B|' +
	  '[u2010u2015u2018u2019u2025u2026u201Cu201Du2225u2260]|' +
	  '[u0391-u0451]|[u00A7u00A8u00B1u00B4u00D7u00F7])+';
	kanji = kanji.replace(/u/g, '\\u');

	const byte = '(?:(?![A-Z0-9 $%*+\\-./:]|' + kanji + ')(?:.|[\r\n]))+';

	regex.KANJI = new RegExp(kanji, 'g');
	regex.BYTE_KANJI = new RegExp('[^A-Z0-9 $%*+\\-./:]+', 'g');
	regex.BYTE = new RegExp(byte, 'g');
	regex.NUMERIC = new RegExp(numeric, 'g');
	regex.ALPHANUMERIC = new RegExp(alphanumeric, 'g');

	const TEST_KANJI = new RegExp('^' + kanji + '$');
	const TEST_NUMERIC = new RegExp('^' + numeric + '$');
	const TEST_ALPHANUMERIC = new RegExp('^[A-Z0-9 $%*+\\-./:]+$');

	regex.testKanji = function testKanji (str) {
	  return TEST_KANJI.test(str)
	};

	regex.testNumeric = function testNumeric (str) {
	  return TEST_NUMERIC.test(str)
	};

	regex.testAlphanumeric = function testAlphanumeric (str) {
	  return TEST_ALPHANUMERIC.test(str)
	};
	return regex;
}

var hasRequiredMode;

function requireMode () {
	if (hasRequiredMode) return mode;
	hasRequiredMode = 1;
	(function (exports) {
		const VersionCheck = requireVersionCheck();
		const Regex = requireRegex();

		/**
		 * Numeric mode encodes data from the decimal digit set (0 - 9)
		 * (byte values 30HEX to 39HEX).
		 * Normally, 3 data characters are represented by 10 bits.
		 *
		 * @type {Object}
		 */
		exports.NUMERIC = {
		  id: 'Numeric',
		  bit: 1 << 0,
		  ccBits: [10, 12, 14]
		};

		/**
		 * Alphanumeric mode encodes data from a set of 45 characters,
		 * i.e. 10 numeric digits (0 - 9),
		 *      26 alphabetic characters (A - Z),
		 *   and 9 symbols (SP, $, %, *, +, -, ., /, :).
		 * Normally, two input characters are represented by 11 bits.
		 *
		 * @type {Object}
		 */
		exports.ALPHANUMERIC = {
		  id: 'Alphanumeric',
		  bit: 1 << 1,
		  ccBits: [9, 11, 13]
		};

		/**
		 * In byte mode, data is encoded at 8 bits per character.
		 *
		 * @type {Object}
		 */
		exports.BYTE = {
		  id: 'Byte',
		  bit: 1 << 2,
		  ccBits: [8, 16, 16]
		};

		/**
		 * The Kanji mode efficiently encodes Kanji characters in accordance with
		 * the Shift JIS system based on JIS X 0208.
		 * The Shift JIS values are shifted from the JIS X 0208 values.
		 * JIS X 0208 gives details of the shift coded representation.
		 * Each two-byte character value is compacted to a 13-bit binary codeword.
		 *
		 * @type {Object}
		 */
		exports.KANJI = {
		  id: 'Kanji',
		  bit: 1 << 3,
		  ccBits: [8, 10, 12]
		};

		/**
		 * Mixed mode will contain a sequences of data in a combination of any of
		 * the modes described above
		 *
		 * @type {Object}
		 */
		exports.MIXED = {
		  bit: -1
		};

		/**
		 * Returns the number of bits needed to store the data length
		 * according to QR Code specifications.
		 *
		 * @param  {Mode}   mode    Data mode
		 * @param  {Number} version QR Code version
		 * @return {Number}         Number of bits
		 */
		exports.getCharCountIndicator = function getCharCountIndicator (mode, version) {
		  if (!mode.ccBits) throw new Error('Invalid mode: ' + mode)

		  if (!VersionCheck.isValid(version)) {
		    throw new Error('Invalid version: ' + version)
		  }

		  if (version >= 1 && version < 10) return mode.ccBits[0]
		  else if (version < 27) return mode.ccBits[1]
		  return mode.ccBits[2]
		};

		/**
		 * Returns the most efficient mode to store the specified data
		 *
		 * @param  {String} dataStr Input data string
		 * @return {Mode}           Best mode
		 */
		exports.getBestModeForData = function getBestModeForData (dataStr) {
		  if (Regex.testNumeric(dataStr)) return exports.NUMERIC
		  else if (Regex.testAlphanumeric(dataStr)) return exports.ALPHANUMERIC
		  else if (Regex.testKanji(dataStr)) return exports.KANJI
		  else return exports.BYTE
		};

		/**
		 * Return mode name as string
		 *
		 * @param {Mode} mode Mode object
		 * @returns {String}  Mode name
		 */
		exports.toString = function toString (mode) {
		  if (mode && mode.id) return mode.id
		  throw new Error('Invalid mode')
		};

		/**
		 * Check if input param is a valid mode object
		 *
		 * @param   {Mode}    mode Mode object
		 * @returns {Boolean} True if valid mode, false otherwise
		 */
		exports.isValid = function isValid (mode) {
		  return mode && mode.bit && mode.ccBits
		};

		/**
		 * Get mode object from its name
		 *
		 * @param   {String} string Mode name
		 * @returns {Mode}          Mode object
		 */
		function fromString (string) {
		  if (typeof string !== 'string') {
		    throw new Error('Param is not a string')
		  }

		  const lcStr = string.toLowerCase();

		  switch (lcStr) {
		    case 'numeric':
		      return exports.NUMERIC
		    case 'alphanumeric':
		      return exports.ALPHANUMERIC
		    case 'kanji':
		      return exports.KANJI
		    case 'byte':
		      return exports.BYTE
		    default:
		      throw new Error('Unknown mode: ' + string)
		  }
		}

		/**
		 * Returns mode from a value.
		 * If value is not a valid mode, returns defaultValue
		 *
		 * @param  {Mode|String} value        Encoding mode
		 * @param  {Mode}        defaultValue Fallback value
		 * @return {Mode}                     Encoding mode
		 */
		exports.from = function from (value, defaultValue) {
		  if (exports.isValid(value)) {
		    return value
		  }

		  try {
		    return fromString(value)
		  } catch (e) {
		    return defaultValue
		  }
		}; 
	} (mode));
	return mode;
}

var hasRequiredVersion;

function requireVersion () {
	if (hasRequiredVersion) return version;
	hasRequiredVersion = 1;
	(function (exports) {
		const Utils = requireUtils$1();
		const ECCode = requireErrorCorrectionCode();
		const ECLevel = requireErrorCorrectionLevel();
		const Mode = requireMode();
		const VersionCheck = requireVersionCheck();

		// Generator polynomial used to encode version information
		const G18 = (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0);
		const G18_BCH = Utils.getBCHDigit(G18);

		function getBestVersionForDataLength (mode, length, errorCorrectionLevel) {
		  for (let currentVersion = 1; currentVersion <= 40; currentVersion++) {
		    if (length <= exports.getCapacity(currentVersion, errorCorrectionLevel, mode)) {
		      return currentVersion
		    }
		  }

		  return undefined
		}

		function getReservedBitsCount (mode, version) {
		  // Character count indicator + mode indicator bits
		  return Mode.getCharCountIndicator(mode, version) + 4
		}

		function getTotalBitsFromDataArray (segments, version) {
		  let totalBits = 0;

		  segments.forEach(function (data) {
		    const reservedBits = getReservedBitsCount(data.mode, version);
		    totalBits += reservedBits + data.getBitsLength();
		  });

		  return totalBits
		}

		function getBestVersionForMixedData (segments, errorCorrectionLevel) {
		  for (let currentVersion = 1; currentVersion <= 40; currentVersion++) {
		    const length = getTotalBitsFromDataArray(segments, currentVersion);
		    if (length <= exports.getCapacity(currentVersion, errorCorrectionLevel, Mode.MIXED)) {
		      return currentVersion
		    }
		  }

		  return undefined
		}

		/**
		 * Returns version number from a value.
		 * If value is not a valid version, returns defaultValue
		 *
		 * @param  {Number|String} value        QR Code version
		 * @param  {Number}        defaultValue Fallback value
		 * @return {Number}                     QR Code version number
		 */
		exports.from = function from (value, defaultValue) {
		  if (VersionCheck.isValid(value)) {
		    return parseInt(value, 10)
		  }

		  return defaultValue
		};

		/**
		 * Returns how much data can be stored with the specified QR code version
		 * and error correction level
		 *
		 * @param  {Number} version              QR Code version (1-40)
		 * @param  {Number} errorCorrectionLevel Error correction level
		 * @param  {Mode}   mode                 Data mode
		 * @return {Number}                      Quantity of storable data
		 */
		exports.getCapacity = function getCapacity (version, errorCorrectionLevel, mode) {
		  if (!VersionCheck.isValid(version)) {
		    throw new Error('Invalid QR Code version')
		  }

		  // Use Byte mode as default
		  if (typeof mode === 'undefined') mode = Mode.BYTE;

		  // Total codewords for this QR code version (Data + Error correction)
		  const totalCodewords = Utils.getSymbolTotalCodewords(version);

		  // Total number of error correction codewords
		  const ecTotalCodewords = ECCode.getTotalCodewordsCount(version, errorCorrectionLevel);

		  // Total number of data codewords
		  const dataTotalCodewordsBits = (totalCodewords - ecTotalCodewords) * 8;

		  if (mode === Mode.MIXED) return dataTotalCodewordsBits

		  const usableBits = dataTotalCodewordsBits - getReservedBitsCount(mode, version);

		  // Return max number of storable codewords
		  switch (mode) {
		    case Mode.NUMERIC:
		      return Math.floor((usableBits / 10) * 3)

		    case Mode.ALPHANUMERIC:
		      return Math.floor((usableBits / 11) * 2)

		    case Mode.KANJI:
		      return Math.floor(usableBits / 13)

		    case Mode.BYTE:
		    default:
		      return Math.floor(usableBits / 8)
		  }
		};

		/**
		 * Returns the minimum version needed to contain the amount of data
		 *
		 * @param  {Segment} data                    Segment of data
		 * @param  {Number} [errorCorrectionLevel=H] Error correction level
		 * @param  {Mode} mode                       Data mode
		 * @return {Number}                          QR Code version
		 */
		exports.getBestVersionForData = function getBestVersionForData (data, errorCorrectionLevel) {
		  let seg;

		  const ecl = ECLevel.from(errorCorrectionLevel, ECLevel.M);

		  if (Array.isArray(data)) {
		    if (data.length > 1) {
		      return getBestVersionForMixedData(data, ecl)
		    }

		    if (data.length === 0) {
		      return 1
		    }

		    seg = data[0];
		  } else {
		    seg = data;
		  }

		  return getBestVersionForDataLength(seg.mode, seg.getLength(), ecl)
		};

		/**
		 * Returns version information with relative error correction bits
		 *
		 * The version information is included in QR Code symbols of version 7 or larger.
		 * It consists of an 18-bit sequence containing 6 data bits,
		 * with 12 error correction bits calculated using the (18, 6) Golay code.
		 *
		 * @param  {Number} version QR Code version
		 * @return {Number}         Encoded version info bits
		 */
		exports.getEncodedBits = function getEncodedBits (version) {
		  if (!VersionCheck.isValid(version) || version < 7) {
		    throw new Error('Invalid QR Code version')
		  }

		  let d = version << 12;

		  while (Utils.getBCHDigit(d) - G18_BCH >= 0) {
		    d ^= (G18 << (Utils.getBCHDigit(d) - G18_BCH));
		  }

		  return (version << 12) | d
		}; 
	} (version));
	return version;
}

var formatInfo = {};

var hasRequiredFormatInfo;

function requireFormatInfo () {
	if (hasRequiredFormatInfo) return formatInfo;
	hasRequiredFormatInfo = 1;
	const Utils = requireUtils$1();

	const G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0);
	const G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);
	const G15_BCH = Utils.getBCHDigit(G15);

	/**
	 * Returns format information with relative error correction bits
	 *
	 * The format information is a 15-bit sequence containing 5 data bits,
	 * with 10 error correction bits calculated using the (15, 5) BCH code.
	 *
	 * @param  {Number} errorCorrectionLevel Error correction level
	 * @param  {Number} mask                 Mask pattern
	 * @return {Number}                      Encoded format information bits
	 */
	formatInfo.getEncodedBits = function getEncodedBits (errorCorrectionLevel, mask) {
	  const data = ((errorCorrectionLevel.bit << 3) | mask);
	  let d = data << 10;

	  while (Utils.getBCHDigit(d) - G15_BCH >= 0) {
	    d ^= (G15 << (Utils.getBCHDigit(d) - G15_BCH));
	  }

	  // xor final data with mask pattern in order to ensure that
	  // no combination of Error Correction Level and data mask pattern
	  // will result in an all-zero data string
	  return ((data << 10) | d) ^ G15_MASK
	};
	return formatInfo;
}

var segments = {};

var numericData;
var hasRequiredNumericData;

function requireNumericData () {
	if (hasRequiredNumericData) return numericData;
	hasRequiredNumericData = 1;
	const Mode = requireMode();

	function NumericData (data) {
	  this.mode = Mode.NUMERIC;
	  this.data = data.toString();
	}

	NumericData.getBitsLength = function getBitsLength (length) {
	  return 10 * Math.floor(length / 3) + ((length % 3) ? ((length % 3) * 3 + 1) : 0)
	};

	NumericData.prototype.getLength = function getLength () {
	  return this.data.length
	};

	NumericData.prototype.getBitsLength = function getBitsLength () {
	  return NumericData.getBitsLength(this.data.length)
	};

	NumericData.prototype.write = function write (bitBuffer) {
	  let i, group, value;

	  // The input data string is divided into groups of three digits,
	  // and each group is converted to its 10-bit binary equivalent.
	  for (i = 0; i + 3 <= this.data.length; i += 3) {
	    group = this.data.substr(i, 3);
	    value = parseInt(group, 10);

	    bitBuffer.put(value, 10);
	  }

	  // If the number of input digits is not an exact multiple of three,
	  // the final one or two digits are converted to 4 or 7 bits respectively.
	  const remainingNum = this.data.length - i;
	  if (remainingNum > 0) {
	    group = this.data.substr(i);
	    value = parseInt(group, 10);

	    bitBuffer.put(value, remainingNum * 3 + 1);
	  }
	};

	numericData = NumericData;
	return numericData;
}

var alphanumericData;
var hasRequiredAlphanumericData;

function requireAlphanumericData () {
	if (hasRequiredAlphanumericData) return alphanumericData;
	hasRequiredAlphanumericData = 1;
	const Mode = requireMode();

	/**
	 * Array of characters available in alphanumeric mode
	 *
	 * As per QR Code specification, to each character
	 * is assigned a value from 0 to 44 which in this case coincides
	 * with the array index
	 *
	 * @type {Array}
	 */
	const ALPHA_NUM_CHARS = [
	  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
	  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
	  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
	  ' ', '$', '%', '*', '+', '-', '.', '/', ':'
	];

	function AlphanumericData (data) {
	  this.mode = Mode.ALPHANUMERIC;
	  this.data = data;
	}

	AlphanumericData.getBitsLength = function getBitsLength (length) {
	  return 11 * Math.floor(length / 2) + 6 * (length % 2)
	};

	AlphanumericData.prototype.getLength = function getLength () {
	  return this.data.length
	};

	AlphanumericData.prototype.getBitsLength = function getBitsLength () {
	  return AlphanumericData.getBitsLength(this.data.length)
	};

	AlphanumericData.prototype.write = function write (bitBuffer) {
	  let i;

	  // Input data characters are divided into groups of two characters
	  // and encoded as 11-bit binary codes.
	  for (i = 0; i + 2 <= this.data.length; i += 2) {
	    // The character value of the first character is multiplied by 45
	    let value = ALPHA_NUM_CHARS.indexOf(this.data[i]) * 45;

	    // The character value of the second digit is added to the product
	    value += ALPHA_NUM_CHARS.indexOf(this.data[i + 1]);

	    // The sum is then stored as 11-bit binary number
	    bitBuffer.put(value, 11);
	  }

	  // If the number of input data characters is not a multiple of two,
	  // the character value of the final character is encoded as a 6-bit binary number.
	  if (this.data.length % 2) {
	    bitBuffer.put(ALPHA_NUM_CHARS.indexOf(this.data[i]), 6);
	  }
	};

	alphanumericData = AlphanumericData;
	return alphanumericData;
}

var byteData;
var hasRequiredByteData;

function requireByteData () {
	if (hasRequiredByteData) return byteData;
	hasRequiredByteData = 1;
	const Mode = requireMode();

	function ByteData (data) {
	  this.mode = Mode.BYTE;
	  if (typeof (data) === 'string') {
	    this.data = new TextEncoder().encode(data);
	  } else {
	    this.data = new Uint8Array(data);
	  }
	}

	ByteData.getBitsLength = function getBitsLength (length) {
	  return length * 8
	};

	ByteData.prototype.getLength = function getLength () {
	  return this.data.length
	};

	ByteData.prototype.getBitsLength = function getBitsLength () {
	  return ByteData.getBitsLength(this.data.length)
	};

	ByteData.prototype.write = function (bitBuffer) {
	  for (let i = 0, l = this.data.length; i < l; i++) {
	    bitBuffer.put(this.data[i], 8);
	  }
	};

	byteData = ByteData;
	return byteData;
}

var kanjiData;
var hasRequiredKanjiData;

function requireKanjiData () {
	if (hasRequiredKanjiData) return kanjiData;
	hasRequiredKanjiData = 1;
	const Mode = requireMode();
	const Utils = requireUtils$1();

	function KanjiData (data) {
	  this.mode = Mode.KANJI;
	  this.data = data;
	}

	KanjiData.getBitsLength = function getBitsLength (length) {
	  return length * 13
	};

	KanjiData.prototype.getLength = function getLength () {
	  return this.data.length
	};

	KanjiData.prototype.getBitsLength = function getBitsLength () {
	  return KanjiData.getBitsLength(this.data.length)
	};

	KanjiData.prototype.write = function (bitBuffer) {
	  let i;

	  // In the Shift JIS system, Kanji characters are represented by a two byte combination.
	  // These byte values are shifted from the JIS X 0208 values.
	  // JIS X 0208 gives details of the shift coded representation.
	  for (i = 0; i < this.data.length; i++) {
	    let value = Utils.toSJIS(this.data[i]);

	    // For characters with Shift JIS values from 0x8140 to 0x9FFC:
	    if (value >= 0x8140 && value <= 0x9FFC) {
	      // Subtract 0x8140 from Shift JIS value
	      value -= 0x8140;

	    // For characters with Shift JIS values from 0xE040 to 0xEBBF
	    } else if (value >= 0xE040 && value <= 0xEBBF) {
	      // Subtract 0xC140 from Shift JIS value
	      value -= 0xC140;
	    } else {
	      throw new Error(
	        'Invalid SJIS character: ' + this.data[i] + '\n' +
	        'Make sure your charset is UTF-8')
	    }

	    // Multiply most significant byte of result by 0xC0
	    // and add least significant byte to product
	    value = (((value >>> 8) & 0xff) * 0xC0) + (value & 0xff);

	    // Convert result to a 13-bit binary string
	    bitBuffer.put(value, 13);
	  }
	};

	kanjiData = KanjiData;
	return kanjiData;
}

var dijkstra = {exports: {}};

var hasRequiredDijkstra;

function requireDijkstra () {
	if (hasRequiredDijkstra) return dijkstra.exports;
	hasRequiredDijkstra = 1;
	(function (module) {

		/******************************************************************************
		 * Created 2008-08-19.
		 *
		 * Dijkstra path-finding functions. Adapted from the Dijkstar Python project.
		 *
		 * Copyright (C) 2008
		 *   Wyatt Baldwin <self@wyattbaldwin.com>
		 *   All rights reserved
		 *
		 * Licensed under the MIT license.
		 *
		 *   http://www.opensource.org/licenses/mit-license.php
		 *
		 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
		 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
		 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
		 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
		 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
		 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
		 * THE SOFTWARE.
		 *****************************************************************************/
		var dijkstra = {
		  single_source_shortest_paths: function(graph, s, d) {
		    // Predecessor map for each node that has been encountered.
		    // node ID => predecessor node ID
		    var predecessors = {};

		    // Costs of shortest paths from s to all nodes encountered.
		    // node ID => cost
		    var costs = {};
		    costs[s] = 0;

		    // Costs of shortest paths from s to all nodes encountered; differs from
		    // `costs` in that it provides easy access to the node that currently has
		    // the known shortest path from s.
		    // XXX: Do we actually need both `costs` and `open`?
		    var open = dijkstra.PriorityQueue.make();
		    open.push(s, 0);

		    var closest,
		        u, v,
		        cost_of_s_to_u,
		        adjacent_nodes,
		        cost_of_e,
		        cost_of_s_to_u_plus_cost_of_e,
		        cost_of_s_to_v,
		        first_visit;
		    while (!open.empty()) {
		      // In the nodes remaining in graph that have a known cost from s,
		      // find the node, u, that currently has the shortest path from s.
		      closest = open.pop();
		      u = closest.value;
		      cost_of_s_to_u = closest.cost;

		      // Get nodes adjacent to u...
		      adjacent_nodes = graph[u] || {};

		      // ...and explore the edges that connect u to those nodes, updating
		      // the cost of the shortest paths to any or all of those nodes as
		      // necessary. v is the node across the current edge from u.
		      for (v in adjacent_nodes) {
		        if (adjacent_nodes.hasOwnProperty(v)) {
		          // Get the cost of the edge running from u to v.
		          cost_of_e = adjacent_nodes[v];

		          // Cost of s to u plus the cost of u to v across e--this is *a*
		          // cost from s to v that may or may not be less than the current
		          // known cost to v.
		          cost_of_s_to_u_plus_cost_of_e = cost_of_s_to_u + cost_of_e;

		          // If we haven't visited v yet OR if the current known cost from s to
		          // v is greater than the new cost we just found (cost of s to u plus
		          // cost of u to v across e), update v's cost in the cost list and
		          // update v's predecessor in the predecessor list (it's now u).
		          cost_of_s_to_v = costs[v];
		          first_visit = (typeof costs[v] === 'undefined');
		          if (first_visit || cost_of_s_to_v > cost_of_s_to_u_plus_cost_of_e) {
		            costs[v] = cost_of_s_to_u_plus_cost_of_e;
		            open.push(v, cost_of_s_to_u_plus_cost_of_e);
		            predecessors[v] = u;
		          }
		        }
		      }
		    }

		    if (typeof d !== 'undefined' && typeof costs[d] === 'undefined') {
		      var msg = ['Could not find a path from ', s, ' to ', d, '.'].join('');
		      throw new Error(msg);
		    }

		    return predecessors;
		  },

		  extract_shortest_path_from_predecessor_list: function(predecessors, d) {
		    var nodes = [];
		    var u = d;
		    while (u) {
		      nodes.push(u);
		      predecessors[u];
		      u = predecessors[u];
		    }
		    nodes.reverse();
		    return nodes;
		  },

		  find_path: function(graph, s, d) {
		    var predecessors = dijkstra.single_source_shortest_paths(graph, s, d);
		    return dijkstra.extract_shortest_path_from_predecessor_list(
		      predecessors, d);
		  },

		  /**
		   * A very naive priority queue implementation.
		   */
		  PriorityQueue: {
		    make: function (opts) {
		      var T = dijkstra.PriorityQueue,
		          t = {},
		          key;
		      opts = opts || {};
		      for (key in T) {
		        if (T.hasOwnProperty(key)) {
		          t[key] = T[key];
		        }
		      }
		      t.queue = [];
		      t.sorter = opts.sorter || T.default_sorter;
		      return t;
		    },

		    default_sorter: function (a, b) {
		      return a.cost - b.cost;
		    },

		    /**
		     * Add a new item to the queue and ensure the highest priority element
		     * is at the front of the queue.
		     */
		    push: function (value, cost) {
		      var item = {value: value, cost: cost};
		      this.queue.push(item);
		      this.queue.sort(this.sorter);
		    },

		    /**
		     * Return the highest priority element in the queue.
		     */
		    pop: function () {
		      return this.queue.shift();
		    },

		    empty: function () {
		      return this.queue.length === 0;
		    }
		  }
		};


		// node.js module exports
		{
		  module.exports = dijkstra;
		} 
	} (dijkstra));
	return dijkstra.exports;
}

var hasRequiredSegments;

function requireSegments () {
	if (hasRequiredSegments) return segments;
	hasRequiredSegments = 1;
	(function (exports) {
		const Mode = requireMode();
		const NumericData = requireNumericData();
		const AlphanumericData = requireAlphanumericData();
		const ByteData = requireByteData();
		const KanjiData = requireKanjiData();
		const Regex = requireRegex();
		const Utils = requireUtils$1();
		const dijkstra = requireDijkstra();

		/**
		 * Returns UTF8 byte length
		 *
		 * @param  {String} str Input string
		 * @return {Number}     Number of byte
		 */
		function getStringByteLength (str) {
		  return unescape(encodeURIComponent(str)).length
		}

		/**
		 * Get a list of segments of the specified mode
		 * from a string
		 *
		 * @param  {Mode}   mode Segment mode
		 * @param  {String} str  String to process
		 * @return {Array}       Array of object with segments data
		 */
		function getSegments (regex, mode, str) {
		  const segments = [];
		  let result;

		  while ((result = regex.exec(str)) !== null) {
		    segments.push({
		      data: result[0],
		      index: result.index,
		      mode: mode,
		      length: result[0].length
		    });
		  }

		  return segments
		}

		/**
		 * Extracts a series of segments with the appropriate
		 * modes from a string
		 *
		 * @param  {String} dataStr Input string
		 * @return {Array}          Array of object with segments data
		 */
		function getSegmentsFromString (dataStr) {
		  const numSegs = getSegments(Regex.NUMERIC, Mode.NUMERIC, dataStr);
		  const alphaNumSegs = getSegments(Regex.ALPHANUMERIC, Mode.ALPHANUMERIC, dataStr);
		  let byteSegs;
		  let kanjiSegs;

		  if (Utils.isKanjiModeEnabled()) {
		    byteSegs = getSegments(Regex.BYTE, Mode.BYTE, dataStr);
		    kanjiSegs = getSegments(Regex.KANJI, Mode.KANJI, dataStr);
		  } else {
		    byteSegs = getSegments(Regex.BYTE_KANJI, Mode.BYTE, dataStr);
		    kanjiSegs = [];
		  }

		  const segs = numSegs.concat(alphaNumSegs, byteSegs, kanjiSegs);

		  return segs
		    .sort(function (s1, s2) {
		      return s1.index - s2.index
		    })
		    .map(function (obj) {
		      return {
		        data: obj.data,
		        mode: obj.mode,
		        length: obj.length
		      }
		    })
		}

		/**
		 * Returns how many bits are needed to encode a string of
		 * specified length with the specified mode
		 *
		 * @param  {Number} length String length
		 * @param  {Mode} mode     Segment mode
		 * @return {Number}        Bit length
		 */
		function getSegmentBitsLength (length, mode) {
		  switch (mode) {
		    case Mode.NUMERIC:
		      return NumericData.getBitsLength(length)
		    case Mode.ALPHANUMERIC:
		      return AlphanumericData.getBitsLength(length)
		    case Mode.KANJI:
		      return KanjiData.getBitsLength(length)
		    case Mode.BYTE:
		      return ByteData.getBitsLength(length)
		  }
		}

		/**
		 * Merges adjacent segments which have the same mode
		 *
		 * @param  {Array} segs Array of object with segments data
		 * @return {Array}      Array of object with segments data
		 */
		function mergeSegments (segs) {
		  return segs.reduce(function (acc, curr) {
		    const prevSeg = acc.length - 1 >= 0 ? acc[acc.length - 1] : null;
		    if (prevSeg && prevSeg.mode === curr.mode) {
		      acc[acc.length - 1].data += curr.data;
		      return acc
		    }

		    acc.push(curr);
		    return acc
		  }, [])
		}

		/**
		 * Generates a list of all possible nodes combination which
		 * will be used to build a segments graph.
		 *
		 * Nodes are divided by groups. Each group will contain a list of all the modes
		 * in which is possible to encode the given text.
		 *
		 * For example the text '12345' can be encoded as Numeric, Alphanumeric or Byte.
		 * The group for '12345' will contain then 3 objects, one for each
		 * possible encoding mode.
		 *
		 * Each node represents a possible segment.
		 *
		 * @param  {Array} segs Array of object with segments data
		 * @return {Array}      Array of object with segments data
		 */
		function buildNodes (segs) {
		  const nodes = [];
		  for (let i = 0; i < segs.length; i++) {
		    const seg = segs[i];

		    switch (seg.mode) {
		      case Mode.NUMERIC:
		        nodes.push([seg,
		          { data: seg.data, mode: Mode.ALPHANUMERIC, length: seg.length },
		          { data: seg.data, mode: Mode.BYTE, length: seg.length }
		        ]);
		        break
		      case Mode.ALPHANUMERIC:
		        nodes.push([seg,
		          { data: seg.data, mode: Mode.BYTE, length: seg.length }
		        ]);
		        break
		      case Mode.KANJI:
		        nodes.push([seg,
		          { data: seg.data, mode: Mode.BYTE, length: getStringByteLength(seg.data) }
		        ]);
		        break
		      case Mode.BYTE:
		        nodes.push([
		          { data: seg.data, mode: Mode.BYTE, length: getStringByteLength(seg.data) }
		        ]);
		    }
		  }

		  return nodes
		}

		/**
		 * Builds a graph from a list of nodes.
		 * All segments in each node group will be connected with all the segments of
		 * the next group and so on.
		 *
		 * At each connection will be assigned a weight depending on the
		 * segment's byte length.
		 *
		 * @param  {Array} nodes    Array of object with segments data
		 * @param  {Number} version QR Code version
		 * @return {Object}         Graph of all possible segments
		 */
		function buildGraph (nodes, version) {
		  const table = {};
		  const graph = { start: {} };
		  let prevNodeIds = ['start'];

		  for (let i = 0; i < nodes.length; i++) {
		    const nodeGroup = nodes[i];
		    const currentNodeIds = [];

		    for (let j = 0; j < nodeGroup.length; j++) {
		      const node = nodeGroup[j];
		      const key = '' + i + j;

		      currentNodeIds.push(key);
		      table[key] = { node: node, lastCount: 0 };
		      graph[key] = {};

		      for (let n = 0; n < prevNodeIds.length; n++) {
		        const prevNodeId = prevNodeIds[n];

		        if (table[prevNodeId] && table[prevNodeId].node.mode === node.mode) {
		          graph[prevNodeId][key] =
		            getSegmentBitsLength(table[prevNodeId].lastCount + node.length, node.mode) -
		            getSegmentBitsLength(table[prevNodeId].lastCount, node.mode);

		          table[prevNodeId].lastCount += node.length;
		        } else {
		          if (table[prevNodeId]) table[prevNodeId].lastCount = node.length;

		          graph[prevNodeId][key] = getSegmentBitsLength(node.length, node.mode) +
		            4 + Mode.getCharCountIndicator(node.mode, version); // switch cost
		        }
		      }
		    }

		    prevNodeIds = currentNodeIds;
		  }

		  for (let n = 0; n < prevNodeIds.length; n++) {
		    graph[prevNodeIds[n]].end = 0;
		  }

		  return { map: graph, table: table }
		}

		/**
		 * Builds a segment from a specified data and mode.
		 * If a mode is not specified, the more suitable will be used.
		 *
		 * @param  {String} data             Input data
		 * @param  {Mode | String} modesHint Data mode
		 * @return {Segment}                 Segment
		 */
		function buildSingleSegment (data, modesHint) {
		  let mode;
		  const bestMode = Mode.getBestModeForData(data);

		  mode = Mode.from(modesHint, bestMode);

		  // Make sure data can be encoded
		  if (mode !== Mode.BYTE && mode.bit < bestMode.bit) {
		    throw new Error('"' + data + '"' +
		      ' cannot be encoded with mode ' + Mode.toString(mode) +
		      '.\n Suggested mode is: ' + Mode.toString(bestMode))
		  }

		  // Use Mode.BYTE if Kanji support is disabled
		  if (mode === Mode.KANJI && !Utils.isKanjiModeEnabled()) {
		    mode = Mode.BYTE;
		  }

		  switch (mode) {
		    case Mode.NUMERIC:
		      return new NumericData(data)

		    case Mode.ALPHANUMERIC:
		      return new AlphanumericData(data)

		    case Mode.KANJI:
		      return new KanjiData(data)

		    case Mode.BYTE:
		      return new ByteData(data)
		  }
		}

		/**
		 * Builds a list of segments from an array.
		 * Array can contain Strings or Objects with segment's info.
		 *
		 * For each item which is a string, will be generated a segment with the given
		 * string and the more appropriate encoding mode.
		 *
		 * For each item which is an object, will be generated a segment with the given
		 * data and mode.
		 * Objects must contain at least the property "data".
		 * If property "mode" is not present, the more suitable mode will be used.
		 *
		 * @param  {Array} array Array of objects with segments data
		 * @return {Array}       Array of Segments
		 */
		exports.fromArray = function fromArray (array) {
		  return array.reduce(function (acc, seg) {
		    if (typeof seg === 'string') {
		      acc.push(buildSingleSegment(seg, null));
		    } else if (seg.data) {
		      acc.push(buildSingleSegment(seg.data, seg.mode));
		    }

		    return acc
		  }, [])
		};

		/**
		 * Builds an optimized sequence of segments from a string,
		 * which will produce the shortest possible bitstream.
		 *
		 * @param  {String} data    Input string
		 * @param  {Number} version QR Code version
		 * @return {Array}          Array of segments
		 */
		exports.fromString = function fromString (data, version) {
		  const segs = getSegmentsFromString(data, Utils.isKanjiModeEnabled());

		  const nodes = buildNodes(segs);
		  const graph = buildGraph(nodes, version);
		  const path = dijkstra.find_path(graph.map, 'start', 'end');

		  const optimizedSegs = [];
		  for (let i = 1; i < path.length - 1; i++) {
		    optimizedSegs.push(graph.table[path[i]].node);
		  }

		  return exports.fromArray(mergeSegments(optimizedSegs))
		};

		/**
		 * Splits a string in various segments with the modes which
		 * best represent their content.
		 * The produced segments are far from being optimized.
		 * The output of this function is only used to estimate a QR Code version
		 * which may contain the data.
		 *
		 * @param  {string} data Input string
		 * @return {Array}       Array of segments
		 */
		exports.rawSplit = function rawSplit (data) {
		  return exports.fromArray(
		    getSegmentsFromString(data, Utils.isKanjiModeEnabled())
		  )
		}; 
	} (segments));
	return segments;
}

var hasRequiredQrcode;

function requireQrcode () {
	if (hasRequiredQrcode) return qrcode;
	hasRequiredQrcode = 1;
	const Utils = requireUtils$1();
	const ECLevel = requireErrorCorrectionLevel();
	const BitBuffer = requireBitBuffer();
	const BitMatrix = requireBitMatrix();
	const AlignmentPattern = requireAlignmentPattern();
	const FinderPattern = requireFinderPattern();
	const MaskPattern = requireMaskPattern();
	const ECCode = requireErrorCorrectionCode();
	const ReedSolomonEncoder = requireReedSolomonEncoder();
	const Version = requireVersion();
	const FormatInfo = requireFormatInfo();
	const Mode = requireMode();
	const Segments = requireSegments();

	/**
	 * QRCode for JavaScript
	 *
	 * modified by Ryan Day for nodejs support
	 * Copyright (c) 2011 Ryan Day
	 *
	 * Licensed under the MIT license:
	 *   http://www.opensource.org/licenses/mit-license.php
	 *
	//---------------------------------------------------------------------
	// QRCode for JavaScript
	//
	// Copyright (c) 2009 Kazuhiko Arase
	//
	// URL: http://www.d-project.com/
	//
	// Licensed under the MIT license:
	//   http://www.opensource.org/licenses/mit-license.php
	//
	// The word "QR Code" is registered trademark of
	// DENSO WAVE INCORPORATED
	//   http://www.denso-wave.com/qrcode/faqpatent-e.html
	//
	//---------------------------------------------------------------------
	*/

	/**
	 * Add finder patterns bits to matrix
	 *
	 * @param  {BitMatrix} matrix  Modules matrix
	 * @param  {Number}    version QR Code version
	 */
	function setupFinderPattern (matrix, version) {
	  const size = matrix.size;
	  const pos = FinderPattern.getPositions(version);

	  for (let i = 0; i < pos.length; i++) {
	    const row = pos[i][0];
	    const col = pos[i][1];

	    for (let r = -1; r <= 7; r++) {
	      if (row + r <= -1 || size <= row + r) continue

	      for (let c = -1; c <= 7; c++) {
	        if (col + c <= -1 || size <= col + c) continue

	        if ((r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
	          (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
	          (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
	          matrix.set(row + r, col + c, true, true);
	        } else {
	          matrix.set(row + r, col + c, false, true);
	        }
	      }
	    }
	  }
	}

	/**
	 * Add timing pattern bits to matrix
	 *
	 * Note: this function must be called before {@link setupAlignmentPattern}
	 *
	 * @param  {BitMatrix} matrix Modules matrix
	 */
	function setupTimingPattern (matrix) {
	  const size = matrix.size;

	  for (let r = 8; r < size - 8; r++) {
	    const value = r % 2 === 0;
	    matrix.set(r, 6, value, true);
	    matrix.set(6, r, value, true);
	  }
	}

	/**
	 * Add alignment patterns bits to matrix
	 *
	 * Note: this function must be called after {@link setupTimingPattern}
	 *
	 * @param  {BitMatrix} matrix  Modules matrix
	 * @param  {Number}    version QR Code version
	 */
	function setupAlignmentPattern (matrix, version) {
	  const pos = AlignmentPattern.getPositions(version);

	  for (let i = 0; i < pos.length; i++) {
	    const row = pos[i][0];
	    const col = pos[i][1];

	    for (let r = -2; r <= 2; r++) {
	      for (let c = -2; c <= 2; c++) {
	        if (r === -2 || r === 2 || c === -2 || c === 2 ||
	          (r === 0 && c === 0)) {
	          matrix.set(row + r, col + c, true, true);
	        } else {
	          matrix.set(row + r, col + c, false, true);
	        }
	      }
	    }
	  }
	}

	/**
	 * Add version info bits to matrix
	 *
	 * @param  {BitMatrix} matrix  Modules matrix
	 * @param  {Number}    version QR Code version
	 */
	function setupVersionInfo (matrix, version) {
	  const size = matrix.size;
	  const bits = Version.getEncodedBits(version);
	  let row, col, mod;

	  for (let i = 0; i < 18; i++) {
	    row = Math.floor(i / 3);
	    col = i % 3 + size - 8 - 3;
	    mod = ((bits >> i) & 1) === 1;

	    matrix.set(row, col, mod, true);
	    matrix.set(col, row, mod, true);
	  }
	}

	/**
	 * Add format info bits to matrix
	 *
	 * @param  {BitMatrix} matrix               Modules matrix
	 * @param  {ErrorCorrectionLevel}    errorCorrectionLevel Error correction level
	 * @param  {Number}    maskPattern          Mask pattern reference value
	 */
	function setupFormatInfo (matrix, errorCorrectionLevel, maskPattern) {
	  const size = matrix.size;
	  const bits = FormatInfo.getEncodedBits(errorCorrectionLevel, maskPattern);
	  let i, mod;

	  for (i = 0; i < 15; i++) {
	    mod = ((bits >> i) & 1) === 1;

	    // vertical
	    if (i < 6) {
	      matrix.set(i, 8, mod, true);
	    } else if (i < 8) {
	      matrix.set(i + 1, 8, mod, true);
	    } else {
	      matrix.set(size - 15 + i, 8, mod, true);
	    }

	    // horizontal
	    if (i < 8) {
	      matrix.set(8, size - i - 1, mod, true);
	    } else if (i < 9) {
	      matrix.set(8, 15 - i - 1 + 1, mod, true);
	    } else {
	      matrix.set(8, 15 - i - 1, mod, true);
	    }
	  }

	  // fixed module
	  matrix.set(size - 8, 8, 1, true);
	}

	/**
	 * Add encoded data bits to matrix
	 *
	 * @param  {BitMatrix}  matrix Modules matrix
	 * @param  {Uint8Array} data   Data codewords
	 */
	function setupData (matrix, data) {
	  const size = matrix.size;
	  let inc = -1;
	  let row = size - 1;
	  let bitIndex = 7;
	  let byteIndex = 0;

	  for (let col = size - 1; col > 0; col -= 2) {
	    if (col === 6) col--;

	    while (true) {
	      for (let c = 0; c < 2; c++) {
	        if (!matrix.isReserved(row, col - c)) {
	          let dark = false;

	          if (byteIndex < data.length) {
	            dark = (((data[byteIndex] >>> bitIndex) & 1) === 1);
	          }

	          matrix.set(row, col - c, dark);
	          bitIndex--;

	          if (bitIndex === -1) {
	            byteIndex++;
	            bitIndex = 7;
	          }
	        }
	      }

	      row += inc;

	      if (row < 0 || size <= row) {
	        row -= inc;
	        inc = -inc;
	        break
	      }
	    }
	  }
	}

	/**
	 * Create encoded codewords from data input
	 *
	 * @param  {Number}   version              QR Code version
	 * @param  {ErrorCorrectionLevel}   errorCorrectionLevel Error correction level
	 * @param  {ByteData} data                 Data input
	 * @return {Uint8Array}                    Buffer containing encoded codewords
	 */
	function createData (version, errorCorrectionLevel, segments) {
	  // Prepare data buffer
	  const buffer = new BitBuffer();

	  segments.forEach(function (data) {
	    // prefix data with mode indicator (4 bits)
	    buffer.put(data.mode.bit, 4);

	    // Prefix data with character count indicator.
	    // The character count indicator is a string of bits that represents the
	    // number of characters that are being encoded.
	    // The character count indicator must be placed after the mode indicator
	    // and must be a certain number of bits long, depending on the QR version
	    // and data mode
	    // @see {@link Mode.getCharCountIndicator}.
	    buffer.put(data.getLength(), Mode.getCharCountIndicator(data.mode, version));

	    // add binary data sequence to buffer
	    data.write(buffer);
	  });

	  // Calculate required number of bits
	  const totalCodewords = Utils.getSymbolTotalCodewords(version);
	  const ecTotalCodewords = ECCode.getTotalCodewordsCount(version, errorCorrectionLevel);
	  const dataTotalCodewordsBits = (totalCodewords - ecTotalCodewords) * 8;

	  // Add a terminator.
	  // If the bit string is shorter than the total number of required bits,
	  // a terminator of up to four 0s must be added to the right side of the string.
	  // If the bit string is more than four bits shorter than the required number of bits,
	  // add four 0s to the end.
	  if (buffer.getLengthInBits() + 4 <= dataTotalCodewordsBits) {
	    buffer.put(0, 4);
	  }

	  // If the bit string is fewer than four bits shorter, add only the number of 0s that
	  // are needed to reach the required number of bits.

	  // After adding the terminator, if the number of bits in the string is not a multiple of 8,
	  // pad the string on the right with 0s to make the string's length a multiple of 8.
	  while (buffer.getLengthInBits() % 8 !== 0) {
	    buffer.putBit(0);
	  }

	  // Add pad bytes if the string is still shorter than the total number of required bits.
	  // Extend the buffer to fill the data capacity of the symbol corresponding to
	  // the Version and Error Correction Level by adding the Pad Codewords 11101100 (0xEC)
	  // and 00010001 (0x11) alternately.
	  const remainingByte = (dataTotalCodewordsBits - buffer.getLengthInBits()) / 8;
	  for (let i = 0; i < remainingByte; i++) {
	    buffer.put(i % 2 ? 0x11 : 0xEC, 8);
	  }

	  return createCodewords(buffer, version, errorCorrectionLevel)
	}

	/**
	 * Encode input data with Reed-Solomon and return codewords with
	 * relative error correction bits
	 *
	 * @param  {BitBuffer} bitBuffer            Data to encode
	 * @param  {Number}    version              QR Code version
	 * @param  {ErrorCorrectionLevel} errorCorrectionLevel Error correction level
	 * @return {Uint8Array}                     Buffer containing encoded codewords
	 */
	function createCodewords (bitBuffer, version, errorCorrectionLevel) {
	  // Total codewords for this QR code version (Data + Error correction)
	  const totalCodewords = Utils.getSymbolTotalCodewords(version);

	  // Total number of error correction codewords
	  const ecTotalCodewords = ECCode.getTotalCodewordsCount(version, errorCorrectionLevel);

	  // Total number of data codewords
	  const dataTotalCodewords = totalCodewords - ecTotalCodewords;

	  // Total number of blocks
	  const ecTotalBlocks = ECCode.getBlocksCount(version, errorCorrectionLevel);

	  // Calculate how many blocks each group should contain
	  const blocksInGroup2 = totalCodewords % ecTotalBlocks;
	  const blocksInGroup1 = ecTotalBlocks - blocksInGroup2;

	  const totalCodewordsInGroup1 = Math.floor(totalCodewords / ecTotalBlocks);

	  const dataCodewordsInGroup1 = Math.floor(dataTotalCodewords / ecTotalBlocks);
	  const dataCodewordsInGroup2 = dataCodewordsInGroup1 + 1;

	  // Number of EC codewords is the same for both groups
	  const ecCount = totalCodewordsInGroup1 - dataCodewordsInGroup1;

	  // Initialize a Reed-Solomon encoder with a generator polynomial of degree ecCount
	  const rs = new ReedSolomonEncoder(ecCount);

	  let offset = 0;
	  const dcData = new Array(ecTotalBlocks);
	  const ecData = new Array(ecTotalBlocks);
	  let maxDataSize = 0;
	  const buffer = new Uint8Array(bitBuffer.buffer);

	  // Divide the buffer into the required number of blocks
	  for (let b = 0; b < ecTotalBlocks; b++) {
	    const dataSize = b < blocksInGroup1 ? dataCodewordsInGroup1 : dataCodewordsInGroup2;

	    // extract a block of data from buffer
	    dcData[b] = buffer.slice(offset, offset + dataSize);

	    // Calculate EC codewords for this data block
	    ecData[b] = rs.encode(dcData[b]);

	    offset += dataSize;
	    maxDataSize = Math.max(maxDataSize, dataSize);
	  }

	  // Create final data
	  // Interleave the data and error correction codewords from each block
	  const data = new Uint8Array(totalCodewords);
	  let index = 0;
	  let i, r;

	  // Add data codewords
	  for (i = 0; i < maxDataSize; i++) {
	    for (r = 0; r < ecTotalBlocks; r++) {
	      if (i < dcData[r].length) {
	        data[index++] = dcData[r][i];
	      }
	    }
	  }

	  // Apped EC codewords
	  for (i = 0; i < ecCount; i++) {
	    for (r = 0; r < ecTotalBlocks; r++) {
	      data[index++] = ecData[r][i];
	    }
	  }

	  return data
	}

	/**
	 * Build QR Code symbol
	 *
	 * @param  {String} data                 Input string
	 * @param  {Number} version              QR Code version
	 * @param  {ErrorCorretionLevel} errorCorrectionLevel Error level
	 * @param  {MaskPattern} maskPattern     Mask pattern
	 * @return {Object}                      Object containing symbol data
	 */
	function createSymbol (data, version, errorCorrectionLevel, maskPattern) {
	  let segments;

	  if (Array.isArray(data)) {
	    segments = Segments.fromArray(data);
	  } else if (typeof data === 'string') {
	    let estimatedVersion = version;

	    if (!estimatedVersion) {
	      const rawSegments = Segments.rawSplit(data);

	      // Estimate best version that can contain raw splitted segments
	      estimatedVersion = Version.getBestVersionForData(rawSegments, errorCorrectionLevel);
	    }

	    // Build optimized segments
	    // If estimated version is undefined, try with the highest version
	    segments = Segments.fromString(data, estimatedVersion || 40);
	  } else {
	    throw new Error('Invalid data')
	  }

	  // Get the min version that can contain data
	  const bestVersion = Version.getBestVersionForData(segments, errorCorrectionLevel);

	  // If no version is found, data cannot be stored
	  if (!bestVersion) {
	    throw new Error('The amount of data is too big to be stored in a QR Code')
	  }

	  // If not specified, use min version as default
	  if (!version) {
	    version = bestVersion;

	  // Check if the specified version can contain the data
	  } else if (version < bestVersion) {
	    throw new Error('\n' +
	      'The chosen QR Code version cannot contain this amount of data.\n' +
	      'Minimum version required to store current data is: ' + bestVersion + '.\n'
	    )
	  }

	  const dataBits = createData(version, errorCorrectionLevel, segments);

	  // Allocate matrix buffer
	  const moduleCount = Utils.getSymbolSize(version);
	  const modules = new BitMatrix(moduleCount);

	  // Add function modules
	  setupFinderPattern(modules, version);
	  setupTimingPattern(modules);
	  setupAlignmentPattern(modules, version);

	  // Add temporary dummy bits for format info just to set them as reserved.
	  // This is needed to prevent these bits from being masked by {@link MaskPattern.applyMask}
	  // since the masking operation must be performed only on the encoding region.
	  // These blocks will be replaced with correct values later in code.
	  setupFormatInfo(modules, errorCorrectionLevel, 0);

	  if (version >= 7) {
	    setupVersionInfo(modules, version);
	  }

	  // Add data codewords
	  setupData(modules, dataBits);

	  if (isNaN(maskPattern)) {
	    // Find best mask pattern
	    maskPattern = MaskPattern.getBestMask(modules,
	      setupFormatInfo.bind(null, modules, errorCorrectionLevel));
	  }

	  // Apply mask pattern
	  MaskPattern.applyMask(maskPattern, modules);

	  // Replace format info bits with correct values
	  setupFormatInfo(modules, errorCorrectionLevel, maskPattern);

	  return {
	    modules: modules,
	    version: version,
	    errorCorrectionLevel: errorCorrectionLevel,
	    maskPattern: maskPattern,
	    segments: segments
	  }
	}

	/**
	 * QR Code
	 *
	 * @param {String | Array} data                 Input data
	 * @param {Object} options                      Optional configurations
	 * @param {Number} options.version              QR Code version
	 * @param {String} options.errorCorrectionLevel Error correction level
	 * @param {Function} options.toSJISFunc         Helper func to convert utf8 to sjis
	 */
	qrcode.create = function create (data, options) {
	  if (typeof data === 'undefined' || data === '') {
	    throw new Error('No input text')
	  }

	  let errorCorrectionLevel = ECLevel.M;
	  let version;
	  let mask;

	  if (typeof options !== 'undefined') {
	    // Use higher error correction level as default
	    errorCorrectionLevel = ECLevel.from(options.errorCorrectionLevel, ECLevel.M);
	    version = Version.from(options.version);
	    mask = MaskPattern.from(options.maskPattern);

	    if (options.toSJISFunc) {
	      Utils.setToSJISFunction(options.toSJISFunc);
	    }
	  }

	  return createSymbol(data, version, errorCorrectionLevel, mask)
	};
	return qrcode;
}

var canvas = {};

var utils = {};

var hasRequiredUtils;

function requireUtils () {
	if (hasRequiredUtils) return utils;
	hasRequiredUtils = 1;
	(function (exports) {
		function hex2rgba (hex) {
		  if (typeof hex === 'number') {
		    hex = hex.toString();
		  }

		  if (typeof hex !== 'string') {
		    throw new Error('Color should be defined as hex string')
		  }

		  let hexCode = hex.slice().replace('#', '').split('');
		  if (hexCode.length < 3 || hexCode.length === 5 || hexCode.length > 8) {
		    throw new Error('Invalid hex color: ' + hex)
		  }

		  // Convert from short to long form (fff -> ffffff)
		  if (hexCode.length === 3 || hexCode.length === 4) {
		    hexCode = Array.prototype.concat.apply([], hexCode.map(function (c) {
		      return [c, c]
		    }));
		  }

		  // Add default alpha value
		  if (hexCode.length === 6) hexCode.push('F', 'F');

		  const hexValue = parseInt(hexCode.join(''), 16);

		  return {
		    r: (hexValue >> 24) & 255,
		    g: (hexValue >> 16) & 255,
		    b: (hexValue >> 8) & 255,
		    a: hexValue & 255,
		    hex: '#' + hexCode.slice(0, 6).join('')
		  }
		}

		exports.getOptions = function getOptions (options) {
		  if (!options) options = {};
		  if (!options.color) options.color = {};

		  const margin = typeof options.margin === 'undefined' ||
		    options.margin === null ||
		    options.margin < 0
		    ? 4
		    : options.margin;

		  const width = options.width && options.width >= 21 ? options.width : undefined;
		  const scale = options.scale || 4;

		  return {
		    width: width,
		    scale: width ? 4 : scale,
		    margin: margin,
		    color: {
		      dark: hex2rgba(options.color.dark || '#000000ff'),
		      light: hex2rgba(options.color.light || '#ffffffff')
		    },
		    type: options.type,
		    rendererOpts: options.rendererOpts || {}
		  }
		};

		exports.getScale = function getScale (qrSize, opts) {
		  return opts.width && opts.width >= qrSize + opts.margin * 2
		    ? opts.width / (qrSize + opts.margin * 2)
		    : opts.scale
		};

		exports.getImageWidth = function getImageWidth (qrSize, opts) {
		  const scale = exports.getScale(qrSize, opts);
		  return Math.floor((qrSize + opts.margin * 2) * scale)
		};

		exports.qrToImageData = function qrToImageData (imgData, qr, opts) {
		  const size = qr.modules.size;
		  const data = qr.modules.data;
		  const scale = exports.getScale(size, opts);
		  const symbolSize = Math.floor((size + opts.margin * 2) * scale);
		  const scaledMargin = opts.margin * scale;
		  const palette = [opts.color.light, opts.color.dark];

		  for (let i = 0; i < symbolSize; i++) {
		    for (let j = 0; j < symbolSize; j++) {
		      let posDst = (i * symbolSize + j) * 4;
		      let pxColor = opts.color.light;

		      if (i >= scaledMargin && j >= scaledMargin &&
		        i < symbolSize - scaledMargin && j < symbolSize - scaledMargin) {
		        const iSrc = Math.floor((i - scaledMargin) / scale);
		        const jSrc = Math.floor((j - scaledMargin) / scale);
		        pxColor = palette[data[iSrc * size + jSrc] ? 1 : 0];
		      }

		      imgData[posDst++] = pxColor.r;
		      imgData[posDst++] = pxColor.g;
		      imgData[posDst++] = pxColor.b;
		      imgData[posDst] = pxColor.a;
		    }
		  }
		}; 
	} (utils));
	return utils;
}

var hasRequiredCanvas;

function requireCanvas () {
	if (hasRequiredCanvas) return canvas;
	hasRequiredCanvas = 1;
	(function (exports) {
		const Utils = requireUtils();

		function clearCanvas (ctx, canvas, size) {
		  ctx.clearRect(0, 0, canvas.width, canvas.height);

		  if (!canvas.style) canvas.style = {};
		  canvas.height = size;
		  canvas.width = size;
		  canvas.style.height = size + 'px';
		  canvas.style.width = size + 'px';
		}

		function getCanvasElement () {
		  try {
		    return document.createElement('canvas')
		  } catch (e) {
		    throw new Error('You need to specify a canvas element')
		  }
		}

		exports.render = function render (qrData, canvas, options) {
		  let opts = options;
		  let canvasEl = canvas;

		  if (typeof opts === 'undefined' && (!canvas || !canvas.getContext)) {
		    opts = canvas;
		    canvas = undefined;
		  }

		  if (!canvas) {
		    canvasEl = getCanvasElement();
		  }

		  opts = Utils.getOptions(opts);
		  const size = Utils.getImageWidth(qrData.modules.size, opts);

		  const ctx = canvasEl.getContext('2d');
		  const image = ctx.createImageData(size, size);
		  Utils.qrToImageData(image.data, qrData, opts);

		  clearCanvas(ctx, canvasEl, size);
		  ctx.putImageData(image, 0, 0);

		  return canvasEl
		};

		exports.renderToDataURL = function renderToDataURL (qrData, canvas, options) {
		  let opts = options;

		  if (typeof opts === 'undefined' && (!canvas || !canvas.getContext)) {
		    opts = canvas;
		    canvas = undefined;
		  }

		  if (!opts) opts = {};

		  const canvasEl = exports.render(qrData, canvas, opts);

		  const type = opts.type || 'image/png';
		  const rendererOpts = opts.rendererOpts || {};

		  return canvasEl.toDataURL(type, rendererOpts.quality)
		}; 
	} (canvas));
	return canvas;
}

var svgTag = {};

var hasRequiredSvgTag;

function requireSvgTag () {
	if (hasRequiredSvgTag) return svgTag;
	hasRequiredSvgTag = 1;
	const Utils = requireUtils();

	function getColorAttrib (color, attrib) {
	  const alpha = color.a / 255;
	  const str = attrib + '="' + color.hex + '"';

	  return alpha < 1
	    ? str + ' ' + attrib + '-opacity="' + alpha.toFixed(2).slice(1) + '"'
	    : str
	}

	function svgCmd (cmd, x, y) {
	  let str = cmd + x;
	  if (typeof y !== 'undefined') str += ' ' + y;

	  return str
	}

	function qrToPath (data, size, margin) {
	  let path = '';
	  let moveBy = 0;
	  let newRow = false;
	  let lineLength = 0;

	  for (let i = 0; i < data.length; i++) {
	    const col = Math.floor(i % size);
	    const row = Math.floor(i / size);

	    if (!col && !newRow) newRow = true;

	    if (data[i]) {
	      lineLength++;

	      if (!(i > 0 && col > 0 && data[i - 1])) {
	        path += newRow
	          ? svgCmd('M', col + margin, 0.5 + row + margin)
	          : svgCmd('m', moveBy, 0);

	        moveBy = 0;
	        newRow = false;
	      }

	      if (!(col + 1 < size && data[i + 1])) {
	        path += svgCmd('h', lineLength);
	        lineLength = 0;
	      }
	    } else {
	      moveBy++;
	    }
	  }

	  return path
	}

	svgTag.render = function render (qrData, options, cb) {
	  const opts = Utils.getOptions(options);
	  const size = qrData.modules.size;
	  const data = qrData.modules.data;
	  const qrcodesize = size + opts.margin * 2;

	  const bg = !opts.color.light.a
	    ? ''
	    : '<path ' + getColorAttrib(opts.color.light, 'fill') +
	      ' d="M0 0h' + qrcodesize + 'v' + qrcodesize + 'H0z"/>';

	  const path =
	    '<path ' + getColorAttrib(opts.color.dark, 'stroke') +
	    ' d="' + qrToPath(data, size, opts.margin) + '"/>';

	  const viewBox = 'viewBox="' + '0 0 ' + qrcodesize + ' ' + qrcodesize + '"';

	  const width = !opts.width ? '' : 'width="' + opts.width + '" height="' + opts.width + '" ';

	  const svgTag = '<svg xmlns="http://www.w3.org/2000/svg" ' + width + viewBox + ' shape-rendering="crispEdges">' + bg + path + '</svg>\n';

	  if (typeof cb === 'function') {
	    cb(null, svgTag);
	  }

	  return svgTag
	};
	return svgTag;
}

var hasRequiredBrowser;

function requireBrowser () {
	if (hasRequiredBrowser) return browser;
	hasRequiredBrowser = 1;
	const canPromise = requireCanPromise();

	const QRCode = requireQrcode();
	const CanvasRenderer = requireCanvas();
	const SvgRenderer = requireSvgTag();

	function renderCanvas (renderFunc, canvas, text, opts, cb) {
	  const args = [].slice.call(arguments, 1);
	  const argsNum = args.length;
	  const isLastArgCb = typeof args[argsNum - 1] === 'function';

	  if (!isLastArgCb && !canPromise()) {
	    throw new Error('Callback required as last argument')
	  }

	  if (isLastArgCb) {
	    if (argsNum < 2) {
	      throw new Error('Too few arguments provided')
	    }

	    if (argsNum === 2) {
	      cb = text;
	      text = canvas;
	      canvas = opts = undefined;
	    } else if (argsNum === 3) {
	      if (canvas.getContext && typeof cb === 'undefined') {
	        cb = opts;
	        opts = undefined;
	      } else {
	        cb = opts;
	        opts = text;
	        text = canvas;
	        canvas = undefined;
	      }
	    }
	  } else {
	    if (argsNum < 1) {
	      throw new Error('Too few arguments provided')
	    }

	    if (argsNum === 1) {
	      text = canvas;
	      canvas = opts = undefined;
	    } else if (argsNum === 2 && !canvas.getContext) {
	      opts = text;
	      text = canvas;
	      canvas = undefined;
	    }

	    return new Promise(function (resolve, reject) {
	      try {
	        const data = QRCode.create(text, opts);
	        resolve(renderFunc(data, canvas, opts));
	      } catch (e) {
	        reject(e);
	      }
	    })
	  }

	  try {
	    const data = QRCode.create(text, opts);
	    cb(null, renderFunc(data, canvas, opts));
	  } catch (e) {
	    cb(e);
	  }
	}

	browser.create = QRCode.create;
	browser.toCanvas = renderCanvas.bind(null, CanvasRenderer.render);
	browser.toDataURL = renderCanvas.bind(null, CanvasRenderer.renderToDataURL);

	// only svg for now.
	browser.toString = renderCanvas.bind(null, function (data, _, opts) {
	  return SvgRenderer.render(data, opts)
	});
	return browser;
}

var browserExports = requireBrowser();
const QRCode = /*@__PURE__*/getDefaultExportFromCjs(browserExports);

const QRCodeMod = /*#__PURE__*/_mergeNamespaces({
  __proto__: null,
  default: QRCode
}, [browserExports]);

/**
 * print-formats.js — 固定版式纸质单据打印(2026-09-23)
 * 现有版式:
 *   ① 银嘉采购订单(用户截图,PU_ORDER 打印):头部信息+物料行表+总计+注意事项+供/需方签章框;
 *   ② 退货单(用户截图,QC_RETURN 暂收退料单 打印):公司抬头+供应商/退货日期+行表+说明+签章行;
 *   ③ 二维码标签(2026-09-24,INV 勾选即打):75×100mm 七字段标签;
 *     ③b 库位标识卡(2026-09-28,WHLOC 勾选即打):同款 75×100mm,卡面=仓库/库位地址/库位编码,二维码=仓库@库位地址@库位编码;
 *   ④ 生产任务单(打印工单,2026-09-24):横向 A4 一表多行+行尾二维码=公司代码@工单号@1000+行号(2026-10-09 规则改版,woQrText)。
 * 打印通道:新窗口 HTML + window.print()(同 QrLabelDialog,绕开 jsPDF §5.5 坑);
 * 版面文字(公司抬头/注意事项/需方联系/生产任务单表头)为固定版式常量,改文案只动本文件。
 * 业务单据为纸面事实格式,不入 tt() 翻译层(ADR-0001)。
 * 纸面「总　计」的位数与明细一致(2026-10-03 用户口径,见 @core/panel/sumTotals):
 * 明细 decimal(18,4) 的 4 位不再被 2 位截断,也不出现 0.30000000000000004 这类浮点尾巴。
 */

/** qrcode 库兼容取用:CJS 互操作下 toDataURL 可能挂在 .default 上 */
function qrLib() {
  if (typeof browserExports.toDataURL === 'function') return QRCodeMod
  if (typeof QRCode?.toDataURL === 'function') return QRCode
  return null
}

const COMPANY = {
  name: '惠州市银嘉环保科技有限公司',
  en: 'AGplus Technologies Co., Ltd',
  tel: '0752-5583930',
  fax: '0752-5583930',
  // 银嘉采购订单 抬头行
  brand: 'AGPLUS 银嘉',
  // 公司代码(2026-09-28 物料二维码口径):取旧系统 plang.comm,全库唯一值 '0';
  // 标识卡二维码前缀=公司代码@物料编码[@批号],与旧系统扫码解析口径一致
  companyCode: '0',
  // 需方签章框
  buyer: { 单位名称: '惠州市银嘉环保科技有限公司', 联系人: '孙郝聪', 联系方式: '13718162430' },
  // 生产任务单(打印工单)固定表头文字
  woTitle: '生产任务单',
  woLineLabel: '线体',
  woPreparedBy: '制单',
  woColumns: ['序', '客户', '成品品名', '批号', '规格', '重点管控', 'PO单号', '排产数量', '每箱数量', '盘数', '交期', '备注', '二维码'],
  // 银嘉采购订单 注意事项(固定条款,转录自用户提供的纸面格式)
  notes: [
    '1.交货要求：供应商应在收到订单的24小时内回复是否可以按照要求日期交货，如未回复，视为同意我方交期要求，逾期对我方造成的损失，我方保留追究供应商责任的权利。',
    '2.品质要求：来料必须符合我方对产品的品质标准。',
    '3.包装要求：必须为外包装标识卡片且只有一个标识卡，同种物料标签需统一。',
    '4.标签要求：每批来料必须清楚地标签，标签单上面的物料名称、数量须与本订单合同保持一致，来料解送到我司仓库；对送货单未注明标识的产品，我司有权拒收或退回。',
    '5.验收标准：我方在收到货后的15天内检验并开出品质异议，包括订单数量、品质等。',
  ],
};

const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtDate = (v) => (v == null || v === '' ? '' : String(v).slice(0, 10).replace('T', ' '));
const fmtNum = (v) => {
  const n = Number(v);
  return v == null || v === '' || Number.isNaN(n) ? '' : String(n)
};

/** 新窗口打开打印(自动调起 print 对话框);宽表横向由各自 @page 控制 */
function openPrintWindow(title, bodyHtml) {
  const w = window.open('', '_blank', 'width=1100,height=780');
  if (!w) return false
  w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>'
    + '@page{size:A4 portrait;margin:10mm}'
    + 'body{font-family:"Microsoft YaHei",system-ui,sans-serif;margin:0;color:#111;font-size:12px}'
    + '</style></head><body>' + bodyHtml
    + '<scr' + 'ipt>window.onload=function(){setTimeout(function(){window.print()},200)}</scr' + 'ipt></body></html>');
  w.document.close();
  return true
}

/**
 * 生产任务单三模板(2026-09-27 用户截图版式,生产工单列表/工单排产看板共用):
 *   成型生产任务单——横向 A4,列含 成型折算后数量;组装生产任务单——同列结构无折算列;
 *   行尾二维码 = 公司代码@工单号@(1000+工单行号)(woQrText,2026-10-09 规则改版;旧 工单号|批号|物料编码|排产数量|生产线 作废)。
 * @param title '成型生产任务单' | '组装生产任务单'
 * @param rows  [{单据编号,公司代码?,工单行号?,是否重点管控产品,商品编码,商品名称,规格型号,订单数量,成型折算后数量,计划完工日期,批号,物料编码,排产数量,生产线}]
 */
/** 工单二维码内容(2026-10-09 规则改版):公司代码@工单号@(1000+工单行号),行号 3 位不足补 0。
 *  例:0@GD2608100001@1003 —— 尾段 = '1' + 3位行号补0 = 1000+行号;行号缺省按 1(MANU_ORDER 单行工单),
 *  公司代码缺省取 COMPANY.companyCode(plang.comm 全库唯一 '0')。扫码报工/领料按本口径解析。 */
function woQrText(wo) {
  const no = String(wo?.['工单号'] ?? wo?.['单据编号'] ?? wo?.['合同号'] ?? wo?.['加工单号'] ?? '').trim();
  const xc = Number.parseInt(wo?.['工单行号'], 10);
  const comm = String(wo?.['公司代码'] ?? '').trim() || COMPANY.companyCode;
  return `${comm}@${no}@${1000 + (Number.isFinite(xc) ? xc : 1)}`
}

const TASK_SHEET_COLUMNS = {
  '成型生产任务单': ['单据编号', '是否重点管控产品', '商品编码', '商品名称', '规格型号', '订单数量', '成型折算后数量', '计划完工日期'],
  '组装生产任务单': ['单据编号', '是否重点管控产品', '商品编码', '商品名称', '规格型号', '订单数量', '计划完工日期'],
};

async function printWorkTaskSheet(title, rows, opts = {}) {
  const cols = TASK_SHEET_COLUMNS[title];
  if (!cols) return false
  const list = (Array.isArray(rows) ? rows : []).filter((r) => r && r['单据编号']);
  if (!list.length) return false
  const line = opts.line || '';
  const user = opts.preparedBy || '';
  const stamp = (() => { const n = new Date(); return `${n.getFullYear()}/${n.getMonth() + 1}/${n.getDate()} ${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}:${String(n.getSeconds()).padStart(2, '0')}` })();
  const trs = [];
  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    let qr = '';
    try {
      const lib = qrLib();
      if (!lib) throw new Error('qrcode lib unavailable')
      qr = await lib.toDataURL(woQrText(r), { margin: 1, errorCorrectionLevel: 'M' });
    } catch (e) { console.warn('[print-formats] 工单二维码生成失败:', e?.message || e); }
    trs.push('<tr><td>' + (i + 1) + '</td>'
      + `<td>${esc(r['单据编号'])}</td><td>${esc(r['是否重点管控产品'])}</td>`
      + `<td>${esc(r['商品编码'])}</td><td>${esc(r['商品名称'])}</td><td>${esc(r['规格型号'])}</td>`
      + `<td class="r">${esc(fmtNum(r['订单数量']))}</td>`
      + (title === '成型生产任务单' ? `<td class="r">${esc(fmtNum(r['成型折算后数量']))}</td>` : '')
      + `<td>${esc(r['计划完工日期'])}</td>`
      + `<td class="qr">${qr ? `<img src="${qr}"/>` : ''}</td></tr>`);
  }
  const ths = '<th>序号</th><th>单据编号</th><th>是否重点管控产品</th><th>商品编码</th><th>商品名称</th><th>规格型号</th><th>订单数量</th>'
    + (title === '成型生产任务单' ? '<th>成型折算后数量</th>' : '') + '<th>计划完工日期</th><th>二维码</th>';
  const body = '<style>'
    + '@page{size:A4 landscape;margin:8mm}'
    + 'body{font-family:"Microsoft YaHei",system-ui,sans-serif;margin:0;color:#111;font-size:12px}'
    + '.hd{display:flex;align-items:baseline;gap:18px;margin-bottom:6px}'
    + '.hd .t{flex:1;text-align:center;font-size:20px;font-weight:700;letter-spacing:6px}'
    + '.hd .s{font-size:12px;color:#333;white-space:nowrap}'
    + 'table{width:100%;border-collapse:collapse;table-layout:fixed}'
    + 'th,td{border:1px solid #444;padding:4px 5px;font-size:11px;word-break:break-all;vertical-align:middle}'
    + 'th{background:#f2f2f2;font-weight:600}'
    + 'td.qr{text-align:center;padding:2px}td.qr img{width:64px;height:64px}'
    + '</style>'
    + '<div class="hd"><span class="s">' + esc(COMPANY.woLineLabel) + ': ' + esc(line) + '</span>'
    + '<span class="t">' + esc(title) + '</span>'
    + '<span class="s">' + esc(COMPANY.woPreparedBy) + ': ' + esc(user) + '　' + esc(stamp) + '</span></div>'
    + '<table><thead><tr>' + ths + '</tr></thead><tbody>' + trs.join('') + '</tbody></table>';
  if (!openPrintWindow(title, body)) { alert('浏览器拦截了打印窗口,请允许弹出窗口'); return false }
  return true
}

/**
 * ⚠ 2026-10-14 已删除 `printFeedingSheet`(生产投料单版式):它的物料明细行全部来自
 *   自建 BOM(/px/workOrderBom → bs_bom),随 MES 自建「物料清单(BOM)」功能整体下线,
 *   两个调用点(工单列表 / 工单排产看板)的「生产投料单」打印项同步移除。若将来有了新的
 *   投料数据源,按原截图版式重新实现即可(纵向 A4、每工单一页、物料表=定额×需求数量)。
 */

/**
 * 银嘉采购单据固定版式公共块(2026-09-28 采购入库单·无金额版与采购订单共用;改文案/版式只动这里):
 * CSS 与 品牌/注意事项/供/需签章框 两版式逐字相同——抽常量防复制粘贴,纸面事实文案不入 tt()(ADR-0001)。
 */
const PU_SHEET_CSS = '<style>'
  + '.brand{font-size:11px;color:#333;margin-bottom:2px}'
  + '.brand b{font-size:14px;color:#1e6fb8;margin-right:8px}'
  + 'h1{font-size:20px;text-align:center;margin:2px 0 10px;letter-spacing:4px;font-weight:700}'
  + '.info{display:grid;grid-template-columns:1fr 1fr;gap:6px 40px;margin:0 0 10px;font-size:12px}'
  + '.info .f{white-space:nowrap}.info .f b{font-weight:400}'
  + '.info .v{display:inline-block;min-width:180px;border-bottom:1px dotted #666;padding:0 6px 1px}'
  + '.info .v.s{min-width:80px}'
  + 'table{width:100%;border-collapse:collapse;table-layout:fixed}'
  + 'th,td{border:1px solid #444;padding:4px 5px;font-size:11px;word-break:break-all;vertical-align:middle}'
  + 'th{background:#f2f2f2;font-weight:600}'
  + 'td.r{text-align:right}td.c{text-align:center}'
  + '.sum td{background:#fafafa;font-weight:600}'
  + '.notes{margin:10px 0 8px;font-size:11px;line-height:1.55}'
  + '.notes .t{font-weight:700;font-size:12px;margin-bottom:2px}'
  + '.sign{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:8px}'
  + '.sign .box{border:1px solid #444;min-height:110px;padding:6px 10px;font-size:12px;line-height:1.9}'
  + '.sign .box .t{text-align:center;font-weight:600;letter-spacing:8px;margin-bottom:4px}'
  + '</style>';
const PU_BRAND_HTML = `<div class="brand"><b>${esc(COMPANY.brand)}</b>${esc(COMPANY.en)}　${esc(COMPANY.name)}</div>`;
const PU_NOTES_HTML = `<div class="notes"><div class="t">注意事项：</div>${COMPANY.notes.map((n) => `<div>${esc(n)}</div>`).join('')}</div>`;
const PU_SIGN_HTML = '<div class="sign">'
  + '<div class="box"><div class="t">供　方</div>单位名称：<br/>联 系 人：<br/>联系方式：</div>'
  + `<div class="box"><div class="t">需　方</div>单位名称：${esc(COMPANY.buyer['单位名称'])}<br/>联 系 人：${esc(COMPANY.buyer['联系人'])}<br/>联系方式：${esc(COMPANY.buyer['联系方式'])}</div>`
  + '</div>';

/**
 * 银嘉采购订单
 * @param doc  头数据(单据编号/单据日期/供应商编码/供应商/付款方式)
 * @param lines 行数据(物料编码/物料名称/规格型号/单价/单位/数量/金额/预计到货日期/备注/税率%)
 */
function printPuOrder(doc, lines) {
  const rows = (Array.isArray(lines) ? lines : []).filter((l) => l && (l['物料编码'] || l['物料名称']));
  const pad = Math.max(0, 4 - rows.length);
  const tax = rows.some((l) => Number(l['税率%']) > 0) ? '是' : '否';
  const totalQty = sumKeepScale(rows.map((l) => l['数量'])) ?? 0;
  const totalAmt = sumKeepScale(rows.map((l) => l['金额'])) ?? 0;
  const trs = rows.map((l) => '<tr>'
    + `<td>${esc(l['物料编码'])}</td><td>${esc(l['物料名称'])}</td><td>${esc(l['规格型号'])}</td>`
    + `<td class="r">${esc(fmtNum(l['单价']))}</td><td>${esc(l['单位'])}</td><td class="r">${esc(fmtNum(l['数量']))}</td>`
    + `<td class="r">${esc(fmtNum(l['金额']))}</td><td>${esc(fmtDate(l['预计到货日期']) || fmtDate(doc['交货日期']))}</td>`
    + `<td>${esc(l['备注'])}</td></tr>`).join('')
    + Array.from({ length: pad }, () => '<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>').join('');
  const body = PU_SHEET_CSS
    + PU_BRAND_HTML
    + '<h1>银嘉采购订单</h1>'
    + '<div class="info">'
    + `<span class="f">订单编号：<span class="v">${esc(doc['单据编号'])}</span></span>`
    + `<span class="f">下单日期：<span class="v">${esc(fmtDate(doc['单据日期']))}</span></span>`
    + `<span class="f">供应商编号：<span class="v">${esc(doc['供应商编码'])}</span></span>`
    + `<span class="f">供应商名称：<span class="v">${esc(doc['供应商'])}</span></span>`
    + `<span class="f">付款方式：<span class="v s">${esc(doc['付款方式'])}</span></span>`
    + `<span class="f">是否含税：<span class="v s">${tax}</span></span>`
    + '</div>'
    + '<table><thead><tr>'
    + ['物料编码', '物料名称', '粉料规格及要求', '单价', '单位', '数量', '小计', '交期要求', '备注']
        .map((h) => `<th>${esc(h)}</th>`).join('')
    + '</tr></thead><tbody>' + trs
    + `<tr class="sum"><td colspan="5" class="c">总　计</td>`
    + `<td class="r">${esc(fmtNum(totalQty))}</td><td class="r">${esc(fmtNum(totalAmt))}</td><td></td><td></td></tr>`
    + '</tbody></table>'
    + PU_NOTES_HTML
    + PU_SIGN_HTML;
  if (!openPrintWindow('银嘉采购订单-' + (doc['单据编号'] || doc['单号'] || doc['编号'] || ''), body)) alert('浏览器拦截了打印窗口,请允许弹出窗口');
}

/**
 * 银嘉采购订单·无金额版(2026-09-28 用户澄清:不是入库单报表,是采购订单的另一种打印版式)——
 * 与 printPuOrder 同一标题/信息区(含付款方式/是否含税)/注意事项/签章框,仅三处金额内容不打印:
 * 行表去 单价/小计 两列(交期要求保留),总计行只留数量合计。
 * @param doc  头数据(同 printPuOrder)
 * @param lines 行数据(同 printPuOrder:物料编码/物料名称/规格型号/单价/单位/数量/金额/预计到货日期/备注)
 */
function printPuOrderNoAmount(doc, lines) {
  const rows = (Array.isArray(lines) ? lines : []).filter((l) => l && (l['物料编码'] || l['物料名称']));
  const pad = Math.max(0, 4 - rows.length);
  const tax = rows.some((l) => Number(l['税率%']) > 0) ? '是' : '否';
  const totalQty = sumKeepScale(rows.map((l) => l['数量'])) ?? 0;
  const trs = rows.map((l) => '<tr>'
    + `<td>${esc(l['物料编码'])}</td><td>${esc(l['物料名称'])}</td><td>${esc(l['规格型号'])}</td>`
    + `<td>${esc(l['单位'])}</td><td class="r">${esc(fmtNum(l['数量']))}</td>`
    + `<td>${esc(fmtDate(l['预计到货日期']) || fmtDate(doc['交货日期']))}</td>`
    + `<td>${esc(l['备注'])}</td></tr>`).join('')
    + Array.from({ length: pad }, () => '<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>').join('');
  const body = PU_SHEET_CSS
    + PU_BRAND_HTML
    + '<h1>银嘉采购订单</h1>'
    + '<div class="info">'
    + `<span class="f">订单编号：<span class="v">${esc(doc['单据编号'])}</span></span>`
    + `<span class="f">下单日期：<span class="v">${esc(fmtDate(doc['单据日期']))}</span></span>`
    + `<span class="f">供应商编号：<span class="v">${esc(doc['供应商编码'])}</span></span>`
    + `<span class="f">供应商名称：<span class="v">${esc(doc['供应商'])}</span></span>`
    + `<span class="f">付款方式：<span class="v s">${esc(doc['付款方式'])}</span></span>`
    + `<span class="f">是否含税：<span class="v s">${tax}</span></span>`
    + '</div>'
    + '<table><thead><tr>'
    + ['物料编码', '物料名称', '粉料规格及要求', '单位', '数量', '交期要求', '备注']
        .map((h) => `<th>${esc(h)}</th>`).join('')
    + '</tr></thead><tbody>' + trs
    + `<tr class="sum"><td colspan="4" class="c">总　计</td>`
    + `<td class="r">${esc(fmtNum(totalQty))}</td><td></td><td></td></tr>`
    + '</tbody></table>'
    + PU_NOTES_HTML
    + PU_SIGN_HTML;
  if (!openPrintWindow('银嘉采购订单(无金额)-' + (doc['单据编号'] || doc['单号'] || doc['编号'] || ''), body)) alert('浏览器拦截了打印窗口,请允许弹出窗口');
}

/**
 * 退货单(暂收退料单)
 * @param doc  头数据(单据编号/单据日期/供应商)
 * @param lines 行数据(物料编码/物料名称/型号/数量/计量单位/不良原因/备注)
 */
function printQcReturn(doc, lines) {
  const rows = (Array.isArray(lines) ? lines : []).filter((l) => l && (l['物料编码'] || l['物料名称']));
  const pad = Math.max(0, 4 - rows.length);
  const trs = rows.map((l) => '<tr>'
    + `<td>${esc(l['物料编码'])}</td><td>${esc(l['物料名称'])}</td><td>${esc(l['型号'])}</td>`
    + `<td class="r">${esc(fmtNum(l['数量']))}</td><td class="c">${esc(l['计量单位'])}</td>`
    + `<td>${esc(l['不良原因'])}</td><td>${esc(l['备注'])}</td></tr>`).join('')
    + Array.from({ length: pad }, () => '<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>').join('');
  const body = '<style>'
    + '.hd{text-align:center}'
    + '.hd .cn{font-size:22px;font-weight:700;letter-spacing:2px}'
    + '.hd .en{font-size:13px;margin:2px 0}'
    + '.hd .tel{font-size:12px;margin-bottom:8px}'
    + 'h1{font-size:20px;text-align:center;margin:4px 0 12px;letter-spacing:16px;font-weight:700}'
    + '.top{display:flex;align-items:flex-end;gap:24px;margin-bottom:8px;font-size:12px}'
    + '.top .f{white-space:nowrap}.top .f b{font-weight:400}'
    + '.top .v{display:inline-block;border-bottom:1px solid #444;padding:0 30px 1px 4px}'
    + '.top .grow{flex:1}'
    + 'table{width:100%;border-collapse:collapse;table-layout:fixed}'
    + 'th,td{border:1px solid #444;padding:5px;font-size:11px;word-break:break-all;vertical-align:middle}'
    + 'th{background:#f2f2f2;font-weight:600}'
    + 'td.r{text-align:right}td.c{text-align:center}'
    + '.memo{border:1px solid #444;border-top:none;padding:6px 8px;font-size:12px}'
    + '.sign{display:flex;border:1px solid #444;border-top:none;padding:8px;font-size:12px}'
    + '.sign span{flex:1}'
    + '</style>'
    + '<div class="hd"><div class="cn">' + esc(COMPANY.name) + '</div>'
    + `<div class="en">${esc(COMPANY.en)}</div>`
    + `<div class="tel">电话：${esc(COMPANY.tel)} ／ 传真：${esc(COMPANY.fax)}</div></div>`
    + '<h1>退货单</h1>'
    + '<div class="top">'
    + `<span class="f">供应商：<span class="v">${esc(doc['供应商'])}</span></span>`
    + '<span class="grow"></span>'
    + `<span class="f">退货日期：<span class="v">${esc(fmtDate(doc['单据日期']))}</span></span>`
    + '</div>'
    + '<table><thead><tr>'
    + ['产品编码', '物料名称', '规格', '数量', '单位', '退货原因', '备　注'].map((h) => `<th>${esc(h)}</th>`).join('')
    + '</tr></thead><tbody>' + trs + '</tbody></table>'
    + '<div class="memo">说明：货物数量及规格请当面点清验收。</div>'
    + '<div class="sign"><span>总经理：</span><span>财务：</span><span>采购：</span><span>仓管：</span><span>供应商：</span></div>';
  if (!openPrintWindow('退货单-' + (doc['单据编号'] || doc['单号'] || doc['编号'] || ''), body)) alert('浏览器拦截了打印窗口,请允许弹出窗口');
}

/**
 * 二维码标签·新版式(2026-09-24 用户拍板,替代 80×80 旧版式):商品界面「二维码标签」勾选即打。
 * 75×100mm 标签纸,一品一卡,一卡一页;字段=订单编号/供应商名称/物料编码/物料规格/数量/批次/生产日期
 * ——编码·规格取商品行,其余留横线手填;二维码=公司代码@物料编码[@批号](2026-09-28 口径,见下),
 * 置于右下角,距边框 ≥5mm 不重合。旧服务端版式 /report/qr-label(inv-qr-label.jrxml)暂留可回滚。
 * 2026-09-28 采购入库单「打印标识卡」复用本版式:同一卡面,但行对象可多带可选键
 * (订单编号/供应商名称/数量/批次/生产日期)——单据上有事实值即打印填充,缺键行为与商品档案完全一致(留空手填)。
 * 2026-09-28 二次修正(用户实打反馈):供应商名称过长时 nowrap 溢出卡边 → 改 flex 版式——
 * 标签恒不折行(.lb),值区占剩余宽度、过长自动转行(.v word-break:break-all),空值仍留 22mm 手填横线。
 * 2026-09-28 三修(用户拍板):二维码内容改旧系统扫码口径——
 * 带批号=公司代码@物料编码@批号(如 0@XH-SX80250SX@20060908,采购入库单行);
 * 不带批号=公司代码@物料编码(如 0@XH-SX80250SX,商品档案行/无批次行)。规格·数量不再进码。
 * 公司代码取旧系统 plang.comm(全库唯一 '0'),常量见 COMPANY.companyCode。
 * @param rows [{编码, 规格, 数量?, 批次?, 订单编号?, 供应商名称?, 生产日期?}]
 */
/** 标识卡二维码内容:公司代码@物料编码[@批号](批号空→两段;2026-09-28 旧系统扫码口径) */
function productCardQrText(card, companyCode = COMPANY.companyCode) {
  return [companyCode, card['编码'], card['批次'] || ''].filter((s) => s !== '' && s != null).join('@')
}

async function printProductCards(rows) {
  const cards = (Array.isArray(rows) ? rows : []).filter((r) => r && r['编码']);
  if (!cards.length) return false
  const pageCss = '@page{size:75mm 100mm;margin:0}';
  const cardCss = '.card{width:75mm;height:100mm;box-sizing:border-box;border:0.35mm solid #000;'
    + 'padding:5mm 5mm 26mm 5mm;position:relative;page-break-after:always;background:#fff;font-family:"Microsoft YaHei",system-ui,sans-serif;color:#111}'
    + '.card:last-child{page-break-after:auto}'
    + '.card .f{display:flex;align-items:flex-end;margin:2.2mm 0;line-height:1.3;font-size:10pt}'
    + '.card .f .lb{flex:none;white-space:nowrap}'
    + '.card .f .v{flex:0 1 auto;min-width:22mm;border-bottom:0.25mm solid #000;padding:0 1mm 0.4mm;font-size:9.5pt;word-break:break-all;overflow-wrap:anywhere}'
    + '.card .qr{position:absolute;right:6mm;bottom:6mm;width:20mm;height:20mm}'
    + '.card .qr img{width:20mm;height:20mm;display:block}'
    + 'body{margin:0;background:#fff}';
  const trs = [];
  for (const c of cards) {
    const qrText = productCardQrText(c);
    let qr = '';
    try {
      const lib = qrLib();
      if (!lib) throw new Error('qrcode lib unavailable')
      qr = await lib.toDataURL(qrText, { margin: 1, errorCorrectionLevel: 'M' });
    } catch (e) { console.warn('[print-formats] 二维码生成失败:', e?.message || e); }
    const f = (label, value) => `<div class="f"><span class="lb">${label}：</span><span class="v">${esc(value || '')}</span></div>`;
    trs.push('<div class="card">'
      + f('订单编号', c['订单编号']) + f('供应商名称', c['供应商名称'])
      + f('物料编码', c['编码']) + f('物料规格', c['规格'])
      + f('数　　量', c['数量']) + f('批　　次', c['批次']) + f('生产日期', c['生产日期'])
      + `<div class="qr">${qr ? `<img src="${qr}"/>` : ''}</div>`
      + '</div>');
  }
  const body = '<style>' + pageCss + cardCss + '</style>' + trs.join('');
  if (!openPrintWindow('产品标识卡', body)) { alert('浏览器拦截了打印窗口,请允许弹出窗口'); return false }
  return true
}

/**
 * 库位标识卡(WHLOC 库位档案「二维码标签」勾选即打,2026-09-28)——与商品标识卡同款 75×100mm 版式,
 * 卡面只放库位字段(仓库/库位地址/库位编码),不含商品标识卡的 订单编号/供应商/数量/批次/生产日期 等字段
 * (用户口径:库位卡只服务定位)。二维码=仓库编码@库位地址@库位编码(固定三段,空段保留占位;
 * 2026-09-28 同日改版:首段 仓库→仓库编码,扫码按编码定位仓库,仓库编码选仓库时参照带回自动填)。
 * 卡面 CSS 与 printProductCards 同构:标签恒不折行(.lb),值区过长自动转行,二维码右下角 20×20mm。
 * @param rows [{仓库, 仓库编码, 库位地址, 库位编码}](库位编码=行身份,缺码行跳过)
 */
/** 库位标识卡二维码内容:仓库编码@库位地址@库位编码(三段固定顺序,空段保留占位) */
function locationCardQrText(loc) {
  return [loc?.['仓库编码'], loc?.['库位地址'], loc?.['库位编码']].map((s) => String(s ?? '').trim()).join('@')
}

async function printLocationCards(rows) {
  const cards = (Array.isArray(rows) ? rows : []).filter((r) => r && r['库位编码']);
  if (!cards.length) return false
  const pageCss = '@page{size:75mm 100mm;margin:0}';
  const cardCss = '.card{width:75mm;height:100mm;box-sizing:border-box;border:0.35mm solid #000;'
    + 'padding:5mm 5mm 26mm 5mm;position:relative;page-break-after:always;background:#fff;font-family:"Microsoft YaHei",system-ui,sans-serif;color:#111}'
    + '.card:last-child{page-break-after:auto}'
    + '.card .f{display:flex;align-items:flex-end;margin:2.2mm 0;line-height:1.3;font-size:10.5pt}'
    + '.card .f .lb{flex:none;white-space:nowrap}'
    + '.card .f .v{flex:0 1 auto;min-width:22mm;border-bottom:0.25mm solid #000;padding:0 1mm 0.4mm;font-size:10pt;word-break:break-all;overflow-wrap:anywhere}'
    + '.card .qr{position:absolute;right:6mm;bottom:6mm;width:20mm;height:20mm}'
    + '.card .qr img{width:20mm;height:20mm;display:block}'
    + 'body{margin:0;background:#fff}';
  const trs = [];
  for (const c of cards) {
    const qrText = locationCardQrText(c);
    let qr = '';
    try {
      const lib = qrLib();
      if (!lib) throw new Error('qrcode lib unavailable')
      qr = await lib.toDataURL(qrText, { margin: 1, errorCorrectionLevel: 'M' });
    } catch (e) { console.warn('[print-formats] 库位二维码生成失败:', e?.message || e); }
    const f = (label, value) => `<div class="f"><span class="lb">${label}：</span><span class="v">${esc(value || '')}</span></div>`;
    trs.push('<div class="card">'
      + f('仓　　库', c['仓库']) + f('库位地址', c['库位地址']) + f('库位编码', c['库位编码'])
      + `<div class="qr">${qr ? `<img src="${qr}"/>` : ''}</div>`
      + '</div>');
  }
  const body = '<style>' + pageCss + cardCss + '</style>' + trs.join('');
  if (!openPrintWindow('库位标识卡', body)) { alert('浏览器拦截了打印窗口,请允许弹出窗口'); return false }
  return true
}

/**
 * 生产任务单(打印工单) — 横向 A4,一行=一张工单,行尾二维码;工单排产看板与生产工单面板共用本实现。
 * 二维码内容=公司代码@工单号@(1000+工单行号)(woQrText,2026-10-09 规则改版;扫码报工/领料入口口径)。
 * @param rows [{加工单号,公司代码?,工单行号?,客户,产品名称,批号,规格型号,重点管控,客户PO,排产数量,每箱数量,箱数,计划完工日期,备注,生产线}]
 * @param opts {line?:string, preparedBy?:string}
 * @return Promise<boolean> true=已送出打印(窗口未被拦截)
 */
async function printProductionTask(rows, opts = {}) {
  const list = (Array.isArray(rows) ? rows : []).filter((r) => r && r['加工单号']);
  if (!list.length) return false
  const line = opts.line || list[0]['生产线'] || '';
  const user = opts.preparedBy || '';
  const now = new Date();
  const stamp = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()} `
    + `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  const trs = [];
  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    let qr = '';
    try {
      const lib = qrLib();
      if (!lib) throw new Error('qrcode lib unavailable')
      qr = await lib.toDataURL(woQrText(r), { margin: 1, errorCorrectionLevel: 'M' });
    } catch (e) { console.warn('[print-formats] 工单二维码生成失败:', e?.message || e); }
    trs.push('<tr>'
      + `<td>${i + 1}</td>`
      + `<td>${esc(r['客户'])}</td><td>${esc(r['产品名称'])}</td><td>${esc(r['批号'])}</td>`
      + `<td>${esc(r['规格型号'])}</td><td>${esc(r['重点管控'])}</td><td>${esc(r['客户PO'])}</td>`
      + `<td>${esc(fmtNum(r['排产数量']))}</td><td>${esc(fmtNum(r['每箱数量']))}</td><td>${esc(fmtNum(r['箱数']))}</td>`
      + `<td>${esc(r['计划完工日期'])}</td><td>${esc(r['备注'])}</td>`
      + `<td class="qr">${qr ? `<img src="${qr}"/>` : ''}</td></tr>`);
  }
  const body = '<style>'
    + '@page{size:A4 landscape;margin:8mm}'
    + 'body{font-family:system-ui,"Microsoft YaHei",sans-serif;margin:0;color:#111}'
    + '.hd{display:flex;align-items:baseline;gap:18px;margin-bottom:6px}'
    + '.hd .t{flex:1;text-align:center;font-size:20px;font-weight:700;letter-spacing:6px}'
    + '.hd .s{font-size:12px;color:#333;white-space:nowrap}'
    + 'table{width:100%;border-collapse:collapse;table-layout:fixed}'
    + 'th,td{border:1px solid #444;padding:4px 5px;font-size:11px;word-break:break-all;vertical-align:middle}'
    + 'th{background:#f2f2f2;font-weight:600}'
    + 'td.qr{text-align:center;padding:2px}td.qr img{width:64px;height:64px}'
    + '</style>'
    + '<div class="hd"><span class="s">' + esc(COMPANY.woLineLabel) + ': ' + esc(line) + '</span>'
    + '<span class="t">' + esc(COMPANY.woTitle) + '</span>'
    + '<span class="s">' + esc(COMPANY.woPreparedBy) + ': ' + esc(user) + '　' + esc(stamp) + '</span></div>'
    + '<table><thead><tr>'
    + COMPANY.woColumns.map((h) => `<th>${esc(h)}</th>`).join('')
    + '</tr></thead><tbody>' + trs.join('') + '</tbody></table>';
  if (!openPrintWindow(COMPANY.woTitle, body)) { alert('浏览器拦截了打印窗口,请允许弹出窗口'); return false }
  return true
}

export { QRCode as Q, printPuOrder as a, printPuOrderNoAmount as b, printQcReturn as c, printLocationCards as d, printProductionTask as e, printWorkTaskSheet as f, printProductCards as p, woQrText as w };
