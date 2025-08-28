"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import { PlusCircle, Edit, Trash2, Copy, User, Sparkles } from "lucide-react";
import { 
  type Persona,
  getDefaultPersonas,
  applyPersonaPrompt
} from "@/services/persona-service";

export default function PersonasPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    systemPrompt: ""
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchPersonas();
  }, []);

  const fetchPersonas = async () => {
    try {
      setIsLoading(true);
      // For now, we'll just use the default personas
      // In a real implementation, you would fetch from localStorage or an API
      const data = getDefaultPersonas();
      setPersonas(data);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch personas",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePersona = async () => {
    try {
      // For now, we'll just add to the local state
      // In a real implementation, you would save to localStorage or an API
      const newPersona: Persona = {
        name: formData.name,
        systemPrompt: formData.systemPrompt
      };
      
      setPersonas([...personas, newPersona]);
      setIsCreateDialogOpen(false);
      setFormData({ name: "", systemPrompt: "" });
      
      toast({
        title: "Success",
        description: "Persona created successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create persona",
        variant: "destructive",
      });
    }
  };

  const handleUpdatePersona = async () => {
    try {
      if (!selectedPersona) return;
      
      // For now, we'll just update the local state
      // In a real implementation, you would save to localStorage or an API
      const updatedPersonas = personas.map(p => 
        p.name === selectedPersona.name ? 
        { ...p, name: formData.name, systemPrompt: formData.systemPrompt } : 
        p
      );
      
      setPersonas(updatedPersonas);
      setIsEditDialogOpen(false);
      setSelectedPersona(null);
      setFormData({ name: "", systemPrompt: "" });
      
      toast({
        title: "Success",
        description: "Persona updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update persona",
        variant: "destructive",
      });
    }
  };

  const handleDeletePersona = async () => {
    try {
      if (!selectedPersona) return;
      
      // For now, we'll just remove from the local state
      // In a real implementation, you would delete from localStorage or an API
      const updatedPersonas = personas.filter(p => p.name !== selectedPersona.name);
      setPersonas(updatedPersonas);
      setIsDeleteDialogOpen(false);
      setSelectedPersona(null);
      
      toast({
        title: "Success",
        description: "Persona deleted successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete persona",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (persona: Persona) => {
    setSelectedPersona(persona);
    setFormData({
      name: persona.name,
      systemPrompt: persona.systemPrompt
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (persona: Persona) => {
    setSelectedPersona(persona);
    setIsDeleteDialogOpen(true);
  };

  const applyPersona = (persona: Persona) => {
    // This would typically be handled by the parent component or context
    // For now, we'll just show a toast
    toast({
      title: "Persona Applied",
      description: `Applied persona: ${persona.name}`,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg">Loading personas...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Personas</h1>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Create Persona
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {personas.map((persona) => (
          <Card key={persona.name} className="flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="mr-2 h-4 w-4" />
                {persona.name}
              </CardTitle>
              <CardDescription className="line-clamp-2">
                {persona.systemPrompt}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col justify-end gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => applyPersona(persona)}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Apply
              </Button>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => openEditDialog(persona)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => openDeleteDialog(persona)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Persona Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Persona</DialogTitle>
            <DialogDescription>
              Define a new persona with a name and system prompt.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="Enter persona name"
              />
            </div>
            <div>
              <Label htmlFor="systemPrompt">System Prompt</Label>
              <Textarea
                id="systemPrompt"
                value={formData.systemPrompt}
                onChange={(e) => setFormData({...formData, systemPrompt: e.target.value})}
                placeholder="Enter system prompt"
                rows={4}
              />
            </div>
            <Button onClick={handleCreatePersona}>Create Persona</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Persona Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Persona</DialogTitle>
            <DialogDescription>
              Modify the persona details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="Enter persona name"
              />
            </div>
            <div>
              <Label htmlFor="edit-systemPrompt">System Prompt</Label>
              <Textarea
                id="edit-systemPrompt"
                value={formData.systemPrompt}
                onChange={(e) => setFormData({...formData, systemPrompt: e.target.value})}
                placeholder="Enter system prompt"
                rows={4}
              />
            </div>
            <Button onClick={handleUpdatePersona}>Update Persona</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Persona Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the persona.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePersona} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}