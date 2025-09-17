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

  const handleFileOpen = useCallback((file: File) => {
    if (file.isDirectory) return;
    
    const existingTab = openTabs.find(tab => tab.path === file.path);
    if (!existingTab) {
      setOpenTabs(prev => [...prev, file]);
    }
    setActiveTab(file.path);
  }, [openTabs]);

  const handleTabClose = useCallback((filePath: string) => {
    setOpenTabs(prev => {
      const filtered = prev.filter(tab => tab.path !== filePath);
      if (activeTab === filePath && filtered.length > 0) {
        setActiveTab(filtered[filtered.length - 1].path);
      } else if (filtered.length === 0) {
        setActiveTab(null);
      }
      return filtered;
    });
  }, [activeTab]);

  const handleTabSwitch = useCallback((filePath: string) => {
    setActiveTab(filePath);
  }, []);

  const activeFile = openTabs.find(tab => tab.path === activeTab);

  return (
    <div className="h-screen flex flex-col bg-background text-foreground" data-testid="ide-container">
      <MenuBar 
        onSearch={setSearchQuery}
        searchQuery={searchQuery}
        data-testid="menu-bar"
      />
      
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          <ResizablePanel defaultSize={20} minSize={15} maxSize={40}>
            <FileExplorer 
              onFileOpen={handleFileOpen}
              searchQuery={searchQuery}
              data-testid="file-explorer"
            />
          </ResizablePanel>
          
          <ResizableHandle className="resizer" data-testid="horizontal-resizer" />
          
          <ResizablePanel defaultSize={80}>
            <ResizablePanelGroup direction="vertical">
              <ResizablePanel defaultSize={70} minSize={30}>
                <EditorArea
                  openTabs={openTabs}
                  activeTab={activeTab}
                  activeFile={activeFile}
                  onTabClose={handleTabClose}
                  onTabSwitch={handleTabSwitch}
                  data-testid="editor-area"
                />
              </ResizablePanel>
              
              <ResizableHandle className="resizer !h-1 !w-auto !cursor-row-resize" data-testid="vertical-resizer" />
              
              <ResizablePanel defaultSize={30} minSize={20}>
                <Terminal data-testid="terminal" />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      
      <StatusBar 
        activeFile={activeFile}
        data-testid="status-bar"
      />
    </div>
  );
}
