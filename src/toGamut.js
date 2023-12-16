import * as util from "./util.js";
import ColorSpace from "./space.js";
import defaults from "./defaults.js";
import deltaE2000 from "./deltaE/deltaE2000.js";
import deltaEHCT from "./deltaE/deltaEHCT.js";
import deltaEOK from "./deltaE/deltaEOK.js";
import inGamut from "./inGamut.js";
import to from "./to.js";
import get from "./get.js";
import set from "./set.js";
import clone from "./clone.js";
import getColor from "./getColor.js";
import {WHITES} from "./adapt.js";

/**
 * Force coordinates to be in gamut of a certain color space.
 * Mutates the color it is passed.
 * @param {Object|string} options object or spaceId string
 * @param {string} options.method - How to force into gamut.
 *        If "clip", coordinates are just clipped to their reference range.
 *        If "css", coordinates are reduced according to the CSS 4 Gamut Mapping Algorithm.
 *        If in the form [colorSpaceId].[coordName], that coordinate is reduced
 *        until the color is in gamut. Please note that this may produce nonsensical
 *        results for certain coordinates (e.g. hue) or infinite loops if reducing the coordinate never brings the color in gamut.
 * @param {ColorSpace|string} options.space - The space whose gamut we want to map to
 */

export default function toGamut (color, { method = defaults.gamut_mapping, space = color.space } = {}) {
	if (util.isString(arguments[1])) {
		space = arguments[1];
	}

	space = ColorSpace.get(space);

	// 3 spaces:
	// color.space: current color space
	// space: space whose gamut we are mapping to
	// mapSpace: space with the coord we're reducing

	let spaceColor = to(color, space);
	if (method === "css") {
		spaceColor = to(toGamutCSS(color, { space }), color.space);
	}
	else if (method === "hct") {
		spaceColor = to(toGamutHCT(color, { space }), color.space);
	}
	else {
		if (inGamut(color, space, { epsilon: 0 })) {
			return getColor(color);
		}

		if (method !== "clip" && !inGamut(color, space)) {
			let clipped = toGamut(clone(spaceColor), { method: "clip", space });
			if (deltaE2000(color, clipped) > 2) {
				// Reduce a coordinate of a certain color space until the color is in gamut
				let coordMeta = ColorSpace.resolveCoord(method);
				let mapSpace = coordMeta.space;
				let coordId = coordMeta.id;

				let mappedColor = to(spaceColor, mapSpace);
				let bounds = coordMeta.range || coordMeta.refRange;
				let min = bounds[0];
				let ε = .01; // for deltaE
				let low = min;
				let high = get(mappedColor, coordId);

				while (high - low > ε) {
					let clipped = clone(mappedColor);
					clipped = toGamut(clipped, { space, method: "clip" });
					let deltaE = deltaE2000(mappedColor, clipped);

					if (deltaE - 2 < ε) {
						low = get(mappedColor, coordId);
					}
					else {
						high = get(mappedColor, coordId);
					}

					set(mappedColor, coordId, (low + high) / 2);
				}

				spaceColor = to(mappedColor, space);
			}
			else {
				spaceColor = clipped;
			}
		}

		if (method === "clip" // Dumb coord clipping
			// finish off smarter gamut mapping with clip to get rid of ε, see #17
			|| !inGamut(spaceColor, space, { epsilon: 0 })
		) {
			let bounds = Object.values(space.coords).map(c => c.range || []);

			spaceColor.coords = spaceColor.coords.map((c, i) => {
				let [min, max] = bounds[i];

				if (min !== undefined) {
					c = Math.max(min, c);
				}

				if (max !== undefined) {
					c = Math.min(c, max);
				}

				return c;
			});
		}
	}

	if (space !== color.space) {
		spaceColor = to(spaceColor, color.space);
	}

	color.coords = spaceColor.coords;
	return color;
}

toGamut.returns = "color";

// The reference colors to be used if lightness is out of the range.
// XYZ D65 is used as a generic space as it is always present and works
// for any LCh space that is being used as the mapping space.
const COLORS = {
	WHITE: { space: "xyz", coords: WHITES.D65 },
	BLACK: { space: "xyz", coords: [0, 0, 0] }
};

/**
 * Given a color `origin`, returns a new color that is in gamut using
 * the CSS Gamut Mapping Algorithm. If `space` is specified, it will be in gamut
 * in `space`, and returned in `space`. Otherwise, it will be in gamut and
 * returned in the color space of `origin`.
 * @param {Object} origin
 * @param {Object} options
 * @param {ColorSpace|string} options.space
 * @returns {Color}
 */
export function toGamutCSS (origin, { space = origin.space }) {
	return chromaReductionCSS(origin, {space: space})
}

/**
 * Given a color `origin`, returns a new color that is in gamut using
 * the CSS Gamut Mapping Algorithm. If `space` is specified, it will be in gamut
 * in `space`, and returned in `space`. Otherwise, it will be in gamut and
 * returned in the color space of `origin`.
 * @param {Object} origin
 * @param {Object} options
 * @param {ColorSpace|string} options.space
 * @returns {Color}
 */
export function toGamutHCT (origin, { space = origin.space }) {
	return chromaReductionCSS(
		origin,
		{
			space: space,
			ε: 0.001,
			mapSpace:
			"hct", deltaE:
			deltaEHCT, indexL:
			2, maxL:
			100
		}
	);
}

/**
 * A chroma reduction MINDE approach to gamut mapping as specified in the CSS
 * spec. Given a color `origin`, returns a new color that is in gamut using
 * the CSS Gamut Mapping Algorithm. If `space` is specified, it will be in
 * gamut in `space`, and returned in `space`. Otherwise, it will be in gamut
 * and returned in the color space of `origin`. By default, this conforms
 * to CSS requirements and uses Oklch, but can be configured to use other
 * LCh like spaces.
 */
export function chromaReductionCSS (
	origin,
	{
		space = origin.space,
		JND = 0.02,
		ε = 0.0001,
		mapSpace = "oklch",
		deltaE = deltaEOK,
		indexC = 1,
		indexL = 0,
		maxL = 1,
		minL = 0
	} = {}
) {
	const threshold = 0.0001;
	space = ColorSpace.get(space);

	if (space.isUnbounded) {
		return to(origin, space);
	}

	const mappingSpace = to(origin, ColorSpace.get(mapSpace));
	let L = mappingSpace.coords[indexL];

	// return media white or black, if lightness is out of range
	// XYZ is always available and is a safe, generic black and white to use.
	if (L >= maxL) {
		const white = to(COLORS.WHITE, space);
		white.alpha = origin.alpha;
		return to(white, space);
	}
	if (L <= minL) {
		const black = to(COLORS.BLACK, space);
		black.alpha = origin.alpha;
		return to(black, space);
	}

	if (inGamut(mappingSpace, space, { epsilon: 0 })) {
		return to(mappingSpace, space);
	}

	function clip (_color) {
		const destColor = to(_color, space);
		const spaceCoords = Object.values(space.coords);
		destColor.coords = destColor.coords.map((coord, index) => {
			const spaceCoord = spaceCoords[index];
			if (("range" in spaceCoord)) {
				if (coord < spaceCoord.range[0]) {
					return spaceCoord.range[0];
				}
				if (coord > spaceCoord.range[1]) {
					return spaceCoord.range[1];
				}
			}
			return coord;
		});
		return destColor;
	}
	let min = 0;
	let max = mappingSpace.coords[indexC];

	let min_inGamut = true;
	let clipped = clip(clone(mappingSpace));
	let current;

	while ((max - min) > threshold) {
		const chroma = (min + max) / 2;
		console.log(mappingSpace)
		current = clone(mappingSpace);
		current.coords[indexC] = chroma;
		if (min_inGamut && inGamut(current, space, { epsilon: 0 })) {
			min = chroma;
			continue;
		}
		else {
			clipped = clip(current);
			const E = deltaE(clipped, current);
			if (E < JND) {
				if ((JND - E < ε)) {
					// match found
					break;
				}
				else {
					min_inGamut = false;
					min = chroma;
				}
			}
			else {
				max = chroma;
			}
		}
	}
	return to(clipped, space);
}
