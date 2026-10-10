declare const name: string;
declare const require: (s: string) => unknown;
export const x = import(name);
export const y = require("../lib/x");
export const z = import.meta.glob("../features/*");
