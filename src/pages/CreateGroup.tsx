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
import { ArrowLeft, Users, Calendar, Check, AlertCircle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { useApp } from "@/contexts/AppContext";
import { toast } from "sonner";
import { createContributionGroupAccount } from "@/services/monnifyApi";

// Define visibility type to fix TypeScript error
type VisibilityType = "public" | "private" | "invite-only";

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
    // New fields for account creation
    bvn: '',
    accountReference: `GROUP_${Date.now()}`,
  });

  const [validationErrors, setValidationErrors] = useState<{
    bvn?: string;
  }>({});

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear validation errors when field is updated
    if (validationErrors[field as keyof typeof validationErrors]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field as keyof typeof validationErrors];
        return newErrors;
      });
    }
  };

  const validateStep = (currentStep: number) => {
    if (currentStep === 1) {
      if (!formData.name.trim()) {
        toast.error("Group name is required");
        return false;
      }
      if (formData.targetAmount <= 0) {
        toast.error("Target amount must be greater than zero");
        return false;
      }
    } else if (currentStep === 2) {
      if (formData.contributionAmount <= 0) {
        toast.error("Contribution amount must be greater than zero");
        return false;
      }
      if (!formData.startDate) {
        toast.error("Start date is required");
        return false;
      }
    } else if (currentStep === 3) {
      // Validate BVN if we're on the settings step
      const errors: {bvn?: string} = {};
      
      if (!formData.bvn.trim()) {
        errors.bvn = "BVN is required to create a dedicated account for the group";
      } else if (formData.bvn.length !== 11 || !/^\d+$/.test(formData.bvn)) {
        errors.bvn = "BVN must be 11 digits";
      }
      
      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors);
        return false;
      }
    }
    
    return true;
  };

  const goToNextStep = () => {
    if (!validateStep(step)) {
      return;
    }
    
    window.scrollTo(0, 0);
    setStep(step + 1);
  };

  const goToPreviousStep = () => {
    window.scrollTo(0, 0);
    setStep(step - 1);
  };

  const handleCreateGroup = async () => {
    if (!validateStep(step)) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Create a virtual account for the group first
      const accountData = {
        accountReference: formData.accountReference,
        accountName: formData.name, // Use the group name directly
        currencyCode: "NGN",
        contractCode: "465595618981", // Use the updated contract code
        customerEmail: user.email,
        customerName: formData.name,
        customerBvn: formData.bvn
      };
      
      const accountResponse = await createContributionGroupAccount(accountData);
      
      if (!accountResponse.requestSuccessful) {
        toast.error(accountResponse.message || "Failed to create account for the group");
        setIsLoading(false);
        return;
      }
      
      // Extract account details from response
      const accountDetails = accountResponse.responseBody;
      
      // Prepare contribution data with account details
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
        creatorId: user.id,
        // Setting required properties to meet the type requirements
        visibility: formData.privacy === 'public' ? 'public' as VisibilityType : 'private' as VisibilityType,
        status: 'active',
        deadline: formData.endDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        // Add account details
        accountNumber: accountDetails.accountNumber,
        bankName: accountDetails.bankName,
        accountReference: accountDetails.accountReference,
        accountDetails: accountDetails,
      };
      
      // Create contribution
      createNewContribution(contributionData);
      
      toast.success("Group created successfully with dedicated account");
      
      // Navigate to dashboard
      setTimeout(() => {
        setIsLoading(false);
        navigate("/dashboard");
      }, 1000);
    } catch (error) {
      console.error("Error creating group:", error);
      toast.error("Failed to create group. Please try again.");
      setIsLoading(false);
    }
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
                    defaultValue={formData.category}
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
                <Button onClick={goToNextStep} className="w-full">
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
                    defaultValue={formData.frequency}
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
                <Button onClick={goToNextStep} className="w-full">
                  Continue
                </Button>
              </CardFooter>
            </>
          )}
          
          {step === 3 && (
            <>
              <CardHeader>
                <CardTitle>Group Settings</CardTitle>
                <CardDescription>Configure how your group operates and set up the dedicated account</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="voting-threshold">Voting Threshold (%)</Label>
                  <Input 
                    id="voting-threshold" 
                    type="number" 
                    min="1" 
                    max="100" 
                    defaultValue="70"
                    value={formData.votingThreshold}
                    onChange={(e) => handleChange('votingThreshold', Number(e.target.value))}
                  />
                  <p className="text-sm text-muted-foreground">Percentage of members required to approve withdrawals</p>
                </div>
                
                <div className="space-y-2">
                  <Label>Privacy</Label>
                  <RadioGroup 
                    defaultValue={formData.privacy}
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
                    defaultValue={formData.memberRoles}
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
                
                {/* New section for BVN input */}
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
          )}
        </Card>
      </main>
      
      <MobileNav />
    </div>
  );
};

export default CreateGroup;
