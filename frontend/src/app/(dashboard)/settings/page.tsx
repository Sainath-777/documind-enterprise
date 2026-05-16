"use client";

import * as React from "react";
import { 
  Save,
  Key,
  Database,
  Building
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function SettingsPage() {
  return (
    <div className="flex-1 space-y-8 p-8 pt-10 h-full overflow-y-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Workspace Settings</h2>
          <p className="text-muted-foreground mt-1">
            Manage your workspace identity and core integrations.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button>
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </div>

      <div className="grid gap-6 max-w-4xl">
        {/* General Settings */}
        <Card className="border-border/60 bg-card">
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <Building className="mr-2 h-5 w-5 text-muted-foreground" />
              General Information
            </CardTitle>
            <CardDescription>
              Update your workspace name and branding.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Workspace Name</label>
              <Input defaultValue="Acme Corp" className="max-w-md bg-background" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Workspace ID</label>
              <Input defaultValue="ws_01HVK9ZM3Q7Y4" disabled className="max-w-md font-mono text-xs text-muted-foreground" />
              <p className="text-xs text-muted-foreground">This is your unique workspace identifier. It cannot be changed.</p>
            </div>
          </CardContent>
        </Card>

        {/* API Configurations */}
        <Card className="border-border/60 bg-card">
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <Key className="mr-2 h-5 w-5 text-muted-foreground" />
              API Integrations
            </CardTitle>
            <CardDescription>
              Configure the external services powering this workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Gemini API Key</label>
              <Input type="password" defaultValue="AIzaSy**************************" className="max-w-md bg-background font-mono text-sm" />
              <p className="text-xs text-muted-foreground">Used for generating embeddings and LLM responses via Google Gemini Flash.</p>
            </div>
            
            <Separator className="max-w-md" />

            <div className="space-y-2">
              <label className="text-sm font-medium">Pinecone API Key</label>
              <Input type="password" defaultValue="pc-**************************" className="max-w-md bg-background font-mono text-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Pinecone Environment</label>
              <Input defaultValue="gcp-starter" className="max-w-md bg-background font-mono text-sm" />
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive text-lg">Danger Zone</CardTitle>
            <CardDescription className="text-destructive/80">
              Irreversible and destructive actions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-foreground">Delete Workspace</h4>
                <p className="text-sm text-muted-foreground mt-1 max-w-md">
                  Permanently remove this workspace, including all uploaded documents, embeddings, and team members.
                </p>
              </div>
              <Button variant="destructive">Delete Workspace</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
