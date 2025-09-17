import { type File, type InsertFile, type UpdateFile, files } from "@shared/schema";
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { eq, like, or, and } from "drizzle-orm";
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

export class DatabaseStorage implements IStorage {
  private db: any;

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required");
    }
    
    neonConfig.fetchConnectionCache = true;
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    this.db = drizzle(pool);
    this.initializeDefaultProject();
  }

  private async initializeDefaultProject() {
    try {
      // Check if files already exist
      const existingFiles = await this.db.select().from(files).limit(1);
      if (existingFiles.length > 0) {
        return; // Already initialized
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
      await this.db.insert(files).values({
        name: fileData.name,
        path: fileData.path,
        content: fileData.content || null,
        isDirectory: fileData.isDirectory || false,
        parentPath: fileData.parentPath || null,
      });
    }
    } catch (error) {
      console.error("Failed to initialize default project:", error);
    }
  }

  async getFiles(): Promise<File[]> {
    try {
      const allFiles = await this.db.select().from(files);
      return allFiles.sort((a: File, b: File) => {
        // Directories first, then files
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
    } catch (error) {
      console.error("Failed to get files:", error);
      return [];
    }
  }

  async getFile(filePath: string): Promise<File | undefined> {
    try {
      const result = await this.db.select().from(files).where(eq(files.path, filePath)).limit(1);
      return result[0] || undefined;
    } catch (error) {
      console.error("Failed to get file:", error);
      return undefined;
    }
  }

  async createFile(fileData: InsertFile): Promise<File> {
    try {
      const result = await this.db.insert(files).values({
        name: fileData.name,
        path: fileData.path,
        content: fileData.content || null,
        isDirectory: fileData.isDirectory || false,
        parentPath: fileData.parentPath || null,
      }).returning();
      return result[0];
    } catch (error) {
      console.error("Failed to create file:", error);
      throw error;
    }
  }

  async updateFile(filePath: string, updates: UpdateFile): Promise<File | undefined> {
    try {
      const result = await this.db.update(files)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(files.path, filePath))
        .returning();
      return result[0] || undefined;
    } catch (error) {
      console.error("Failed to update file:", error);
      return undefined;
    }
  }

  async deleteFile(filePath: string): Promise<boolean> {
    try {
      const file = await this.getFile(filePath);
      if (!file) return false;

      // If it's a directory, delete all children recursively
      if (file.isDirectory) {
        await this.db.delete(files).where(
          or(
            eq(files.parentPath, filePath),
            like(files.path, filePath + "/%")
          )
        );
      }

      // Delete the file itself
      const result = await this.db.delete(files).where(eq(files.path, filePath)).returning();
      return result.length > 0;
    } catch (error) {
      console.error("Failed to delete file:", error);
      return false;
    }
  }

  async renameFile(oldPath: string, newPath: string): Promise<File | undefined> {
    try {
      const file = await this.getFile(oldPath);
      if (!file) return undefined;

      // Update the file itself
      const updatedFile = await this.db.update(files)
        .set({
          name: path.basename(newPath),
          path: newPath,
          updatedAt: new Date(),
        })
        .where(eq(files.path, oldPath))
        .returning();

      // If it's a directory, update all children
      if (file.isDirectory) {
        // Get all children that need updating
        const children = await this.db.select().from(files).where(
          or(
            eq(files.parentPath, oldPath),
            like(files.path, oldPath + "/%")
          )
        );

        // Update each child
        for (const child of children) {
          const newChildPath = child.path.replace(oldPath, newPath);
          const newParentPath = child.parentPath === oldPath ? newPath : 
            child.parentPath?.replace(oldPath, newPath) || null;
          
          await this.db.update(files)
            .set({
              path: newChildPath,
              parentPath: newParentPath,
              updatedAt: new Date(),
            })
            .where(eq(files.id, child.id));
        }
      }

      return updatedFile[0] || undefined;
    } catch (error) {
      console.error("Failed to rename file:", error);
      return undefined;
    }
  }

  async searchFiles(query: string): Promise<File[]> {
    try {
      const result = await this.db.select().from(files).where(
        or(
          like(files.name, `%${query}%`),
          like(files.content, `%${query}%`)
        )
      );
      return result;
    } catch (error) {
      console.error("Failed to search files:", error);
      return [];
    }
  }
}

export const storage = new DatabaseStorage();
