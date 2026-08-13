/** Crash-safe rebuild of the managed subfolders under the url-porter folder. */

/**
 * Suffix appended to a folder while it is being rebuilt.
 *
 * The reconcilers used to delete the live folder and then recreate it. In MV3
 * the service worker can be terminated at any await, so an interrupted run left
 * the user with no folder at all and no way to get the contents back. Instead we
 * build into a staging folder, and only drop the live folder once the
 * replacement is fully populated.
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
 * Remove a staging folder abandoned by an interrupted rebuild of this folder.
 *
 * Scoped to the exact staging title rather than every staging folder, so that
 * rebuilding one managed folder can never delete another one's in-flight work.
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
 * The replacement is populated in a staging folder first, created directly at
 * its final position. Only once `populate` resolves is the previous folder
 * removed and the staging folder renamed into place. If `populate` throws — or
 * the worker dies part way through it — the previous folder is still there, and
 * the next run cleans up the orphaned staging folder.
 *
 * @param {object} options - Rebuild options.
 * @param {string} options.parentId - The url-porter folder ID.
 * @param {string} options.title - Final title of the managed subfolder.
 * @param {(folderId: string) => Promise<void>} options.populate - Fills the new folder.
 * @param {(children: chrome.bookmarks.BookmarkTreeNode[]) => number} options.resolveIndex -
 *   Returns the position for the folder. Receives the porter folder's current
 *   children, which still include the folder being replaced; removing that
 *   folder afterwards does not shift the staging folder relative to its
 *   remaining siblings, so the resolved index still holds.
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

  const live = (await chrome.bookmarks.getChildren(parentId)).find(
    (c) => !c.url && c.title === title,
  );
  if (live) {
    await chrome.bookmarks.removeTree(live.id);
  }

  await chrome.bookmarks.update(staging.id, { title });
}
