
import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Check, AlertCircle } from "lucide-react";
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface SettingsStepProps {
  formData: {
    privacy: 'public' | 'private';
    category: string;
    enableVotingRights: boolean;
    bvn: string;
    notifyContributions: boolean;
    notifyVotes: boolean;
    notifyUpdates: boolean;
  };
  handleChange: (field: string, value: any) => void;
  handleCreateGroup: () => void;
  isLoading: boolean;
  validationErrors: {
    bvn?: string;
  };
}

const SettingsStep = ({ 
  formData, 
  handleChange, 
  handleCreateGroup, 
  isLoading, 
  validationErrors 
}: SettingsStepProps) => {
  return (
    <>
      <CardHeader>
        <CardTitle>Group Settings</CardTitle>
        <CardDescription>Configure how your group operates and set up the dedicated account</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Privacy</Label>
          <RadioGroup 
            value={formData.privacy}
            onValueChange={(value) => handleChange('privacy', value)}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="public" id="public" />
              <Label htmlFor="public">Public - Anyone can discover and join</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="private" id="private" />
              <Label htmlFor="private">Private - Invitation only</Label>
            </div>
          </RadioGroup>
        </div>

        {/* Voting Rights Toggle */}
        <div className="space-y-2 p-4 bg-muted/40 rounded-lg border">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium">Governance Settings</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Choose how withdrawals are approved in this group
              </p>
            </div>
          </div>
          
          <RadioGroup 
            value={formData.enableVotingRights ? "with-voting" : "no-voting"}
            onValueChange={(value) => handleChange('enableVotingRights', value === "with-voting")}
          >
            <div className="flex items-start space-x-2 p-3 rounded-md border bg-background">
              <RadioGroupItem value="with-voting" id="with-voting" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="with-voting" className="font-medium">
                  With Voting Rights (Recommended)
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Contributors vote on withdrawal requests. Democratic and transparent.
                  {formData.category === 'emergency' || formData.category === 'charity' 
                    ? ' Recommended for emergency and charity groups.' 
                    : ''}
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-2 p-3 rounded-md border bg-background">
              <RadioGroupItem value="no-voting" id="no-voting" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="no-voting" className="font-medium">
                  No Voting Rights
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Admin can withdraw without approval. Contributors will be notified they have no voting rights.
                </p>
              </div>
            </div>
          </RadioGroup>
          
          {!formData.enableVotingRights && (
            <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded text-xs text-amber-800 dark:text-amber-200">
              ⚠️ Contributors will see a clear warning that they have no voting rights when contributing
            </div>
          )}
          
          {formData.enableVotingRights && (
            <p className="text-xs text-muted-foreground mt-2">
              Voting rules: 60% approval, 70% participation, 7 days deadline
            </p>
          )}
        </div>
        
        {/* BVN input section */}
        <div className="space-y-2 p-4 bg-muted/40 rounded-lg border">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium">Account Information</h3>
              <p className="text-sm text-muted-foreground">
                We need your BVN to create a dedicated account for this group. 
                This is required by our payment provider for verification purposes.
              </p>
            </div>
          </div>
          
          <div className="space-y-2 mt-3">
            <Label htmlFor="bvn" className="text-sm">Bank Verification Number (BVN)</Label>
            <Input 
              id="bvn" 
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={11}
              placeholder="Enter your 11-digit BVN"
              value={formData.bvn}
              onChange={(e) => handleChange('bvn', e.target.value)}
              className={validationErrors.bvn ? "border-red-500" : ""}
            />
            {validationErrors.bvn && (
              <p className="text-xs text-red-500">{validationErrors.bvn}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Your BVN is used only for verification and to create the account. It is not stored after verification.
            </p>
          </div>
        </div>
        
        <div className="space-y-2">
          <Label>Notification Settings</Label>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="notify-contributions" 
                checked={formData.notifyContributions}
                onCheckedChange={(checked) => handleChange('notifyContributions', checked)}
              />
              <label
                htmlFor="notify-contributions"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Contribution reminders
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="notify-votes" 
                checked={formData.notifyVotes}
                onCheckedChange={(checked) => handleChange('notifyVotes', checked)}
              />
              <label
                htmlFor="notify-votes"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                New withdrawal requests
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="notify-updates" 
                checked={formData.notifyUpdates}
                onCheckedChange={(checked) => handleChange('notifyUpdates', checked)}
              />
              <label
                htmlFor="notify-updates"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Group updates and announcements
              </label>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          onClick={handleCreateGroup} 
          className="w-full"
          disabled={isLoading}
        >
          {isLoading ? (
            <div className="flex items-center">
              <div className="animate-spin mr-2 h-4 w-4 border-t-2 border-b-2 border-current rounded-full"></div>
              Creating Group...
            </div>
          ) : (
            <div className="flex items-center">
              <Check className="mr-2 h-4 w-4" />
              Create Group
            </div>
          )}
        </Button>
      </CardFooter>
    </>
  );
};

export default SettingsStep;
