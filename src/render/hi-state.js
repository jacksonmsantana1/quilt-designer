// What the cutting guide lights up in the quilt pictures. Pure; read as live bindings, changed with the setters.

/** @type {any} the cutting-guide card under the pointer (-1: none) */
export let cgHi = -1;
/** @param {any} v */
export const setCgHi = v => (cgHi = v);
/** @type {((info: object) => boolean) | null} which pieces stay lit while a cutting-list row is hovered */
export let fabHi = null;
/** @param {((info: object) => boolean) | null} f */
export const setFabHi = f => (fabHi = f);
/** @type {any} the last cutting plan drawn */
export let lastPlan = null;
/** @param {any} p */
export const setLastPlan = p => (lastPlan = p);
