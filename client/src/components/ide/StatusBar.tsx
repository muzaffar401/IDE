import { CheckCircle, AlertTriangle, XCircle, RotateCcw, Save, Clock } from "lucide-react";
import type { File } from "@shared/schema";

interface StatusBarProps {
  activeFile?: File;
  editorState?: {
    isDirty: boolean;
    cursorPosition?: { line: number; column: number };
    isSaving: boolean;
    bufferLength?: number;
  };
}

export default function StatusBar({ activeFile, editorState }: StatusBarProps) {
  const getLanguageFromFileName = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'js':
      case 'jsx':
        return 'JavaScript';
      case 'ts':
      case 'tsx':
        return 'TypeScript';
      case 'html':
        return 'HTML';
      case 'css':
        return 'CSS';
      case 'json':
        return 'JSON';
      case 'md':
        return 'Markdown';
      case 'py':
        return 'Python';
      case 'java':
        return 'Java';
      case 'cpp':
      case 'c':
        return 'C++';
      default:
        return 'Plain Text';
    }
  };

  return (
    <div 
      className="bg-accent text-accent-foreground px-4 py-1 flex items-center justify-between text-xs"
      data-testid="status-bar"
    >
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <CheckCircle className="h-3 w-3" />
          <span data-testid="text-git-branch">main</span>
        </div>
        <div className="flex items-center space-x-1">
          <AlertTriangle className="h-3 w-3 text-yellow-300" />
          <span data-testid="text-warnings">0</span>
        </div>
        <div className="flex items-center space-x-1">
          <XCircle className="h-3 w-3 text-red-300" />
          <span data-testid="text-errors">0</span>
        </div>
      </div>
      
      <div className="flex items-center space-x-4">
        {activeFile && (
          <>
            <span data-testid="text-cursor-position">
              Ln {editorState?.cursorPosition?.line || 1}, Col {editorState?.cursorPosition?.column || 1}
            </span>
            <span data-testid="text-encoding">UTF-8</span>
            <span data-testid="text-language">
              {getLanguageFromFileName(activeFile.name)}
            </span>
            <span className="text-muted-foreground">
              {editorState?.bufferLength !== undefined ? editorState.bufferLength : (activeFile.content?.length || 0)} chars
            </span>
          </>
        )}
        <div className="flex items-center space-x-1">
          {editorState?.isSaving ? (
            <>
              <RotateCcw className="h-3 w-3 animate-spin" />
              <span data-testid="text-saving">Saving...</span>
            </>
          ) : editorState?.isDirty ? (
            <>
              <Clock className="h-3 w-3 text-yellow-400" />
              <span data-testid="text-unsaved" className="text-yellow-400">Unsaved changes</span>
            </>
          ) : activeFile ? (
            <>
              <Save className="h-3 w-3 text-green-400" />
              <span data-testid="text-saved" className="text-green-400">Saved</span>
            </>
          ) : (
            <>
              <RotateCcw className="h-3 w-3" />
              <span data-testid="text-auto-save">Auto Save</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
