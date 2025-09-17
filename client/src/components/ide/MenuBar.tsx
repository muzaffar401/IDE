import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, Search, Code } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface MenuBarProps {
  onSearch: (query: string) => void;
  searchQuery: string;
}

export default function MenuBar({ onSearch, searchQuery }: MenuBarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState(searchQuery);

  const handleSearch = () => {
    onSearch(localSearch);
    setSearchOpen(false);
  };

  return (
    <div 
      className="bg-secondary border-b border-border px-4 py-2 flex items-center justify-between"
      data-testid="menu-bar"
    >
      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-2">
          <Code className="h-5 w-5 text-accent" />
          <span className="font-semibold text-sm">Cursor IDE</span>
        </div>
        <nav className="flex items-center space-x-4 text-sm">
          <Button 
            variant="ghost" 
            size="sm" 
            className="hover:text-accent transition-colors h-auto p-1"
            data-testid="button-file-menu"
          >
            File
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="hover:text-accent transition-colors h-auto p-1"
            data-testid="button-edit-menu"
          >
            Edit
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="hover:text-accent transition-colors h-auto p-1"
            data-testid="button-view-menu"
          >
            View
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="hover:text-accent transition-colors h-auto p-1"
            data-testid="button-terminal-menu"
          >
            Terminal
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="hover:text-accent transition-colors h-auto p-1"
            data-testid="button-help-menu"
          >
            Help
          </Button>
        </nav>
      </div>
      
      <div className="flex items-center space-x-3">
        <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
          <DialogTrigger asChild>
            <Button 
              size="sm" 
              className="bg-accent text-accent-foreground hover:bg-accent/90 transition-colors"
              data-testid="button-search"
            >
              <Search className="h-3 w-3 mr-1" />
              Search
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Search Files</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Search for files and content..."
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                data-testid="input-search-dialog"
              />
              <div className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => setSearchOpen(false)}
                  data-testid="button-cancel-search"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSearch}
                  data-testid="button-execute-search"
                >
                  Search
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 w-8 p-0"
          title="Settings"
          data-testid="button-settings"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
