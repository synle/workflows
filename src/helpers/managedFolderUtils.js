/** Crash-safe rebuild of the managed subfolders under the url-porter folder. */

/**
 * Suffix appended to a managed folder while being rebuilt. Work happens in the
 * staging copy; only a fully populated replacement swaps in, so an interrupted
 * run never leaves the user without the folder.
 *
 * @type {string}
 */
const STAGING_SUFFIX = " (updating\u2026)";

/**
 * Build the staging folder title for a managed folder.
 *
 * @param {string} title - Final folder title.
 * @returns {string} Title used while the rebuild is in flight.
 */
export function stagingTitleFor(title) {
  return `${title}${STAGING_SUFFIX}`;
}

/**
 * Remove the staging folder abandoned by an interrupted rebuild of this folder.
 * Scoped to the exact staging title so one rebuild can never delete another's
 * in-flight work.
 *
 * @param {chrome.bookmarks.BookmarkTreeNode[]} children - Children of the porter folder.
 * @param {string} title - Final title of the managed subfolder being rebuilt.
 * @returns {Promise<void>}
 */
async function removeStaleStagingFolders(children, title) {
  const staleTitle = stagingTitleFor(title);
  for (const child of children) {
    if (child.url || child.title !== staleTitle) continue;
    await chrome.bookmarks.removeTree(child.id);
    console.log("[managedFolderUtils] removed abandoned staging folder:", child.title);
  }
}

/**
 * Rebuild a managed subfolder without ever leaving the user without one.
 *
 * Populate a staging folder created at the final position; only after
 * `populate` resolves is the previous folder removed and staging renamed into
 * place. If `populate` throws — or the worker dies part way through it — the
 * previous folder survives and the next run removes the orphaned staging one.
 *
 * @param {object} options - Rebuild options.
 * @param {string} options.parentId - The url-porter folder ID.
 * @param {string} options.title - Final title of the managed subfolder.
 * @param {(folderId: string) => Promise<void>} options.populate - Fills the new folder.
 * @param {(children: chrome.bookmarks.BookmarkTreeNode[]) => number} options.resolveIndex -
 *   Returns the position for the folder. Receives the porter folder's current
 *   children, still including the folder being replaced; removing it afterwards
 *   does not shift staging relative to remaining siblings, so the index holds.
 * @returns {Promise<void>}
 */
export async function rebuildManagedSubfolder({ parentId, title, populate, resolveIndex }) {
  const before = await chrome.bookmarks.getChildren(parentId);
  await removeStaleStagingFolders(before, title);

  const children = await chrome.bookmarks.getChildren(parentId);
  const staging = await chrome.bookmarks.create({
    parentId,
    title: stagingTitleFor(title),
    index: resolveIndex(children),
  });

  try {
    await populate(staging.id);
  } catch (err) {
    // Leave the live folder alone; drop the half-built replacement.
    await chrome.bookmarks.removeTree(staging.id).catch(() => {});
    throw err;
  }

  const live = (await chrome.bookmarks.getChildren(parentId)).find((c) => !c.url && c.title === title);
  if (live) {
    await chrome.bookmarks.removeTree(live.id);
  }

  await chrome.bookmarks.update(staging.id, { title });
}
