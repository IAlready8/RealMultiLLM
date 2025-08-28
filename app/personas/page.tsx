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
  getPersonas, 
  createPersona, 
  updatePersona, 
  deletePersona, 
  DEFAULT_PERSONAS,
  type Persona, 
  type CreatePersonaRequest,
  type UpdatePersonaRequest 
} from "@/services/persona-service";

export default function PersonasPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    prompt: ""
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchPersonas();
  }, []);

  const fetchPersonas = async () => {
    try {
      setIsLoading(true);
      const data = await getPersonas();
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

  const handleCreate = async () => {
    try {
      if (!formData.title.trim() || !formData.prompt.trim()) {
        toast({
          title: "Validation Error",
          description: "Title and prompt are required",
          variant: "destructive",
        });
        return;
      }

      const personaData: CreatePersonaRequest = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        prompt: formData.prompt.trim(),
      };

      await createPersona(personaData);
      
      toast({
        title: "Success",
        description: "Persona created successfully",
      });
      
      setIsCreateDialogOpen(false);
      resetForm();
      fetchPersonas();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create persona",
        variant: "destructive",
      });
    }
  };

  const handleUpdate = async () => {
    if (!selectedPersona) return;

    try {
      if (!formData.title.trim() || !formData.prompt.trim()) {
        toast({
          title: "Validation Error",
          description: "Title and prompt are required",
          variant: "destructive",
        });
        return;
      }

      const updateData: UpdatePersonaRequest = {
        id: selectedPersona.id,
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        prompt: formData.prompt.trim(),
      };

      await updatePersona(updateData);
      
      toast({
        title: "Success",
        description: "Persona updated successfully",
      });
      
      setIsEditDialogOpen(false);
      resetForm();
      setSelectedPersona(null);
      fetchPersonas();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update persona",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedPersona) return;

    try {
      await deletePersona(selectedPersona.id);
      
      toast({
        title: "Success",
        description: "Persona deleted successfully",
      });
      
      setIsDeleteDialogOpen(false);
      setSelectedPersona(null);
      fetchPersonas();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete persona",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      prompt: ""
    });
  };

  const openCreateDialog = () => {
    resetForm();
    setIsCreateDialogOpen(true);
  };

  const openEditDialog = (persona: Persona) => {
    setSelectedPersona(persona);
    setFormData({
      title: persona.title,
      description: persona.description || "",
      prompt: persona.prompt,
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (persona: Persona) => {
    setSelectedPersona(persona);
    setIsDeleteDialogOpen(true);
  };

  const createFromTemplate = async (template: typeof DEFAULT_PERSONAS[0]) => {
    try {
      await createPersona(template);
      toast({
        title: "Success",
        description: `Created "${template.title}" persona from template`,
      });
      fetchPersonas();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create persona from template",
        variant: "destructive",
      });
    }
  };

  const copyPrompt = (prompt: string) => {
    navigator.clipboard.writeText(prompt);
    toast({
      title: "Copied",
      description: "Prompt copied to clipboard",
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <User className="h-6 w-6" />
            AI Personas
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Create and manage AI personas with custom prompts and personalities
          </p>
        </div>
        <Button onClick={openCreateDialog} className="flex items-center gap-2">
          <PlusCircle className="h-4 w-4" />
          Create Persona
        </Button>
      </div>

      {/* Templates Section */}
      {personas.length === 0 && !isLoading && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Quick Start Templates
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {DEFAULT_PERSONAS.map((template, index) => (
              <Card key={index} className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-blue-700 dark:text-blue-300">{template.title}</CardTitle>
                  <CardDescription className="text-xs">{template.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => createFromTemplate(template)}
                    className="w-full text-xs"
                  >
                    Use Template
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Personas Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-full"></div>
              </CardHeader>
              <CardContent>
                <div className="h-20 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : personas.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <User className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No personas yet
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Create your first AI persona or use one of the templates above
            </p>
            <Button onClick={openCreateDialog}>
              <PlusCircle className="h-4 w-4 mr-2" />
              Create Your First Persona
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {personas.map((persona) => (
            <Card key={persona.id} className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="truncate">{persona.title}</span>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyPrompt(persona.prompt)}
                      className="h-8 w-8 p-0"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEditDialog(persona)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openDeleteDialog(persona)}
                      className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardTitle>
                {persona.description && (
                  <CardDescription className="text-sm text-gray-400">
                    {persona.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="bg-gray-800 p-3 rounded text-sm text-gray-300 max-h-24 overflow-y-auto">
                  {persona.prompt}
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  Created {new Date(persona.createdAt).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateDialogOpen || isEditDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsCreateDialogOpen(false);
          setIsEditDialogOpen(false);
          resetForm();
          setSelectedPersona(null);
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {isCreateDialogOpen ? "Create New Persona" : "Edit Persona"}
            </DialogTitle>
            <DialogDescription>
              {isCreateDialogOpen 
                ? "Create a new AI persona with custom instructions and personality."
                : "Update your AI persona's settings and instructions."
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., Professional Assistant, Creative Writer..."
                className="bg-gray-800 border-gray-700"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of this persona's role..."
                className="bg-gray-800 border-gray-700"
              />
            </div>
            <div>
              <Label htmlFor="prompt">System Prompt *</Label>
              <Textarea
                id="prompt"
                value={formData.prompt}
                onChange={(e) => setFormData(prev => ({ ...prev, prompt: e.target.value }))}
                placeholder="You are a helpful assistant that..."
                className="bg-gray-800 border-gray-700 min-h-32"
                rows={6}
              />
              <p className="text-xs text-gray-500 mt-1">
                This prompt will be sent to the AI before every conversation to define its personality and behavior.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false);
                setIsEditDialogOpen(false);
                resetForm();
                setSelectedPersona(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={isCreateDialogOpen ? handleCreate : handleUpdate}
              disabled={!formData.title.trim() || !formData.prompt.trim()}
            >
              {isCreateDialogOpen ? "Create Persona" : "Update Persona"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Persona</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{selectedPersona?.title}&rdquo;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}