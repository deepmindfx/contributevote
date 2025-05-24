
import React from 'react';
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface SettingsStepProps {
  formData: any;
  handleChange: (field: string, value: any) => void;
  goToPreviousStep: () => void;
  handleSubmit: () => void;
  validationErrors: any;
  isSubmitting: boolean;
}

const SettingsStep = ({ 
  formData, 
  handleChange, 
  goToPreviousStep, 
  handleSubmit, 
  validationErrors,
  isSubmitting 
}: SettingsStepProps) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-center mb-2">Group Settings</h2>
        <p className="text-muted-foreground text-center">Configure your group preferences</p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="isPrivate">Private Group</Label>
          <Switch
            id="isPrivate"
            checked={formData.isPrivate}
            onCheckedChange={(checked) => handleChange('isPrivate', checked)}
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
        <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create Group'}
        </Button>
      </div>
    </div>
  );
};

export default SettingsStep;
