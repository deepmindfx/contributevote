
import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ScheduleStepProps {
  formData: any;
  handleChange: (field: string, value: any) => void;
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  validationErrors: any;
}

const ScheduleStep = ({ 
  formData, 
  handleChange, 
  goToNextStep, 
  goToPreviousStep, 
  validationErrors 
}: ScheduleStepProps) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-center mb-2">Schedule & Amount</h2>
        <p className="text-muted-foreground text-center">Set your contribution schedule and amount</p>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="frequency">Contribution Frequency</Label>
          <Select value={formData.frequency} onValueChange={(value) => handleChange('frequency', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select frequency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="one-time">One-time</SelectItem>
            </SelectContent>
          </Select>
          {validationErrors.frequency && (
            <p className="text-red-500 text-sm mt-1">{validationErrors.frequency}</p>
          )}
        </div>

        <div>
          <Label htmlFor="contributionAmount">Individual Contribution Amount (₦)</Label>
          <Input
            id="contributionAmount"
            type="number"
            value={formData.contributionAmount}
            onChange={(e) => handleChange('contributionAmount', parseFloat(e.target.value))}
            placeholder="Enter contribution amount"
          />
          {validationErrors.contributionAmount && (
            <p className="text-red-500 text-sm mt-1">{validationErrors.contributionAmount}</p>
          )}
        </div>

        <div>
          <Label htmlFor="startDate">Start Date</Label>
          <Input
            id="startDate"
            type="date"
            value={formData.startDate}
            onChange={(e) => handleChange('startDate', e.target.value)}
          />
          {validationErrors.startDate && (
            <p className="text-red-500 text-sm mt-1">{validationErrors.startDate}</p>
          )}
        </div>
      </div>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={goToPreviousStep}>
          Previous
        </Button>
        <Button type="button" onClick={goToNextStep}>
          Next
        </Button>
      </div>
    </div>
  );
};

export default ScheduleStep;
