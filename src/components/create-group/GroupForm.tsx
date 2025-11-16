import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { createGroupVirtualAccount } from "@/services/flutterwave/virtualAccounts";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { useSupabaseContribution } from "@/contexts/SupabaseContributionContext";
import { createGroupWithFee, checkGroupCreationEligibility } from '@/services/supabase/groupEnhancementService';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const [showFeeConfirmation, setShowFeeConfirmation] = useState(false);
  const [eligibility, setEligibility] = useState<any>(null);
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
    votingThreshold: 60, // Default: 60% approval (fixed, not user-configurable)
    privacy: 'private' as 'public' | 'private',
    memberRoles: 'equal' as 'equal' | 'weighted', // Default: equal (fixed, not user-configurable)
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

  // Check eligibility on mount
  useEffect(() => {
    if (user?.id) {
      checkEligibility();
    }
  }, [user]);

  const checkEligibility = async () => {
    try {
      const result = await checkGroupCreationEligibility(user.id);
      setEligibility(result);
    } catch (error) {
      console.error('Error checking eligibility:', error);
    }
  };

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

    // Check if fee is required and show confirmation
    if (eligibility && !eligibility.can_create_free) {
      setShowFeeConfirmation(true);
      return;
    }

    // Proceed with creation
    await createGroup();
  };

  const createGroup = async () => {
    setIsLoading(true);
    
    try {
      // Use the new service that handles fee deduction
      await createGroupWithFee(user.id, {
        name: formData.name,
        description: formData.description,
        target_amount: Number(formData.targetAmount),
        category: formData.category,
        frequency: formData.frequency,
        privacy: formData.privacy,
      });
      
      toast.success("Group created successfully!");
      
      // Small delay to ensure data is synced
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Navigate to dashboard
      navigate("/dashboard");
    } catch (error) {
      console.error("Error creating group:", error);
      toast.error(`Failed to create group: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsLoading(false);
      setShowFeeConfirmation(false);
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
    <>
      <Card className="shadow-none border-0 p-6">
        <StepIndicator current={step} totalSteps={3} />
        {renderStep()}
      </Card>

      {/* Fee Confirmation Dialog */}
      <AlertDialog open={showFeeConfirmation} onOpenChange={setShowFeeConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Group Creation Fee</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                You've used all 3 free group creations. Creating this group will cost <strong className="text-orange-600">₦500</strong>.
              </p>
              <p className="text-sm">
                This fee will be deducted from your wallet balance.
              </p>
              <div className="bg-muted p-3 rounded-md text-sm">
                <p className="font-medium mb-1">What you get:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Dedicated bank account for the group</li>
                  <li>Full admin controls</li>
                  <li>Unlimited members</li>
                  <li>Voting and governance features</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={createGroup}
              disabled={isLoading}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isLoading ? "Creating..." : "Pay ₦500 & Create Group"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default GroupForm;
