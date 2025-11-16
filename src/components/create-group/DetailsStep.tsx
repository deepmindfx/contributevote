
import React, { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  CATEGORIES, 
  checkGroupCreationEligibility 
} from '@/services/supabase/groupEnhancementService';
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";

interface DetailsStepProps {
  formData: {
    name: string;
    description: string;
    targetAmount: number;
    category: string;
  };
  handleChange: (field: string, value: any) => void;
  goToNextStep: () => void;
}

const DetailsStep = ({ formData, handleChange, goToNextStep }: DetailsStepProps) => {
  const { user } = useSupabaseUser();
  const [eligibility, setEligibility] = useState<any>(null);
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);

  useEffect(() => {
    if (user?.id) {
      checkEligibility();
    }
  }, [user]);

  const checkEligibility = async () => {
    setIsCheckingEligibility(true);
    try {
      const result = await checkGroupCreationEligibility(user.id);
      setEligibility(result);
    } catch (error) {
      console.error('Error checking eligibility:', error);
    } finally {
      setIsCheckingEligibility(false);
    }
  };

  return (
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
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.icon} {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Fee Warning */}
        {!isCheckingEligibility && eligibility && !eligibility.can_create_free && (
          <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950">
            <AlertDescription className="text-orange-800 dark:text-orange-200">
              ⚠️ Group creation fee: ₦500 (You've used all 3 free groups)
            </AlertDescription>
          </Alert>
        )}
        
        {isCheckingEligibility && (
          <Alert>
            <AlertDescription>
              Checking eligibility...
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={goToNextStep} className="w-full">
          Continue
        </Button>
      </CardFooter>
    </>
  );
};

export default DetailsStep;
