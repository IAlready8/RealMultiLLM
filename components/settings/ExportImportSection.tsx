"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ExportImportDialog } from "@/components/export-import-dialog";
import { FileDown, FileUp, Trash2, AlertTriangle } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";

interface ExportImportSectionProps {
  onExportData: (password: string) => Promise<string>;
  onImportData: (data: string, password: string) => Promise<void>;
  onClearAllData: () => Promise<void>;
}

export function ExportImportSection({ 
  onExportData, 
  onImportData, 
  onClearAllData 
}: ExportImportSectionProps) {
  const { toast } = useToast();
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [exportPassword, setExportPassword] = useState("");
  const [importData, setImportData] = useState("");
  const [importPassword, setImportPassword] = useState("");
  const [importError, setImportError] = useState("");

  const handleExport = async () => {
    try {
      const result = await onExportData(exportPassword);
      setShowExportDialog(false);
      setExportPassword("");
      toast({
        title: "Export Successful", 
        description: "Your data has been exported successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export data",
        variant: "destructive",
      });
    }
  };

  const handleImport = async () => {
    if (!importData.trim()) {
      setImportError("Please paste your export data");
      return;
    }

    try {
      setImportError("");
      await onImportData(importData, importPassword);
      setShowImportDialog(false);
      setImportData("");
      setImportPassword("");
      toast({
        title: "Import Successful",
        description: "Your data has been imported successfully.",
      });
    } catch (error: any) {
      setImportError(error.message || "Failed to import data");
    }
  };

  const handleClearAll = async () => {
    try {
      await onClearAllData();
      setShowClearDialog(false);
      toast({
        title: "Data Cleared",
        description: "All settings and data have been cleared successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Clear Failed",
        description: error.message || "Failed to clear data",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Export Data</CardTitle>
          <CardDescription>
            Download your settings, API keys, and conversation history
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
            <DialogTrigger asChild>
              <Button>
                <FileDown className="h-4 w-4 mr-2" />
                Export All Data
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Export Settings</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="export-password">Password (optional)</Label>
                  <Input
                    id="export-password"
                    type="password"
                    placeholder="Enter password to encrypt export"
                    value={exportPassword}
                    onChange={(e) => setExportPassword(e.target.value)}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Leave blank for unencrypted export
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowExportDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleExport}>
                  <FileDown className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Import Data</CardTitle>
          <CardDescription>
            Restore your settings from a previous export
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <FileUp className="h-4 w-4 mr-2" />
                Import Data
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Import Settings</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="import-data">Export Data</Label>
                  <Textarea
                    id="import-data"
                    placeholder="Paste your exported data here..."
                    value={importData}
                    onChange={(e) => setImportData(e.target.value)}
                    rows={8}
                  />
                </div>
                <div>
                  <Label htmlFor="import-password">Password (if encrypted)</Label>
                  <Input
                    id="import-password"
                    type="password"
                    placeholder="Enter password if data is encrypted"
                    value={importPassword}
                    onChange={(e) => setImportPassword(e.target.value)}
                  />
                </div>
                {importError && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{importError}</AlertDescription>
                  </Alert>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setShowImportDialog(false);
                  setImportError("");
                }}>
                  Cancel
                </Button>
                <Button onClick={handleImport}>
                  <FileUp className="h-4 w-4 mr-2" />
                  Import
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Permanently delete all your data and settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
            <DialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All Data
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Clear All Data</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    This will permanently delete all your API keys, settings, 
                    and conversation history. This action cannot be undone.
                  </AlertDescription>
                </Alert>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowClearDialog(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleClearAll}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Yes, Clear Everything
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}