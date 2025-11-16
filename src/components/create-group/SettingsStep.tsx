
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
            defaultValue={formData.privacy}
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
          <p className="text-xs text-muted-foreground mt-2">
            Note: Voting rules are automatically set (60% approval, 70% participation, 7 days deadline)
          </p>
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
