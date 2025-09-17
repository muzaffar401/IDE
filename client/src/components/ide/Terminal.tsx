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

interface TerminalSession {
  id: string;
  cwd: string;
  history: TerminalOutput[];
  name: string;
}

export default function Terminal() {
  const [command, setCommand] = useState("");
  const [sessions, setSessions] = useState<TerminalSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const createSessionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/terminal/session", {});
      return response.json();
    },
    onSuccess: (data) => {
      const newSession: TerminalSession = {
        id: data.id,
        cwd: data.cwd,
        history: [],
        name: `Terminal ${sessions.length + 1}`
      };
      setSessions(prev => [...prev, newSession]);
      setActiveSessionId(data.id);
    }
  });

  const executeCommandMutation = useMutation({
    mutationFn: async ({ sessionId, command }: { sessionId: string; command: string }) => {
      const response = await apiRequest("POST", `/api/terminal/session/${sessionId}/execute`, { command });
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
      
      setSessions(prev => prev.map(session => 
        session.id === activeSessionId 
          ? { ...session, history: [...session.history, output], cwd: data.cwd }
          : session
      ));
      
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
    if (!command.trim() || !activeSessionId) return;

    executeCommandMutation.mutate({
      sessionId: activeSessionId,
      command: command.trim(),
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
    if (!activeSessionId) return;
    setSessions(prev => prev.map(session => 
      session.id === activeSessionId 
        ? { ...session, history: [] }
        : session
    ));
  };

  const createNewTerminal = () => {
    createSessionMutation.mutate();
  };

  const closeTerminal = (sessionId: string) => {
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== sessionId);
      if (activeSessionId === sessionId && filtered.length > 0) {
        setActiveSessionId(filtered[0].id);
      } else if (filtered.length === 0) {
        setActiveSessionId(null);
      }
      return filtered;
    });
  };

  // Create initial session on mount
  useEffect(() => {
    if (sessions.length === 0) {
      createSessionMutation.mutate();
    }
  }, []);

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const currentHistory = activeSession?.history || [];
  const currentCwd = activeSession?.cwd || '/';

  // Auto-scroll to bottom when new output is added
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [currentHistory]);

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
              onClick={createNewTerminal}
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
        {/* Terminal tabs */}
        {sessions.length > 1 && (
          <div className="flex space-x-2 mb-2 border-b border-border pb-2">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`flex items-center px-3 py-1 text-xs rounded cursor-pointer ${
                  session.id === activeSessionId ? 'bg-accent text-accent-foreground' : 'bg-secondary hover:bg-accent/50'
                }`}
                onClick={() => setActiveSessionId(session.id)}
              >
                <span>{session.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 ml-2 hover:bg-destructive/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTerminal(session.id);
                  }}
                >
                  <X className="h-2 w-2" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Welcome message */}
        {currentHistory.length === 0 && (
          <div className="space-y-1 text-muted-foreground">
            <div className="text-accent">Welcome to IDE Terminal</div>
            <div>Type commands to interact with your project files.</div>
            <div>Available commands: pwd, ls, cd, cat, touch, mkdir, rm, mv, echo, clear, help</div>
            <div></div>
          </div>
        )}

        {/* Command history */}
        {currentHistory.map((output) => (
          <div key={output.id} className="space-y-1 mb-2">
            {/* Command prompt */}
            <div className="flex items-center">
              <span className="text-green-400">user@ide</span>
              <span className="text-blue-400 mx-1">:</span>
              <span className="text-accent">{currentCwd}</span>
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
        {activeSessionId && (
        <form onSubmit={handleSubmit} className="flex items-center">
          <span className="text-green-400 shrink-0">user@ide</span>
          <span className="text-blue-400 mx-1 shrink-0">:</span>
          <span className="text-accent shrink-0">{currentCwd}</span>
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
        )}

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
