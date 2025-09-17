# Overview

This is a web-based IDE (Integrated Development Environment) application built with React and Express. The application provides a VSCode-like interface for editing code, managing files, and running terminal commands. It features a modern, dark-themed UI with file exploration capabilities, code editing with syntax highlighting, and terminal integration. The system supports creating, editing, and managing files within a project workspace.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The frontend is built with React and TypeScript, using modern tooling and component libraries:
- **Framework**: React 18 with TypeScript for type safety
- **Styling**: Tailwind CSS for utility-first styling with custom CSS variables for theming
- **UI Components**: Extensive use of Radix UI primitives for accessible, unstyled components
- **Component System**: shadcn/ui components providing a cohesive design system
- **State Management**: React Query (TanStack Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Build Tool**: Vite for fast development and optimized builds

## Backend Architecture
The backend uses Node.js with Express in a REST API pattern:
- **Runtime**: Node.js with ES modules
- **Framework**: Express.js for HTTP server and routing
- **API Design**: RESTful endpoints following conventional patterns
- **File System**: In-memory storage with file system persistence for project files
- **Development**: TypeScript with tsx for development server

## Database and Storage
- **ORM**: Drizzle ORM for type-safe database operations
- **Database**: PostgreSQL (via Neon serverless) for persistent data storage
- **Schema**: File-based schema with support for hierarchical file structures
- **Migration**: Drizzle Kit for database schema management
- **Session Storage**: PostgreSQL-backed session storage using connect-pg-simple

## Key Design Patterns
- **Monorepo Structure**: Client, server, and shared code organized in separate directories
- **Shared Schema**: Common TypeScript types and Zod schemas shared between frontend and backend
- **Component Composition**: Heavy use of compound components and render props patterns
- **Hook-based Logic**: Custom hooks for terminal operations, file management, and UI state
- **Resizable Layout**: Panel-based layout using react-resizable-panels for IDE-like experience

## Development Environment
- **Hot Reload**: Vite HMR for instant frontend updates
- **Type Checking**: Strict TypeScript configuration across all packages
- **Code Quality**: ESLint and TypeScript for code quality and consistency
- **Path Mapping**: TypeScript path aliases for clean imports

# External Dependencies

## Core Framework Dependencies
- **@neondatabase/serverless**: Serverless PostgreSQL database connection
- **drizzle-orm**: Type-safe ORM for database operations
- **@tanstack/react-query**: Server state management and caching
- **wouter**: Lightweight React router

## UI and Styling
- **@radix-ui/***: Comprehensive collection of accessible UI primitives
- **tailwindcss**: Utility-first CSS framework
- **class-variance-authority**: Utility for managing component variants
- **lucide-react**: Icon library for consistent iconography

## Development and Build Tools
- **vite**: Frontend build tool and development server
- **tsx**: TypeScript execution for Node.js
- **esbuild**: Fast JavaScript bundler for production builds
- **@replit/vite-plugin-***: Replit-specific development tools and plugins

## Terminal and File Management
- **cmdk**: Command palette functionality
- **embla-carousel-react**: Carousel components for UI
- **react-resizable-panels**: Resizable panel layout system
- **date-fns**: Date manipulation and formatting

## Form Handling and Validation
- **react-hook-form**: Form state management
- **@hookform/resolvers**: Form validation resolvers
- **zod**: Runtime type validation and schema definition

The application is designed to run in Replit's environment with specific plugins for development experience enhancement, including error overlays, cartographer integration, and development banners.