
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { Building2, ShieldCheck, Users2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createContributionAccount } from "@/services/walletIntegration";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";

const CreateGroup = () => {
  const navigate = useNavigate();
  const { createNewContribution, user } = useApp();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    targetAmount: 1000,
    startDate: new Date(),
    endDate: undefined,
    frequency: "weekly" as "daily" | "weekly" | "monthly", // Type assertion to fix the type error
    privacy: "public",
    accountNumber: "",
    accountName: "",
    bankName: "",
    accountReference: "",
    accountDetails: null,
    votingThreshold: 70,
  });
  const [isGroupAccountDialogOpen, setIsGroupAccountDialogOpen] = useState(false);
  const [groupAccountLoading, setGroupAccountLoading] = useState(false);
  const [isTermsChecked, setIsTermsChecked] = useState(false);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSelectChange = (name: string, value: string) => {
    if (name === 'frequency') {
      // Ensure frequency is always one of the accepted values
      setFormData(prev => ({ 
        ...prev, 
        [name]: value as "daily" | "weekly" | "monthly" 
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };
  
  const handleDateChange = (date: DateRange | undefined) => {
    setFormData(prev => ({ ...prev, startDate: date?.from, endDate: date?.to }));
  };
  
  const handleSubmit = () => {
    if (!isTermsChecked) {
      toast.error("Please accept the terms and conditions");
      return;
    }
    
    // Validate form data
    if (!formData.name || !formData.targetAmount || !formData.startDate || !formData.frequency || !formData.privacy) {
      toast.error("Please fill in all required fields");
      return;
    }
    
    // Convert targetAmount to a number
    const targetAmount = Number(formData.targetAmount);
    
    // Create new contribution
    createNewContribution({
      name: formData.name,
      description: formData.description,
      targetAmount: targetAmount,
      startDate: formData.startDate.toISOString(),
      endDate: formData.endDate?.toISOString(),
      frequency: formData.frequency,
      status: 'active',
      creatorId: user.id,
      privacy: formData.privacy,
      accountNumber: formData.accountNumber,
      accountName: formData.accountName,
      bankName: formData.bankName,
      accountReference: formData.accountReference,
      accountDetails: formData.accountDetails,
      votingThreshold: formData.votingThreshold,
    });
    
    // Redirect to dashboard
    navigate("/dashboard");
  };
  
  const handleAccountCreation = async () => {
    setIsGroupAccountDialogOpen(false);
    setGroupAccountLoading(true);
    
    try {
      const response = await createContributionAccount(formData.name);
      
      handleAccountCreationResponse(response);
    } catch (error: any) {
      setGroupAccountLoading(false);
      toast.error(error?.message || "Failed to create account for the group");
    }
  };
  
  const handleAccountCreationResponse = (response: any) => {
    if (response && response.success) {
      // Successfully created account
      setGroupAccountLoading(false);
      toast.success("Account created for the group");
      
      // Store account details in form data
      setFormData(prev => ({
        ...prev,
        accountNumber: response.accountNumber || '',
        bankName: response.bankName || '',
        accountReference: response.accountReference || '',
        accountDetails: response
      }));
      
      // Proceed to next step
      setCurrentStep(3);
    } else {
      // Failed to create account
      setGroupAccountLoading(false);
      toast.error(response.message || "Failed to create account for the group");
    }
  };
  
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Group Name</Label>
              <Input id="name" name="name" value={formData.name} onChange={handleInputChange} placeholder="e.g. My Savings Group" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" name="description" value={formData.description} onChange={handleInputChange} placeholder="e.g. A group for saving towards a common goal" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="targetAmount">Target Amount</Label>
              <Input id="targetAmount" type="number" name="targetAmount" value={formData.targetAmount} onChange={handleInputChange} placeholder="e.g. 10000" />
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Start & End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-[240px] justify-start text-left font-normal",
                      !formData.startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.startDate ? (
                      formData.endDate ? (
                        `${format(formData.startDate, "MMM dd, yyyy")} - ${format(formData.endDate, "MMM dd, yyyy")}`
                      ) : (
                        format(formData.startDate, "MMM dd, yyyy")
                      )
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="center" side="bottom">
                  <Calendar
                    mode="range"
                    defaultMonth={formData.startDate}
                    selected={{ from: formData.startDate, to: formData.endDate }}
                    onSelect={handleDateChange}
                    numberOfMonths={2}
                    disabled={(date) =>
                      date < new Date()
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label htmlFor="frequency">Frequency</Label>
              <Select onValueChange={(value) => handleSelectChange("frequency", value)}>
                <SelectTrigger className="w-[240px]">
                  <SelectValue placeholder="Select a frequency" defaultValue={formData.frequency} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="privacy">Privacy</Label>
              <Select onValueChange={(value) => handleSelectChange("privacy", value)}>
                <SelectTrigger className="w-[240px]">
                  <SelectValue placeholder="Select privacy" defaultValue={formData.privacy} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="votingThreshold">Voting Threshold (%)</Label>
              <Input
                id="votingThreshold"
                type="number"
                name="votingThreshold"
                value={formData.votingThreshold}
                onChange={handleInputChange}
                placeholder="e.g. 70"
                min="50"
                max="100"
              />
              <p className="text-sm text-muted-foreground">
                The percentage of votes required to approve a withdrawal request.
              </p>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-4">
            {formData.accountNumber ? (
              <div className="rounded-md border p-4">
                <div className="flex items-center space-x-4">
                  <Building2 className="h-5 w-5 text-gray-500" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">{formData.bankName}</p>
                    <p className="text-sm text-gray-500">Account Number: {formData.accountNumber}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-md border p-4">
                <div className="flex items-center space-x-4">
                  <ShieldCheck className="h-5 w-5 text-gray-500" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">Secure Account Creation</p>
                    <p className="text-sm text-gray-500">We will create a secure account for your group.</p>
                  </div>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="terms">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="terms" 
                    checked={isTermsChecked} 
                    onCheckedChange={(checked) => setIsTermsChecked(checked === true)}
                  />
                  <span className="text-sm">I agree to the <a href="#" className="text-blue-500">terms and conditions</a></span>
                </div>
              </Label>
            </div>
          </div>
        );
      default:
        return null;
    }
  };
  
  const stepTitles = [
    "Group Details",
    "Preferences",
    "Confirmation",
  ];
  
  const progress = (currentStep - 1) * 50;

  return (
    <div className="container relative">
      <div className="absolute top-0 left-0 w-full h-2 bg-gray-200 rounded-full dark:bg-gray-700">
        <Progress className="h-2 rounded-full" value={progress} />
      </div>
      
      <div className="flex justify-center items-start h-screen pt-20">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>{stepTitles[currentStep - 1]}</CardTitle>
            <CardDescription>
              {currentStep === 1 && "Enter the details of your contribution group."}
              {currentStep === 2 && "Set your group preferences."}
              {currentStep === 3 && "Confirm your group details."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {renderStepContent()}
          </CardContent>
          <div className="flex justify-between p-6">
            {currentStep > 1 ? (
              <Button variant="outline" onClick={() => setCurrentStep(currentStep - 1)}>
                Previous
              </Button>
            ) : (
              <div></div>
            )}
            {currentStep < 3 ? (
              <Button onClick={() => {
                if (currentStep === 2 && !formData.accountNumber) {
                  setIsGroupAccountDialogOpen(true);
                } else {
                  setCurrentStep(currentStep + 1);
                }
              }}
              >
                Next
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={groupAccountLoading}>
                Create Group
              </Button>
            )}
          </div>
        </Card>
      </div>
      
      <Dialog open={isGroupAccountDialogOpen} onOpenChange={setIsGroupAccountDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Group Account</DialogTitle>
            <DialogDescription>
              To receive contributions, you need to create a group account.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Group Name
              </Label>
              <Input type="text" id="name" value={formData.name} readOnly className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                Email
              </Label>
              <Input type="email" id="email" value={user.email} readOnly className="col-span-3" />
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsGroupAccountDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAccountCreation} disabled={groupAccountLoading}>
              {groupAccountLoading ? "Creating..." : "Create Account"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CreateGroup;
