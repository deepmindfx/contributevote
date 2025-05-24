
import React from 'react';
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface SettingsStepProps {
  formData: any;
  handleChange: (field: string, value: any) => void;
  goToPreviousStep: () => void;
  handleCreateGroup: () => void;
  validationErrors: any;
  isLoading: boolean;
}

const SettingsStep = ({ 
  formData, 
  handleChange, 
  goToPreviousStep, 
  handleCreateGroup, 
  validationErrors,
  isLoading 
}: SettingsStepProps) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-center mb-2">Group Settings</h2>
        <p className="text-muted-foreground text-center">Configure your group preferences and provide your BVN for account creation</p>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="bvn">Bank Verification Number (BVN) *</Label>
          <Input
            id="bvn"
            type="text"
            placeholder="Enter your 11-digit BVN"
            value={formData.bvn}
            onChange={(e) => handleChange('bvn', e.target.value)}
            maxLength={11}
          />
          {validationErrors.bvn && (
            <p className="text-sm text-red-500 mt-1">{validationErrors.bvn}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            Required to create a dedicated bank account for your group
          </p>
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="isPrivate">Private Group</Label>
          <Switch
            id="isPrivate"
            checked={formData.privacy === 'private'}
            onCheckedChange={(checked) => handleChange('privacy', checked ? 'private' : 'public')}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="allowAnonymous">Allow Anonymous Contributions</Label>
          <Switch
            id="allowAnonymous"
            checked={formData.allowAnonymous}
            onCheckedChange={(checked) => handleChange('allowAnonymous', checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="requireApproval">Require Approval for New Members</Label>
          <Switch
            id="requireApproval"
            checked={formData.requireApproval}
            onCheckedChange={(checked) => handleChange('requireApproval', checked)}
          />
        </div>
      </div>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={goToPreviousStep}>
          Previous
        </Button>
        <Button type="button" onClick={handleCreateGroup} disabled={isLoading}>
          {isLoading ? 'Creating...' : 'Create Group'}
        </Button>
      </div>
    </div>
  );
};

export default SettingsStep;
