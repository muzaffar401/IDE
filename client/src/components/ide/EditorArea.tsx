import { useRef, useEffect, useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getFileIcon } from "@/lib/file-icons";
import type { File } from "@shared/schema";

// Monaco Editor integration
declare global {
  interface Window {
    monaco: any;
    require: any;
  }
}

interface EditorAreaProps {
  openTabs: File[];
  activeTab: string | null;
  activeFile?: File;
  onTabClose: (filePath: string) => void;
  onTabSwitch: (filePath: string) => void;
  onEditorStateChange?: (state: { isDirty: boolean; cursorPosition?: { line: number; column: number }; isSaving: boolean }) => void;
}

export default function EditorArea({ 
  openTabs, 
  activeTab, 
  activeFile, 
  onTabClose, 
  onTabSwitch,
  onEditorStateChange
}: EditorAreaProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const monacoEditorRef = useRef<any>(null);
  const [editorContent, setEditorContent] = useState("");
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevFilePathRef = useRef<string | null>(null);
  const [isMonacoLoaded, setIsMonacoLoaded] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [isSaving, setIsSaving] = useState(false);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateFileMutation = useMutation({
    mutationFn: async ({ filePath, content }: { filePath: string; content: string }) => {
      setIsSaving(true);
      const response = await apiRequest("PATCH", `/api/files${filePath}`, { content });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      setIsDirty(false);
      setIsSaving(false);
      toast({ title: "Saved", description: "File saved successfully", duration: 2000 });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save file", variant: "destructive" });
      setIsSaving(false);
    },
  });

  // Load Monaco Editor
  useEffect(() => {
    if (window.monaco) {
      setIsMonacoLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs/loader.js';
    script.onload = () => {
      window.require.config({ 
        paths: { 
          vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs' 
        } 
      });
      
      window.require(['vs/editor/editor.main'], () => {
        // Set dark theme
        window.monaco.editor.defineTheme('cursor-dark', {
          base: 'vs-dark',
          inherit: true,
          rules: [
            { token: 'comment', foreground: '6a9955' },
            { token: 'keyword', foreground: '569cd6' },
            { token: 'string', foreground: 'ce9178' },
            { token: 'number', foreground: 'b5cea8' },
            { token: 'function', foreground: 'dcdcaa' },
            { token: 'variable', foreground: '9cdcfe' },
          ],
          colors: {
            'editor.background': '#1e1e1e',
            'editor.foreground': '#cccccc',
            'editorLineNumber.foreground': '#858585',
            'editorLineNumber.activeForeground': '#cccccc',
            'editor.selectionBackground': '#264f78',
            'editor.lineHighlightBackground': '#2d2d30',
          }
        });
        
        setIsMonacoLoaded(true);
      });
    };
    
    document.head.appendChild(script);
    
    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  // Initialize Monaco Editor
  useEffect(() => {
    if (!isMonacoLoaded || !editorRef.current) return;

    monacoEditorRef.current = window.monaco.editor.create(editorRef.current, {
      value: activeFile?.content || '',
      language: getLanguageFromFileName(activeFile?.name || ''),
      theme: 'cursor-dark',
      fontSize: 14,
      fontFamily: 'JetBrains Mono, monospace',
      lineNumbers: 'on',
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 2,
      insertSpaces: true,
      wordWrap: 'on',
    });

    // Auto-save on content change
    const disposable = monacoEditorRef.current.onDidChangeModelContent((e: any) => {
      // Ignore programmatic setValue calls to prevent race conditions
      if (e.isFlush) {
        return;
      }
      
      const content = monacoEditorRef.current.getValue();
      setEditorContent(content);
      
      const isDirtyState = activeFile && content !== activeFile.content;
      setIsDirty(Boolean(isDirtyState));
      
      if (isDirtyState) {
        // Clear existing timeout
        if (autoSaveTimeoutRef.current) {
          clearTimeout(autoSaveTimeoutRef.current);
        }
        
        // Set new debounced auto-save
        autoSaveTimeoutRef.current = setTimeout(() => {
          // Capture the file path and content at timeout creation time
          const currentFilePath = activeFile.path;
          const currentContent = content;
          updateFileMutation.mutate({
            filePath: currentFilePath,
            content: currentContent,
          });
          autoSaveTimeoutRef.current = null;
        }, 1000);
      }
    });

    // Track cursor position
    const cursorDisposable = monacoEditorRef.current.onDidChangeCursorPosition((e: any) => {
      setCursorPosition({
        line: e.position.lineNumber,
        column: e.position.column
      });
    });

    return () => {
      // Clear auto-save timeout on cleanup
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }
      disposable?.dispose();
      cursorDisposable?.dispose();
      monacoEditorRef.current?.dispose();
    };
  }, [isMonacoLoaded, activeFile]); // Removed updateFileMutation to prevent editor recreation

  // Update editor content when active file changes
  useEffect(() => {
    // Clear any pending auto-save when switching files
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }
    
    // Reset state for new file
    setIsDirty(false);
    setIsSaving(false);
    setCursorPosition({ line: 1, column: 1 });
    
    // Only setValue when actually switching to a different file
    if (monacoEditorRef.current && activeFile && activeFile.path !== prevFilePathRef.current) {
      monacoEditorRef.current.setValue(activeFile.content || '');
      const language = getLanguageFromFileName(activeFile.name);
      window.monaco.editor.setModelLanguage(monacoEditorRef.current.getModel(), language);
      prevFilePathRef.current = activeFile.path;
    }
  }, [activeFile]);

  // Notify parent about editor state changes
  useEffect(() => {
    onEditorStateChange?.({
      isDirty,
      cursorPosition,
      isSaving
    });
  }, [isDirty, cursorPosition, isSaving, onEditorStateChange]);

  const getLanguageFromFileName = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'js':
      case 'jsx':
        return 'javascript';
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'html':
        return 'html';
      case 'css':
        return 'css';
      case 'json':
        return 'json';
      case 'md':
        return 'markdown';
      case 'py':
        return 'python';
      case 'java':
        return 'java';
      case 'cpp':
      case 'c':
        return 'cpp';
      default:
        return 'plaintext';
    }
  };

  return (
    <div className="h-full flex flex-col bg-ide-editor" data-testid="editor-area">
      {/* Editor Tabs */}
      <div className="bg-muted border-b border-border flex items-center overflow-x-auto">
        <div className="flex">
          {openTabs.map((tab) => {
            const Icon = getFileIcon(tab.name, tab.isDirectory);
            const isActive = activeTab === tab.path;
            
            return (
              <div
                key={tab.path}
                className={`px-4 py-2 flex items-center min-w-0 group cursor-pointer transition-colors ${
                  isActive ? 'tab-active' : 'tab-inactive hover:bg-muted/80'
                }`}
                onClick={() => onTabSwitch(tab.path)}
                data-testid={`tab-${tab.path.replace(/[/\\]/g, '-')}`}
              >
                <Icon className="h-4 w-4 mr-2 shrink-0" />
                <span className="text-sm truncate max-w-[120px]" title={tab.name}>
                  {activeTab === tab.path && isDirty ? '• ' : ''}{tab.name}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 ml-2 opacity-0 group-hover:opacity-100 hover:bg-muted-foreground/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTabClose(tab.path);
                  }}
                  data-testid={`button-close-tab-${tab.path.replace(/[/\\]/g, '-')}`}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
        
        <div className="ml-auto px-4 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            title="New Tab"
            data-testid="button-new-tab"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 overflow-hidden relative">
        {activeFile ? (
          <div className="h-full w-full">
            <div ref={editorRef} className="h-full w-full" data-testid="monaco-editor" />
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <div className="text-4xl mb-4">📝</div>
              <h3 className="text-lg font-medium mb-2">No file selected</h3>
              <p className="text-sm">Open a file from the explorer to start editing</p>
            </div>
          </div>
        )}
        
        {!isMonacoLoaded && activeFile && (
          <div className="absolute inset-0 flex items-center justify-center bg-ide-editor/80">
            <div className="text-sm text-muted-foreground">Loading editor...</div>
          </div>
        )}
      </div>
    </div>
  );
}
