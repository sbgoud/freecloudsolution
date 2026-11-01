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
  const isRoot = node.path === '/';

  return (
    <div>
      <div
        className={cn(
          'group relative flex items-center gap-0.5 rounded-lg pr-1.5 transition-colors duration-150',
          isActive
            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
            : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'
        )}
      >
        {isActive ? (
          <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary" />
        ) : null}
        <button
          type="button"
          className={cn(
            'flex h-8 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground',
            !hasChildren && 'invisible'
          )}
          style={{ marginLeft: `${depth * 12 + 2}px` }}
          onClick={() => onToggle(node.path)}
          aria-label={
            isOpen
              ? `Collapse ${node.name}`
              : `Expand ${node.name}`
          }
          aria-expanded={isOpen}
          tabIndex={hasChildren ? 0 : -1}
        >
          <ChevronRight
            className={cn(
              'h-3.5 w-3.5 transition-transform duration-150',
              isOpen && 'rotate-90'
            )}
          />
        </button>
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left text-[13px] font-medium"
          onClick={() => onNavigate(node.path)}
          title={node.path}
          aria-current={isActive ? 'page' : undefined}
        >
          {isOpen && hasChildren ? (
            <FolderOpen
              className={cn(
                'h-4 w-4 shrink-0',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}
            />
          ) : (
            <Folder
              className={cn(
                'h-4 w-4 shrink-0',
                isActive
                  ? 'text-primary'
                  : isRoot
                    ? 'fill-primary/10 text-primary/80'
                    : 'text-muted-foreground'
              )}
            />
          )}
          <span className="truncate">{node.name}</span>
        </button>
      </div>

      {hasChildren && isOpen ? (
        <div className="relative">
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
