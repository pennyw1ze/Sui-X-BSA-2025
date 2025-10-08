pragma circom 2.0.0;

include "node_modules/circomlib/circuits/pedersen.circom";

template Hasher() {
    signal input secret;
    signal output out;

    component pedersen = Pedersen(1);
    pedersen.in[0] <== secret;
    out <== pedersen.out[0];
}

component main = Hasher();