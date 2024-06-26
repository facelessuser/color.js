import ColorSpace from "../space.js";
import * as spaces from "./index-fn.js";

for (let key of Object.keys(spaces)) {
	ColorSpace.register(spaces[key]);
}

export * as spaces from "./index-fn.js";
export default ColorSpace;
