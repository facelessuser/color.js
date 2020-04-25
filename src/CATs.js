import Color, {util} from "./color.js";

Color.CATs = {};

Color.defineCAT = function({id, toCone_M, fromCone_M}) {
    // Use id, toCone_M, fromCone_M like variables
    Color.CATs[id] = arguments[0];
};

Color.adapt = function(W1, W2, id) {
    // adapt from a source whitepoint or illuminant W1
    // to a destination whitepoint or illuminant W2,
    // using the given chromatic adaptation transform (CAT)
    let method = _.CATs[id];
    let src = util.multiplyMatrices(W1, method.toCone_M);
    let dest = util.multiplyMatrices(W2, method.toCone_M);

    Color.defineCoordAccessors("ργβ", ["ρ", "γ", "β"]);

    let [ρs, γs, βs] = src;
    let [ρd, γd, βd] = dest;

    let scale = [
        [ρd/ρs,    0,      0      ],
        [0,        γd/γs,  0      ],
        [0,        0,      βd/βs  ]
    ];

    return util.multiplyMatrices(method.fromCone_M,
        util.multiplyMatrices(scale, method.toCone_M));
}

Color.defineCAT({
    id: "von Kries",
    toCone_M: [
       [  0.4002400,  0.7076000, -0.0808100 ],
       [ -0.2263000,  1.1653200,  0.0457000 ],
       [  0.0000000,  0.0000000,  0.9182200 ]
    ],
    fromCone_M: [
        [  1.8599364, -1.1293816,  0.2198974 ],
        [  0.3611914,  0.6388125, -0.0000064 ],
        [  0.0000000,  0.0000000,  1.0890636 ]
    ]
})
Color.defineCAT({
    id: "Bradford",
    // Convert an array of XYZ values in the range 0.0 - 1.0
    // to cone fundamentals
    toCone_M: [
        [  0.8951000,  0.2664000, -0.1614000 ],
        [ -0.7502000,  1.7135000,  0.0367000 ],
        [  0.0389000, -0.0685000,  1.0296000 ]
    ],
    /// and back
    fromCone_M: [
        [  0.9869929, -0.1470543,  0.1599627 ],
        [  0.4323053,  0.5183603,  0.0492912 ],
        [ -0.0085287,  0.0400428,  0.9684867 ]
    ]
});

Color.defineCAT({
    id: "CAT02",
    toCone_M: [
        [  0.7328000,  0.4296000, -0.1624000 ],
        [ -0.7036000,  1.6975000,  0.0061000 ],
        [  0.0030000,  0.0136000,  0.9834000 ]
    ],
    fromCone_M: [
        [  1.0961238, -0.2788690,  0.1827452 ],
        [  0.4543690,  0.4735332,  0.0720978 ],
        [ -0.0096276, -0.0056980,  1.0153256 ]
    ]
});
