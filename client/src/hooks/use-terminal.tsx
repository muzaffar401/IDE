import { useState, useRef, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface TerminalOutput {
  id: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  timestamp: Date;
}

interface UseTerminalOptions {
  initialDirectory?: string;
}

export function useTerminal(options: UseTerminalOptions = {}) {
  const [history, setHistory] = useState<TerminalOutput[]>([]);
  const [currentDirectory, setCurrentDirectory] = useState(options.initialDirectory || "~/my-web-project");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  
  const executeCommand = useMutation({
    mutationFn: async ({ command, cwd }: { command: string; cwd?: string }) => {
      const response = await apiRequest("POST", "/api/terminal/execute", {
        command,
        cwd: cwd || currentDirectory,
      });
      return response.json();
    },
    onSuccess: (data, variables) => {
      const output: TerminalOutput = {
        id: Date.now().toString(),
        command: data.command,
        stdout: data.stdout,
        stderr: data.stderr,
        exitCode: data.exitCode,
        timestamp: new Date(),
      };
      
      setHistory(prev => [...prev, output]);
      
      // Update command history
      if (variables.command.trim()) {
        setCommandHistory(prev => {
          const filtered = prev.filter(cmd => cmd !== variables.command.trim());
          return [...filtered, variables.command.trim()].slice(-50);
        });
      }
    },
  });

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const changeDirectory = useCallback((newDir: string) => {
    setCurrentDirectory(newDir);
  }, []);

  return {
    history,
    currentDirectory,
    commandHistory,
    executeCommand: executeCommand.mutate,
    isExecuting: executeCommand.isPending,
    clearHistory,
    changeDirectory,
  };
}
