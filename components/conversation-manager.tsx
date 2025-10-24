import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Save, Trash2, Clock } from 'lucide-react';
import { useConversation } from '@/hooks/use-conversation';
import { formatTimestamp } from '@/lib/utils';
import type { Conversation, ConversationData } from '@/types/app';

// The component is now generic, constrained to a valid conversation type.
interface ConversationManagerProps<T extends Conversation['type']> {
  type: T;
  data: ConversationData<T>;
  onLoad: (data: ConversationData<T>) => void;
  buttonVariant?: "default" | "outline" | "secondary";
}

export function ConversationManager<T extends Conversation['type']>({ 
  type, 
  data, 
  onLoad,
  buttonVariant = "outline" 
}: ConversationManagerProps<T>) {
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [conversationTitle, setConversationTitle] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  
  // The hook is now called with the generic type, ensuring type safety.
  const { 
    conversations, 
    isLoading, 
    deleteConversation 
  } = useConversation(type);
  
  
  
  const handleDelete = async (id: string) => {
    try {
      await deleteConversation(id);
      setShowDeleteConfirm(null);
    } catch (error) {
      // TODO: Replace with a proper toast notification
      console.error("Error deleting conversation:", error);
    }
  };
  
  return (
    <div className="flex gap-2">
      
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant={buttonVariant}>Load</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {isLoading ? (
            <DropdownMenuItem disabled>Loading...</DropdownMenuItem>
          ) : conversations.length > 0 ? (
            conversations.map((conv) => (
              <DropdownMenuItem 
                key={conv.id}
                // `conv.data` is now also strongly typed.
                onClick={() => onLoad(conv.data as ConversationData<T>)}
                className="flex flex-col items-start cursor-pointer"
              >
                <span className="font-medium">{conv.title}</span>
                <span className="text-xs text-muted-foreground flex items-center mt-1">
                  <Clock className="h-3 w-3 mr-1" />
                  {formatTimestamp(conv.timestamp)}
                </span>
                <DropdownMenuSeparator className="my-1" />
                <div className="flex w-full justify-end">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="h-6 px-2 hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDeleteConfirm(conv.id);
                    }}
                  >
                    {/* ✅ Fixed: Using theme-aware color */}
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </DropdownMenuItem>
            ))
          ) : (
            <DropdownMenuItem disabled>No saved conversations</DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      
      <Dialog open={!!showDeleteConfirm} onOpenChange={() => setShowDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you absolutely sure?</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>This action cannot be undone. This will permanently delete the conversation.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(null)}>Cancel</Button>
            <Button 
              variant="destructive"
              onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
