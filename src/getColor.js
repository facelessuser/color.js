import ColorSpace from "./space.js";
import {isString} from "./util.js";
import parse from "./parse.js";

/**
 * Resolves a color reference (object or string) to a plain color object
 * @param {Color | {space, coords, alpha} | string | Array<Color | {space, coords, alpha} | string> } color
 * @param {object} [options]
 * @param {boolean} [options.parseMeta] - Optional object to hold parsing metadata
 * @returns {{space, coords, alpha} | Array<{space, coords, alpha}}>
 */
export default function getColor (color, options) {
	if (Array.isArray(color)) {
		return color.map(c => getColor(c, options));
	}

	if (!color) {
		throw new TypeError("Empty color reference");
	}

	if (isString(color)) {
		color = parse(color, options);
	}

	// Object fixup
	let space = color.space || color.spaceId;

	if (!(space instanceof ColorSpace)) {
		// Convert string id to color space object
		color.space = ColorSpace.get(space);
	}

	if (color.alpha === undefined) {
		color.alpha = 1;
	}

	return color;
}
