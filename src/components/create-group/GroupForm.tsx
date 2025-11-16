import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { createGroupVirtualAccount } from "@/services/flutterwave/virtualAccounts";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { useSupabaseContribution } from "@/contexts/SupabaseContributionContext";
import { createGroupWithFee } from '@/services/supabase/groupEnhancementService';

// Import Step Components
import DetailsStep from "./DetailsStep";
import ScheduleStep from "./ScheduleStep";
import SettingsStep from "./SettingsStep";
import StepIndicator from "./StepIndicator";

// Define visibility type to fix TypeScript error
type VisibilityType = "public" | "private" | "invite-only";

const GroupForm = () => {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useSupabaseUser();
  const { createNewContribution } = useSupabaseContribution();
  
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
    // Fields for account creation
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
      // Use the new service that handles fee deduction
      const result = await createGroupWithFee(user.id, {
        name: formData.name,
        description: formData.description,
        target_amount: Number(formData.targetAmount),
        category: formData.category,
        frequency: formData.frequency,
        privacy: formData.privacy,
        contribution_amount: Number(formData.contributionAmount),
        start_date: formData.startDate,
        end_date: formData.endDate || undefined,
        voting_threshold: formData.votingThreshold,
        bvn: formData.bvn,
      });
      
      if (result.success) {
        toast.success(result.message);
        
        // Small delay to ensure data is synced
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Navigate to dashboard
        navigate("/dashboard");
      } else {
        toast.error(result.error || "Failed to create group");
      }
    } catch (error) {
      console.error("Error creating group:", error);
      toast.error(`Failed to create group: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Render the appropriate step
  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <DetailsStep 
            formData={formData} 
            handleChange={handleChange} 
            goToNextStep={goToNextStep} 
          />
        );
      case 2:
        return (
          <ScheduleStep 
            formData={formData} 
            handleChange={handleChange} 
            goToNextStep={goToNextStep} 
            goToPreviousStep={goToPreviousStep} 
          />
        );
      case 3:
        return (
          <SettingsStep 
            formData={formData} 
            handleChange={handleChange} 
            handleCreateGroup={handleCreateGroup} 
            goToPreviousStep={goToPreviousStep} 
            isLoading={isLoading}
            validationErrors={validationErrors}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Card className="shadow-none border-0 p-6">
      <StepIndicator current={step} totalSteps={3} />
      {renderStep()}
    </Card>
  );
};

export default GroupForm;
