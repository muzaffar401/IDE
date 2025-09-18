import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Plus, FolderPlus, RotateCcw, Search, MoreHorizontal, Edit2, Trash2, FileIcon, FolderIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getFileIcon } from "@/lib/file-icons";
import type { File } from "@shared/schema";

interface FileExplorerProps {
  onFileOpen: (file: File) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export default function FileExplorer({ onFileOpen, searchQuery = "", onSearchChange }: FileExplorerProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["/"]));
  const [newItemDialog, setNewItemDialog] = useState<{ open: boolean; type: 'file' | 'folder' | null; parentPath: string }>({
    open: false,
    type: null,
    parentPath: "/",
  });
  const [newItemName, setNewItemName] = useState("");
  const [searchInput, setSearchInput] = useState(searchQuery);
  const [draggedItem, setDraggedItem] = useState<File | null>(null);
  const [dragOverItem, setDragOverItem] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: File } | null>(null);

  // Sync search input with prop
  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: files = [], isLoading } = useQuery<File[]>({
    queryKey: ["/api/files"],
  });

  const { data: searchResults = [] } = useQuery<File[]>({
    queryKey: ["/api/files/search", searchInput],
    queryFn: async () => {
      if (!searchInput.trim()) return [];
      const response = await apiRequest("GET", `/api/files/search/${encodeURIComponent(searchInput)}`);
      return response.json();
    },
    enabled: searchInput.length > 0,
  });

  // Debounced search
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (onSearchChange && searchInput !== searchQuery) {
        onSearchChange(searchInput);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchInput, searchQuery, onSearchChange]);

  const createFileMutation = useMutation({
    mutationFn: async (data: { name: string; path: string; isDirectory: boolean; parentPath: string; content?: string }) => {
      const response = await apiRequest("POST", "/api/files", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      setNewItemDialog({ open: false, type: null, parentPath: "/" });
      setNewItemName("");
      toast({ title: "Success", description: "Item created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create item", variant: "destructive" });
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (filePath: string) => {
      await apiRequest("DELETE", `/api/files${filePath === "/" ? "" : filePath}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      toast({ title: "Success", description: "Item deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete item", variant: "destructive" });
    },
  });

  const renameFileMutation = useMutation({
    mutationFn: async ({ oldPath, newPath }: { oldPath: string; newPath: string }) => {
      const response = await apiRequest("PUT", "/api/files/rename", { oldPath, newPath });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      toast({ title: "Success", description: "Item renamed successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to rename item", variant: "destructive" });
    },
  });

  const toggleFolder = useCallback((folderPath: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  }, []);

  const handleCreateItem = useCallback(() => {
    if (!newItemName.trim() || !newItemDialog.type) return;

    const parentPath = newItemDialog.parentPath;
    const itemPath = parentPath === "/" ? `/${newItemName}` : `${parentPath}/${newItemName}`;

    createFileMutation.mutate({
      name: newItemName.trim(),
      path: itemPath,
      isDirectory: newItemDialog.type === 'folder',
      parentPath,
      content: newItemDialog.type === 'file' ? "" : undefined,
    });
  }, [newItemName, newItemDialog, createFileMutation]);

  const handleDeleteItem = useCallback((filePath: string) => {
    if (window.confirm("Are you sure you want to delete this item?")) {
      deleteFileMutation.mutate(filePath);
    }
  }, [deleteFileMutation]);

  const handleRenameItem = useCallback((file: File) => {
    const newName = prompt("Enter new name:", file.name);
    if (newName && newName !== file.name) {
      const parentPath = file.path.substring(0, file.path.lastIndexOf('/')) || '/';
      const newPath = parentPath === '/' ? `/${newName}` : `${parentPath}/${newName}`;
      renameFileMutation.mutate({ oldPath: file.path, newPath });
    }
  }, [renameFileMutation]);

  const handleDragStart = useCallback((e: React.DragEvent, file: File) => {
    setDraggedItem(file);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', file.path);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, targetPath: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverItem(targetPath);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverItem(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetFile: File) => {
    e.preventDefault();
    setDragOverItem(null);
    
    if (!draggedItem || !targetFile.isDirectory || draggedItem.path === targetFile.path) {
      setDraggedItem(null);
      return;
    }

    // Don't allow dropping a folder into itself or its children
    if (targetFile.path.startsWith(draggedItem.path + '/')) {
      setDraggedItem(null);
      return;
    }

    // Check if it's already in the target directory (no-op)
    if (draggedItem.parentPath === targetFile.path) {
      toast({ title: "Info", description: "File is already in this location" });
      setDraggedItem(null);
      return;
    }

    // Build correct path for root directory
    const basePath = targetFile.path === '/' ? '' : targetFile.path;
    const newPath = `${basePath}/${draggedItem.name}`;
    
    // Check if a file with the same name already exists
    const existingFile = files.find(f => f.path === newPath);
    if (existingFile) {
      if (!confirm(`A file named "${draggedItem.name}" already exists. Replace it?`)) {
        setDraggedItem(null);
        return;
      }
    }

    renameFileMutation.mutate({ oldPath: draggedItem.path, newPath });
    setDraggedItem(null);
  }, [draggedItem, renameFileMutation, files, toast]);

  const handleContextMenu = useCallback((e: React.MouseEvent, file: File) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, file });
  }, []);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  const buildFileTree = useCallback((files: File[]) => {
    const fileMap = new Map<string, File>();
    const children = new Map<string, File[]>();

    files.forEach(file => {
      fileMap.set(file.path, file);
      const parentPath = file.parentPath || "/";
      if (!children.has(parentPath)) {
        children.set(parentPath, []);
      }
      if (file.path !== "/") {
        children.get(parentPath)?.push(file);
      }
    });

    const renderNode = (file: File, level: number = 0): JSX.Element => {
      const isExpanded = expandedFolders.has(file.path);
      const hasChildren = children.has(file.path) && children.get(file.path)!.length > 0;
      const Icon = getFileIcon(file.name, file.isDirectory);

      return (
        <div key={file.path}>
          <div
            className={`file-tree-item group hover:bg-accent/10 cursor-pointer rounded px-1 py-1 flex items-center ${level > 0 ? `ml-${level * 4}` : ""} ${
              dragOverItem === file.path && file.isDirectory ? 'bg-accent/20 border-2 border-dashed border-accent' : ''
            }`}
            style={{ paddingLeft: `${level * 16 + 8}px` }}
            onClick={() => file.isDirectory ? toggleFolder(file.path) : onFileOpen(file)}
            onContextMenu={(e) => handleContextMenu(e, file)}
            draggable={file.path !== "/"}
            onDragStart={(e) => handleDragStart(e, file)}
            onDragOver={file.isDirectory ? (e) => handleDragOver(e, file.path) : undefined}
            onDragLeave={file.isDirectory ? handleDragLeave : undefined}
            onDrop={file.isDirectory ? (e) => handleDrop(e, file) : undefined}
            data-testid={`file-item-${file.path.replace(/[/\\]/g, '-')}`}
          >
            {file.isDirectory && hasChildren && (
              isExpanded ? 
              <ChevronDown className="h-3 w-3 mr-1 text-muted-foreground shrink-0" /> : 
              <ChevronRight className="h-3 w-3 mr-1 text-muted-foreground shrink-0" />
            )}
            {file.isDirectory && !hasChildren && (
              <div className="w-3 h-3 mr-1 shrink-0" />
            )}
            {!file.isDirectory && (
              <div className="w-3 h-3 mr-1 shrink-0" />
            )}
            <Icon className="h-4 w-4 mr-2 shrink-0" />
            <span className="text-sm truncate flex-1">{file.name}</span>
            
            {file.path !== "/" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-auto opacity-0 group-hover:opacity-100 shrink-0">
                    <MoreHorizontal className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation();
                    setNewItemDialog({ open: true, type: 'file', parentPath: file.isDirectory ? file.path : (file.parentPath || '/') });
                  }}>
                    <Plus className="h-3 w-3 mr-2" />
                    New File
                  </DropdownMenuItem>
                  {file.isDirectory && (
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation();
                      setNewItemDialog({ open: true, type: 'folder', parentPath: file.path });
                    }}>
                      <FolderPlus className="h-3 w-3 mr-2" />
                      New Folder
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation();
                    handleRenameItem(file);
                  }}>
                    <Edit2 className="h-3 w-3 mr-2" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteItem(file.path);
                    }}
                    className="text-destructive"
                  >
                    <Trash2 className="h-3 w-3 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          
          {file.isDirectory && isExpanded && hasChildren && (
            <div>
              {children.get(file.path)?.map(child => renderNode(child, level + 1))}
            </div>
          )}
        </div>
      );
    };

    const rootFile = fileMap.get("/");
    return rootFile ? renderNode(rootFile) : null;
  }, [expandedFolders, onFileOpen, toggleFolder, handleDeleteItem, renameFileMutation]);

  const displayFiles = searchInput.trim() ? searchResults : files;

  if (isLoading) {
    return (
      <div className="w-full h-full bg-ide-sidebar border-r border-border flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading files...</div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-ide-sidebar border-r border-border flex flex-col" data-testid="file-explorer">
      {/* Explorer Header */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">EXPLORER</h3>
          <div className="flex space-x-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setNewItemDialog({ open: true, type: 'file', parentPath: "/" })}
              title="New File"
              data-testid="button-new-file"
            >
              <Plus className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setNewItemDialog({ open: true, type: 'folder', parentPath: "/" })}
              title="New Folder"
              data-testid="button-new-folder"
            >
              <FolderPlus className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/files"] })}
              title="Refresh"
              data-testid="button-refresh"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          </div>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-7 h-7 text-xs bg-muted border-border"
            data-testid="input-search-files"
          />
        </div>
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-y-auto ide-scrollbar px-2 py-2">
        {searchInput.trim() ? (
          <div className="space-y-1">
            {(displayFiles as File[]).map((file: File) => {
              const Icon = getFileIcon(file.name, file.isDirectory);
              return (
                <div
                  key={file.path}
                  className="file-tree-item group hover:bg-accent/10 cursor-pointer rounded px-2 py-1 flex items-center"
                  onClick={() => !file.isDirectory && onFileOpen(file)}
                  onContextMenu={(e) => handleContextMenu(e, file)}
                  data-testid={`search-result-${file.path.replace(/[/\\]/g, '-')}`}
                >
                  <Icon className="h-4 w-4 mr-2 shrink-0" />
                  <span className="text-sm truncate flex-1">{file.path}</span>
                  {file.path !== "/" && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 w-6 p-0 ml-auto opacity-0 group-hover:opacity-100 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRenameItem(file);
                      }}
                      title="Rename"
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              );
            })}
            {displayFiles.length === 0 && searchInput.trim() && (
              <div className="text-sm text-muted-foreground px-2 py-4 text-center">
                No files found matching "{searchInput}"
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {buildFileTree(files)}
          </div>
        )}
      </div>

      {/* Right-click Context Menu */}
      {contextMenu && (
        <div 
          className="fixed z-50 bg-popover border border-border rounded-md shadow-lg py-1 min-w-[150px]"
          style={{ 
            left: contextMenu.x, 
            top: contextMenu.y,
            transform: 'translate(0, -100%)' // Position above cursor
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div 
            className="px-3 py-1 text-xs font-medium text-muted-foreground border-b border-border mb-1"
          >
            {contextMenu.file.name}
          </div>
          
          <button 
            className="w-full text-left px-3 py-1 text-sm hover:bg-accent hover:text-accent-foreground flex items-center"
            onClick={() => {
              setNewItemDialog({ open: true, type: 'file', parentPath: contextMenu.file.isDirectory ? contextMenu.file.path : (contextMenu.file.parentPath || '/') });
              setContextMenu(null);
            }}
          >
            <Plus className="h-3 w-3 mr-2" />
            New File
          </button>
          
          {contextMenu.file.isDirectory && (
            <button 
              className="w-full text-left px-3 py-1 text-sm hover:bg-accent hover:text-accent-foreground flex items-center"
              onClick={() => {
                setNewItemDialog({ open: true, type: 'folder', parentPath: contextMenu.file.path });
                setContextMenu(null);
              }}
            >
              <FolderPlus className="h-3 w-3 mr-2" />
              New Folder
            </button>
          )}
          
          {contextMenu.file.path !== "/" && (
            <>
              <button 
                className="w-full text-left px-3 py-1 text-sm hover:bg-accent hover:text-accent-foreground flex items-center"
                onClick={() => {
                  handleRenameItem(contextMenu.file);
                  setContextMenu(null);
                }}
              >
                <Edit2 className="h-3 w-3 mr-2" />
                Rename
              </button>
              
              <button 
                className="w-full text-left px-3 py-1 text-sm hover:bg-destructive/20 text-destructive flex items-center"
                onClick={() => {
                  handleDeleteItem(contextMenu.file.path);
                  setContextMenu(null);
                }}
              >
                <Trash2 className="h-3 w-3 mr-2" />
                Delete
              </button>
            </>
          )}
        </div>
      )}

      {/* New Item Dialog */}
      <Dialog open={newItemDialog.open} onOpenChange={(open) => setNewItemDialog({ ...newItemDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Create New {newItemDialog.type === 'file' ? 'File' : 'Folder'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder={`Enter ${newItemDialog.type} name...`}
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateItem()}
              data-testid="input-new-item-name"
            />
            <div className="flex justify-end space-x-2">
              <Button 
                variant="outline" 
                onClick={() => setNewItemDialog({ open: false, type: null, parentPath: "/" })}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleCreateItem}
                disabled={!newItemName.trim() || createFileMutation.isPending}
                data-testid="button-create"
              >
                {createFileMutation.isPending ? "Creating..." : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
