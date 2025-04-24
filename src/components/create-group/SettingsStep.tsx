
import React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface SettingsStepProps {
  formData: {
    name: string;
    description: string;
    targetAmount: number;
    category: string;
    frequency: "daily" | "weekly" | "monthly" | "one-time";
    contributionAmount: number;
    startDate: string;
    endDate: string;
    votingThreshold: number;
    privacy: "public" | "private";
    memberRoles: "equal" | "weighted";
    notifyContributions: boolean;
    notifyVotes: boolean;
    notifyUpdates: boolean;
    bvn: string;
    accountReference: string;
  };
  handleChange: (field: string, value: any) => void;
  handleCreateGroup: () => void;
  goToPreviousStep: () => void;
  isLoading: boolean;
  validationErrors: {
    bvn?: string;
  };
}

const SettingsStep = ({
  formData,
  handleChange,
  handleCreateGroup,
  goToPreviousStep,
  isLoading,
  validationErrors,
}: SettingsStepProps) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Group Settings</h2>
        <p className="text-muted-foreground">Configure additional settings for your contribution group.</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="privacy">Privacy Setting</Label>
          <Select
            value={formData.privacy}
            onValueChange={(value) => handleChange("privacy", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select privacy setting" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">Public (Anyone can find and join)</SelectItem>
              <SelectItem value="private">Private (By invitation only)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="memberRoles">Member Roles</Label>
          <Select
            value={formData.memberRoles}
            onValueChange={(value) => handleChange("memberRoles", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select member roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="equal">Equal (All members have equal rights)</SelectItem>
              <SelectItem value="weighted">Weighted (Based on contribution amount)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="votingThreshold">
            Voting Threshold (%)
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="votingThreshold"
              type="number"
              min="50"
              max="100"
              value={formData.votingThreshold}
              onChange={(e) => handleChange("votingThreshold", Number(e.target.value))}
            />
            <span>{formData.votingThreshold}%</span>
          </div>
          <p className="text-sm text-muted-foreground">
            The percentage of votes needed to approve withdrawals
          </p>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="bvn" className="flex justify-between">
            <span>Bank Verification Number (BVN)</span>
            <span className="text-sm text-green-600">Required</span>
          </Label>
          <Input
            id="bvn"
            type="text"
            inputMode="numeric"
            maxLength={11}
            value={formData.bvn}
            onChange={(e) => handleChange("bvn", e.target.value)}
            className={validationErrors.bvn ? "border-red-500" : ""}
          />
          {validationErrors.bvn && (
            <p className="text-sm font-medium text-red-500 mt-1">
              {validationErrors.bvn}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            Your BVN is required to create a dedicated account for the group. This information is encrypted and secure.
          </p>
        </div>

        <div className="space-y-2 pt-4">
          <Label>Notifications</Label>
          
          <div className="flex items-center justify-between pt-2">
            <div className="space-y-0.5">
              <Label htmlFor="notifyContributions" className="text-sm">
                New Contributions
              </Label>
              <p className="text-xs text-muted-foreground">
                Get notified when someone contributes
              </p>
            </div>
            <Switch
              id="notifyContributions"
              checked={formData.notifyContributions}
              onCheckedChange={(value) => handleChange("notifyContributions", value)}
            />
          </div>
          
          <div className="flex items-center justify-between pt-2">
            <div className="space-y-0.5">
              <Label htmlFor="notifyVotes" className="text-sm">
                Withdrawal Votes
              </Label>
              <p className="text-xs text-muted-foreground">
                Get notified when a withdrawal vote is needed
              </p>
            </div>
            <Switch
              id="notifyVotes"
              checked={formData.notifyVotes}
              onCheckedChange={(value) => handleChange("notifyVotes", value)}
            />
          </div>
          
          <div className="flex items-center justify-between pt-2">
            <div className="space-y-0.5">
              <Label htmlFor="notifyUpdates" className="text-sm">
                Group Updates
              </Label>
              <p className="text-xs text-muted-foreground">
                Get notified about group changes and announcements
              </p>
            </div>
            <Switch
              id="notifyUpdates"
              checked={formData.notifyUpdates}
              onCheckedChange={(value) => handleChange("notifyUpdates", value)}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <Button 
          type="button" 
          variant="outline" 
          onClick={goToPreviousStep}
          disabled={isLoading}
        >
          Back
        </Button>
        <Button 
          onClick={handleCreateGroup}
          disabled={isLoading || !!validationErrors.bvn}
          className="ml-2"
        >
          {isLoading ? "Creating Group..." : "Create Group"}
        </Button>
      </div>
    </div>
  );
};

export default SettingsStep;
