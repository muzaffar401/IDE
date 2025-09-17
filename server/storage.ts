import { type File, type InsertFile, type UpdateFile } from "@shared/schema";
import { randomUUID } from "crypto";
import * as fs from "fs/promises";
import * as path from "path";

export interface IStorage {
  getFiles(): Promise<File[]>;
  getFile(filePath: string): Promise<File | undefined>;
  createFile(file: InsertFile): Promise<File>;
  updateFile(filePath: string, updates: UpdateFile): Promise<File | undefined>;
  deleteFile(filePath: string): Promise<boolean>;
  renameFile(oldPath: string, newPath: string): Promise<File | undefined>;
  searchFiles(query: string): Promise<File[]>;
}

export class MemStorage implements IStorage {
  private files: Map<string, File>;
  private projectRoot: string;

  constructor() {
    this.files = new Map();
    this.projectRoot = path.join(process.cwd(), "project-workspace");
    this.initializeDefaultProject();
  }

  private async initializeDefaultProject() {
    try {
      await fs.mkdir(this.projectRoot, { recursive: true });
    } catch (error) {
      console.error("Failed to create project root:", error);
    }

    // Initialize with default files
    const defaultFiles: InsertFile[] = [
      {
        name: "my-web-project",
        path: "/",
        isDirectory: true,
        parentPath: null,
      },
      {
        name: "src",
        path: "/src",
        isDirectory: true,
        parentPath: "/",
      },
      {
        name: "index.js",
        path: "/src/index.js",
        content: `// Main application entry point
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware configuration
app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Hello World!' });
});

// Start server
app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});`,
        isDirectory: false,
        parentPath: "/src",
      },
      {
        name: "app.js",
        path: "/src/app.js",
        content: `// Application configuration
export default class App {
  constructor() {
    this.init();
  }
  
  init() {
    console.log('App initialized');
  }
}`,
        isDirectory: false,
        parentPath: "/src",
      },
      {
        name: "styles.css",
        path: "/src/styles.css",
        content: `/* Global styles */
body {
  font-family: Arial, sans-serif;
  margin: 0;
  padding: 0;
  background-color: #f5f5f5;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}`,
        isDirectory: false,
        parentPath: "/src",
      },
      {
        name: "components",
        path: "/components",
        isDirectory: true,
        parentPath: "/",
      },
      {
        name: "public",
        path: "/public",
        isDirectory: true,
        parentPath: "/",
      },
      {
        name: "index.html",
        path: "/index.html",
        content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Web Project</title>
    <link rel="stylesheet" href="src/styles.css">
</head>
<body>
    <div class="container">
        <h1>Welcome to My Web Project</h1>
        <p>This is a sample HTML file.</p>
    </div>
    <script src="src/index.js"></script>
</body>
</html>`,
        isDirectory: false,
        parentPath: "/",
      },
      {
        name: "package.json",
        path: "/package.json",
        content: `{
  "name": "my-web-project",
  "version": "1.0.0",
  "description": "A sample web project",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^6.1.5"
  },
  "devDependencies": {
    "nodemon": "^2.0.20"
  }
}`,
        isDirectory: false,
        parentPath: "/",
      },
      {
        name: "README.md",
        path: "/README.md",
        content: `# My Web Project

A sample web development project created with Cursor IDE.

## Getting Started

1. Install dependencies:
   \`\`\`
   npm install
   \`\`\`

2. Start the development server:
   \`\`\`
   npm run dev
   \`\`\`

3. Open your browser and navigate to \`http://localhost:3000\`

## Project Structure

- \`src/\` - Source code files
- \`public/\` - Static assets
- \`components/\` - Reusable components

Enjoy coding! 🚀`,
        isDirectory: false,
        parentPath: "/",
      },
    ];

    for (const fileData of defaultFiles) {
      const file: File = {
        ...fileData,
        id: randomUUID(),
        content: fileData.content || null,
        isDirectory: fileData.isDirectory || false,
        parentPath: fileData.parentPath || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.files.set(file.path, file);
    }
  }

  async getFiles(): Promise<File[]> {
    return Array.from(this.files.values()).sort((a, b) => {
      // Directories first, then files
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  async getFile(filePath: string): Promise<File | undefined> {
    return this.files.get(filePath);
  }

  async createFile(fileData: InsertFile): Promise<File> {
    const file: File = {
      ...fileData,
      id: randomUUID(),
      content: fileData.content || null,
      isDirectory: fileData.isDirectory || false,
      parentPath: fileData.parentPath || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.files.set(file.path, file);
    return file;
  }

  async updateFile(filePath: string, updates: UpdateFile): Promise<File | undefined> {
    const existingFile = this.files.get(filePath);
    if (!existingFile) return undefined;

    const updatedFile: File = {
      ...existingFile,
      ...updates,
      updatedAt: new Date(),
    };
    this.files.set(filePath, updatedFile);
    return updatedFile;
  }

  async deleteFile(filePath: string): Promise<boolean> {
    const file = this.files.get(filePath);
    if (!file) return false;

    // If it's a directory, delete all children
    if (file.isDirectory) {
      const children = Array.from(this.files.values()).filter(
        f => f.parentPath === filePath || f.path.startsWith(filePath + "/")
      );
      for (const child of children) {
        this.files.delete(child.path);
      }
    }

    return this.files.delete(filePath);
  }

  async renameFile(oldPath: string, newPath: string): Promise<File | undefined> {
    const file = this.files.get(oldPath);
    if (!file) return undefined;

    // Update the file
    const updatedFile: File = {
      ...file,
      name: path.basename(newPath),
      path: newPath,
      updatedAt: new Date(),
    };

    // Remove old entry and add new one
    this.files.delete(oldPath);
    this.files.set(newPath, updatedFile);

    // If it's a directory, update all children
    if (file.isDirectory) {
      const children = Array.from(this.files.values()).filter(
        f => f.parentPath === oldPath || f.path.startsWith(oldPath + "/")
      );
      
      for (const child of children) {
        const newChildPath = child.path.replace(oldPath, newPath);
        const newParentPath = child.parentPath === oldPath ? newPath : 
          child.parentPath?.replace(oldPath, newPath) || null;
        
        const updatedChild: File = {
          ...child,
          path: newChildPath,
          parentPath: newParentPath,
          updatedAt: new Date(),
        };
        
        this.files.delete(child.path);
        this.files.set(newChildPath, updatedChild);
      }
    }

    return updatedFile;
  }

  async searchFiles(query: string): Promise<File[]> {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.files.values()).filter(file => 
      file.name.toLowerCase().includes(lowerQuery) ||
      (file.content && file.content.toLowerCase().includes(lowerQuery))
    );
  }
}

export const storage = new MemStorage();
