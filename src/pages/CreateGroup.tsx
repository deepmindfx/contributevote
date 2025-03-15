
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
import { toast } from "sonner";

const CreateGroup = () => {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const goToNextStep = () => {
    window.scrollTo(0, 0);
    setStep(step + 1);
  };

  const goToPreviousStep = () => {
    window.scrollTo(0, 0);
    setStep(step - 1);
  };

  const handleCreateGroup = () => {
    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      toast.success("Group created successfully!");
      navigate("/dashboard");
    }, 1500);
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
                  <Input id="name" placeholder="E.g., Wedding Fund, Business Launch" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" placeholder="Describe the purpose of this group" rows={4} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target">Target Amount</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-muted-foreground">₦</span>
                    <Input id="target" type="number" className="pl-8" placeholder="0.00" />
                  </div>
                  <p className="text-sm text-muted-foreground">Set a goal for your group contributions</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select defaultValue="personal">
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
                  <RadioGroup defaultValue="monthly">
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
                    <Input id="amount" type="number" className="pl-8" placeholder="0.00" />
                  </div>
                  <p className="text-sm text-muted-foreground">Amount each member contributes per period</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input id="start-date" type="date" />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="end-date">End Date (Optional)</Label>
                  <Input id="end-date" type="date" />
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
                <CardDescription>Configure how your group operates</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="voting-threshold">Voting Threshold (%)</Label>
                  <Input id="voting-threshold" type="number" min="1" max="100" defaultValue="70" />
                  <p className="text-sm text-muted-foreground">Percentage of members required to approve withdrawals</p>
                </div>
                
                <div className="space-y-2">
                  <Label>Privacy</Label>
                  <RadioGroup defaultValue="private">
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
                  <RadioGroup defaultValue="equal">
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
                      <Checkbox id="notify-contributions" />
                      <label
                        htmlFor="notify-contributions"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Contribution reminders
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="notify-votes" defaultChecked />
                      <label
                        htmlFor="notify-votes"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        New withdrawal requests
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="notify-updates" defaultChecked />
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

// Missing Checkbox component
const Checkbox = ({ id, defaultChecked }: { id: string; defaultChecked?: boolean }) => {
  const [checked, setChecked] = useState(defaultChecked || false);
  
  return (
    <div className="h-4 w-4 rounded border border-input flex items-center justify-center">
      {checked && <Check className="h-3 w-3" />}
      <input
        type="checkbox"
        id={id}
        className="absolute w-0 h-0 opacity-0"
        checked={checked}
        onChange={() => setChecked(!checked)}
      />
    </div>
  );
};

export default CreateGroup;
