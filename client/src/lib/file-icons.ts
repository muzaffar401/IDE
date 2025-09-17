import { 
  FileText, 
  Folder, 
  FolderOpen,
  FileCode,
  FileImage,
  FileVideo,
  FileArchive,
  Settings,
  Database,
  Globe
} from "lucide-react";

export function getFileIcon(fileName: string, isDirectory: boolean = false) {
  if (isDirectory) {
    return Folder;
  }

  const ext = fileName.split('.').pop()?.toLowerCase();
  
  switch (ext) {
    // Code files
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
    case 'vue':
    case 'svelte':
      return FileCode;
    
    // Web files
    case 'html':
    case 'htm':
      return Globe;
    
    case 'css':
    case 'scss':
    case 'sass':
    case 'less':
      return FileCode;
    
    // Config files
    case 'json':
    case 'yml':
    case 'yaml':
    case 'toml':
    case 'ini':
    case 'cfg':
    case 'conf':
      return Settings;
    
    // Database
    case 'sql':
    case 'db':
    case 'sqlite':
      return Database;
    
    // Images
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'ico':
    case 'webp':
      return FileImage;
    
    // Videos
    case 'mp4':
    case 'avi':
    case 'mov':
    case 'webm':
      return FileVideo;
    
    // Archives
    case 'zip':
    case 'rar':
    case '7z':
    case 'tar':
    case 'gz':
      return FileArchive;
    
    default:
      return FileText;
  }
}

export function getFileIconColor(fileName: string, isDirectory: boolean = false): string {
  if (isDirectory) {
    return "text-accent";
  }

  const ext = fileName.split('.').pop()?.toLowerCase();
  
  switch (ext) {
    case 'js':
    case 'jsx':
      return "text-yellow-400";
    case 'ts':
    case 'tsx':
      return "text-blue-400";
    case 'html':
    case 'htm':
      return "text-orange-400";
    case 'css':
    case 'scss':
    case 'sass':
    case 'less':
      return "text-blue-400";
    case 'json':
      return "text-yellow-600";
    case 'md':
      return "text-blue-300";
    case 'py':
      return "text-green-400";
    case 'java':
      return "text-red-400";
    case 'cpp':
    case 'c':
      return "text-blue-600";
    default:
      return "text-gray-400";
  }
}
