
import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ScheduleStepProps {
  formData: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'one-time';
    contributionAmount: number;
    startDate: string;
    endDate: string;
  };
  handleChange: (field: string, value: any) => void;
  goToNextStep: () => void;
  goToPreviousStep: () => void;
}

const ScheduleStep = ({ formData, handleChange, goToNextStep, goToPreviousStep }: ScheduleStepProps) => {
  return (
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
      <CardFooter className="flex gap-3">
        <Button 
          onClick={goToPreviousStep} 
          variant="outline" 
          className="flex-1"
        >
          Previous
        </Button>
        <Button onClick={goToNextStep} className="flex-1">
          Continue
        </Button>
      </CardFooter>
    </>
  );
};

export default ScheduleStep;
