import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useApp } from "@/contexts/AppContext";
import { CalendarIcon, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import Header from "@/components/layout/Header";
import { createGroupReservedAccount } from "@/services/groupAccounts";

const CreateGroup = () => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [category, setCategory] = useState("General");
  const [frequency, setFrequency] = useState("one-time");
  const [contributionAmount, setContributionAmount] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [threshold, setThreshold] = useState("50");
  const [privacy, setPrivacy] = useState("public");
  const [memberRoles, setMemberRoles] = useState("equal");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { createNewContribution, user, contributions, refreshData, isAuthenticated } = useApp();
  const navigate = useNavigate();
  
  // Update the handleSubmit function to create a reserved account after group creation
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isAuthenticated) {
      toast.error("Please log in to create a group");
      navigate("/auth");
      return;
    }
    
    if (isSubmitting) {
      return;
    }
    
    setIsSubmitting(true);
    setStep(3); // Show loading state
    
    try {
      // Validate inputs
      if (!name || !description || !targetAmount) {
        toast.error("Please fill in all required fields");
        setIsSubmitting(false);
        setStep(2);
        return;
      }
      
      // Create the contribution group
      createNewContribution({
        name,
        description,
        targetAmount: Number(targetAmount),
        category,
        frequency,
        contributionAmount: Number(contributionAmount),
        startDate,
        endDate,
        votingThreshold: Number(threshold),
        privacy,
        memberRoles,
        creatorId: user.id
      });
      
      // Wait briefly to ensure the contribution is saved
      setTimeout(async () => {
        // Get the newly created contribution
        refreshData();
        const newContribution = contributions.find(c => 
          c.name === name && 
          c.creatorId === user.id &&
          new Date(c.createdAt).getTime() > Date.now() - 60000
        );
        
        if (newContribution) {
          // Create a reserved account for the contribution
          toast.info("Creating dedicated account for the group...");
          const accountResult = await createGroupReservedAccount(newContribution.id);
          
          if (accountResult) {
            toast.success(`Group created with account number: ${accountResult.accountNumber}`);
          }
          
          navigate(`/groups/${newContribution.id}`);
        } else {
          navigate("/dashboard");
        }
        
        setIsSubmitting(false);
      }, 1000);
    } catch (error) {
      console.error("Error creating group:", error);
      toast.error("Failed to create group");
      setIsSubmitting(false);
      setStep(2); // Go back to form
    }
  };
  
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container max-w-2xl mx-auto py-12 px-4">
        <Card className="glass-card">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">Create a Contribution Group</CardTitle>
            <CardDescription>
              {step === 1 && "Tell us about your group"}
              {step === 2 && "Set up contribution details"}
              {step === 3 && "Creating your group..."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {step === 1 && (
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Group Name</Label>
                  <Input
                    id="name"
                    placeholder="My Awesome Group"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    placeholder="A group for awesome people"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="targetAmount">Target Amount</Label>
                  <Input
                    id="targetAmount"
                    type="number"
                    placeholder="100000"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="General">General</SelectItem>
                      <SelectItem value="Education">Education</SelectItem>
                      <SelectItem value="Health">Health</SelectItem>
                      <SelectItem value="Business">Business</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            {step === 2 && (
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Contribution Frequency</Label>
                  <RadioGroup defaultValue="one-time" className="flex">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="daily" id="daily" onClick={() => setFrequency("daily")} />
                      <Label htmlFor="daily">Daily</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="weekly" id="weekly" onClick={() => setFrequency("weekly")} />
                      <Label htmlFor="weekly">Weekly</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="monthly" id="monthly" onClick={() => setFrequency("monthly")} />
                      <Label htmlFor="monthly">Monthly</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="one-time" id="one-time" onClick={() => setFrequency("one-time")} />
                      <Label htmlFor="one-time">One-time</Label>
                    </div>
                  </RadioGroup>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="contributionAmount">Contribution Amount</Label>
                  <Input
                    id="contributionAmount"
                    type="number"
                    placeholder="1000"
                    value={contributionAmount}
                    onChange={(e) => setContributionAmount(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-[240px] justify-start text-left font-normal",
                            !startDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="center" side="bottom">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={setStartDate}
                          disabled={endDate ? (date) => date > endDate : undefined}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="grid gap-2">
                    <Label>End Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-[240px] justify-start text-left font-normal",
                            !endDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="center" side="bottom">
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={setEndDate}
                          disabled={startDate ? (date) => date < startDate : undefined}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Voting Threshold (%)</Label>
                  <Select value={threshold} onValueChange={setThreshold}>
                    <SelectTrigger>
                      <SelectValue placeholder="50" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30%</SelectItem>
                      <SelectItem value="50">50%</SelectItem>
                      <SelectItem value="70">70%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Privacy</Label>
                  <RadioGroup defaultValue="public" className="flex">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="public" id="public" onClick={() => setPrivacy("public")} />
                      <Label htmlFor="public">Public</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="private" id="private" onClick={() => setPrivacy("private")} />
                      <Label htmlFor="private">Private</Label>
                    </div>
                  </RadioGroup>
                </div>
                <div className="grid gap-2">
                  <Label>Member Roles</Label>
                  <RadioGroup defaultValue="equal" className="flex">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="equal" id="equal" onClick={() => setMemberRoles("equal")} />
                      <Label htmlFor="equal">Equal</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="weighted" id="weighted" onClick={() => setMemberRoles("weighted")} />
                      <Label htmlFor="weighted">Weighted</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            {step === 2 && (
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            )}
            {step === 1 && (
              <Button onClick={() => setStep(2)} disabled={!name || !description || !targetAmount}>
                Next
              </Button>
            )}
            {step === 2 && (
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <span className="animate-spin mr-2 h-4 w-4 border-t-2 border-b-2 border-current rounded-full"></span>
                    Creating...
                  </>
                ) : (
                  "Create Group"
                )}
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default CreateGroup;
