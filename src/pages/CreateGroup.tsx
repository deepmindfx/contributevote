
import { useState } from "react";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, Users, Calendar, Check } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { useApp } from "@/contexts/AppContext";
import { toast } from "sonner";
import { monnifyAPI } from "@/services/monnifyService";

const CreateGroup = () => {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { createNewContribution, user } = useApp();
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    targetAmount: 0,
    category: 'personal',
    frequency: 'monthly' as 'daily' | 'weekly' | 'monthly' | 'one-time',
    contributionAmount: 0,
    startDate: '',
    endDate: '',
    votingThreshold: 70,
    privacy: 'private' as 'public' | 'private',
    memberRoles: 'equal' as 'equal' | 'weighted',
    notifyContributions: true,
    notifyVotes: true,
    notifyUpdates: true,
  });

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const goToNextStep = () => {
    window.scrollTo(0, 0);
    setStep(step + 1);
  };

  const goToPreviousStep = () => {
    window.scrollTo(0, 0);
    setStep(step - 1);
  };

  const handleCreateGroup = async () => {
    if (!formData.name || !formData.startDate || formData.targetAmount <= 0 || formData.contributionAmount <= 0) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsLoading(true);
    
    try {
      // Prepare contribution data
      const contributionData = {
        name: formData.name,
        description: formData.description,
        targetAmount: Number(formData.targetAmount),
        category: formData.category,
        frequency: formData.frequency,
        contributionAmount: Number(formData.contributionAmount),
        startDate: formData.startDate,
        endDate: formData.endDate || undefined,
        votingThreshold: formData.votingThreshold,
        privacy: formData.privacy,
        memberRoles: formData.memberRoles,
        creatorId: user?.id || '1', // Use actual user ID from context
      };
      
      console.log("Creating new contribution with data:", contributionData);
      
      // Create contribution
      const newContribution = await createNewContribution(contributionData);
      
      // If we have a successful contribution creation and Monnify integration is active
      if (newContribution && user?.virtualAccount) {
        try {
          // Here we could create a dedicated account for the group if needed
          // For now we just show success message
          toast.success(`Group "${formData.name}" created successfully`);
        } catch (error) {
          console.error("Error setting up Monnify account for group:", error);
          // Still allow group creation even if Monnify setup fails
        }
      } else {
        toast.success(`Group "${formData.name}" created successfully`);
      }
      
      // Navigate to dashboard
      navigate("/dashboard");
    } catch (error) {
      console.error("Error creating contribution group:", error);
      toast.error("Failed to create group. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const validateStep = () => {
    if (step === 1) {
      return !!formData.name && !!formData.targetAmount;
    } else if (step === 2) {
      return !!formData.contributionAmount && !!formData.startDate; 
    }
    return true;
  };

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <Header />
      
      <main className="container max-w-3xl mx-auto px-4 pt-24 pb-12">
        <div className="mb-6 animate-fade-in">
          <Button 
            variant="ghost" 
            size="sm" 
            className="mb-2"
            onClick={step > 1 ? goToPreviousStep : () => navigate("/dashboard")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {step > 1 ? "Back" : "Dashboard"}
          </Button>
          <h1 className="text-2xl font-bold">Create a New Group</h1>
          <p className="text-muted-foreground">Set up your contribution group in a few steps</p>
        </div>
        
        <div className="relative mb-8">
          <div className="flex justify-between items-center relative z-10">
            <div className={`flex flex-col items-center ${step >= 1 ? "text-primary" : "text-muted-foreground"}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
                step >= 1 ? "bg-primary text-white" : "bg-muted text-muted-foreground"
              }`}>
                1
              </div>
              <span className="text-xs font-medium">Details</span>
            </div>
            
            <div className={`flex flex-col items-center ${step >= 2 ? "text-primary" : "text-muted-foreground"}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
                step >= 2 ? "bg-primary text-white" : "bg-muted text-muted-foreground"
              }`}>
                2
              </div>
              <span className="text-xs font-medium">Schedule</span>
            </div>
            
            <div className={`flex flex-col items-center ${step >= 3 ? "text-primary" : "text-muted-foreground"}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
                step >= 3 ? "bg-primary text-white" : "bg-muted text-muted-foreground"
              }`}>
                3
              </div>
              <span className="text-xs font-medium">Settings</span>
            </div>
          </div>
          <div className="absolute top-5 left-0 right-0 h-1 bg-muted">
            <div 
              className="h-full bg-primary transition-all duration-300" 
              style={{ width: `${(step - 1) * 50}%` }} 
            />
          </div>
        </div>
        
        <Card className="glass-card animate-scale">
          {step === 1 && (
            <>
              <CardHeader>
                <CardTitle>Group Details</CardTitle>
                <CardDescription>Provide information about your contribution group</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Group Name</Label>
                  <Input 
                    id="name" 
                    placeholder="E.g., Wedding Fund, Business Launch" 
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea 
                    id="description" 
                    placeholder="Describe the purpose of this group" 
                    rows={4}
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target">Target Amount</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-muted-foreground">₦</span>
                    <Input 
                      id="target" 
                      type="number" 
                      className="pl-8" 
                      placeholder="0.00"
                      value={formData.targetAmount || ''}
                      onChange={(e) => handleChange('targetAmount', Number(e.target.value))}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">Set a goal for your group contributions</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select 
                    value={formData.category}
                    onValueChange={(value) => handleChange('category', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="personal">Personal</SelectItem>
                      <SelectItem value="business">Business</SelectItem>
                      <SelectItem value="family">Family</SelectItem>
                      <SelectItem value="event">Event</SelectItem>
                      <SelectItem value="education">Education</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  onClick={goToNextStep} 
                  className="w-full"
                  disabled={!validateStep()}
                >
                  Continue
                </Button>
              </CardFooter>
            </>
          )}
          
          {step === 2 && (
            <>
              <CardHeader>
                <CardTitle>Contribution Schedule</CardTitle>
                <CardDescription>Set up how often members will contribute</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Contribution Frequency</Label>
                  <RadioGroup 
                    value={formData.frequency}
                    onValueChange={(value) => handleChange('frequency', value)}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="daily" id="daily" />
                      <Label htmlFor="daily">Daily</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="weekly" id="weekly" />
                      <Label htmlFor="weekly">Weekly</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="monthly" id="monthly" />
                      <Label htmlFor="monthly">Monthly</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="one-time" id="one-time" />
                      <Label htmlFor="one-time">One-time contribution</Label>
                    </div>
                  </RadioGroup>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="amount">Contribution Amount</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-muted-foreground">₦</span>
                    <Input 
                      id="amount" 
                      type="number" 
                      className="pl-8" 
                      placeholder="0.00"
                      value={formData.contributionAmount || ''}
                      onChange={(e) => handleChange('contributionAmount', Number(e.target.value))}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">Amount each member contributes per period</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input 
                    id="start-date" 
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => handleChange('startDate', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="end-date">End Date (Optional)</Label>
                  <Input 
                    id="end-date" 
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => handleChange('endDate', e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">Leave empty for ongoing contributions</p>
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  onClick={goToNextStep} 
                  className="w-full"
                  disabled={!validateStep()}
                >
                  Continue
                </Button>
              </CardFooter>
            </>
          )}
          
          {step === 3 && (
            <>
              <CardHeader>
                <CardTitle>Group Settings</CardTitle>
                <CardDescription>Configure how your group operates</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="voting-threshold">Voting Threshold (%)</Label>
                  <Input 
                    id="voting-threshold" 
                    type="number" 
                    min="1" 
                    max="100"
                    value={formData.votingThreshold}
                    onChange={(e) => handleChange('votingThreshold', Number(e.target.value))}
                  />
                  <p className="text-sm text-muted-foreground">Percentage of members required to approve withdrawals</p>
                </div>
                
                <div className="space-y-2">
                  <Label>Privacy</Label>
                  <RadioGroup 
                    value={formData.privacy}
                    onValueChange={(value) => handleChange('privacy', value)}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="public" id="public" />
                      <Label htmlFor="public">Public - Anyone can request to join</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="private" id="private" />
                      <Label htmlFor="private">Private - Invitation only</Label>
                    </div>
                  </RadioGroup>
                </div>
                
                <div className="space-y-2">
                  <Label>Member Roles</Label>
                  <RadioGroup 
                    value={formData.memberRoles}
                    onValueChange={(value) => handleChange('memberRoles', value)}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="equal" id="equal" />
                      <Label htmlFor="equal">Equal voting rights for all members</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="weighted" id="weighted" />
                      <Label htmlFor="weighted">Voting power based on contribution amount</Label>
                    </div>
                  </RadioGroup>
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
          )}
        </Card>
      </main>
      
      <MobileNav />
    </div>
  );
};

export default CreateGroup;
