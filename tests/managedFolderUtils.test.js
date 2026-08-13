/**
 * Tests for managedFolderUtils — the crash-safe managed subfolder rebuild.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createChromeMock } from "./_chromeMock.js";

const { chrome, mockBookmarks, addMockFolder, addMockBookmark, reset } = createChromeMock();
vi.stubGlobal("chrome", chrome);

const { rebuildManagedSubfolder, stagingTitleFor } =
  await import("../src/helpers/managedFolderUtils.js");

/**
 * Titles of a folder's children that are bookmarks (not subfolders).
 * @param {string} parentId - Parent folder ID.
 * @returns {string[]} Bookmark titles.
 */
function bookmarkTitlesIn(parentId) {
  return mockBookmarks.filter((b) => b.parentId === parentId && b.url).map((b) => b.title);
}

/**
 * Subfolder titles under a parent, in order.
 * @param {string} parentId - Parent folder ID.
 * @returns {string[]} Subfolder titles.
 */
function subfolderTitlesIn(parentId) {
  return mockBookmarks.filter((b) => b.parentId === parentId && !b.url).map((b) => b.title);
}

describe("managedFolderUtils — rebuildManagedSubfolder", () => {
  beforeEach(() => {
    reset();
  });

  it("replaces the previous folder contents", async () => {
    const porter = addMockFolder("2", "url-porter");
    const old = addMockFolder(porter.id, "prs");
    addMockBookmark(old.id, "stale", "https://example.com/stale", 1);

    await rebuildManagedSubfolder({
      parentId: porter.id,
      title: "prs",
      resolveIndex: () => 0,
      populate: async (folderId) => {
        await chrome.bookmarks.create({
          parentId: folderId,
          title: "fresh",
          url: "https://example.com/fresh",
        });
      },
    });

    expect(subfolderTitlesIn(porter.id)).toEqual(["prs"]);
    const rebuilt = mockBookmarks.find((b) => !b.url && b.title === "prs");
    expect(bookmarkTitlesIn(rebuilt.id)).toEqual(["fresh"]);
  });

  it("keeps the previous folder intact when the rebuild throws part way through", async () => {
    const porter = addMockFolder("2", "url-porter");
    const old = addMockFolder(porter.id, "prs");
    addMockBookmark(old.id, "keep me", "https://example.com/keep", 1);

    await expect(
      rebuildManagedSubfolder({
        parentId: porter.id,
        title: "prs",
        resolveIndex: () => 0,
        populate: async (folderId) => {
          await chrome.bookmarks.create({
            parentId: folderId,
            title: "half built",
            url: "https://example.com/half",
          });
          throw new Error("worker died");
        },
      }),
    ).rejects.toThrow("worker died");

    // The user's folder still exists, with its original contents.
    expect(subfolderTitlesIn(porter.id)).toEqual(["prs"]);
    expect(bookmarkTitlesIn(old.id)).toEqual(["keep me"]);
    // The half-built replacement is gone.
    expect(mockBookmarks.some((b) => b.title === "half built")).toBe(false);
  });

  it("never deletes the previous folder before the replacement is populated", async () => {
    const porter = addMockFolder("2", "url-porter");
    const old = addMockFolder(porter.id, "prs");
    addMockBookmark(old.id, "keep me", "https://example.com/keep", 1);

    let liveFolderDuringPopulate;
    await rebuildManagedSubfolder({
      parentId: porter.id,
      title: "prs",
      resolveIndex: () => 0,
      populate: async (folderId) => {
        // Snapshot what the user would see if the worker were killed right here.
        liveFolderDuringPopulate = mockBookmarks.find((b) => b.id === old.id);
        await chrome.bookmarks.create({
          parentId: folderId,
          title: "fresh",
          url: "https://example.com/fresh",
        });
      },
    });

    expect(liveFolderDuringPopulate).toBeDefined();
  });

  it("removes a staging folder abandoned by an interrupted run", async () => {
    const porter = addMockFolder("2", "url-porter");
    const abandoned = addMockFolder(porter.id, stagingTitleFor("prs"));
    addMockBookmark(abandoned.id, "orphan", "https://example.com/orphan", 1);

    await rebuildManagedSubfolder({
      parentId: porter.id,
      title: "prs",
      resolveIndex: () => 0,
      populate: async (folderId) => {
        await chrome.bookmarks.create({
          parentId: folderId,
          title: "fresh",
          url: "https://example.com/fresh",
        });
      },
    });

    expect(subfolderTitlesIn(porter.id)).toEqual(["prs"]);
    expect(mockBookmarks.some((b) => b.title === "orphan")).toBe(false);
  });

  it("leaves another folder's staging work alone", async () => {
    const porter = addMockFolder("2", "url-porter");
    const otherStaging = addMockFolder(porter.id, stagingTitleFor("jira tickets"));
    addMockBookmark(otherStaging.id, "in flight", "https://example.com/inflight", 1);

    await rebuildManagedSubfolder({
      parentId: porter.id,
      title: "prs",
      resolveIndex: () => 0,
      populate: async (folderId) => {
        await chrome.bookmarks.create({
          parentId: folderId,
          title: "fresh",
          url: "https://example.com/fresh",
        });
      },
    });

    // Cleanup is scoped to this folder's own staging title.
    expect(mockBookmarks.some((b) => b.id === otherStaging.id)).toBe(true);
    expect(mockBookmarks.some((b) => b.title === "in flight")).toBe(true);
  });

  it("places the rebuilt folder at the resolved index", async () => {
    const porter = addMockFolder("2", "url-porter");
    addMockFolder(porter.id, "prs");
    addMockFolder(porter.id, "github repos");

    await rebuildManagedSubfolder({
      parentId: porter.id,
      title: "jira tickets",
      resolveIndex: (children) => children.length,
      populate: async (folderId) => {
        await chrome.bookmarks.create({
          parentId: folderId,
          title: "t",
          url: "https://example.com/t",
        });
      },
    });

    expect(subfolderTitlesIn(porter.id)).toEqual(["prs", "github repos", "jira tickets"]);
  });
});
