import ColorSpace from "../space.js";
import {constrain} from "../angles.js";
import xyz_d65 from "./xyz-d65.js";
import {fromCam16, toCam16, environment} from "./cam16.js";
import {WHITES} from "../adapt.js";

const white = WHITES.D65;
const ε = 216/24389;  // 6^3/29^3 == (24/116)^3
const κ = 24389/27;   // 29^3/3^3

function toLstar (y) {
	// Convert XYZ Y to L*

	const fy = (y > ε) ? Math.cbrt(y) : (κ * y + 16) / 116;
	return (116.0 * fy) - 16.0;
}

function fromLstar (lstar) {
	// Convert L* back to XYZ Y

	return (lstar > 8) ?  Math.pow((lstar + 16) / 116, 3) : lstar / κ;
}

function fromHct (coords, env) {
	// Use Newton's method to try and converge as quick as possible or converge
	// as close as we can. If we don't converge in about 7 iterations, we will
	// instead correct the Y in XYZ and re-calculate the J. This will
	// incrementally get our J closer, but slower. If we do not converge, we
	// will do a final round with Newton's method one last time with the more
	// accurate J. If, for whatever reason, we cannot achieve the accuracy we
	// seek in the allotted iterations, just return the closest we were able to
	// get.

	// Threshold of how close is close enough
	const threshold = 2e-8;
	let [h, c, t] = coords;
	let xyz = [];
	let j = 0;

	// Shortcut out for black
	if (t === 0) {
		return [0.0, 0.0, 0.0];
	}

	// Calculate the Y we need to target
	let y = fromLstar(t);

	if (0 < c && c < 142) {
		// Calculated by curve fitting J vs T to give a better
		// initial guess for common colors. Helps to converge faster.
		// Works well with colors within a mid-sized gamut, but not ultra wide.
		j = 0.00462403 * t ** 2 + 0.51460278 * t + 2.62845677;
	}
	else {
		// For ultra wide gamuts we can get a better J by
		// correcting Y in XYZ and then calculating our J.
		xyz = fromCam16({J: t, C: c, h: h}, env);
		xyz[1] = y;
		j = toCam16(xyz, env).J;
	}

	// Try to find a J such that the returned y matches the returned y of the L*
	let attempt = 0;
	let last = Infinity;
	let best = j;

	while (attempt < 16) {
		xyz = fromCam16({J: j, C: c, h: h}, env);

		// If we are within range, return XYZ
		// If we are closer than last time, save the values
		const delta = Math.abs(xyz[1] - y)
		if (delta < last) {
			if (delta <= threshold) {
				return xyz;
			}
			best = j;
			last = delta;
		}

		// Use Newton's method to see if we can quickly converge
		// or get as close as we can.
		if ((attempt < 7 || attempt >= 13) && xyz[1] !== 0) {
			// f(j_root) = (j ** (1 / 2)) * 0.1
			// f(j) = ((f(j_root) * 100) ** 2) / j - 1 = 0
			// f(j_root) = Y = y / 100
			// f(j) = (y ** 2) / j - 1
			// f'(j) = (2 * y) / j
			j = j - (xyz[1] - y) * j / (2 * xyz[1]);
		}

		// Correct the lightness in XYZ and then re-calculate J
		else {
			xyz[1] = y;
			j = toCam16(xyz, env).J;
		}

		attempt += 1;
	}

	// We could not acquire the precision we desired,
	// return our closest attempt.
	return fromCam16({J: j, C: c, h: h}, env);
}

function toHct (xyz, env) {
	// Calculate HCT by taking the L* of CIE LCh D65 and CAM16 chroma and hue.

	const t = toLstar(xyz[1]);
	if (t === 0.0) {
		return [0.0, 0.0, 0.0];
	}
	const cam16 = toCam16(xyz, viewingConditions);
	return [constrain(cam16.h), cam16.C, t];
}

// Pre-calculate everything we can with the viewing conditions
export const viewingConditions = environment(
	white, 200 / Math.PI * fromLstar(50.0),
	fromLstar(50.0) * 100,
	'average',
	false
);

export default new ColorSpace({
	id: "hct",
	name: "HCT",
	coords: {
		h: {
			refRange: [0, 360],
			type: "angle",
			name: "Hue",
		},
		c: {
			refRange: [0, 145],
			name: "Colorfulness",
		},
		t: {
			refRange: [0, 100],
			name: "Tone",
		}
	},

	base: xyz_d65,

	fromBase (xyz) {
		return toHct(xyz, viewingConditions);
	},
	toBase (hct) {
		return fromHct(hct, viewingConditions);
	},
	formats: {
		color: {}
	},
});
