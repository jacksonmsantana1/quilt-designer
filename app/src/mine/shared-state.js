// Sharing with the community, as the rest of the app sees it (pure: no side effects when loaded). mine/community.js
// fills these in; My designs (the "Shared" tag, the ⋯ menu) and the pages read them.
// @ts-check

/** The ids of the signed-in account's designs that are shared with the community. */
let sharedIds = new Set();
/** @param {Iterable<string>} ids */
const setSharedIds = ids => {
  sharedIds = new Set(ids);
};

/**
 * What the community module does, for the modules loaded before it.
 * @type {{ share: ((id: string) => void) | null, unshare: ((id: string) => void) | null, render: (() => void) | null }}
 */
const communityHooks = { share: null, unshare: null, render: null };

export { communityHooks, setSharedIds, sharedIds };
