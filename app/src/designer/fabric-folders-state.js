// The person's fabric folders, which are made in the phone app and only read here: they show as groups in the fabric
// library. Asked for when the library opens, not at every sync. No side effects when loaded.

/** @typedef {{ id: string, name: string, fabricIds: string[], position: number, deleted: boolean }} FabricFolder */

/** @type {FabricFolder[]} */
let folders = [];
/** @type {() => Promise<FabricFolder[]>} */
let loader = async () => [];

/** How to get them: from the server, when signed in (mine/sync-ui.js). @param {() => Promise<FabricFolder[]>} f */
const setFolderLoader = f => void (loader = f);

/** Asks again. Without a connection the last ones stay. */
async function refreshFolders() {
  try {
    folders = (await loader()).filter(f => !f.deleted).sort((a, b) => a.position - b.position);
  } catch (e) {}
}

export { folders, refreshFolders, setFolderLoader };
