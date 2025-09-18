import { useState, useCallback } from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import FileExplorer from "@/components/ide/FileExplorer";
import EditorArea from "@/components/ide/EditorArea";
import Terminal from "@/components/ide/Terminal";
import MenuBar from "@/components/ide/MenuBar";
import StatusBar from "@/components/ide/StatusBar";
import type { File } from "@shared/schema";

export default function IDE() {
  const [openTabs, setOpenTabs] = useState<File[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [explorerVisible, setExplorerVisible] = useState(true);
  const [terminalVisible, setTerminalVisible] = useState(true);
  const [newFileDialog, setNewFileDialog] = useState<{ open: boolean; type: 'file' | 'folder' | null }>({ open: false, type: null });
  const [editorState, setEditorState] = useState<{ isDirty: boolean; cursorPosition?: { line: number; column: number }; isSaving: boolean; bufferLength?: number }>({ isDirty: false, isSaving: false });
  const [dirtyTabs, setDirtyTabs] = useState<Set<string>>(new Set());
  const [savedContent, setSavedContent] = useState<Map<string, string>>(new Map());

  const handleFileOpen = useCallback((file: File) => {
    if (file.isDirectory) return;
    
    const existingTab = openTabs.find(tab => tab.path === file.path);
    if (!existingTab) {
      setOpenTabs(prev => [...prev, file]);
      // Initialize saved content reference
      setSavedContent(prev => {
        const next = new Map(prev);
        next.set(file.path, file.content || '');
        return next;
      });
    }
    setActiveTab(file.path);
  }, [openTabs]);

  const handleFileSaved = useCallback((filePath: string, newContent: string) => {
    // Update the tab content to prevent stale content issues
    setOpenTabs(prev => prev.map(tab => 
      tab.path === filePath 
        ? { ...tab, content: newContent, updatedAt: new Date() }
        : tab
    ));
    
    // Update saved content reference
    setSavedContent(prev => {
      const next = new Map(prev);
      next.set(filePath, newContent);
      return next;
    });
    
    // Clear dirty state
    setDirtyTabs(prev => {
      const next = new Set(prev);
      next.delete(filePath);
      return next;
    });
  }, []);

  const handleEditorStateChange = useCallback((state: { isDirty: boolean; cursorPosition?: { line: number; column: number }; isSaving: boolean; bufferLength?: number; filePath?: string; content?: string }) => {
    setEditorState(state);
    
    // Update per-tab dirty tracking
    if (state.filePath) {
      const savedContentForFile = savedContent.get(state.filePath) || '';
      const isDirtyForFile = state.content !== undefined && state.content !== savedContentForFile;
      
      setDirtyTabs(prev => {
        const next = new Set(prev);
        if (isDirtyForFile) {
          next.add(state.filePath!);
        } else {
          next.delete(state.filePath!);
        }
        return next;
      });
    }
  }, [savedContent]);

  const handleTabClose = useCallback((filePath: string) => {
    // Check if tab is dirty and confirm close
    if (dirtyTabs.has(filePath)) {
      if (!confirm(`${filePath.split('/').pop()} has unsaved changes. Close without saving?`)) {
        return;
      }
    }
    
    setOpenTabs(prev => {
      const filtered = prev.filter(tab => tab.path !== filePath);
      if (activeTab === filePath && filtered.length > 0) {
        setActiveTab(filtered[filtered.length - 1].path);
      } else if (filtered.length === 0) {
        setActiveTab(null);
      }
      return filtered;
    });
    
    // Clean up dirty state and saved content
    setDirtyTabs(prev => {
      const next = new Set(prev);
      next.delete(filePath);
      return next;
    });
    setSavedContent(prev => {
      const next = new Map(prev);
      next.delete(filePath);
      return next;
    });
  }, [activeTab, dirtyTabs]);

  const handleTabSwitch = useCallback((filePath: string) => {
    setActiveTab(filePath);
  }, []);

  const activeFile = openTabs.find(tab => tab.path === activeTab);

  const handleNewFile = useCallback(() => {
    setNewFileDialog({ open: true, type: 'file' });
  }, []);

  const handleNewFolder = useCallback(() => {
    setNewFileDialog({ open: true, type: 'folder' });
  }, []);

  const handleSaveAll = useCallback(() => {
    // Trigger save for all open tabs - this would normally save all modified files
    // For now, show a toast indicating save all was triggered
    console.log('Save All triggered for tabs:', openTabs.map(t => t.path));
  }, [openTabs]);

  const handleNewTerminal = useCallback(() => {
    // This will be handled by the Terminal component when it receives focus
    // For now, ensure terminal is visible
    setTerminalVisible(true);
  }, []);

  const handleToggleExplorer = useCallback(() => {
    setExplorerVisible(prev => !prev);
  }, []);

  const handleToggleTerminal = useCallback(() => {
    setTerminalVisible(prev => !prev);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background text-foreground" data-testid="ide-container">
      <MenuBar 
        onSearch={setSearchQuery}
        searchQuery={searchQuery}
        onNewFile={handleNewFile}
        onNewFolder={handleNewFolder}
        onSaveAll={handleSaveAll}
        onNewTerminal={handleNewTerminal}
        onToggleExplorer={handleToggleExplorer}
        onToggleTerminal={handleToggleTerminal}
        explorerVisible={explorerVisible}
        terminalVisible={terminalVisible}
        data-testid="menu-bar"
      />
      
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {explorerVisible && (
            <>
              <ResizablePanel defaultSize={20} minSize={15} maxSize={40}>
                <FileExplorer 
                  onFileOpen={handleFileOpen}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  data-testid="file-explorer"
                />
              </ResizablePanel>
              <ResizableHandle className="resizer" data-testid="horizontal-resizer" />
            </>
          )}
          
          <ResizablePanel defaultSize={explorerVisible ? 80 : 100}>
            <ResizablePanelGroup direction="vertical">
              <ResizablePanel defaultSize={terminalVisible ? 70 : 100} minSize={30}>
                <EditorArea
                  openTabs={openTabs}
                  activeTab={activeTab}
                  activeFile={activeFile}
                  onTabClose={handleTabClose}
                  onTabSwitch={handleTabSwitch}
                  onEditorStateChange={handleEditorStateChange}
                  onFileSaved={handleFileSaved}
                  dirtyTabs={dirtyTabs}
                  savedContent={savedContent}
                  data-testid="editor-area"
                />
              </ResizablePanel>
              
              {terminalVisible && (
                <>
                  <ResizableHandle className="resizer !h-1 !w-auto !cursor-row-resize" data-testid="vertical-resizer" />
                  <ResizablePanel defaultSize={30} minSize={20}>
                    <Terminal data-testid="terminal" />
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      
      <StatusBar 
        activeFile={activeFile}
        editorState={editorState}
        data-testid="status-bar"
      />
    </div>
  );
}
