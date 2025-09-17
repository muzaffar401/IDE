import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Plus, FolderPlus, RotateCcw, Search, MoreHorizontal, Edit2, Trash2 } from "lucide-react";
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
}

export default function FileExplorer({ onFileOpen, searchQuery = "" }: FileExplorerProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["/"]));
  const [newItemDialog, setNewItemDialog] = useState<{ open: boolean; type: 'file' | 'folder' | null; parentPath: string }>({
    open: false,
    type: null,
    parentPath: "/",
  });
  const [newItemName, setNewItemName] = useState("");
  const [searchInput, setSearchInput] = useState("");
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: files = [], isLoading } = useQuery<File[]>({
    queryKey: ["/api/files"],
  });

  const { data: searchResults = [] } = useQuery<File[]>({
    queryKey: ["/api/files/search", searchQuery],
    enabled: searchQuery.length > 0,
  });

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
            className={`file-tree-item ${level > 0 ? `ml-${level * 4}` : ""}`}
            style={{ paddingLeft: `${level * 16 + 8}px` }}
            onClick={() => file.isDirectory ? toggleFolder(file.path) : onFileOpen(file)}
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
            <span className="text-sm truncate">{file.name}</span>
            
            {file.path !== "/" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-auto opacity-0 group-hover:opacity-100">
                    <MoreHorizontal className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation();
                    const newName = prompt("Enter new name:", file.name);
                    if (newName && newName !== file.name) {
                      const parentPath = file.path.substring(0, file.path.lastIndexOf('/')) || '/';
                      const newPath = parentPath === '/' ? `/${newName}` : `${parentPath}/${newName}`;
                      renameFileMutation.mutate({ oldPath: file.path, newPath });
                    }
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

  const displayFiles = searchQuery ? searchResults : files;

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
        {searchQuery ? (
          <div className="space-y-1">
            {(displayFiles as File[]).map((file: File) => {
              const Icon = getFileIcon(file.name, file.isDirectory);
              return (
                <div
                  key={file.path}
                  className="file-tree-item"
                  onClick={() => !file.isDirectory && onFileOpen(file)}
                  data-testid={`search-result-${file.path.replace(/[/\\]/g, '-')}`}
                >
                  <Icon className="h-4 w-4 mr-2 shrink-0" />
                  <span className="text-sm truncate">{file.path}</span>
                </div>
              );
            })}
            {displayFiles.length === 0 && (
              <div className="text-sm text-muted-foreground px-2 py-4 text-center">
                No files found matching "{searchQuery}"
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {buildFileTree(files)}
          </div>
        )}
      </div>

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
