"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { CheckCircle, PlusCircle, Trash2, Edit, XCircle, Loader2, AlertTriangle } from "lucide-react";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/ui/use-toast"; // Import useToast

interface Goal {
  id: string;
  title: string;
  description: string | null;
  status: "pending" | "completed";
  createdAt: string;
  updatedAt: string;
  userId: string;
}

export default function GoalHub() {
  const { data: session, status } = useSession();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [newGoalDescription, setNewGoalDescription] = useState("");
  const [isAddGoalDialogOpen, setIsAddGoalDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast(); // Initialize toast

  const fetchGoals = useCallback(async () => {
    if (status !== "authenticated") return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/goals");
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to fetch goals: ${response.statusText}`);
      }
      const data: Goal[] = await response.json();
      setGoals(data);
    } catch (err: any) {
      setError(err.message);
      console.error("Error fetching goals:", err);
      toast({
        title: "Error fetching goals",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [status, toast]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]); // Re-fetch when session changes

  const handleAddGoal = async () => {
    if (!newGoalTitle.trim()) return;
    if (status !== "authenticated") {
      setError("You must be logged in to add goals.");
      toast({
        title: "Authentication Required",
        description: "You must be logged in to add goals.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/goals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: newGoalTitle.trim(),
          description: newGoalDescription.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to add goal: ${response.statusText}`);
      }

      setNewGoalTitle("");
      setNewGoalDescription("");
      setIsAddGoalDialogOpen(false);
      fetchGoals(); // Re-fetch all goals after adding
      toast({
        title: "Goal Added",
        description: "Your goal has been successfully added.",
        variant: "success",
      });
    } catch (err: any) {
      setError(err.message);
      console.error("Error adding goal:", err);
      toast({
        title: "Error adding goal",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkComplete = async (id: string) => {
    if (status !== "authenticated") {
      setError("You must be logged in to update goals.");
      toast({
        title: "Authentication Required",
        description: "You must be logged in to update goals.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const goalToUpdate = goals.find(goal => goal.id === id);
      if (!goalToUpdate) throw new Error("Goal not found.");

      const response = await fetch("/api/goals", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id,
          title: goalToUpdate.title,
          description: goalToUpdate.description,
          status: "completed",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to mark goal complete: ${response.statusText}`);
      }

      fetchGoals(); // Re-fetch all goals after updating
      toast({
        title: "Goal Completed",
        description: "Your goal has been marked as completed.",
        variant: "success",
      });
    } catch (err: any) {
      setError(err.message);
      console.error("Error marking goal complete:", err);
      toast({
        title: "Error marking goal complete",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteGoal = async (id: string) => {
    if (status !== "authenticated") {
      setError("You must be logged in to delete goals.");
      toast({
        title: "Authentication Required",
        description: "You must be logged in to delete goals.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/goals?id=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to delete goal: ${response.statusText}`);
      }

      fetchGoals(); // Re-fetch all goals after deleting
      toast({
        title: "Goal Deleted",
        description: "Your goal has been successfully deleted.",
        variant: "success",
      });
    } catch (err: any) {
      setError(err.message);
      console.error("Error deleting goal:", err);
      toast({
        title: "Error deleting goal",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const pendingGoals = goals.filter(goal => goal.status === "pending");
  const completedGoals = goals.filter(goal => goal.status === "completed");

  if (status === "loading" || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        <p className="ml-2 text-gray-500">Loading goals...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] text-red-500">
        <XCircle className="h-12 w-12 mb-4" />
        <p className="text-lg">Error: {error}</p>
        <p className="text-sm text-gray-400">Please ensure you are logged in and your database is configured correctly.</p>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] text-yellow-500">
        <AlertTriangle className="h-12 w-12 mb-4" />
        <p className="text-lg">Please log in to manage your goals.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Goal Hub</h1>
          <p className="text-gray-400">Define, track, and manage your personal goals.</p>
        </div>
        <Dialog open={isAddGoalDialogOpen} onOpenChange={setIsAddGoalDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="h-4 w-4 mr-2" /> Add New Goal
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] bg-gray-900 border-gray-800">
            <DialogHeader>
              <DialogTitle>Add New Goal</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="e.g., Learn Next.js"
                  value={newGoalTitle}
                  onChange={(e) => setNewGoalTitle(e.target.value)}
                  className="bg-gray-800 border-gray-700"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="e.g., Build a full-stack application using Next.js and Tailwind CSS."
                  value={newGoalDescription}
                  onChange={(e) => setNewGoalDescription(e.target.value)}
                  className="bg-gray-800 border-gray-700"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddGoalDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddGoal}>Add Goal</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h2 className="text-xl font-semibold mb-4">Pending Goals ({pendingGoals.length})</h2>
          <div className="space-y-4">
            {pendingGoals.length === 0 ? (
              <p className="text-gray-500">No pending goals. Time to set some!</p>
            ) : (
              pendingGoals.map((goal) => (
                <Card key={goal.id} className="bg-gray-900 border-gray-800">
                  <CardHeader>
                    <CardTitle>{goal.title}</CardTitle>
                    <CardDescription className="text-gray-400">Created: {new Date(goal.createdAt).toLocaleDateString()}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p>{goal.description}</p>
                    <div className="flex gap-2">
                      <Button onClick={() => handleMarkComplete(goal.id)} size="sm">
                        <CheckCircle className="h-4 w-4 mr-2" /> Mark Complete
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDeleteGoal(goal.id)}>
                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Completed Goals ({completedGoals.length})</h2>
          <div className="space-y-4">
            {completedGoals.length === 0 ? (
              <p className="text-gray-500">No completed goals yet. Keep going!</p>
            ) : (
              completedGoals.map((goal) => (
                <Card key={goal.id} className="bg-gray-900 border-gray-800 opacity-70">
                  <CardHeader>
                    <CardTitle className="line-through">{goal.title}</CardTitle>
                    <CardDescription className="text-gray-500">Completed: {new Date(goal.createdAt).toLocaleDateString()}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="line-through">{goal.description}</p>
                    <div className="flex gap-2">
                      <Button variant="destructive" size="sm" onClick={() => handleDeleteGoal(goal.id)}>
                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}