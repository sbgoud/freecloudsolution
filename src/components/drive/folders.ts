import type { DriveFile, DriveFolderMarker } from '@/lib/telegram/files';
import { basename, dirname, joinPath, normalizePath } from '@/lib/telegram/meta';
import type { FolderEntry, FolderTreeNode } from './types';

export function isPathInside(path: string, folder: string): boolean {
  const normalizedPath = normalizePath(path);
  const normalizedFolder = normalizePath(folder);
  if (normalizedPath === normalizedFolder) return true;
  if (normalizedFolder === '/') return normalizedPath.startsWith('/');
  return normalizedPath.startsWith(`${normalizedFolder}/`);
}

export function buildFolderEntries(
  files: DriveFile[],
  markers: DriveFolderMarker[]
): FolderEntry[] {
  const dates = new Map<string, number>();

  const addFolder = (input: string, date = 0) => {
    let path = normalizePath(input);
    while (path !== '/') {
      const current = dates.get(path) ?? 0;
      if (date > current) dates.set(path, date);
      path = dirname(path);
    }
  };

  for (const marker of markers) {
    addFolder(marker.path, marker.date);
  }

  for (const file of files) {
    addFolder(file.folder, file.date);
  }

  return Array.from(dates.entries())
    .map(([path, date]) => ({
      path,
      name: basename(path),
      parent: dirname(path),
      date,
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

export function buildFolderTree(entries: FolderEntry[]): FolderTreeNode {
  const root: FolderTreeNode = {
    path: '/',
    name: 'My Drive',
    children: [],
  };

  const nodes = new Map<string, FolderTreeNode>();
  nodes.set('/', root);

  for (const entry of entries) {
    nodes.set(entry.path, {
      path: entry.path,
      name: entry.name,
      children: [],
    });
  }

  for (const entry of entries) {
    const node = nodes.get(entry.path);
    if (!node) continue;
    const parent = nodes.get(entry.parent) ?? root;
    parent.children.push(node);
  }

  const sortNodes = (node: FolderTreeNode) => {
    node.children.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );
    node.children.forEach(sortNodes);
  };
  sortNodes(root);

  return root;
}

export function replaceFolderPath(
  path: string,
  oldFolder: string,
  newFolder: string
): string {
  const normalizedPath = normalizePath(path);
  const normalizedOld = normalizePath(oldFolder);
  const normalizedNew = normalizePath(newFolder);
  if (!isPathInside(normalizedPath, normalizedOld)) return normalizedPath;
  if (normalizedPath === normalizedOld) return normalizedNew;

  const suffix =
    normalizedOld === '/'
      ? normalizedPath.slice(1)
      : normalizedPath.slice(normalizedOld.length + 1);
  return joinPath(normalizedNew, suffix);
}

export function folderAncestors(path: string): string[] {
  const normalized = normalizePath(path);
  const ancestors: string[] = [];
  let current = normalized;
  while (current !== '/') {
    current = dirname(current);
    ancestors.push(current);
  }
  return ancestors;
}

export function encodeFolderPath(path: string): string {
  const normalized = normalizePath(path);
  if (normalized === '/') return '';
  return normalized
    .slice(1)
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

export function folderUrl(path: string): string {
  const encoded = encodeFolderPath(path);
  return encoded ? `/drive/${encoded}` : '/drive';
}

export function sortByName<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );
}
