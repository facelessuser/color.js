import Color from "colorjs.io/src";
import ColorSpace from "colorjs.io/src/ColorSpace";

// @ts-expect-error
new ColorSpace();
// @ts-expect-error
new ColorSpace({});

const space = new ColorSpace({ id: "abc", name: "ABC" });

new ColorSpace({ id: "abc", name: "ABC", base: "foo" });
new ColorSpace({ id: "abc", name: "ABC", base: space });

new ColorSpace({
	id: "abc",
	name: "ABC",
	toBase: () => [3, 2, 1],
	fromBase: () => [1, 2, 3],
	coords: {
		a: {
			refRange: [0, 360],
			name: "A",
		},
		b: {
			range: [0, 100],
			name: "B",
		},
		c: {
			range: [0, 100],
			name: "C",
		},
	},
	white: "D50",
	cssId: "abc",
	referred: "abc",
	formats: { color: { id: "#ffffff" } },
});

ColorSpace.get("abc");
ColorSpace.get(space);
ColorSpace.get("abc", "def");
ColorSpace.get(space, space);

ColorSpace.findFormat("abc");
ColorSpace.findFormat("abc", [space]);
ColorSpace.findFormat({}, [space]);

ColorSpace.register(space);
ColorSpace.register("abc", space);

ColorSpace.registry["abc"]; // $ExpectType ColorSpace

ColorSpace.resolveCoord("p3.0", "p3");
ColorSpace.resolveCoord(["p3", "r"], "p3");

space.to(new Color("red")); // $ExpectType Coords
space.to("red"); // $ExpectType Coords
space.to({ space: space, coords: [1, 2, 3], alpha: 1 }); // $ExpectType Coords
space.to({ space: space, coords: [1, 2, 3] }); // $ExpectType Coords
space.to(space, [1, 2, 3]); // $ExpectType Coords
space.to("srgb", [1, 2, 3]); // $ExpectType Coords

space.from(new Color("red")); // $ExpectType Coords
space.from("red"); // $ExpectType Coords
space.from({ space: space, coords: [1, 2, 3], alpha: 1 }); // $ExpectType Coords
space.from({ space: space, coords: [1, 2, 3] }); // $ExpectType Coords
space.from(space, [1, 2, 3]); // $ExpectType Coords
space.from("srgb", [1, 2, 3]); // $ExpectType Coords

space.equals(space); // $ExpectType boolean
