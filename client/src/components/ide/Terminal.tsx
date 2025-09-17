import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Plus, Trash2, Maximize, X, Terminal as TerminalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface TerminalOutput {
  id: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  timestamp: Date;
}

export default function Terminal() {
  const [command, setCommand] = useState("");
  const [history, setHistory] = useState<TerminalOutput[]>([]);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [currentDir, setCurrentDir] = useState("~/my-web-project");
  
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const executeCommandMutation = useMutation({
    mutationFn: async ({ command, cwd }: { command: string; cwd: string }) => {
      const response = await apiRequest("POST", "/api/terminal/execute", { command, cwd });
      return response.json();
    },
    onSuccess: (data) => {
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
      if (command.trim()) {
        setCommandHistory(prev => {
          const filtered = prev.filter(cmd => cmd !== command.trim());
          return [...filtered, command.trim()].slice(-50); // Keep last 50 commands
        });
      }
      
      setCommand("");
      setHistoryIndex(-1);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to execute command", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;

    executeCommandMutation.mutate({
      command: command.trim(),
      cwd: currentDir,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setCommand(commandHistory[commandHistory.length - 1 - newIndex]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCommand(commandHistory[commandHistory.length - 1 - newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCommand("");
      }
    }
  };

  const clearTerminal = () => {
    setHistory([]);
  };

  // Auto-scroll to bottom when new output is added
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [history]);

  // Focus input when terminal is clicked
  const handleTerminalClick = () => {
    inputRef.current?.focus();
  };

  const formatOutput = (text: string) => {
    if (!text) return null;
    return text.split('\n').map((line, i) => (
      <div key={i} className="whitespace-pre-wrap">
        {line}
      </div>
    ));
  };

  return (
    <div className="h-full bg-ide-terminal border-t border-border flex flex-col" data-testid="terminal">
      {/* Terminal Header */}
      <div className="px-4 py-2 border-b border-border flex items-center justify-between bg-secondary">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <TerminalIcon className="h-4 w-4" />
            <h3 className="text-sm font-semibold">TERMINAL</h3>
          </div>
          <div className="flex space-x-2">
            <Button
              variant="secondary"
              size="sm"
              className="h-6 px-2 text-xs"
              data-testid="button-new-terminal"
            >
              <Plus className="h-3 w-3 mr-1" />
              New Terminal
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={clearTerminal}
              title="Clear Terminal"
              data-testid="button-clear-terminal"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            title="Maximize/Minimize"
            data-testid="button-toggle-terminal"
          >
            <Maximize className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            title="Close Terminal"
            data-testid="button-close-terminal"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Terminal Content */}
      <div 
        className="flex-1 overflow-y-auto ide-scrollbar px-4 py-2 terminal-output cursor-text"
        ref={terminalRef}
        onClick={handleTerminalClick}
        data-testid="terminal-output"
      >
        {/* Welcome message */}
        {history.length === 0 && (
          <div className="space-y-1 text-muted-foreground">
            <div className="text-accent">Welcome to Cursor IDE Terminal</div>
            <div>Type commands to interact with your project.</div>
            <div></div>
          </div>
        )}

        {/* Command history */}
        {history.map((output) => (
          <div key={output.id} className="space-y-1 mb-2">
            {/* Command prompt */}
            <div className="flex items-center">
              <span className="text-green-400">user@cursor-ide</span>
              <span className="text-blue-400 mx-1">:</span>
              <span className="text-accent">{currentDir}</span>
              <span className="text-foreground ml-1">$ {output.command}</span>
            </div>
            
            {/* Stdout */}
            {output.stdout && (
              <div className="text-foreground">
                {formatOutput(output.stdout)}
              </div>
            )}
            
            {/* Stderr */}
            {output.stderr && (
              <div className="text-red-400">
                {formatOutput(output.stderr)}
              </div>
            )}
          </div>
        ))}

        {/* Current command prompt */}
        <form onSubmit={handleSubmit} className="flex items-center">
          <span className="text-green-400 shrink-0">user@cursor-ide</span>
          <span className="text-blue-400 mx-1 shrink-0">:</span>
          <span className="text-accent shrink-0">{currentDir}</span>
          <span className="text-foreground ml-1 shrink-0">$</span>
          <Input
            ref={inputRef}
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 ml-2 bg-transparent border-none p-0 h-auto text-sm text-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
            placeholder="Enter command..."
            disabled={executeCommandMutation.isPending}
            data-testid="input-terminal-command"
          />
        </form>

        {/* Loading indicator */}
        {executeCommandMutation.isPending && (
          <div className="flex items-center text-muted-foreground">
            <div className="animate-spin h-3 w-3 border border-current border-t-transparent rounded-full mr-2" />
            <span className="text-sm">Executing command...</span>
          </div>
        )}
      </div>
    </div>
  );
}
