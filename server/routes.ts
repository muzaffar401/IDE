import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertFileSchema, updateFileSchema } from "@shared/schema";
import { randomUUID } from "crypto";

export async function registerRoutes(app: Express): Promise<Server> {
  // File management routes
  app.get("/api/files", async (req, res) => {
    try {
      const files = await storage.getFiles();
      res.json(files);
    } catch (error) {
      res.status(500).json({ message: "Failed to get files" });
    }
  });

  app.get("/api/files/*", async (req, res) => {
    try {
      const filePath = "/" + (req.params as any)[0];
      const file = await storage.getFile(filePath);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }
      res.json(file);
    } catch (error) {
      res.status(500).json({ message: "Failed to get file" });
    }
  });

  app.post("/api/files", async (req, res) => {
    try {
      const fileData = insertFileSchema.parse(req.body);
      const file = await storage.createFile(fileData);
      res.status(201).json(file);
    } catch (error) {
      res.status(400).json({ message: "Invalid file data" });
    }
  });

  app.patch("/api/files/*", async (req, res) => {
    try {
      const filePath = "/" + (req.params as any)[0];
      const updates = updateFileSchema.parse(req.body);
      const file = await storage.updateFile(filePath, updates);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }
      res.json(file);
    } catch (error) {
      res.status(400).json({ message: "Invalid update data" });
    }
  });

  app.delete("/api/files/*", async (req, res) => {
    try {
      const filePath = "/" + (req.params as any)[0];
      const success = await storage.deleteFile(filePath);
      if (!success) {
        return res.status(404).json({ message: "File not found" });
      }
      res.json({ message: "File deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete file" });
    }
  });

  app.put("/api/files/rename", async (req, res) => {
    try {
      const { oldPath, newPath } = req.body;
      if (!oldPath || !newPath) {
        return res.status(400).json({ message: "oldPath and newPath are required" });
      }
      const file = await storage.renameFile(oldPath, newPath);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }
      res.json(file);
    } catch (error) {
      res.status(500).json({ message: "Failed to rename file" });
    }
  });

  app.get("/api/files/search/:query", async (req, res) => {
    try {
      const { query } = req.params;
      const files = await storage.searchFiles(query);
      res.json(files);
    } catch (error) {
      res.status(500).json({ message: "Failed to search files" });
    }
  });

  // Terminal session management
  const terminalSessions = new Map<string, { id: string; cwd: string; }>();

  app.post("/api/terminal/session", async (req, res) => {
    try {
      const sessionId = randomUUID();
      terminalSessions.set(sessionId, { id: sessionId, cwd: "/" });
      res.json({ id: sessionId, cwd: "/" });
    } catch (error) {
      res.status(500).json({ message: "Failed to create terminal session" });
    }
  });

  app.post("/api/terminal/session/:sessionId/execute", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { command } = req.body;
      
      if (!command) {
        return res.status(400).json({ message: "Command is required" });
      }

      let session = terminalSessions.get(sessionId);
      if (!session) {
        session = { id: sessionId, cwd: "/" };
        terminalSessions.set(sessionId, session);
      }

      const result = await executeVirtualCommand(command.trim(), session.cwd);
      
      // Update session cwd if command was successful cd
      if (result.command === 'cd' && result.exitCode === 0 && result.newCwd) {
        session.cwd = result.newCwd;
        terminalSessions.set(sessionId, session);
      }

      res.json({
        command: command.trim(),
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        cwd: session.cwd
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to execute command" });
    }
  });

  async function executeVirtualCommand(command: string, cwd: string) {
    const args = command.split(' ').filter(arg => arg.length > 0);
    const cmd = args[0];
    const cmdArgs = args.slice(1);

    try {
      switch (cmd) {
        case 'pwd':
          return { command: cmd, stdout: cwd + '\n', stderr: '', exitCode: 0 };
        
        case 'ls':
          const files = await storage.getFiles();
          // Handle both null and '/' as root parentPath for backwards compatibility
          const targetParentPath = cwd === '/' ? null : cwd;
          const currentDirFiles = files.filter(f => 
            f.parentPath === targetParentPath || 
            (cwd === '/' && f.parentPath === '/')
          );
          const output = currentDirFiles.map(f => {
            const name = f.isDirectory ? f.name + '/' : f.name;
            return name;
          }).join('  ');
          return { command: cmd, stdout: output + '\n', stderr: '', exitCode: 0 };
        
        case 'cd':
          const targetDir = cmdArgs[0] || '/';
          let newDirPath: string;
          
          if (targetDir === '/') {
            newDirPath = '/';
          } else if (targetDir === '..' || targetDir === '../') {
            if (cwd === '/') {
              newDirPath = '/';
            } else {
              const parts = cwd.split('/').filter(p => p);
              parts.pop();
              newDirPath = parts.length === 0 ? '/' : '/' + parts.join('/');
            }
          } else if (targetDir.startsWith('/')) {
            newDirPath = targetDir;
          } else {
            newDirPath = cwd === '/' ? '/' + targetDir : cwd + '/' + targetDir;
          }
          
          // Check if directory exists
          const dirExists = await storage.getFile(newDirPath);
          if (!dirExists || !dirExists.isDirectory) {
            return { command: cmd, stdout: '', stderr: `cd: ${targetDir}: No such directory\n`, exitCode: 1 };
          }
          
          return { command: cmd, stdout: '', stderr: '', exitCode: 0, newCwd: newDirPath };
        
        case 'cat':
          if (cmdArgs.length === 0) {
            return { command: cmd, stdout: '', stderr: 'cat: missing file operand\n', exitCode: 1 };
          }
          
          const filePath = cmdArgs[0].startsWith('/') ? cmdArgs[0] : 
            cwd === '/' ? '/' + cmdArgs[0] : cwd + '/' + cmdArgs[0];
          
          const file = await storage.getFile(filePath);
          if (!file) {
            return { command: cmd, stdout: '', stderr: `cat: ${cmdArgs[0]}: No such file or directory\n`, exitCode: 1 };
          }
          if (file.isDirectory) {
            return { command: cmd, stdout: '', stderr: `cat: ${cmdArgs[0]}: Is a directory\n`, exitCode: 1 };
          }
          
          return { command: cmd, stdout: (file.content || '') + '\n', stderr: '', exitCode: 0 };
        
        case 'touch':
          if (cmdArgs.length === 0) {
            return { command: cmd, stdout: '', stderr: 'touch: missing file operand\n', exitCode: 1 };
          }
          
          const newFilePath = cmdArgs[0].startsWith('/') ? cmdArgs[0] : 
            cwd === '/' ? '/' + cmdArgs[0] : cwd + '/' + cmdArgs[0];
          
          // Check if file already exists
          const existingFile = await storage.getFile(newFilePath);
          if (existingFile) {
            // File exists, just update timestamp (simulated)
            return { command: cmd, stdout: '', stderr: '', exitCode: 0 };
          }
          
          // Create new file
          const fileName = cmdArgs[0].split('/').pop() || cmdArgs[0];
          let parentPath: string | null;
          if (newFilePath === '/' + fileName) {
            parentPath = null; // Root level file
          } else {
            parentPath = newFilePath.replace('/' + fileName, '') || '/';
            if (parentPath === '') parentPath = '/';
          }
          
          await storage.createFile({
            name: fileName,
            path: newFilePath,
            content: '',
            isDirectory: false,
            parentPath: parentPath
          });
          
          return { command: cmd, stdout: '', stderr: '', exitCode: 0 };
        
        case 'mkdir':
          if (cmdArgs.length === 0) {
            return { command: cmd, stdout: '', stderr: 'mkdir: missing operand\n', exitCode: 1 };
          }
          
          const dirPath = cmdArgs[0].startsWith('/') ? cmdArgs[0] : 
            cwd === '/' ? '/' + cmdArgs[0] : cwd + '/' + cmdArgs[0];
          
          // Check if directory already exists
          const existingDir = await storage.getFile(dirPath);
          if (existingDir) {
            return { command: cmd, stdout: '', stderr: `mkdir: cannot create directory '${cmdArgs[0]}': File exists\n`, exitCode: 1 };
          }
          
          const dirName = cmdArgs[0].split('/').pop() || cmdArgs[0];
          let parentDirPath: string | null;
          if (dirPath === '/' + dirName) {
            parentDirPath = null; // Root level directory
          } else {
            parentDirPath = dirPath.replace('/' + dirName, '') || '/';
            if (parentDirPath === '') parentDirPath = '/';
          }
          
          await storage.createFile({
            name: dirName,
            path: dirPath,
            isDirectory: true,
            parentPath: parentDirPath
          });
          
          return { command: cmd, stdout: '', stderr: '', exitCode: 0 };
        
        case 'rm':
          if (cmdArgs.length === 0) {
            return { command: cmd, stdout: '', stderr: 'rm: missing operand\n', exitCode: 1 };
          }
          
          const rmPath = cmdArgs[0].startsWith('/') ? cmdArgs[0] : 
            cwd === '/' ? '/' + cmdArgs[0] : cwd + '/' + cmdArgs[0];
          
          const fileToDelete = await storage.getFile(rmPath);
          if (!fileToDelete) {
            return { command: cmd, stdout: '', stderr: `rm: cannot remove '${cmdArgs[0]}': No such file or directory\n`, exitCode: 1 };
          }
          
          if (fileToDelete.isDirectory && !cmdArgs.includes('-rf') && !cmdArgs.includes('-r')) {
            return { command: cmd, stdout: '', stderr: `rm: cannot remove '${cmdArgs[0]}': Is a directory\n`, exitCode: 1 };
          }
          
          await storage.deleteFile(rmPath);
          return { command: cmd, stdout: '', stderr: '', exitCode: 0 };
        
        case 'mv':
          if (cmdArgs.length < 2) {
            return { command: cmd, stdout: '', stderr: 'mv: missing destination file operand\n', exitCode: 1 };
          }
          
          const oldMvPath = cmdArgs[0].startsWith('/') ? cmdArgs[0] : 
            cwd === '/' ? '/' + cmdArgs[0] : cwd + '/' + cmdArgs[0];
          const newMvPath = cmdArgs[1].startsWith('/') ? cmdArgs[1] : 
            cwd === '/' ? '/' + cmdArgs[1] : cwd + '/' + cmdArgs[1];
          
          const fileToMove = await storage.getFile(oldMvPath);
          if (!fileToMove) {
            return { command: cmd, stdout: '', stderr: `mv: cannot stat '${cmdArgs[0]}': No such file or directory\n`, exitCode: 1 };
          }
          
          await storage.renameFile(oldMvPath, newMvPath);
          return { command: cmd, stdout: '', stderr: '', exitCode: 0 };
        
        case 'echo':
          const text = cmdArgs.join(' ');
          return { command: cmd, stdout: text + '\n', stderr: '', exitCode: 0 };
        
        case 'clear':
          return { command: cmd, stdout: '\x1b[2J\x1b[H', stderr: '', exitCode: 0 };
        
        case 'help':
          const helpText = `Available commands:
  pwd - show current directory
  ls - list directory contents
  cd <dir> - change directory
  cat <file> - display file contents
  touch <file> - create empty file
  mkdir <dir> - create directory
  rm [-rf] <file> - remove file or directory
  mv <old> <new> - move/rename file or directory
  echo <text> - display text
  clear - clear terminal
  help - show this help
`;
          return { command: cmd, stdout: helpText, stderr: '', exitCode: 0 };
        
        default:
          return { command: cmd, stdout: '', stderr: `${cmd}: command not found\n`, exitCode: 127 };
      }
    } catch (error) {
      return { command: cmd, stdout: '', stderr: `Error: ${error}\n`, exitCode: 1 };
    }
  }

  const httpServer = createServer(app);
  return httpServer;
}
