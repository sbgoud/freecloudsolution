import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type InputHTMLAttributes,
} from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertCircle,
  ChevronRight,
  Download,
  FolderOpen,
  FolderPlus,
  Home,
  Loader2,
  Move,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useTelegram } from '@/context/TelegramContext';
import {
  createFolder,
  deleteFolder,
  deleteItems,
  downloadFile,
  listAll,
  messageToDriveFile,
  moveFolder,
  renameOrMove,
  triggerBrowserDownload,
  uploadFiles,
  type DriveFile,
  type DriveFolderMarker,
} from '@/lib/telegram/files';
import { basename, dirname, joinPath, normalizePath } from '@/lib/telegram/meta';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet';
import { DriveTopBar } from '@/components/drive/DriveTopBar';
import { DriveSidebar } from '@/components/drive/DriveSidebar';
import { FileGrid } from '@/components/drive/FileGrid';
import { FileList } from '@/components/drive/FileList';
import { UploadPanel } from '@/components/drive/UploadPanel';
import { NewFolderDialog } from '@/components/drive/NewFolderDialog';
import { RenameDialog } from '@/components/drive/RenameDialog';
import { MoveDialog } from '@/components/drive/MoveDialog';
import { ConfirmDeleteDialog } from '@/components/drive/ConfirmDeleteDialog';
import { ImagePreviewDialog } from '@/components/drive/ImagePreviewDialog';
import {
  buildFolderEntries,
  buildFolderTree,
  folderUrl,
  isPathInside,
  replaceFolderPath,
  sortByName,
} from '@/components/drive/folders';
import type {
  ItemTarget,
  UploadTask,
  ViewMode,
} from '@/components/drive/types';

const VIEW_STORAGE_KEY = 'tgdrive:view';

function readStoredView(): ViewMode {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return fallback;
}

function DriveSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 10 }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-xl border bg-card">
          <Skeleton className="aspect-[4/3] w-full rounded-none" />
          <div className="space-y-2 p-2.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

const Drive = () => {
  const navigate = useNavigate();
  const params = useParams();
  const { client, status, me, logout } = useTelegram();

  const currentPath = useMemo(
    () => normalizePath(params['*'] ?? ''),
    [params]
  );

  const [files, setFiles] = useState<DriveFile[]>([]);
  const [markers, setMarkers] = useState<DriveFolderMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewMode>(readStoredView);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<ItemTarget | null>(null);
  const [moveTarget, setMoveTarget] = useState<ItemTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ItemTarget | null>(null);
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<DriveFile | null>(null);

  const [uploads, setUploads] = useState<UploadTask[]>([]);
  const uploadQueueRef = useRef<UploadTask[]>([]);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const processingRef = useRef(false);
  const uploadIdRef = useRef(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const [dragActive, setDragActive] = useState(false);
  const dragDepthRef = useRef(0);

  const query = search.trim().toLowerCase();
  const searching = query.length > 0;

  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!client) return;

      const silent = Boolean(options?.silent);
      if (silent) setRefreshing(true);
      else {
        setLoading(true);
        setError(null);
      }
      setLoadedCount(0);

      try {
        const result = await listAll(client, (loaded) => setLoadedCount(loaded));
        setFiles(result.files);
        setMarkers(result.folders);
        setError(null);
      } catch (loadError) {
        const message = errorMessage(loadError, 'Could not load your drive.');
        if (silent) toast.error(message);
        else setError(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [client]
  );

  useEffect(() => {
    if (status === 'loggedIn' && client) {
      void load();
    }
  }, [status, client, load]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [currentPath, searching]);

  const folderEntries = useMemo(
    () => buildFolderEntries(files, markers),
    [files, markers]
  );

  const folderTree = useMemo(
    () => buildFolderTree(folderEntries),
    [folderEntries]
  );

  const folderPathSet = useMemo(
    () => new Set(folderEntries.map((entry) => entry.path)),
    [folderEntries]
  );

  const childFolders = useMemo(
    () => sortByName(folderEntries.filter((entry) => entry.parent === currentPath)),
    [folderEntries, currentPath]
  );

  const childFiles = useMemo(
    () =>
      sortByName(
        files.filter((file) => normalizePath(file.folder) === currentPath)
      ),
    [files, currentPath]
  );

  const searchFolders = useMemo(() => {
    if (!searching) return [];
    return sortByName(
      folderEntries.filter((entry) => entry.name.toLowerCase().includes(query))
    );
  }, [folderEntries, query, searching]);

  const searchFiles = useMemo(() => {
    if (!searching) return [];
    return sortByName(
      files.filter((file) => file.name.toLowerCase().includes(query))
    );
  }, [files, query, searching]);

  const displayFolders = searching ? searchFolders : childFolders;
  const displayFiles = searching ? searchFiles : childFiles;

  const selectedFiles = useMemo(
    () => files.filter((file) => selectedIds.has(file.id)),
    [files, selectedIds]
  );

  const breadcrumbs = useMemo(() => {
    if (currentPath === '/') return [];
    const segments = currentPath.slice(1).split('/');
    return segments.map((segment, index) => ({
      name: segment,
      path: `/${segments.slice(0, index + 1).join('/')}`,
    }));
  }, [currentPath]);

  const goToFolder = useCallback(
    (path: string) => {
      setMobileSidebarOpen(false);
      setSearch('');
      navigate(folderUrl(path));
    },
    [navigate]
  );

  const handleViewChange = (next: ViewMode) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // ignore storage errors
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  const toggleSelect = (file: DriveFile) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(file.id)) next.delete(file.id);
      else next.add(file.id);
      return next;
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      for (const file of displayFiles) {
        if (checked) next.add(file.id);
        else next.delete(file.id);
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const download = async (file: DriveFile) => {
    if (!client) return;
    const toastId = toast.loading(`Downloading “${file.name}”…`);
    try {
      const blob = await downloadFile(client, file, (fraction) => {
        toast.loading(
          `Downloading “${file.name}”… ${Math.round(fraction * 100)}%`,
          { id: toastId }
        );
      });
      triggerBrowserDownload(blob, file.name);
      toast.success(`Downloaded “${file.name}”`, { id: toastId });
    } catch (downloadError) {
      toast.error(errorMessage(downloadError, 'Download failed.'), {
        id: toastId,
      });
    }
  };

  const openFile = (file: DriveFile) => {
    if (file.kind === 'image') {
      setPreviewFile(file);
      return;
    }
    void download(file);
  };

  const replaceFileInState = (
    file: DriveFile,
    newPath: string,
    message?: Awaited<ReturnType<typeof renameOrMove>>
  ) => {
    const updated = message ? messageToDriveFile(message, newPath) : null;
    setFiles((previous) =>
      previous.map((item) => {
        if (item.id !== file.id) return item;
        return (
          updated ?? {
            ...item,
            name: basename(newPath),
            path: newPath,
            folder: dirname(newPath),
          }
        );
      })
    );
  };

  const handleCreateFolder = async (name: string) => {
    if (!client) throw new Error('Telegram client is not ready.');
    const path = joinPath(currentPath, name);
    if (folderPathSet.has(path)) {
      throw new Error('A folder with that name already exists here.');
    }
    const message = await createFolder(client, path);
    setMarkers((previous) => [
      ...previous,
      {
        id: message.id,
        path,
        date: Date.now(),
      },
    ]);
    toast.success(`Created “${name}”`);
  };

  const handleRename = async (name: string) => {
    if (!client || !renameTarget) return;

    if (renameTarget.type === 'file') {
      const file = renameTarget.file;
      const folder = dirname(file.path);
      const newPath = joinPath(folder, name);
      const collision = files.some(
        (item) =>
          item.id !== file.id &&
          normalizePath(item.folder) === folder &&
          item.name === name
      );
      if (collision) throw new Error('A file with that name already exists here.');

      const message = await renameOrMove(client, file, newPath);
      replaceFileInState(file, newPath, message);
      toast.success(`Renamed to “${name}”`);
      return;
    }

    const folder = renameTarget.folder;
    const oldPath = folder.path;
    const newPath = joinPath(dirname(oldPath), name);
    if (newPath === oldPath) return;
    if (folderPathSet.has(newPath)) {
      throw new Error('A folder with that name already exists here.');
    }

    await moveFolder(client, files, markers, oldPath, newPath);
    if (isPathInside(currentPath, oldPath)) {
      goToFolder(replaceFolderPath(currentPath, oldPath, newPath));
    }
    await load({ silent: true });
    toast.success(`Renamed to “${name}”`);
  };

  const handleMove = async (destination: string) => {
    if (!client || !moveTarget) return;

    if (moveTarget.type === 'file') {
      const file = moveTarget.file;
      const newPath = joinPath(destination, file.name);
      if (newPath === file.path) return;
      const message = await renameOrMove(client, file, newPath);
      replaceFileInState(file, newPath, message);
      toast.success(`Moved “${file.name}”`);
      return;
    }

    const folder = moveTarget.folder;
    const newPath = joinPath(destination, folder.name);
    if (newPath === folder.path) return;
    if (isPathInside(newPath, folder.path)) {
      throw new Error('You cannot move a folder into itself.');
    }
    if (folderPathSet.has(newPath)) {
      throw new Error('A folder with that name already exists at the destination.');
    }

    await moveFolder(client, files, markers, folder.path, newPath);
    if (isPathInside(currentPath, folder.path)) {
      goToFolder(replaceFolderPath(currentPath, folder.path, newPath));
    }
    await load({ silent: true });
    toast.success(`Moved “${folder.name}”`);
  };

  const handleDelete = async () => {
    if (!client || !deleteTarget) return;

    if (deleteTarget.type === 'file') {
      const file = deleteTarget.file;
      await deleteItems(client, [file.id]);
      setFiles((previous) => previous.filter((item) => item.id !== file.id));
      setSelectedIds((previous) => {
        const next = new Set(previous);
        next.delete(file.id);
        return next;
      });
      toast.success(`Deleted “${file.name}”`);
      return;
    }

    const folder = deleteTarget.folder;
    const deletedFromCurrent = isPathInside(currentPath, folder.path);
    const count = await deleteFolder(client, files, markers, folder.path);
    if (deletedFromCurrent) goToFolder(dirname(folder.path));
    await load({ silent: true });
    toast.success(`Deleted ${count} item${count === 1 ? '' : 's'}`);
  };

  const handleBulkDelete = async () => {
    if (!client || selectedFiles.length === 0) return;
    const count = selectedFiles.length;
    await deleteItems(
      client,
      selectedFiles.map((file) => file.id)
    );
    const ids = new Set(selectedFiles.map((file) => file.id));
    setFiles((previous) => previous.filter((file) => !ids.has(file.id)));
    setSelectedIds(new Set());
    toast.success(`Deleted ${count} item${count === 1 ? '' : 's'}`);
  };

  const handleBulkMove = async (destination: string) => {
    if (!client || selectedFiles.length === 0) return;
    let moved = 0;

    for (const file of selectedFiles) {
      const newPath = joinPath(destination, file.name);
      if (newPath === file.path) continue;
      const message = await renameOrMove(client, file, newPath);
      replaceFileInState(file, newPath, message);
      moved += 1;
    }

    setSelectedIds(new Set());
    toast.success(`Moved ${moved} item${moved === 1 ? '' : 's'}`);
  };

  const downloadSelected = async () => {
    if (!client || selectedFiles.length === 0) return;
    const total = selectedFiles.length;
    const toastId = toast.loading(`Downloading 0 of ${total}…`);
    let failed = 0;

    for (let index = 0; index < selectedFiles.length; index += 1) {
      const file = selectedFiles[index];
      toast.loading(
        `Downloading ${index + 1} of ${total}…`,
        { id: toastId }
      );
      try {
        const blob = await downloadFile(client, file);
        triggerBrowserDownload(blob, file.name);
      } catch {
        failed += 1;
      }
    }

    if (failed > 0) {
      toast.error(`Downloaded ${total - failed} of ${total}; ${failed} failed.`, {
        id: toastId,
      });
    } else {
      toast.success(`Downloaded ${total} item${total === 1 ? '' : 's'}`, {
        id: toastId,
      });
    }
  };

  const updateTask = (id: number, patch: Partial<UploadTask>) => {
    setUploads((previous) =>
      previous.map((task) => (task.id === id ? { ...task, ...patch } : task))
    );
  };

  const processUploads = async () => {
    if (processingRef.current || !client) return;
    processingRef.current = true;

    const controller = new AbortController();
    uploadAbortRef.current = controller;

    try {
      while (uploadQueueRef.current.length > 0) {
        if (controller.signal.aborted) break;
        const task = uploadQueueRef.current[0];

        updateTask(task.id, { status: 'uploading', progress: 0, error: undefined });

        try {
          const messages = await uploadFiles(
            client,
            [{ file: task.file, path: task.path }],
            {
              signal: controller.signal,
              onFileProgress: (_index, fraction) => {
                updateTask(task.id, {
                  progress: Math.max(0, Math.min(1, fraction)),
                });
              },
            }
          );

          const message = messages[0];
          const newFile = message
            ? messageToDriveFile(message, task.path)
            : null;
          if (newFile) {
            setFiles((previous) =>
              previous.some((file) => file.id === newFile.id)
                ? previous
                : [...previous, newFile]
            );
          }
          updateTask(task.id, { status: 'done', progress: 1 });
        } catch (uploadError) {
          if (controller.signal.aborted) {
            updateTask(task.id, { status: 'cancelled', error: undefined });
          } else {
            updateTask(task.id, {
              status: 'error',
              error: errorMessage(uploadError, 'Upload failed.'),
            });
          }
        } finally {
          uploadQueueRef.current.shift();
        }
      }

      if (controller.signal.aborted) {
        const remaining = uploadQueueRef.current;
        uploadQueueRef.current = [];
        for (const task of remaining) {
          updateTask(task.id, { status: 'cancelled' });
        }
      }
    } finally {
      processingRef.current = false;
      uploadAbortRef.current = null;
      if (uploadQueueRef.current.length > 0) {
        void processUploads();
      }
    }
  };

  const enqueueUploads = (fileList: FileList | File[] | null) => {
    if (!fileList) return;
    const incoming = Array.from(fileList);
    if (incoming.length === 0) return;

    const tasks: UploadTask[] = incoming.map((file) => {
      const relativePath = (file as File & { webkitRelativePath?: string })
        .webkitRelativePath;
      const path = relativePath
        ? joinPath(currentPath, relativePath)
        : joinPath(currentPath, file.name);

      uploadIdRef.current += 1;
      return {
        id: uploadIdRef.current,
        file,
        path,
        status: 'queued',
        progress: 0,
      };
    });

    setUploads((previous) => [...previous, ...tasks]);
    uploadQueueRef.current.push(...tasks);
    void processUploads();
  };

  const cancelUploads = () => {
    uploadAbortRef.current?.abort();
    const remaining = uploadQueueRef.current;
    uploadQueueRef.current = [];
    for (const task of remaining) {
      updateTask(task.id, { status: 'cancelled' });
    }
  };

  const closeUploadPanel = () => {
    if (processingRef.current) return;
    setUploads([]);
  };

  const handleNewFolderAction = () => {
    setMobileSidebarOpen(false);
    setNewFolderOpen(true);
  };

  const handleUploadFilesAction = () => {
    setMobileSidebarOpen(false);
    fileInputRef.current?.click();
  };

  const handleUploadFolderAction = () => {
    setMobileSidebarOpen(false);
    folderInputRef.current?.click();
  };

  const handleDragEnter = (event: DragEvent<HTMLElement>) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    dragDepthRef.current += 1;
    setDragActive(true);
  };

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDragActive(false);
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    dragDepthRef.current = 0;
    setDragActive(false);
    if (event.dataTransfer.files?.length) {
      enqueueUploads(event.dataTransfer.files);
    }
  };

  const renameName = renameTarget
    ? renameTarget.type === 'file'
      ? renameTarget.file.name
      : renameTarget.folder.name
    : '';

  const moveName = moveTarget
    ? moveTarget.type === 'file'
      ? moveTarget.file.name
      : moveTarget.folder.name
    : '';

  const moveParent = moveTarget
    ? moveTarget.type === 'file'
      ? dirname(moveTarget.file.path)
      : dirname(moveTarget.folder.path)
    : currentPath;

  const deleteTitle = deleteTarget
    ? deleteTarget.type === 'file'
      ? `Delete “${deleteTarget.file.name}”?`
      : `Delete “${deleteTarget.folder.name}”?`
    : 'Delete item?';

  const deleteDescription = (() => {
    if (!deleteTarget) return '';
    if (deleteTarget.type === 'file') {
      return 'This file will be permanently deleted from your Telegram Saved Messages.';
    }
    const folder = deleteTarget.folder;
    const fileCount = files.filter((file) =>
      isPathInside(file.path, folder.path)
    ).length;
    const subfolderCount = markers.filter(
      (marker) =>
        marker.path !== folder.path && isPathInside(marker.path, folder.path)
    ).length;
    const total = fileCount + subfolderCount;
    if (total === 0) {
      return 'This empty folder will be permanently deleted.';
    }
    return `This folder and ${total} item${total === 1 ? '' : 's'} inside will be permanently deleted.`;
  })();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === 'loggedOut') {
    return <Navigate to="/login" replace />;
  }

  const showSkeleton = loading && files.length === 0 && markers.length === 0;
  const showError = Boolean(error) && files.length === 0 && markers.length === 0;
  const isEmpty = displayFolders.length === 0 && displayFiles.length === 0;

  const sidebar = (
    <DriveSidebar
      tree={folderTree}
      currentPath={currentPath}
      onNavigate={goToFolder}
      onNewFolder={handleNewFolderAction}
      onUploadFiles={handleUploadFilesAction}
      onUploadFolder={handleUploadFolderAction}
    />
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <DriveTopBar
        me={me}
        search={search}
        onSearchChange={setSearch}
        view={view}
        onViewChange={handleViewChange}
        onToggleSidebar={() => setSidebarVisible((value) => !value)}
        onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
        onLogout={() => void handleLogout()}
        loggingOut={loggingOut}
      />

      <div className="flex flex-1">
        {sidebarVisible ? (
          <aside className="hidden w-64 shrink-0 border-r bg-muted/20 md:block">
            {sidebar}
          </aside>
        ) : null}

        <main
          className="relative min-h-[calc(100vh-3.5rem)] min-w-0 flex-1"
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              {searching ? (
                <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                  <Search className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    Search results for <span className="font-medium text-foreground">“{search.trim()}”</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs">
                    {displayFiles.length + displayFolders.length}
                  </span>
                </div>
              ) : (
                <Breadcrumb className="min-w-0">
                  <BreadcrumbList className="flex-nowrap">
                    <BreadcrumbItem>
                      {currentPath === '/' ? (
                        <BreadcrumbPage className="flex items-center gap-1.5 font-medium">
                          <Home className="h-4 w-4" />
                          My Drive
                        </BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <Link
                            to="/drive"
                            className="flex items-center gap-1.5 font-medium"
                          >
                            <Home className="h-4 w-4" />
                            My Drive
                          </Link>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                    {breadcrumbs.map((crumb, index) => {
                      const isLast = index === breadcrumbs.length - 1;
                      return (
                        <Fragment key={crumb.path}>
                          <BreadcrumbSeparator>
                            <ChevronRight className="h-4 w-4" />
                          </BreadcrumbSeparator>
                          <BreadcrumbItem className="min-w-0">
                            {isLast ? (
                              <BreadcrumbPage className="max-w-[12rem] truncate font-medium">
                                {crumb.name}
                              </BreadcrumbPage>
                            ) : (
                              <BreadcrumbLink asChild>
                                <Link
                                  to={folderUrl(crumb.path)}
                                  className="max-w-[10rem] truncate"
                                >
                                  {crumb.name}
                                </Link>
                              </BreadcrumbLink>
                            )}
                          </BreadcrumbItem>
                        </Fragment>
                      );
                    })}
                  </BreadcrumbList>
                </Breadcrumb>
              )}

              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() =>
                  void load({ silent: files.length > 0 || markers.length > 0 })
                }
                disabled={loading || refreshing}
              >
                <RefreshCw
                  className={`mr-0 h-4 w-4 sm:mr-2 ${refreshing ? 'animate-spin' : ''}`}
                />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
            </div>

            {searching ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Searching every folder in your drive.
              </p>
            ) : null}

            <div className="mt-4">
              {showSkeleton ? (
                <div className="space-y-4">
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading… {loadedCount} items
                  </p>
                  <DriveSkeleton />
                </div>
              ) : showError ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 py-16 text-center">
                  <AlertCircle className="mb-3 h-10 w-10 text-destructive" />
                  <p className="text-base font-medium">Could not load your drive</p>
                  <p className="mt-1 max-w-md text-sm text-muted-foreground">
                    {error}
                  </p>
                  <Button
                    className="mt-4"
                    variant="outline"
                    onClick={() => void load()}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Retry
                  </Button>
                </div>
              ) : isEmpty ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 py-16 text-center">
                  <FolderOpen className="mb-3 h-12 w-12 text-muted-foreground/60" />
                  <p className="text-base font-medium">
                    {searching ? 'No matching items' : 'This folder is empty'}
                  </p>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    {searching
                      ? `Nothing matches “${search.trim()}”. Try a different search.`
                      : 'This folder is empty — drop files here or click New to upload.'}
                  </p>
                  {searching ? (
                    <Button
                      className="mt-4"
                      variant="outline"
                      onClick={() => setSearch('')}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Clear search
                    </Button>
                  ) : (
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      <Button onClick={handleNewFolderAction}>
                        <FolderPlus className="mr-2 h-4 w-4" />
                        New folder
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleUploadFilesAction}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Upload files
                      </Button>
                    </div>
                  )}
                </div>
              ) : view === 'grid' ? (
                <FileGrid
                  client={client}
                  files={displayFiles}
                  folders={displayFolders}
                  selectedIds={selectedIds}
                  showPath={searching}
                  onToggleSelect={toggleSelect}
                  onOpenFolder={(folder) => goToFolder(folder.path)}
                  onOpenFile={openFile}
                  onDownloadFile={(file) => void download(file)}
                  onRename={setRenameTarget}
                  onMove={setMoveTarget}
                  onDelete={setDeleteTarget}
                />
              ) : (
                <FileList
                  files={displayFiles}
                  folders={displayFolders}
                  selectedIds={selectedIds}
                  showPath={searching}
                  onToggleSelect={toggleSelect}
                  onToggleSelectAll={toggleSelectAll}
                  onOpenFolder={(folder) => goToFolder(folder.path)}
                  onOpenFile={openFile}
                  onDownloadFile={(file) => void download(file)}
                  onRename={setRenameTarget}
                  onMove={setMoveTarget}
                  onDelete={setDeleteTarget}
                />
              )}
            </div>
          </div>

          {dragActive ? (
            <div className="pointer-events-none absolute inset-3 z-20 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary bg-primary/5 backdrop-blur-sm">
              <Upload className="mb-3 h-12 w-12 text-primary" />
              <p className="text-lg font-semibold text-primary">Drop files to upload</p>
              <p className="mt-1 text-sm text-muted-foreground">
                They will be saved to {currentPath === '/' ? 'My Drive' : currentPath}
              </p>
            </div>
          ) : null}
        </main>
      </div>

      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="w-72 p-0 pt-8 md:hidden">
          <SheetTitle className="sr-only">Folders</SheetTitle>
          <SheetDescription className="sr-only">
            Browse folders and create or upload items.
          </SheetDescription>
          {sidebar}
        </SheetContent>
      </Sheet>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          enqueueUploads(event.target.files);
          event.target.value = '';
        }}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          enqueueUploads(event.target.files);
          event.target.value = '';
        }}
        {...({ webkitdirectory: '', directory: '' } as unknown as InputHTMLAttributes<HTMLInputElement>)}
      />

      {selectedFiles.length > 0 ? (
        <div className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-background px-3 py-1.5 shadow-xl">
          <span className="mr-1 whitespace-nowrap px-1 text-sm font-medium">
            {selectedFiles.length} selected
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => void downloadSelected()}
          >
            <Download className="mr-1.5 h-4 w-4" />
            <span className="hidden sm:inline">Download</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => setBulkMoveOpen(true)}
          >
            <Move className="mr-1.5 h-4 w-4" />
            <span className="hidden sm:inline">Move</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-destructive hover:text-destructive"
            onClick={() => setBulkDeleteOpen(true)}
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            <span className="hidden sm:inline">Delete</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={clearSelection}
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      <NewFolderDialog
        open={newFolderOpen}
        onOpenChange={setNewFolderOpen}
        onCreate={handleCreateFolder}
      />

      {renameTarget ? (
        <RenameDialog
          open
          onOpenChange={(open) => {
            if (!open) setRenameTarget(null);
          }}
          currentName={renameName}
          itemType={renameTarget.type}
          onRename={handleRename}
        />
      ) : null}

      {moveTarget ? (
        <MoveDialog
          open
          onOpenChange={(open) => {
            if (!open) setMoveTarget(null);
          }}
          itemName={moveName}
          itemType={moveTarget.type}
          currentParent={moveParent}
          folders={folderEntries}
          disallowPath={
            moveTarget.type === 'folder' ? moveTarget.folder.path : undefined
          }
          onMove={handleMove}
        />
      ) : null}

      <MoveDialog
        open={bulkMoveOpen}
        onOpenChange={setBulkMoveOpen}
        itemName={`${selectedFiles.length} selected file${selectedFiles.length === 1 ? '' : 's'}`}
        itemType="file"
        currentParent={currentPath}
        folders={folderEntries}
        onMove={handleBulkMove}
      />

      {deleteTarget ? (
        <ConfirmDeleteDialog
          open
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
          title={deleteTitle}
          description={deleteDescription}
          onConfirm={handleDelete}
        />
      ) : null}

      <ConfirmDeleteDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`Delete ${selectedFiles.length} item${selectedFiles.length === 1 ? '' : 's'}?`}
        description="The selected files will be permanently deleted from your Telegram Saved Messages."
        onConfirm={handleBulkDelete}
      />

      <ImagePreviewDialog
        client={client}
        file={previewFile}
        open={previewFile !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewFile(null);
        }}
      />

      <UploadPanel
        tasks={uploads}
        onCancel={cancelUploads}
        onClose={closeUploadPanel}
      />
    </div>
  );
};

export default Drive;
