import hct from "../spaces/hct.js";
import {viewingConditions} from "../spaces/hct.js";

// CAM6 UCS has the following coefficients: (1.00, 0.007, 0.0228).
// We need the third to calculate the a and b components.
const coeff = 0.228

function calcAB (C, h) {
    // Convert chroma to colorfulness and adjust it by the UCS coefficient
    // Calculate a and b components from that value.

    const hRad = h * Math.PI / 180;
    const M = Math.log(1 + coeff * C * viewingConditions.flRoot) / coeff;
    const a = M * Math.cos(hRad);
    const b = M * Math.sin(hRad);

    return [a, b];
}

export default function (color, sample) {
    // Apply CAM16 UCS transform to chroma and hue and use Euclidean distancing.

    let hct1 = hct.from(color);
    let hct2 = hct.from(sample);

    if (hct1[1] < 0) {
        hct1 = hct.fromBase(hct.toBase(hct1));
    }
    if (hct2[1] < 0) {
        hct2 = hct.fromBase(hct.toBase(hct2));
    }

    let [h1, c1, t1] = hct1;
    let [h2, c2, t2] = hct2;

    let [a1, b1] = calcAB(c1, h1);
    let [a2, b2] = calcAB(c2, h2);

    return Math.sqrt((t1 - t2) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2);
}
