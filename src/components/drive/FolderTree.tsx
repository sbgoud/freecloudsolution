import { useEffect, useState } from 'react';
import { ChevronRight, Folder, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { folderAncestors } from './folders';
import type { FolderTreeNode } from './types';

interface FolderTreeProps {
  tree: FolderTreeNode;
  currentPath: string;
  onNavigate: (path: string) => void;
}

interface TreeRowProps {
  node: FolderTreeNode;
  depth: number;
  currentPath: string;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  onNavigate: (path: string) => void;
}

function TreeRow({
  node,
  depth,
  currentPath,
  expanded,
  onToggle,
  onNavigate,
}: TreeRowProps) {
  const isOpen = expanded.has(node.path);
  const isActive = currentPath === node.path;
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-0.5 rounded-md pr-1 transition-colors',
          isActive ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        <button
          type="button"
          className={cn(
            'flex h-7 w-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-transform hover:text-foreground',
            !hasChildren && 'invisible'
          )}
          onClick={() => onToggle(node.path)}
          aria-label={isOpen ? 'Collapse folder' : 'Expand folder'}
          aria-expanded={isOpen}
          tabIndex={hasChildren ? 0 : -1}
        >
          <ChevronRight
            className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-90')}
          />
        </button>
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left text-sm"
          onClick={() => onNavigate(node.path)}
          title={node.path}
        >
          {isOpen && hasChildren ? (
            <FolderOpen
              className={cn(
                'h-4 w-4 shrink-0',
                isActive ? 'text-primary' : 'text-sky-500'
              )}
            />
          ) : (
            <Folder
              className={cn(
                'h-4 w-4 shrink-0',
                isActive ? 'text-primary' : 'text-sky-500'
              )}
            />
          )}
          <span className="truncate">{node.name}</span>
        </button>
      </div>

      {hasChildren && isOpen ? (
        <div>
          {node.children.map((child) => (
            <TreeRow
              key={child.path}
              node={child}
              depth={depth + 1}
              currentPath={currentPath}
              expanded={expanded}
              onToggle={onToggle}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function FolderTree({ tree, currentPath, onNavigate }: FolderTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(
    () =>
      new Set([
        '/',
        ...folderAncestors(currentPath),
        ...(currentPath !== '/' ? [currentPath] : []),
      ])
  );

  useEffect(() => {
    setExpanded((previous) => {
      const next = new Set(previous);
      next.add('/');
      for (const ancestor of folderAncestors(currentPath)) next.add(ancestor);
      if (currentPath !== '/') next.add(currentPath);
      return next;
    });
  }, [currentPath]);

  const toggle = (path: string) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  return (
    <div className="space-y-0.5">
      <TreeRow
        node={tree}
        depth={0}
        currentPath={currentPath}
        expanded={expanded}
        onToggle={toggle}
        onNavigate={onNavigate}
      />
    </div>
  );
}
