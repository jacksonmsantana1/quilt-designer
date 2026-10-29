// State of the 3D simulation shared by its modules. Pure; read as live bindings, changed with the setters.

/** @type {any} the camera in use (the orbit camera, or the photo camera) */
export let activeCam = null;
/** @param {any} c */
export const setActiveCam = c => (activeCam = c);
/** @type {any} picture of the bed cavity under the quilt */
export let cavityImg = null;
/** @param {any} v */
export const setCavityImg = v => (cavityImg = v);
/** @type {any} the bed's collision shapes for the cloth */
export let colliders = null;
/** @param {any} v */
export const setColliders = v => (colliders = v);
/** @type {any} normal map of the quilt top's seams */
export let designNormalTex = null;
/** @param {any} t */
export const setDesignNormalTex = t => (designNormalTex = t);
/** @type {any} where the quilt is dropped from (null: the default) */
export let dropPos = null;
/** @param {any} v */
export const setDropPos = v => (dropPos = v);
/** @type {any} the pending grab message for the physics worker */
export let grabMsg = null;
/** @param {any} m */
export const setGrabMsg = m => (grabMsg = m);
/** whether the mesh has positions from the physics yet */
export let havePos = false;
/** @param {boolean} v */
export const setHavePos = v => (havePos = v);
/** whether a new physics frame arrived since the last draw */
export let newFrame = false;
/** @param {boolean} v */
export const setNewFrame = v => (newFrame = v);
/** @type {any} the quilt top's texture */
export let patchTex = null;
/** @param {any} t */
export const setPatchTex = t => (patchTex = t);
/** @type {any} */
export let ptBroken = null;
/** @param {any} v */
export const setPtBroken = v => (ptBroken = v);
/** @type {any} */
export let ptCheck = null;
/** @param {any} v */
export const setPtCheck = v => (ptCheck = v);
/** whether the quilt is turned over (backing up) */
export let quiltTurned = false;
/** @param {boolean} v */
export const setQuiltTurned = v => (quiltTurned = v);
/** when the photo render started (ms) */
export let renderT0 = 0;
/** @param {number} v */
export const setRenderT0 = v => (renderT0 = v);
