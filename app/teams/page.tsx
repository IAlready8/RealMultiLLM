'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Users, Plus, Edit, Trash2, UserPlus, UserMinus, Shield } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { ConversationRecord } from '@/services/conversation-storage';
import { SharedConversationInput as SharedConversation } from '@/services/shared-conversation-service';

interface Team {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  ownerId: string;
  owner: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
  members: Array<{
    id: string;
    userId: string;
    role: string;
    joinedAt: Date;
    user: {
      id: string;
      name: string | null;
      email: string | null;
      image: string | null;
    };
  }>;
  conversations: ConversationRecord[];
  sharedConversations: SharedConversation[];
}

export default function TeamsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { toast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [newTeam, setNewTeam] = useState({ name: '', description: '' });
  const [newMemberEmail, setNewMemberEmail] = useState('');

  const fetchTeams = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/teams');
      if (!response.ok) throw new Error('Failed to fetch teams');
      const data = await response.json();
      setTeams(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load teams',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (status === 'authenticated') {
      void fetchTeams();
    }
  }, [status, fetchTeams]);

  const handleCreateTeam = async () => {
    try {
      const response = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTeam),
      });

      if (!response.ok) throw new Error('Failed to create team');

      const team = await response.json();
      setTeams([...teams, team]);
      setIsCreateDialogOpen(false);
      setNewTeam({ name: '', description: '' });
      
      toast({
        title: 'Success',
        description: 'Team created successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create team',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    try {
      const response = await fetch(`/api/teams/${teamId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete team');

      setTeams(teams.filter(team => team.id !== teamId));
      
      toast({
        title: 'Success',
        description: 'Team deleted successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete team',
        variant: 'destructive',
      });
    }
  };

  const handleAddMember = async () => {
    if (!selectedTeam || !newMemberEmail.trim()) return;

    try {
      // In a real implementation, you would look up the user by email
      // and then add them to the team. For now, we'll implement a basic version.
      
      // First, we need to find the user by email
      // This would require a user lookup API endpoint
      const userResponse = await fetch(`/api/users/lookup?email=${encodeURIComponent(newMemberEmail)}`);
      
      if (!userResponse.ok) {
        toast({
          title: 'Error',
          description: 'User not found with that email address',
          variant: 'destructive',
        });
        return;
      }
      
      const userData = await userResponse.json();
      
      // Then add the user to the team
      const response = await fetch(`/api/teams/${selectedTeam.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userData.id }),
      });

      if (!response.ok) throw new Error('Failed to add member');

      
      
      // Refresh the team data
      const updatedTeamResponse = await fetch(`/api/teams/${selectedTeam.id}`);
      if (!updatedTeamResponse.ok) throw new Error('Failed to refresh team data');
      
      const updatedTeam = await updatedTeamResponse.json();
      setSelectedTeam(updatedTeam);
      
      setTeams(teams.map(team => 
        team.id === selectedTeam.id ? updatedTeam : team
      ));
      
      toast({
        title: 'Success',
        description: `Added ${userData.name || userData.email} to the team`,
      });
      
      setNewMemberEmail('');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add member to team',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!selectedTeam) return;

    try {
      const response = await fetch(`/api/teams/${selectedTeam.id}/members/${memberId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to remove member');

      // Refresh the team data
      const updatedTeamResponse = await fetch(`/api/teams/${selectedTeam.id}`);
      if (!updatedTeamResponse.ok) throw new Error('Failed to refresh team data');
      
      const updatedTeam = await updatedTeamResponse.json();
      setSelectedTeam(updatedTeam);
      
      setTeams(teams.map(team => 
        team.id === selectedTeam.id ? updatedTeam : team
      ));
      
      toast({
        title: 'Success',
        description: 'Member removed successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove member',
        variant: 'destructive',
      });
    }
  };

  if (status === 'loading') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-300 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 bg-gray-300 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    router.push('/auth/signin');
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="heading-underline text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Team Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Create and manage your teams
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Team
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Team</DialogTitle>
              <DialogDescription>
                Create a new team to collaborate with others
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name
                </Label>
                <Input
                  id="name"
                  value={newTeam.name}
                  onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                  className="col-span-3"
                  placeholder="Enter team name"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="description" className="text-right">
                  Description
                </Label>
                <Textarea
                  id="description"
                  value={newTeam.description}
                  onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
                  className="col-span-3"
                  placeholder="Enter team description (optional)"
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreateTeam}>Create Team</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-48 bg-gray-300 rounded"></div>
            ))}
          </div>
        </div>
      ) : teams.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No teams yet
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Create your first team to start collaborating
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Team
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map((team) => (
            <Card key={team.id} className="flex flex-col">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {team.name}
                      {team.ownerId === session?.user?.id && (
                        <Badge variant="secondary">Owner</Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {team.description || 'No description'}
                    </CardDescription>
                  </div>
                  {team.ownerId === session?.user?.id && (
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedTeam(team);
                          setIsManageDialogOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteTeam(team.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-grow">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-500">
                    {team.members.length + 1} member{team.members.length + 1 !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  Created {new Date(team.createdAt).toLocaleDateString()}
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setSelectedTeam(team);
                    setIsManageDialogOpen(true);
                  }}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Manage Members
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Manage Team Dialog */}
      <Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Manage Team Members</DialogTitle>
            <DialogDescription>
              {selectedTeam?.name}
            </DialogDescription>
          </DialogHeader>
          
          {selectedTeam && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-medium">Team Owner</h3>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {selectedTeam.owner.image ? (
                      <img 
                        src={selectedTeam.owner.image} 
                        alt={selectedTeam.owner.name || 'Owner'} 
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs">
                        {selectedTeam.owner.name?.charAt(0) || 'O'}
                      </div>
                    )}
                    <div>
                      <div className="font-medium">
                        {selectedTeam.owner.name || 'Unnamed User'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {selectedTeam.owner.email}
                      </div>
                    </div>
                  </div>
                  <Badge variant="default">
                    <Shield className="h-3 w-3 mr-1" />
                    Owner
                  </Badge>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-medium">Team Members</h3>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="Add member by email"
                      value={newMemberEmail}
                      onChange={(e) => setNewMemberEmail(e.target.value)}
                      className="w-64"
                    />
                    <Button onClick={handleAddMember}>
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                {selectedTeam.members.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="h-12 w-12 mx-auto mb-2" />
                    <p>No members in this team yet</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedTeam.members.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {member.user.image ? (
                                <img 
                                  src={member.user.image} 
                                  alt={member.user.name || 'Member'} 
                                  className="w-8 h-8 rounded-full"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs">
                                  {member.user.name?.charAt(0) || 'M'}
                                </div>
                              )}
                              <div>
                                <div className="font-medium">
                                  {member.user.name || 'Unnamed User'}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {member.user.email}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={member.role === 'ADMIN' ? 'default' : 'secondary'}>
                              {member.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(member.joinedAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveMember(member.id)}
                            >
                              <UserMinus className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={() => setIsManageDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
