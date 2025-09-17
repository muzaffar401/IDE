import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertFileSchema, updateFileSchema } from "@shared/schema";
import { spawn } from "child_process";
import * as os from "os";

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

  // Terminal routes
  app.post("/api/terminal/execute", async (req, res) => {
    try {
      const { command, cwd } = req.body;
      if (!command) {
        return res.status(400).json({ message: "Command is required" });
      }

      const shell = os.platform() === "win32" ? "cmd" : "bash";
      const args = os.platform() === "win32" ? ["/c", command] : ["-c", command];
      
      const child = spawn(shell, args, {
        cwd: cwd || process.cwd(),
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("close", (code) => {
        res.json({
          command,
          stdout,
          stderr,
          exitCode: code,
        });
      });

      child.on("error", (error) => {
        res.status(500).json({
          message: "Failed to execute command",
          error: error.message,
        });
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to execute command" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
